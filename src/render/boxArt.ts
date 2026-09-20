import * as THREE from 'three'
import { GENRE_COLOR } from './palette'
import type { Title } from '../data/catalog'

/**
 * Box art is drawn at VHS-sleeve proportions and kept small, so the affine warp in the PS1
 * shader has visible detail to swim. 96x144 is about as far as it can go before the type gets
 * crisper than anything else in the room.
 */
const ART_WIDTH = 96
const ART_HEIGHT = 144

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

  // A sleeve, not a poster: the printed card is inset inside a clamshell border, which is the
  // single detail that makes these read as rentable tapes rather than art on a wall.
  ctx.fillStyle = '#131319'
  ctx.fillRect(0, 0, ART_WIDTH, ART_HEIGHT)

  const inset = 4
  const artW = ART_WIDTH - inset * 2
  const artH = ART_HEIGHT - inset * 2

  // Ground: a lit horizon, the house style of every direct-to-video sleeve ever printed.
  const sky = ctx.createLinearGradient(0, inset, 0, inset + artH)
  sky.addColorStop(0, `#${dark.getHexString()}`)
  sky.addColorStop(0.55, `#${genre.getHexString()}`)
  sky.addColorStop(1, '#0b0b10')
  ctx.fillStyle = sky
  ctx.fillRect(inset, inset, artW, artH)

  // A silhouette blob standing in for Whoever Is On The Cover, with a second behind it — two
  // heads at different sizes is the whole grammar of a nineties cover.
  ctx.fillStyle = 'rgba(11,11,16,0.55)'
  ctx.beginPath()
  ctx.ellipse(ART_WIDTH * 0.68, ART_HEIGHT * 0.66, 15, 21, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#0b0b10'
  ctx.beginPath()
  ctx.ellipse(ART_WIDTH * 0.42, ART_HEIGHT * 0.74, 20, 27, 0, 0, Math.PI * 2)
  ctx.fill()

  // Studio band across the top, where the distributor's name always sat.
  ctx.fillStyle = 'rgba(12,12,18,0.72)'
  ctx.fillRect(inset, inset, artW, 11)
  ctx.fillStyle = '#cfc8b4'
  ctx.font = 'bold 6px Helvetica, Arial, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('MERIDIAN HOME VIDEO', ART_WIDTH / 2, inset + 6)

  // Title block
  ctx.font = 'bold 13px Helvetica, Arial, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  const lines = wrap(ctx, title.title.toUpperCase(), artW - 6)
  lines.forEach((line, i) => {
    const y = inset + 18 + i * 14
    ctx.fillStyle = '#000000'
    ctx.fillText(line, ART_WIDTH * 0.5 + 1, y + 1)
    ctx.fillStyle = '#f5f0e0'
    ctx.fillText(line, ART_WIDTH * 0.5, y)
  })

  // Foot of the sleeve: the rating box on one side, the format mark on the other, and the
  // tagline squeezed between them in the smallest type the printer could hold.
  const footY = ART_HEIGHT - inset - 18
  ctx.fillStyle = 'rgba(8,8,12,0.8)'
  ctx.fillRect(inset, footY, artW, 18)

  ctx.fillStyle = '#e8e4d8'
  ctx.fillRect(inset + 2, footY + 4, 20, 11)
  ctx.fillStyle = '#12121a'
  ctx.font = 'bold 7px Helvetica, Arial, sans-serif'
  ctx.textBaseline = 'middle'
  ctx.fillText(title.rating, inset + 12, footY + 10)

  ctx.fillStyle = '#d8d2c0'
  ctx.font = 'bold 7px Helvetica, Arial, sans-serif'
  ctx.textAlign = 'right'
  ctx.fillText('VHS', ART_WIDTH - inset - 3, footY + 10)

  ctx.textAlign = 'center'
  ctx.font = '6px Helvetica, Arial, sans-serif'
  ctx.fillStyle = '#b9b3a2'
  const tag = title.tagline.toUpperCase()
  const squash = Math.min(1, (artW - 54) / Math.max(ctx.measureText(tag).width, 1))
  ctx.save()
  ctx.translate(ART_WIDTH / 2, footY + 10)
  ctx.scale(squash, 1)
  ctx.fillText(tag, 0, 0)
  ctx.restore()

  const texture = new THREE.CanvasTexture(canvas)
  texture.magFilter = THREE.LinearFilter
  texture.minFilter = THREE.LinearFilter
  texture.generateMipmaps = false
  texture.colorSpace = THREE.SRGBColorSpace

  cache.set(title.id, texture)
  return texture
}

export function disposeBoxArt(): void {
  for (const texture of cache.values()) texture.dispose()
  cache.clear()
}
