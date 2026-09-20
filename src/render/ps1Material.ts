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

    // (1) cancel the hardware perspective divide
    vUvW = uv * clip.w;
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

  #ifdef USE_PS1_MAP
    uniform sampler2D uMap;
  #endif

  varying vec2 vUvW;
  varying float vW;
  varying vec3 vLight;
  varying float vFogDepth;

  void main() {
    vec2 uv = vUvW / vW;

    vec4 base = vec4(uColor, uOpacity);
    #ifdef USE_PS1_MAP
      base *= texture2D(uMap, uv);
    #endif

    if (base.a < 0.5) discard;

    vec3 lit = base.rgb * vLight;

    float fog = clamp((vFogDepth - uFogNear) / (uFogFar - uFogNear), 0.0, 1.0);
    lit = mix(lit, uFogColor, fog);

    gl_FragColor = vec4(lit, base.a);
  }
`

/** Every PS1 material shares these, so the post pass and the store agree on one resolution. */
const shared = {
  resolution: new THREE.Vector2(320, 240),
  lightDir: new THREE.Vector3(0.25, 1, 0.4).normalize(),
  lightColor: new THREE.Color(0xfff4e2),
  ambient: new THREE.Color(0x7a8492),
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
}

export function createPS1Material(options: PS1MaterialOptions = {}): THREE.ShaderMaterial {
  const { color = 0xffffff, map, opacity = 1, jitter = 1, side = THREE.FrontSide, unlit = false } = options

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
      uJitter: { value: jitter },
      uLightDir: { value: shared.lightDir },
      uLightColor: { value: shared.lightColor },
      uAmbient: { value: shared.ambient },
      uFogColor: { value: new THREE.Color(FOG.color) },
      uFogNear: { value: FOG.near },
      uFogFar: { value: FOG.far },
    },
  })

  registry.add(material)
  return material
}

export function setPS1Resolution(width: number, height: number): void {
  shared.resolution.set(width, height)
}

export function disposePS1Materials(): void {
  for (const material of registry) material.dispose()
  registry.clear()
}
