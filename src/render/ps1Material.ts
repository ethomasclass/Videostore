import * as THREE from 'three'
import { FOG } from './palette'

/**
 * The three artifacts that read as "PS1" to anyone who grew up with one:
 *
 * 1. Affine texture mapping. Real hardware had no perspective divide per pixel, so textures
 *    swim across large polygons. GPUs interpolate varyings perspective-correctly, so we defeat
 *    it: pass uv premultiplied by clip w, pass w alongside, divide in the fragment stage. The
 *    hardware divide and ours cancel, leaving screen-linear (wrong, correct-looking) uvs.
 * 2. Vertex snapping. Vertices landed on integer screen positions, so geometry jitters as the
 *    camera moves. We quantize clip space to the low-res grid.
 * 3. Vertex lighting. Lighting was computed per vertex and interpolated — no specular, no
 *    per-pixel normals, everything soft and slightly wrong across big faces.
 */

const vertexShader = /* glsl */ `
  uniform vec2 uResolution;
  uniform float uJitter;
  uniform vec3 uLightDir;
  uniform vec3 uLightColor;
  uniform vec3 uAmbient;

  varying vec2 vUvW;
  varying vec2 vUvCorrect;
  varying float vW;
  varying vec3 vLight;
  varying float vFogDepth;

  void main() {
    vec4 viewPos = modelViewMatrix * vec4(position, 1.0);
    vec4 clip = projectionMatrix * viewPos;

    // (2) snap to the internal framebuffer grid
    if (uJitter > 0.0) {
      vec2 grid = uResolution * 0.5;
      vec2 snapped = floor((clip.xy / clip.w) * grid + 0.5) / grid;
      clip.xy = mix(clip.xy, snapped * clip.w, uJitter);
    }

    // (3) per-vertex wrapped lambert, no specular. A ceiling full of fluorescent troffers is
    // closer to an area light than a sun, so hard lambert leaves every shelf face black.
    // Wrapping the term keeps verticals lit and the whole room flat and overexposed — which
    // is both what the store looked like and what the hardware could afford.
    #ifdef USE_PS1_UNLIT
      vLight = vec3(1.0);
    #else
      vec3 n = normalize(normalMatrix * normal);
      float wrapped = dot(n, normalize(uLightDir)) * 0.5 + 0.5;
      vLight = uAmbient + uLightColor * wrapped * 0.9;
    #endif

    // (1) cancel the hardware perspective divide. The plain uv rides alongside so the fragment
    // stage can blend back to correct mapping when the warp is switched off.
    vUvW = uv * clip.w;
    vUvCorrect = uv;
    vW = clip.w;

    vFogDepth = -viewPos.z;
    gl_Position = clip;
  }
`

const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform vec3 uFogColor;
  uniform float uFogNear;
  uniform float uFogFar;
  uniform float uAffine;

  #ifdef USE_PS1_MAP
    uniform sampler2D uMap;
  #endif

  varying vec2 vUvW;
  varying vec2 vUvCorrect;
  varying float vW;
  varying vec3 vLight;
  varying float vFogDepth;

  void main() {
    vec2 uv = mix(vUvCorrect, vUvW / vW, uAffine);

    vec3 albedo = uColor;
    float alpha = uOpacity;

    #ifdef USE_PS1_MAP
      vec4 texel = texture2D(uMap, uv);
      // Alpha-test the texture only. Folding uOpacity into this test would make any
      // translucent surface — glass, most obviously — vanish instead of blending.
      if (texel.a < 0.5) discard;
      albedo *= texel.rgb;
    #endif

    // A fully transparent surface still writes depth, so discard it outright: that is how
    // invisible interaction hitboxes stay invisible without occluding what is behind them.
    if (alpha < 0.01) discard;

    vec3 lit = albedo * vLight;

    float fog = clamp((vFogDepth - uFogNear) / (uFogFar - uFogNear), 0.0, 1.0);
    lit = mix(lit, uFogColor, fog);

    gl_FragColor = vec4(lit, alpha);
  }
`

/** Every PS1 material shares these, so the post pass and the store agree on one resolution. */
const shared = {
  resolution: new THREE.Vector2(320, 240),
  lightDir: new THREE.Vector3(0.25, 1, 0.4).normalize(),
  lightColor: new THREE.Color(0xfff4e2),
  ambient: new THREE.Color(0x8f98a6),
  /** Global scales for the era artifacts, driven by the fidelity setting. */
  affine: 1,
  jitter: 1,
}

const registry = new Set<THREE.ShaderMaterial>()

export interface PS1MaterialOptions {
  color?: THREE.ColorRepresentation
  map?: THREE.Texture
  opacity?: number
  /** 0 disables snapping — useful for anything that must not wobble, like held props. */
  jitter?: number
  side?: THREE.Side
  /** Skips lighting entirely. Light fixtures and signage read as emissive, not shaded. */
  unlit?: boolean
  /**
   * Marks this as a surface laid on top of another one — a sign on a board, art on a case,
   * a screen in a bezel. Vertex snapping quantizes positions to the framebuffer grid, which
   * makes two near-coplanar faces swap order as the camera moves and strobe against each
   * other. A depth bias settles the argument once instead of every frame.
   */
  decal?: boolean
}

export function createPS1Material(options: PS1MaterialOptions = {}): THREE.ShaderMaterial {
  const {
    color = 0xffffff,
    map,
    opacity = 1,
    jitter = 1,
    side = THREE.FrontSide,
    unlit = false,
    decal = false,
  } = options

  const defines: Record<string, string> = {}
  if (map) defines.USE_PS1_MAP = ''
  if (unlit) defines.USE_PS1_UNLIT = ''

  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    side,
    transparent: opacity < 1,
    defines,
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: opacity },
      uMap: { value: map ?? null },
      uResolution: { value: shared.resolution },
      uJitter: { value: jitter * shared.jitter },
      uAffine: { value: shared.affine },
      uLightDir: { value: shared.lightDir },
      uLightColor: { value: shared.lightColor },
      uAmbient: { value: shared.ambient },
      uFogColor: { value: new THREE.Color(FOG.color) },
      uFogNear: { value: FOG.near },
      uFogFar: { value: FOG.far },
    },
  })

  if (decal) {
    material.polygonOffset = true
    material.polygonOffsetFactor = -2
    material.polygonOffsetUnits = -4
  }

  material.userData.authoredJitter = jitter
  registry.add(material)
  return material
}

export function setPS1Resolution(width: number, height: number): void {
  shared.resolution.set(width, height)
}

/**
 * Scales the two geometry-level artifacts across every material at once. Each is independent of
 * the framebuffer size, so turning the resolution up does not on its own make anything crisper
 * — a swimming texture stays swimming, just in more detail.
 */
export function setPS1Fidelity(options: { affine: number; jitter: number }): void {
  shared.affine = options.affine
  shared.jitter = options.jitter
  for (const material of registry) {
    const authored = (material.userData.authoredJitter as number | undefined) ?? 1
    material.uniforms.uJitter!.value = authored * options.jitter
    material.uniforms.uAffine!.value = options.affine
  }
}

export function disposePS1Materials(): void {
  for (const material of registry) material.dispose()
  registry.clear()
}
