import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { createPS1Material } from '../render/ps1Material'
import { boxArtTexture } from '../render/boxArt'
import { BRAND, GENRE_COLOR, ROOM } from '../render/palette'
import { CATALOG, newReleases, type Genre } from '../data/catalog'

/** Store footprint, in meters. A small strip-mall unit. */
export const STORE = {
  minX: -12,
  maxX: 12,
  minZ: -9,
  maxZ: 9,
  height: 3.4,
} as const

export type InteractKind = 'rewind' | 'returns' | 'register' | 'restock' | 'shelf'

export interface Interactable {
  object: THREE.Object3D
  label: string
  kind: InteractKind
}

export interface BuiltStore {
  root: THREE.Group
  colliders: THREE.Box3[]
  interactables: Interactable[]
}

const VHS = { width: 0.028, height: 0.19, depth: 0.11 } as const
const GONDOLA = { length: 12, depth: 0.55, height: 1.7 } as const
const TIER_Y = [0.4, 0.86, 1.32] as const

function box(width: number, height: number, depth: number, color: number): THREE.Mesh {
  return new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), createPS1Material({ color }))
}

/** Places a mesh by its center and returns a collider for it. */
function place(parent: THREE.Object3D, mesh: THREE.Mesh, x: number, y: number, z: number): THREE.Box3 {
  mesh.position.set(x, y, z)
  parent.add(mesh)
  return new THREE.Box3().setFromObject(mesh)
}

