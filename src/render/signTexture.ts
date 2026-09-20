import * as THREE from 'three'
import { BRAND } from './palette'

/**
 * Section signage. Every reference photo of one of these stores has the same thing running the
 * top of the walls and hanging over the gondolas: a saturated band with one short word on it in
 * a heavy condensed face. It is what tells you at a glance that a bright room full of white
 * shelving is a video store and not a pharmacy, so it is worth a texture of its own.
 */

const cache = new Map<string, THREE.CanvasTexture>()

export interface SignOptions {
  /** Band color behind the text. */
  background?: number
  /** Letter color. */
  color?: number
  /** Pixels per unit of width — the canvas is sized from the aspect so text stays square. */
  aspect?: number
  /** A thin keyline inset from the edge, as the printed signs had. */
  rule?: boolean
}

const hex = (value: number): string => `#${value.toString(16).padStart(6, '0')}`

export function signTexture(text: string, options: SignOptions = {}): THREE.CanvasTexture {
  const { background = BRAND.blue, color = 0xffffff, aspect = 6, rule = true } = options
  const key = `${text}|${background}|${color}|${aspect}|${rule}`
  const cached = cache.get(key)
  if (cached) return cached

  const height = 64
  const width = Math.max(64, Math.round(height * aspect))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2D canvas unavailable for signage')

  ctx.fillStyle = hex(background)
  ctx.fillRect(0, 0, width, height)

  if (rule) {
    ctx.strokeStyle = hex(color)
    ctx.globalAlpha = 0.55
    ctx.lineWidth = 2
    ctx.strokeRect(5, 5, width - 10, height - 10)
    ctx.globalAlpha = 1
  }

  // Condensed by squashing the transform rather than trusting a font family to exist: the
  // headless build and the browser have to agree on the result.
  const letters = text.toUpperCase()
  ctx.fillStyle = hex(color)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = 'bold 40px Helvetica, Arial, sans-serif'
  const natural = ctx.measureText(letters).width
  const target = width - 28
  const squash = Math.min(1, target / Math.max(natural, 1))
  ctx.save()
  ctx.translate(width / 2, height / 2 + 2)
  ctx.scale(squash, 1)
  ctx.fillText(letters, 0, 0)
  ctx.restore()

  const texture = new THREE.CanvasTexture(canvas)
  texture.magFilter = THREE.LinearFilter
  texture.minFilter = THREE.LinearFilter
  texture.generateMipmaps = false
  texture.colorSpace = THREE.SRGBColorSpace
  cache.set(key, texture)
  return texture
}
