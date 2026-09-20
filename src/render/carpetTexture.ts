import * as THREE from 'three'
import { ROOM } from './palette'

/**
 * Commercial carpet is flecked, and the flecks are the only reason a floor this size does not
 * read as one flat polygon. A small tile repeated across the room costs one texture.
 */
const TILE = 64

let carpet: THREE.CanvasTexture | null = null
let tile: THREE.CanvasTexture | null = null
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
      ctx.fillStyle = light ? 'rgba(186,206,232,0.34)' : 'rgba(20,38,72,0.34)'
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

/** Vinyl floor tile with a grout line, for the hard-floor strip across the front of the store. */
export function tileTexture(repeatX: number, repeatZ: number): THREE.CanvasTexture {
  if (!tile) {
    const canvas = document.createElement('canvas')
    canvas.width = TILE
    canvas.height = TILE
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('2D canvas unavailable for tile')

    ctx.fillStyle = `#${ROOM.tile.toString(16).padStart(6, '0')}`
    ctx.fillRect(0, 0, TILE, TILE)

    // Speckle, then the grout on two edges so the repeat forms a continuous grid.
    for (let i = 0; i < 260; i += 1) {
      ctx.fillStyle = i % 2 === 0 ? 'rgba(150,148,136,0.28)' : 'rgba(255,255,255,0.5)'
      ctx.fillRect(Math.floor(Math.random() * TILE), Math.floor(Math.random() * TILE), 1, 1)
    }
    ctx.fillStyle = 'rgba(120,118,106,0.55)'
    ctx.fillRect(0, 0, TILE, 2)
    ctx.fillRect(0, 0, 2, TILE)

    tile = new THREE.CanvasTexture(canvas)
    tile.magFilter = THREE.NearestFilter
    tile.minFilter = THREE.LinearFilter
    tile.generateMipmaps = false
    tile.colorSpace = THREE.SRGBColorSpace
  }

  tile.wrapS = THREE.RepeatWrapping
  tile.wrapT = THREE.RepeatWrapping
  tile.repeat.set(repeatX, repeatZ)
  return tile
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
  tile?.dispose()
  pool?.dispose()
  carpet = null
  tile = null
  pool = null
}
