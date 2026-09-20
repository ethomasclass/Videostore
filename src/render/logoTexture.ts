import * as THREE from 'three'
import { BRAND } from './palette'

/**
 * The same stub mark as `src/ui/lackluster-logo.svg`, redrawn at texture resolution.
 * The vector file is for crisp UI; this one is for surfaces in the world, where the PS1 pipeline
 * is going to chew it up anyway — so it is authored at the size it will actually be sampled at
 * rather than scaled down from artwork that assumes clean edges.
 */
const cache = new Map<string, THREE.CanvasTexture>()

const hex = (color: number): string => `#${color.toString(16).padStart(6, '0')}`

function drawStub(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const notch = h * 0.22
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(w, 0)
  ctx.lineTo(w, h / 2 - notch)
  ctx.arc(w, h / 2, notch, -Math.PI / 2, Math.PI / 2, true)
  ctx.lineTo(w, h)
  ctx.lineTo(0, h)
  ctx.lineTo(0, h / 2 + notch)
  ctx.arc(0, h / 2, notch, Math.PI / 2, -Math.PI / 2, true)
  ctx.closePath()
}

export interface LogoOptions {
  width?: number
  height?: number
  /** Drops the "VIDEO" line — for narrow surfaces like a basket panel. */
  compact?: boolean
}

export function lacklusterLogoTexture(options: LogoOptions = {}): THREE.CanvasTexture {
  const { width = 256, height = 112, compact = false } = options
  const key = `${width}x${height}:${compact ? 'compact' : 'full'}`
  const cached = cache.get(key)
  if (cached) return cached

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2D canvas unavailable for logo')

  ctx.fillStyle = hex(BRAND.yellow)
  ctx.fillRect(0, 0, width, height)

  const inset = Math.round(height * 0.11)
  ctx.save()
  ctx.translate(inset, inset)
  drawStub(ctx, width - inset * 2, height - inset * 2)
  ctx.fillStyle = hex(BRAND.blue)
  ctx.fill()
  ctx.restore()

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  if (compact) {
    ctx.fillStyle = '#efe9d8'
    ctx.font = `italic 800 ${Math.round(height * 0.42)}px sans-serif`
    ctx.fillText('LACKLUSTER', width / 2, height / 2)
  } else {
    ctx.fillStyle = '#efe9d8'
    ctx.font = `italic 800 ${Math.round(height * 0.32)}px sans-serif`
    ctx.fillText('LACKLUSTER', width / 2, height * 0.42)

    ctx.fillStyle = hex(BRAND.yellow)
    ctx.font = `italic 700 ${Math.round(height * 0.19)}px sans-serif`
    ctx.fillText('V I D E O', width / 2, height * 0.68)
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.magFilter = THREE.NearestFilter
  texture.minFilter = THREE.NearestFilter
  texture.generateMipmaps = false
  texture.colorSpace = THREE.SRGBColorSpace

  cache.set(key, texture)
  return texture
}

export function disposeLogoTextures(): void {
  for (const texture of cache.values()) texture.dispose()
  cache.clear()
}
