import * as THREE from 'three'
import { GENRE_COLOR } from './palette'
import type { Title } from '../data/catalog'

/**
 * Box art is drawn at VHS-sleeve proportions and deliberately tiny, so the affine warp in the
 * PS1 shader has visible detail to swim. Low resolution is the point — 64x96 is roughly what a
 * texture page could spare for a prop you walk past.
 */
const ART_WIDTH = 64
const ART_HEIGHT = 96

const cache = new Map<string, THREE.Texture>()

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(' ')) {
    const candidate = line ? `${line} ${word}` : word
    if (ctx.measureText(candidate).width > maxWidth && line) {
      lines.push(line)
      line = word
    } else {
      line = candidate
    }
  }
  if (line) lines.push(line)
  return lines
}

export function boxArtTexture(title: Title): THREE.Texture {
  const cached = cache.get(title.id)
  if (cached) return cached

  const canvas = document.createElement('canvas')
  canvas.width = ART_WIDTH
  canvas.height = ART_HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2D canvas unavailable for box art')

  const genre = new THREE.Color(GENRE_COLOR[title.genre])
  const dark = genre.clone().multiplyScalar(0.35)

  // Ground: a lit horizon, the house style of every direct-to-video sleeve ever printed.
  const sky = ctx.createLinearGradient(0, 0, 0, ART_HEIGHT)
  sky.addColorStop(0, `#${dark.getHexString()}`)
  sky.addColorStop(0.55, `#${genre.getHexString()}`)
  sky.addColorStop(1, '#0b0b10')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, ART_WIDTH, ART_HEIGHT)

  // A silhouette blob standing in for Whoever Is On The Cover.
  ctx.fillStyle = '#0b0b10'
  ctx.beginPath()
  ctx.ellipse(ART_WIDTH * 0.5, ART_HEIGHT * 0.72, 14, 20, 0, 0, Math.PI * 2)
  ctx.fill()

  // Title block
  ctx.font = 'bold 9px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  const lines = wrap(ctx, title.title.toUpperCase(), ART_WIDTH - 6)
  lines.forEach((line, i) => {
    const y = 5 + i * 10
    ctx.fillStyle = '#000000'
    ctx.fillText(line, ART_WIDTH * 0.5 + 1, y + 1)
    ctx.fillStyle = '#f5f0e0'
    ctx.fillText(line, ART_WIDTH * 0.5, y)
  })

  // Rating box, bottom corner, like every sleeve had.
  ctx.fillStyle = '#e8e4d8'
  ctx.fillRect(3, ART_HEIGHT - 11, 14, 8)
  ctx.fillStyle = '#12121a'
  ctx.font = 'bold 6px sans-serif'
  ctx.fillText('PG13', 10, ART_HEIGHT - 10)

  const texture = new THREE.CanvasTexture(canvas)
  texture.magFilter = THREE.NearestFilter
  texture.minFilter = THREE.NearestFilter
  texture.generateMipmaps = false
  texture.colorSpace = THREE.SRGBColorSpace

  cache.set(title.id, texture)
  return texture
}

export function disposeBoxArt(): void {
  for (const texture of cache.values()) texture.dispose()
  cache.clear()
}
