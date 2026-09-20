import * as THREE from 'three'
import { setPS1Fidelity, setPS1Resolution } from './ps1Material'

/**
 * Internal framebuffer. Everything renders here, then gets point-sampled up to the window.
 * Height is fixed so the pixels stay a constant size; width follows the window's aspect so a
 * phone in either orientation fills the screen without stretching the image.
 */
const MIN_INTERNAL_WIDTH = 200
const MAX_INTERNAL_WIDTH = 560

/**
 * The look is five separable things, and only the buffer size controls crispness. `sharp` keeps
 * every era artifact and just doubles the vertical resolution; `crisp` turns the lot off and
 * renders straight to the canvas.
 */
export type Fidelity = 'ps1' | 'sharp' | 'crisp'

export const FIDELITY_ORDER: readonly Fidelity[] = ['ps1', 'sharp', 'crisp']

/** Sharp: era artifacts intact, titles legible. The look the project settled on. */
export const DEFAULT_FIDELITY: Fidelity = 'sharp'

export const FIDELITY_LABEL: Record<Fidelity, string> = {
  ps1: 'Look: PS1 (V)',
  sharp: 'Look: Sharp (V)',
  crisp: 'Look: Crisp (V)',
}

const FIDELITY_SETTINGS: Record<Fidelity, { height: number; affine: number; jitter: number; dither: number }> = {
  ps1: { height: 240, affine: 1, jitter: 1, dither: 1 },
  sharp: { height: 480, affine: 1, jitter: 1, dither: 1 },
  crisp: { height: 0, affine: 0, jitter: 0, dither: 0 },
}

const postVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`

/**
 * Crushes the framebuffer to 15-bit color with an ordered 4x4 dither, the way the console's
 * output stage did. Without the dither, big gradients band hard; with it, they shimmer.
 */
const postFragment = /* glsl */ `
  uniform sampler2D uScene;
  uniform vec2 uInternal;
  varying vec2 vUv;

  const mat4 BAYER = mat4(
     0.0,  8.0,  2.0, 10.0,
    12.0,  4.0, 14.0,  6.0,
     3.0, 11.0,  1.0,  9.0,
    15.0,  7.0, 13.0,  5.0
  );

  float bayer(vec2 pixel) {
    int x = int(mod(pixel.x, 4.0));
    int y = int(mod(pixel.y, 4.0));
    // GLSL ES 1.0 forbids dynamic matrix indexing, so branch it out
    vec4 row = x == 0 ? BAYER[0] : x == 1 ? BAYER[1] : x == 2 ? BAYER[2] : BAYER[3];
    float v = y == 0 ? row[0] : y == 1 ? row[1] : y == 2 ? row[2] : row[3];
    return v / 16.0 - 0.5;
  }

  uniform float uDither;

  void main() {
    vec3 c = texture2D(uScene, vUv).rgb;
    if (uDither < 0.5) {
      gl_FragColor = vec4(c, 1.0);
      return;
    }
    float d = bayer(vUv * uInternal) / 32.0;
    // 5 bits per channel
    gl_FragColor = vec4(floor((c + d) * 31.0 + 0.5) / 31.0, 1.0);
  }
`

export class Renderer {
  readonly renderer: THREE.WebGLRenderer
  private readonly target: THREE.WebGLRenderTarget
  private readonly postScene: THREE.Scene
  private readonly postCamera: THREE.Camera
  private readonly postMaterial: THREE.ShaderMaterial
  private internalWidth = 640
  private internalHeight = 480
  private fidelity: Fidelity = DEFAULT_FIDELITY

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(1)

    this.target = new THREE.WebGLRenderTarget(this.internalWidth, this.internalHeight, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      depthBuffer: true,
      generateMipmaps: false,
    })

    this.postMaterial = new THREE.ShaderMaterial({
      vertexShader: postVertex,
      fragmentShader: postFragment,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uScene: { value: this.target.texture },
        uInternal: { value: new THREE.Vector2(this.internalWidth, 240) },
        uDither: { value: 1 },
      },
    })

    this.postScene = new THREE.Scene()
    this.postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.postMaterial))
    this.postCamera = new THREE.Camera()

    this.resize()
  }

  /** Returns the new aspect so the caller can keep its camera in step. */
  resize(): number {
    // Measured from the canvas, not the window: when the page is embedded or padded, the two
    // differ and sizing to the window leaves the view offset from what the player sees.
    const canvas = this.renderer.domElement
    const width = Math.max(canvas.clientWidth, 1)
    const height = Math.max(canvas.clientHeight, 1)
    this.renderer.setSize(width, height, false)

    const setting = FIDELITY_SETTINGS[this.fidelity]
    const canvasAspect = width / height

    if (setting.height === 0) {
      this.internalWidth = width
      this.internalHeight = height
    } else {
      const scale = setting.height / 240
      this.internalHeight = setting.height
      // Width follows the aspect so a phone in either orientation fills the screen unstretched.
      this.internalWidth = Math.round(
        THREE.MathUtils.clamp(
          setting.height * canvasAspect,
          MIN_INTERNAL_WIDTH * scale,
          MAX_INTERNAL_WIDTH * scale,
        ),
      )
      this.target.setSize(this.internalWidth, this.internalHeight)
      this.postMaterial.uniforms.uInternal?.value.set(this.internalWidth, this.internalHeight)
    }

    setPS1Resolution(this.internalWidth, this.internalHeight)
    return this.aspect
  }

  setFidelity(fidelity: Fidelity): number {
    this.fidelity = fidelity
    const setting = FIDELITY_SETTINGS[fidelity]
    setPS1Fidelity({ affine: setting.affine, jitter: setting.jitter })
    this.postMaterial.uniforms.uDither!.value = setting.dither
    return this.resize()
  }

  get aspect(): number {
    return this.internalWidth / this.internalHeight
  }

  render(scene: THREE.Scene, camera: THREE.Camera): void {
    // At native resolution there is nothing to upscale and no dither, so the post pass would
    // be a pure copy — render straight to the canvas instead.
    if (FIDELITY_SETTINGS[this.fidelity].height === 0) {
      this.renderer.setRenderTarget(null)
      this.renderer.render(scene, camera)
      return
    }

    this.renderer.setRenderTarget(this.target)
    this.renderer.clear()
    this.renderer.render(scene, camera)

    this.renderer.setRenderTarget(null)
    this.renderer.render(this.postScene, this.postCamera)
  }

  dispose(): void {
    this.target.dispose()
    this.postMaterial.dispose()
    this.renderer.dispose()
  }
}
