import * as THREE from 'three'
import { ROOM } from './palette'

/**
 * Commercial carpet is flecked, and the flecks are the only reason a floor this size does not
 * read as one flat polygon. A small tile repeated across the room costs one texture.
 */
const TILE = 64

let carpet: THREE.CanvasTexture | null = null
let pool: THREE.CanvasTexture | null = null

export function carpetTexture(repeatX: number, repeatZ: number): THREE.CanvasTexture {
  if (!carpet) {
    const canvas = document.createElement('canvas')
    canvas.width = TILE
    canvas.height = TILE
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('2D canvas unavailable for carpet')

    ctx.fillStyle = `#${ROOM.carpet.toString(16).padStart(6, '0')}`
    ctx.fillRect(0, 0, TILE, TILE)

    // Two fleck colours, one lighter and one darker, scattered at single-pixel size.
    for (let i = 0; i < 900; i += 1) {
      const light = i % 3 !== 0
      ctx.fillStyle = light ? 'rgba(150,168,190,0.30)' : 'rgba(18,26,40,0.38)'
      ctx.fillRect(Math.floor(Math.random() * TILE), Math.floor(Math.random() * TILE), 1, 1)
    }

    carpet = new THREE.CanvasTexture(canvas)
    carpet.magFilter = THREE.NearestFilter
    carpet.minFilter = THREE.LinearFilter
    carpet.generateMipmaps = false
    carpet.colorSpace = THREE.SRGBColorSpace
  }

  carpet.wrapS = THREE.RepeatWrapping
  carpet.wrapT = THREE.RepeatWrapping
  carpet.repeat.set(repeatX, repeatZ)
  return carpet
}

/**
 * A soft pool laid on the floor under each fixture, added on top of whatever is already there.
 * The lighting model is per-vertex and has no falloff, so without these the carpet takes one
 * flat value across the whole room and the troffers overhead light nothing.
 */
export function lightPoolTexture(): THREE.CanvasTexture {
  if (pool) return pool

  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2D canvas unavailable for light pool')

  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  // Kept weak on purpose: additive light saturates to white fast, and a pool that reaches full
  // brightness reads as a painted disc rather than as light falling on carpet.
  gradient.addColorStop(0, 'rgba(255,244,214,0.62)')
  gradient.addColorStop(0.35, 'rgba(255,240,205,0.30)')
  gradient.addColorStop(0.65, 'rgba(255,238,200,0.10)')
  gradient.addColorStop(0.85, 'rgba(255,238,200,0.03)')
  gradient.addColorStop(1, 'rgba(255,238,200,0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)

  pool = new THREE.CanvasTexture(canvas)
  pool.magFilter = THREE.LinearFilter
  pool.minFilter = THREE.LinearFilter
  pool.generateMipmaps = false
  pool.colorSpace = THREE.SRGBColorSpace
  return pool
}

export function disposeCarpetTextures(): void {
  carpet?.dispose()
  pool?.dispose()
  carpet = null
  pool = null
}
