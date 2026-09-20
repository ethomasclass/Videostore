import * as THREE from 'three'
import { GENRE_COLOR } from './palette'
import { CATALOG, type Genre } from '../data/catalog'

/**
 * A row of VHS spines, drawn once as a strip and mapped across a whole shelf face.
 *
 * The shelves used to be one little box per tape, merged by color — cheap, but a wall of stock
 * came out as a solid painted block. A real shelf reads as spines: a black clamshell sleeve, a
 * colored header, the title set small and sideways, a rental sticker near the foot. That is all
 * texture work, so one plane per tier per side replaces a hundred boxes and looks far more like
 * the thing.
 */

/** Pixels per spine. Enough for legible-ish sideways type without a huge canvas. */
const SPINE_W = 18
const SPINE_H = 108

const cache = new Map<string, THREE.CanvasTexture>()

/** Deterministic per-strip noise: the same shelf looks the same every frame and every reload. */
function rng(seed: number): () => number {
  let state = (seed * 1664525 + 1013904223) >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 0x100000000
  }
}

export interface SpineOptions {
  /** How many spines the strip carries. */
  count: number
  /** Drives the header color and which titles get printed on the sleeves. */
  genre: Genre
  seed: number
  /** Fraction of slots left as an empty gap, so a shelf is not a solid wall of tape. */
  gaps?: number
}

export function spineStripTexture({ count, genre, seed, gaps = 0.07 }: SpineOptions): THREE.CanvasTexture {
  const key = `${count}|${genre}|${seed}|${gaps}`
  const cached = cache.get(key)
  if (cached) return cached

  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, count) * SPINE_W
  canvas.height = SPINE_H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2D canvas unavailable for spines')

  // The shadowed slot behind the tapes, which is what shows through every gap.
  ctx.fillStyle = '#171a20'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  const titles = CATALOG.filter((title) => title.genre === genre)
  const header = new THREE.Color(GENRE_COLOR[genre])
  const random = rng(seed)

  for (let i = 0; i < count; i += 1) {
    if (random() < gaps) continue

    const x = i * SPINE_W
    const width = SPINE_W - 1

    // Sleeve. Black vinyl, but never exactly the same black twice in a row — a shelf of one
    // flat value is the thing this replaced.
    const shade = 0.13 + random() * 0.1
    ctx.fillStyle = `rgb(${Math.round(shade * 255)},${Math.round(shade * 252)},${Math.round(shade * 268)})`
    ctx.fillRect(x, 0, width, SPINE_H)

    // A lit edge down one side, so the eye reads a hundred separate objects.
    ctx.fillStyle = 'rgba(214,222,236,0.22)'
    ctx.fillRect(x, 0, 1, SPINE_H)

    // Header band at the top of the spine, tinted per sleeve off the genre color.
    const tint = header.clone().offsetHSL(0, 0, (random() - 0.5) * 0.18)
    ctx.fillStyle = `#${tint.getHexString()}`
    ctx.fillRect(x + 1, 3, width - 2, 16)

    // Title, set sideways and small. It reads as type rather than as words at shelf distance,
    // which is exactly how a spine reads in a real store.
    const title = titles[Math.floor(random() * titles.length)]
    if (title) {
      ctx.save()
      ctx.translate(x + width / 2 + 1, SPINE_H - 26)
      ctx.rotate(-Math.PI / 2)
      ctx.fillStyle = '#e6e2d4'
      ctx.font = 'bold 9px Helvetica, Arial, sans-serif'
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      const text = title.title.toUpperCase()
      const squash = Math.min(1, (SPINE_H - 52) / Math.max(ctx.measureText(text).width, 1))
      ctx.scale(squash, 1)
      ctx.fillText(text, 0, 0)
      ctx.restore()
    }

    // Rental sticker at the foot — the numbered barcode label every tape in the building wore.
    // Nudged up and down per sleeve: a row of them at one height reads as a painted stripe.
    const stickerY = SPINE_H - 22 + Math.floor(random() * 6)
    ctx.fillStyle = '#c9c4b2'
    ctx.fillRect(x + 2, stickerY, width - 4, 13)
    ctx.fillStyle = '#20222a'
    for (let bar = 0; bar < 5; bar += 1) {
      ctx.fillRect(x + 3 + bar * 3, stickerY + 2, random() < 0.5 ? 1 : 2, 7)
    }
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.magFilter = THREE.LinearFilter
  texture.minFilter = THREE.LinearFilter
  texture.generateMipmaps = false
  texture.colorSpace = THREE.SRGBColorSpace
  cache.set(key, texture)
  return texture
}

export function disposeSpineTextures(): void {
  for (const texture of cache.values()) texture.dispose()
  cache.clear()
}