export function buildStore(): BuiltStore {
  const root = new THREE.Group()
  const colliders: THREE.Box3[] = []
  const interactables: Interactable[] = []

  const width = STORE.maxX - STORE.minX
  const depth = STORE.maxZ - STORE.minZ
  const cx = (STORE.minX + STORE.maxX) / 2
  const cz = (STORE.minZ + STORE.maxZ) / 2

  // --- Shell ---
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), createPS1Material({ color: ROOM.carpet }))
  floor.rotation.x = -Math.PI / 2
  floor.position.set(cx, 0, cz)
  root.add(floor)

  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(width, depth),
    createPS1Material({ color: ROOM.ceiling, unlit: true }),
  )
  ceiling.rotation.x = Math.PI / 2
  ceiling.position.set(cx, STORE.height, cz)
  root.add(ceiling)

  const wallMaterial = createPS1Material({ color: ROOM.wall, side: THREE.DoubleSide })
  const wall = (w: number, x: number, z: number, rotY: number): void => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, STORE.height), wallMaterial)
    mesh.position.set(x, STORE.height / 2, z)
    mesh.rotation.y = rotY
    root.add(mesh)
  }
  wall(width, cx, STORE.minZ, 0) // back
  wall(depth, STORE.minX, cz, Math.PI / 2) // left
  wall(depth, STORE.maxX, cz, -Math.PI / 2) // right

  // The blue-over-yellow band running the top of every wall. Cheap geometry, and it is the
  // detail that makes the room read as branded retail rather than a plain yellow box.
  const stripeY = STORE.height - 0.55
  const stripe = (w: number, x: number, z: number, rotY: number): void => {
    const band = box(w, 0.34, 0.04, BRAND.blue)
    band.rotation.y = rotY
    place(root, band, x, stripeY, z)
    const accent = box(w, 0.1, 0.05, BRAND.yellow)
    accent.rotation.y = rotY
    place(root, accent, x, stripeY - 0.22, z)
  }
  stripe(width, cx, STORE.minZ + 0.05, 0)
  stripe(depth, STORE.minX + 0.05, cz, Math.PI / 2)
  stripe(depth, STORE.maxX - 0.05, cz, -Math.PI / 2)

  // Storefront glass: a dark pane so the room reads as interior-at-night.
  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(width, STORE.height),
    createPS1Material({ color: 0x0c111c, opacity: 0.85, side: THREE.DoubleSide }),
  )
  glass.position.set(cx, STORE.height / 2, STORE.maxZ)
  root.add(glass)

  // Walls are colliders as thin slabs, so the player cannot walk through them.
  const bound = 0.4
  colliders.push(
    new THREE.Box3(
      new THREE.Vector3(STORE.minX - bound, 0, STORE.minZ - bound),
      new THREE.Vector3(STORE.maxX + bound, STORE.height, STORE.minZ),
    ),
    new THREE.Box3(
      new THREE.Vector3(STORE.minX - bound, 0, STORE.maxZ),
      new THREE.Vector3(STORE.maxX + bound, STORE.height, STORE.maxZ + bound),
    ),
    new THREE.Box3(
      new THREE.Vector3(STORE.minX - bound, 0, STORE.minZ - bound),
      new THREE.Vector3(STORE.minX, STORE.height, STORE.maxZ + bound),
    ),
    new THREE.Box3(
      new THREE.Vector3(STORE.maxX, 0, STORE.minZ - bound),
      new THREE.Vector3(STORE.maxX + bound, STORE.height, STORE.maxZ + bound),
    ),
  )

  // --- Fluorescent troffers: unlit bright quads, the only "light source" you can see ---
  const troffer = createPS1Material({ color: ROOM.light, unlit: true })
  for (let i = 0; i < 4; i += 1) {
    for (let j = 0; j < 3; j += 1) {
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.9), troffer)
      panel.rotation.x = Math.PI / 2
      panel.position.set(-8 + i * 5.3, STORE.height - 0.02, -6 + j * 5)
      root.add(panel)
    }
  }

  // --- Gondola shelving, four double-sided runs ---
  const spinesByGenre = new Map<Genre, THREE.BufferGeometry[]>()
  const addSpine = (genre: Genre, x: number, y: number, z: number): void => {
    // Spine-out: the case's thin edge faces down the aisle, its depth points into the shelf.
    const geometry = new THREE.BoxGeometry(VHS.depth, VHS.height, VHS.width)
    geometry.translate(x, y, z)
    const list = spinesByGenre.get(genre)
    if (list) list.push(geometry)
    else spinesByGenre.set(genre, [geometry])
  }

  const genreOrder: Genre[] = ['action', 'comedy', 'scifi', 'horror', 'family', 'drama']
  // Runs point away from the entrance, so walking in puts you at the head of an aisle
  // looking down it at the New Release wall.
  const gondolaX = [-9, -5.5, -2, 1.5]
  const gondolaCenterZ = -2

  gondolaX.forEach((x, index) => {
    const body = box(GONDOLA.depth, GONDOLA.height, GONDOLA.length, ROOM.shelfBody)
    colliders.push(place(root, body, x, GONDOLA.height / 2, gondolaCenterZ))

    // Shelf boards read as dark trim lines from across the room.
    for (const y of TIER_Y) {
      const board = box(GONDOLA.depth + 0.06, 0.04, GONDOLA.length, ROOM.shelfTrim)
      place(root, board, x, y - VHS.height / 2 - 0.02, gondolaCenterZ)
    }

    // One genre per gondola side, so a genre spans a readable stretch of shelf.
    for (const y of TIER_Y) {
      for (const side of [-1, 1] as const) {
        const genre = genreOrder[(index * 2 + (side === 1 ? 1 : 0)) % genreOrder.length]
        if (!genre) continue
        const count = Math.floor((GONDOLA.length - 0.6) / VHS.width)
        const startZ = gondolaCenterZ - (count * VHS.width) / 2
        for (let i = 0; i < count; i += 1) {
          // Leave the odd gap — a fully faced shelf looks fake and removes the restock read.
          if (Math.random() < 0.06) continue
          // Sits proud of the shelf face — faced-out stock overhangs the lip, and a spine
          // flush with the body just disappears inside it.
          addSpine(genre, x + side * (GONDOLA.depth / 2 - VHS.depth / 2 + 0.03), y, startZ + i * VHS.width)
        }
      }
    }

    const sign = box(0.05, 0.28, 2.2, BRAND.blue)
    place(root, sign, x, GONDOLA.height + 0.2, gondolaCenterZ)

    // Fully transparent, so the shader discards every fragment — but still raycastable,
    // which `visible = false` would not reliably be.
    const shelfHitbox = new THREE.Mesh(
      new THREE.BoxGeometry(GONDOLA.depth + 0.4, GONDOLA.height, GONDOLA.length),
      createPS1Material({ color: 0xffffff, opacity: 0 }),
    )
    shelfHitbox.position.set(x, GONDOLA.height / 2, gondolaCenterZ)
    root.add(shelfHitbox)
    interactables.push({ object: shelfHitbox, label: 'Shelve a tape', kind: 'shelf' })
  })

  for (const [genre, geometries] of spinesByGenre) {
    const merged = mergeGeometries(geometries, false)
    for (const geometry of geometries) geometry.dispose()
    if (!merged) continue
    root.add(new THREE.Mesh(merged, createPS1Material({ color: GENRE_COLOR[genre] })))
  }

  // --- New Release wall ---
  // Faced-out on angled wire racks, not flat against the wall: cases lean back on a lip, and
  // every slot carries a paper tag. An empty slot keeps its tag, which is how "we're out of
  // that one" reads from across the store.
  const releases = newReleases()
  const facingPool = releases.length >= 6 ? releases : [...releases, ...CATALOG.slice(0, 12)]
  const FACING = { width: 0.26, height: 0.45, tilt: -0.28 }
  // Spans the full width of the aisles, so the wall is the thing you see at the end of any of them.
  const RACK = { columns: 26, rows: 3, startX: -8, spacingX: 0.42, topY: 2.05, spacingY: 0.52 }
  const wallZ = STORE.minZ + 0.04

  const tagGeometries: THREE.BufferGeometry[] = []
  const hotTagGeometries: THREE.BufferGeometry[] = []

  for (let row = 0; row < RACK.rows; row += 1) {
    const y = RACK.topY - row * RACK.spacingY

    // The wire shelf lip each row of cases rests on.
    const rail = box(RACK.columns * RACK.spacingX, 0.03, 0.14, ROOM.shelfBody)
    place(root, rail, RACK.startX + ((RACK.columns - 1) * RACK.spacingX) / 2, y - FACING.height / 2, wallZ + 0.07)

    for (let column = 0; column < RACK.columns; column += 1) {
      const x = RACK.startX + column * RACK.spacingX
      const slot = row * RACK.columns + column

      const tag = new THREE.PlaneGeometry(0.2, 0.05)
      tag.translate(x, y - FACING.height / 2 - 0.06, wallZ + 0.02)
      // Roughly every fifth slot is a yellow "just arrived" flag rather than a white tag.
      if (slot % 5 === 2) hotTagGeometries.push(tag)
      else tagGeometries.push(tag)

      // Sold out: the tag stays, the case is gone.
      if (slot % 8 === 3) continue

      const title = facingPool[slot % facingPool.length]
      if (!title) continue
      const facing = new THREE.Mesh(
        new THREE.PlaneGeometry(FACING.width, FACING.height),
        createPS1Material({ map: boxArtTexture(title) }),
      )
      facing.rotation.x = FACING.tilt
      facing.position.set(x, y, wallZ + 0.09)
      root.add(facing)
    }
  }

  const mergeInto = (geometries: THREE.BufferGeometry[], color: number): void => {
    const merged = mergeGeometries(geometries, false)
    for (const geometry of geometries) geometry.dispose()
    if (merged) root.add(new THREE.Mesh(merged, createPS1Material({ color })))
  }
  mergeInto(tagGeometries, ROOM.tag)
  mergeInto(hotTagGeometries, BRAND.yellow)

  const signCenterX = RACK.startX + ((RACK.columns - 1) * RACK.spacingX) / 2
  const signWidth = RACK.columns * RACK.spacingX
  const newReleaseSign = box(signWidth, 0.42, 0.08, BRAND.blue)
  place(root, newReleaseSign, signCenterX, 2.62, STORE.minZ + 0.1)
  const newReleaseSignAccent = box(signWidth, 0.09, 0.1, BRAND.yellow)
  place(root, newReleaseSignAccent, signCenterX, 2.38, STORE.minZ + 0.11)

  // --- Counter, right of the entrance, with the three stations of the job ---
  const counter = box(7, 1.05, 0.9, ROOM.counter)
  colliders.push(place(root, counter, 6, 0.525, 4.5))

  const counterTop = box(7.1, 0.06, 1, ROOM.counterTop)
  place(root, counterTop, 6, 1.08, 4.5)

  const register = box(0.5, 0.35, 0.4, 0x3a3a42)
  place(root, register, 8.2, 1.28, 4.5)
  interactables.push({ object: register, label: 'Ring up a customer', kind: 'register' })

  const returnBin = box(0.9, 0.7, 0.7, BRAND.blueDark)
  colliders.push(place(root, returnBin, 4, 0.35, 5.6))
  interactables.push({ object: returnBin, label: 'Check the return bin', kind: 'returns' })

  const rewindDeck = box(0.6, 0.22, 0.45, 0x26262c)
  place(root, rewindDeck, 6.2, 1.22, 4.5)
  interactables.push({ object: rewindDeck, label: 'Rewind a tape', kind: 'rewind' })

  const crate = box(0.8, 0.5, 0.6, 0x7d6a4f)
  colliders.push(place(root, crate, 9.5, 0.25, 1.5))
  interactables.push({ object: crate, label: 'Open the shipment crate', kind: 'restock' })

  // --- Shopping baskets by the door ---
  // The yellow basket is the most recognizable loose prop in the whole store, so it is worth
  // the five boxes it takes to build an open-topped one.
  const basket = (x: number, y: number, z: number): void => {
    const group = new THREE.Group()
    const size = { w: 0.42, h: 0.22, d: 0.3 }
    const shell = [
      box(size.w, 0.02, size.d, BRAND.yellow),
      box(size.w, size.h, 0.02, BRAND.yellow),
      box(size.w, size.h, 0.02, BRAND.yellow),
      box(0.02, size.h, size.d, BRAND.yellow),
      box(0.02, size.h, size.d, BRAND.yellow),
    ]
    shell[0]?.position.set(0, -size.h / 2, 0)
    shell[1]?.position.set(0, 0, -size.d / 2)
    shell[2]?.position.set(0, 0, size.d / 2)
    shell[3]?.position.set(-size.w / 2, 0, 0)
    shell[4]?.position.set(size.w / 2, 0, 0)
    for (const part of shell) if (part) group.add(part)

    // The blue wordmark panel on the long side.
    const label = box(size.w * 0.6, 0.09, 0.01, BRAND.blue)
    label.position.set(0, 0.01, size.d / 2 + 0.01)
    group.add(label)

    group.position.set(x, y, z)
    root.add(group)
  }
  basket(10.4, 0.12, 6.6)
  basket(10.4, 0.35, 6.6)
  basket(10.4, 0.58, 6.6)

  // --- Signage: the store's own name, backwards to you, facing the street ---
  const brandBar = box(6, 0.8, 0.1, BRAND.blue)
  place(root, brandBar, 0, 2.6, STORE.maxZ - 0.15)
  const brandBarAccent = box(6.3, 0.16, 0.08, BRAND.yellow)
  place(root, brandBarAccent, 0, 2.6, STORE.maxZ - 0.2)

  return { root, colliders, interactables }
}
