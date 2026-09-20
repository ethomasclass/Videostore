import * as THREE from 'three'
import ballcap from '../ui/faces/ballcap.svg'
import beard from '../ui/faces/beard.svg'
import crimped from '../ui/faces/crimped.svg'
import curtains from '../ui/faces/curtains.svg'
import moustache from '../ui/faces/moustache.svg'
import spectacles from '../ui/faces/spectacles.svg'

/**
 * Customer faces. Each is a hand-drawn SVG at 64x64 that maps onto the front of the head box —
 * a face is the cheapest thing you can give a blocky NPC that makes it read as a person, and
 * drawing them as vector art keeps the set easy to extend.
 *
 * `skin` is the flat tone the rest of the head is painted, so the sides and back of the head
 * match the face plate.
 */
export const FACES = [
  { id: 'curtains', url: curtains, skin: 0xc08a5e },
  { id: 'spectacles', url: spectacles, skin: 0xe0b48c },
  { id: 'moustache', url: moustache, skin: 0xb07a52 },
  { id: 'ballcap', url: ballcap, skin: 0x8a5a38 },
  { id: 'crimped', url: crimped, skin: 0xd8a878 },
  { id: 'beard', url: beard, skin: 0x9a6a46 },
] as const

export type FaceId = (typeof FACES)[number]['id']

const loader = new THREE.TextureLoader()
const cache = new Map<string, THREE.Texture>()

export function faceTexture(id: FaceId): THREE.Texture {
  const cached = cache.get(id)
  if (cached) return cached

  const entry = FACES.find((face) => face.id === id)
  if (!entry) throw new Error(`unknown face ${id}`)

  const texture = loader.load(entry.url)
  texture.magFilter = THREE.NearestFilter
  texture.minFilter = THREE.LinearFilter
  texture.generateMipmaps = false
  texture.colorSpace = THREE.SRGBColorSpace

  cache.set(id, texture)
  return texture
}

export function disposeFaceTextures(): void {
  for (const texture of cache.values()) texture.dispose()
  cache.clear()
}
