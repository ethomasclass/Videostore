import * as THREE from 'three'

/**
 * A 6 PM autumn sky, drawn once into a tall thin gradient. The shift opens at dusk and closes at
 * eleven, so the lot wants the last of the light rather than full dark — a flat grey backdrop
 * read as "unfinished" more than as "night".
 */
const WIDTH = 16
const HEIGHT = 256

let cached: THREE.CanvasTexture | null = null

export function duskSkyTexture(): THREE.CanvasTexture {
  if (cached) return cached

  const canvas = document.createElement('canvas')
  canvas.width = WIDTH
  canvas.height = HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2D canvas unavailable for sky')

  const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT)
  gradient.addColorStop(0, '#141d38')
  gradient.addColorStop(0.36, '#2d3f63')
  gradient.addColorStop(0.62, '#6a5e77')
  gradient.addColorStop(0.82, '#b8714a')
  gradient.addColorStop(0.95, '#e0a05a')
  gradient.addColorStop(1, '#f0c078')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, WIDTH, HEIGHT)

  // Cloud bars, darker than the band behind them and thinning toward the horizon.
  ctx.globalAlpha = 0.5
  ctx.fillStyle = '#2b2f4a'
  for (const [y, height] of [
    [128, 7],
    [150, 5],
    [170, 4],
    [188, 3],
  ] as const) {
    ctx.fillRect(0, y, WIDTH, height)
  }
  ctx.globalAlpha = 1

  const texture = new THREE.CanvasTexture(canvas)
  texture.magFilter = THREE.LinearFilter
  texture.minFilter = THREE.LinearFilter
  texture.generateMipmaps = false
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.ClampToEdgeWrapping

  cached = texture
  return texture
}

export function disposeSkyTexture(): void {
  cached?.dispose()
  cached = null
}
