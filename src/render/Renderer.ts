import * as THREE from 'three'
import { setPS1Resolution } from './ps1Material'

/**
 * Internal framebuffer. Everything renders here, then gets point-sampled up to the window.
 * Height is fixed so the pixels stay a constant size; width follows the window's aspect so a
 * phone in either orientation fills the screen without stretching the image.
 */
const INTERNAL_HEIGHT = 240
const MIN_INTERNAL_WIDTH = 200
const MAX_INTERNAL_WIDTH = 560

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

  void main() {
    vec3 c = texture2D(uScene, vUv).rgb;
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
  private internalWidth = 320

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(1)

    this.target = new THREE.WebGLRenderTarget(this.internalWidth, INTERNAL_HEIGHT, {
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
        uInternal: { value: new THREE.Vector2(this.internalWidth, INTERNAL_HEIGHT) },
      },
    })

    this.postScene = new THREE.Scene()
    this.postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.postMaterial))
    this.postCamera = new THREE.Camera()

    this.resize()
  }

  /** Returns the new aspect so the caller can keep its camera in step. */
  resize(): number {
    this.renderer.setSize(window.innerWidth, window.innerHeight, false)

    const windowAspect = window.innerWidth / Math.max(window.innerHeight, 1)
    this.internalWidth = Math.round(
      THREE.MathUtils.clamp(INTERNAL_HEIGHT * windowAspect, MIN_INTERNAL_WIDTH, MAX_INTERNAL_WIDTH),
    )

    this.target.setSize(this.internalWidth, INTERNAL_HEIGHT)
    this.postMaterial.uniforms.uInternal?.value.set(this.internalWidth, INTERNAL_HEIGHT)
    setPS1Resolution(this.internalWidth, INTERNAL_HEIGHT)

    return this.aspect
  }

  get aspect(): number {
    return this.internalWidth / INTERNAL_HEIGHT
  }

  render(scene: THREE.Scene, camera: THREE.Camera): void {
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
