import * as THREE from 'three'
import hardToPerish from '../ui/posters/hard-to-perish.svg'
import lizardPark from '../ui/posters/lizard-park.svg'
import shriek from '../ui/posters/shriek.svg'
import ogreIt from '../ui/posters/ogre-it.svg'

/**
 * One-sheets for the front-of-house displays. The art lives as SVG so it stays editable and
 * crisp for anything outside the game; the browser rasterizes it at the file's own 128x192,
 * which is already about the size a texture page would have spared for a poster you walk past.
 */
export const POSTERS = [
  { id: 'hard-to-perish', url: hardToPerish },
  { id: 'lizard-park', url: lizardPark },
  { id: 'shriek', url: shriek },
  { id: 'ogre-it', url: ogreIt },
] as const

export type PosterId = (typeof POSTERS)[number]['id']

const loader = new THREE.TextureLoader()
const cache = new Map<string, THREE.Texture>()

/**
 * Returns immediately with a texture the loader fills in asynchronously, so world building
 * stays synchronous — the poster pops in a frame or two after the store is already standing.
 */
export function posterTexture(id: PosterId): THREE.Texture {
  const cached = cache.get(id)
  if (cached) return cached

  const entry = POSTERS.find((poster) => poster.id === id)
  if (!entry) throw new Error(`unknown poster ${id}`)

  const texture = loader.load(entry.url)
  texture.magFilter = THREE.NearestFilter
  texture.minFilter = THREE.LinearFilter
  texture.generateMipmaps = false
  texture.colorSpace = THREE.SRGBColorSpace

  cache.set(id, texture)
  return texture
}

export function disposePosterTextures(): void {
  for (const texture of cache.values()) texture.dispose()
  cache.clear()
}
