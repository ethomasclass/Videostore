import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { createPS1Material } from '../render/ps1Material'
import { boxArtTexture } from '../render/boxArt'
import { lacklusterLogoTexture } from '../render/logoTexture'
import { posterTexture, type PosterId } from '../render/posterTexture'
import { BRAND, GENRE_COLOR, ROOM } from '../render/palette'
import { CATALOG, newReleases, type Genre, type Title } from '../data/catalog'
import { box, unlitBox, panel, place, DOORS, FRONT_SOLID_HALF, STORE, VHS } from './buildKit'
import { buildParkingLot, buildStorefront } from './exterior'

export { STORE } from './buildKit'

/** The five places work happens. Every job on the board resolves at one of them. */
export type StationKind = 'rewind' | 'returns' | 'register' | 'restock' | 'shelf'

/** Doing a job, versus picking a case up to read the back of it — different verbs entirely. */
export type Interactable =
  | { object: THREE.Object3D; label: string; kind: 'station'; station: StationKind }
  | { object: THREE.Object3D; label: string; kind: 'inspect'; title: Title }

export interface BuiltStore {
  root: THREE.Group
  colliders: THREE.Box3[]
  interactables: Interactable[]
}

/** Where the player clocks in: just inside the entrance, looking down the first aisle. */
export const SPAWN = { x: DOORS.entranceX, z: 7.2 } as const

const GONDOLA = { length: 11, depth: 0.55, height: 1.7 } as const
const TIER_Y = [0.4, 0.86, 1.32] as const

/**
 * The counter island, dead centre, open at the back so staff can step into it. It and the
 * feature wall block the middle of the floor, so the aisles have to stop well short of it —
 * otherwise there is no way to cross from the entrance to the exit without a detour.
 */
const COUNTER = { halfWidth: 3.6, frontZ: 5.2, backZ: 6.4, height: 1.05, top: 1.08 } as const

/**
 * The feature wall *is* the building's front wall across the middle bay — glazing picks up
 * again either side of it. A display wall standing in front of windows reads as a partition
 * with daylight leaking round it; as the wall itself it reads as architecture.
 */
const FEATURE_WALL_Z = STORE.maxZ - 0.12

/** Section colors for the non-film departments, kept out of the film genre palette. */
const SECTION = { games: 0x6a3d9a, music: 0x1f7a6d, bargain: 0xb03a3a } as const

/**
 * Runs are split in two with a cross aisle between them, and stop well short of both ends:
 * a shelf that reaches the back wall leaves nowhere to stand and read the New Release rack,
 * and one that reaches the counter closes off the only route between the two doors.
 */
const SHELF_SEGMENTS = [
  { centerZ: -4.6, length: 4.4 },
  { centerZ: 1.3, length: 3.4 },
] as const

interface Build {
  root: THREE.Group
  colliders: THREE.Box3[]
  interactables: Interactable[]
  addItem: (color: number, x: number, y: number, z: number, item: Item) => void
}

interface Item {
  width: number
  height: number
  depth: number
  /** 'z' runs the shelf along Z (items face ±X); 'x' runs it along X (items face ±Z). */
  axis: 'x' | 'z'
}

export function buildStore(): BuiltStore {
  const root = new THREE.Group()
  const colliders: THREE.Box3[] = []
  const interactables: Interactable[] = []

  // Every faced item in the store merges into one mesh per color, so a wall of stock costs
  // a single draw call rather than one per tape.
  const itemsByColor = new Map<number, THREE.BufferGeometry[]>()
  const addItem = (color: number, x: number, y: number, z: number, item: Item): void => {
    const geometry =
      item.axis === 'z'
        ? new THREE.BoxGeometry(item.depth, item.height, item.width)
        : new THREE.BoxGeometry(item.width, item.height, item.depth)
    geometry.translate(x, y, z)
    const list = itemsByColor.get(color)
    if (list) list.push(geometry)
    else itemsByColor.set(color, [geometry])
  }

  const build: Build = { root, colliders, interactables, addItem }

  buildShell(build)
  buildStorefront(root)
  buildParkingLot(root)
  buildFilmAisles(build)
  buildSideSections(build)
  buildPerimeterShelving(build)
  buildNewReleaseWall(build)
  buildCounter(build)
  buildPosters(build)
  buildProps(build)

  for (const [color, geometries] of itemsByColor) {
    const merged = mergeGeometries(geometries, false)
    for (const geometry of geometries) geometry.dispose()
    if (merged) root.add(new THREE.Mesh(merged, createPS1Material({ color })))
  }

  return { root, colliders, interactables }
}

function buildShell({ root, colliders }: Build): void {
  const width = STORE.maxX - STORE.minX
  const depth = STORE.maxZ - STORE.minZ
  const cx = (STORE.minX + STORE.maxX) / 2
  const cz = (STORE.minZ + STORE.maxZ) / 2

  const floor = panel(width, depth, { color: ROOM.carpet })
  floor.rotation.x = -Math.PI / 2
  floor.position.set(cx, 0, cz)
  root.add(floor)

  // Unlit: the ceiling faces away from every light in the room, so shading it correctly turns
  // the largest surface in the store black while real tile under fluorescents is the brightest.
  const ceiling = panel(width, depth, { color: ROOM.ceiling, unlit: true })
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
  wall(width, cx, STORE.minZ, 0)
  wall(depth, STORE.minX, cz, Math.PI / 2)
  wall(depth, STORE.maxX, cz, -Math.PI / 2)

  // The blue-over-yellow band running the top of every wall, tucked up under the ceiling so
  // the posters below it have room.
  const stripeY = STORE.height - 0.18
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

  const troffer = createPS1Material({ color: ROOM.light, unlit: true })
  for (let i = 0; i < 5; i += 1) {
    for (let j = 0; j < 3; j += 1) {
      const lamp = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.9), troffer)
      lamp.rotation.x = Math.PI / 2
      lamp.position.set(-9.5 + i * 4.8, STORE.height - 0.02, -6 + j * 5)
      root.add(lamp)
    }
  }
}

interface RunOptions {
  x: number
  centerZ: number
  length: number
  height: number
  tiers: readonly number[]
  item: Item
  /** One color per side, so a run can carry two departments back to back. */
  colors: readonly [number, number]
  signColor: number
  label?: string
  station?: StationKind
  /** Fraction of slots left empty, so shelves do not read as a solid painted block. */
  gaps?: number
}

/** A double-sided gondola run pointing away from the entrance, faced on both sides. */
function buildRun(build: Build, options: RunOptions): void {
  const { root, colliders, interactables, addItem } = build
  const { x, centerZ, length, height, tiers, item, colors, signColor, gaps = 0.06 } = options
  const depth = GONDOLA.depth

  const body = box(depth, height, length, ROOM.shelfBody)
  colliders.push(place(root, body, x, height / 2, centerZ))

  for (const y of tiers) {
    const board = box(depth + 0.06, 0.04, length, ROOM.shelfTrim)
    place(root, board, x, y - item.height / 2 - 0.02, centerZ)
  }

  for (const y of tiers) {
    for (const side of [-1, 1] as const) {
      const color = side === -1 ? colors[0] : colors[1]
      const count = Math.floor((length - 0.6) / item.width)
      const startZ = centerZ - (count * item.width) / 2
      for (let i = 0; i < count; i += 1) {
        if (Math.random() < gaps) continue
        addItem(color, x + side * (depth / 2 - item.depth / 2 + 0.03), y, startZ + i * item.width, item)
      }
    }
  }

  const sign = box(0.05, 0.3, 2.2, signColor)
  place(root, sign, x, height + 0.22, centerZ)

  if (options.label && options.station) {
    // Fully transparent, so the shader discards every fragment — but still raycastable,
    // which `visible = false` would not reliably be.
    const hitbox = box(depth + 0.4, height, length, 0xffffff)
    ;(hitbox.material as THREE.ShaderMaterial).uniforms.uOpacity!.value = 0
    ;(hitbox.material as THREE.ShaderMaterial).transparent = true
    hitbox.position.set(x, height / 2, centerZ)
    root.add(hitbox)
    interactables.push({ object: hitbox, label: options.label, kind: 'station', station: options.station })
  }
}

const FILM_AISLE_X = [-9.5, -6, -2.5, 1] as const

function buildFilmAisles(build: Build): void {
  const genreOrder: Genre[] = ['action', 'comedy', 'scifi', 'horror', 'family', 'drama']
  const item: Item = { width: VHS.width, height: VHS.height, depth: VHS.depth, axis: 'z' }

  FILM_AISLE_X.forEach((x, index) => {
    SHELF_SEGMENTS.forEach((segment, segmentIndex) => {
      const offset = index * 2 + segmentIndex * 4
      const left = genreOrder[offset % genreOrder.length] ?? 'action'
      const right = genreOrder[(offset + 1) % genreOrder.length] ?? 'comedy'
      buildRun(build, {
        x,
        centerZ: segment.centerZ,
        length: segment.length,
        height: GONDOLA.height,
        tiers: TIER_Y,
        item,
        colors: [GENRE_COLOR[left], GENRE_COLOR[right]],
        signColor: BRAND.blue,
        label: 'Shelve a tape',
        station: 'shelf',
      })
    })
  })

  // Aisle markers hung over each run, so the store brands itself from anywhere on the floor.
  const aisleLogo = lacklusterLogoTexture({ width: 128, height: 32, compact: true })
  for (const x of FILM_AISLE_X) {
    const marker = panel(1.5, 0.38, { map: aisleLogo, side: THREE.DoubleSide })
    marker.position.set(x, 2.5, SHELF_SEGMENTS[0].centerZ)
    marker.rotation.y = Math.PI / 2
    build.root.add(marker)
  }
}

/**
 * The departments that filled the right-hand third of a real store: games, music, a kids corner
 * on low shelving, and the previously-viewed bin everybody dug through on the way out.
 */
function buildSideSections(build: Build): void {
  for (const segment of SHELF_SEGMENTS) {
    buildRun(build, {
      x: 4.6,
      centerZ: segment.centerZ,
      length: segment.length,
      height: GONDOLA.height,
      tiers: TIER_Y,
      item: { width: 0.05, height: 0.21, depth: 0.14, axis: 'z' },
      colors: [SECTION.games, SECTION.games],
      signColor: SECTION.games,
    })

    buildRun(build, {
      x: 8,
      centerZ: segment.centerZ,
      length: segment.length,
      height: GONDOLA.height,
      tiers: TIER_Y,
      item: { width: 0.022, height: 0.14, depth: 0.14, axis: 'z' },
      colors: [SECTION.music, SECTION.music],
      signColor: SECTION.music,
      gaps: 0.04,
    })
  }

  buildBargainBin(build, 10.4, -1.6)
}

const BARGAIN_GENRES: readonly Genre[] = ['action', 'comedy', 'horror', 'scifi', 'family', 'drama']

/** Previously-viewed: an open-topped bin of loose cases, tilted every which way. */
function buildBargainBin({ root, colliders, addItem }: Build, x: number, z: number): void {
  const bin = box(2.2, 0.72, 1.4, SECTION.bargain)
  colliders.push(place(root, bin, x, 0.36, z))

  const lip = box(2.3, 0.06, 1.5, BRAND.yellow)
  place(root, lip, x, 0.75, z)

  const item: Item = { width: 0.035, height: 0.18, depth: 0.11, axis: 'x' }
  for (let row = 0; row < 3; row += 1) {
    for (let i = 0; i < 44; i += 1) {
      if (Math.random() < 0.1) continue
      const genre = BARGAIN_GENRES[i % BARGAIN_GENRES.length] ?? 'action'
      addItem(GENRE_COLOR[genre], x - 1 + i * 0.045, 0.66, z - 0.45 + row * 0.45, item)
    }
  }

  const sign = box(1.4, 0.3, 0.06, SECTION.bargain)
  place(root, sign, x, 1.15, z - 0.75)
}

/** Wall-hung stock down both side walls, which is where the overflow genres lived. */
function buildPerimeterShelving({ root, addItem }: Build): void {
  const item: Item = { width: VHS.width, height: VHS.height, depth: VHS.depth, axis: 'z' }
  // Three tiers, not four: the top row sat where the posters hang and buried them.
  const tiers = [0.55, 1.05, 1.55]

  for (const [wallX, facing, colors] of [
    [STORE.minX + 0.3, 1, [GENRE_COLOR.drama, GENRE_COLOR.family]],
    [STORE.maxX - 0.3, -1, [GENRE_COLOR.horror, GENRE_COLOR.action]],
  ] as const) {
    const backing = box(0.3, 1.9, 13, ROOM.shelfBody)
    place(root, backing, wallX - facing * 0.15, 1.05, -2)

    tiers.forEach((y, tier) => {
      const board = box(0.34, 0.04, 13, ROOM.shelfTrim)
      place(root, board, wallX, y - item.height / 2 - 0.02, -2)

      const count = Math.floor(12.4 / item.width)
      const startZ = -2 - (count * item.width) / 2
      const color = colors[tier % colors.length] ?? GENRE_COLOR.drama
      for (let i = 0; i < count; i += 1) {
        if (Math.random() < 0.08) continue
        addItem(color, wallX + facing * 0.09, y, startZ + i * item.width, item)
      }
    })
  }
}

function buildNewReleaseWall({ root, interactables }: Build): void {
  const releases = newReleases()
  const facingPool = releases.length >= 6 ? releases : [...releases, ...CATALOG.slice(0, 12)]
  // Faced almost edge to edge, the way a release wall actually looks — and it means the
  // crosshair lands on a case rather than in the gap between two of them.
  const FACING = { width: 0.38, height: 0.52, tilt: -0.28 }
  const RACK = { columns: 30, rows: 3, startX: -9.2, spacingX: 0.42, topY: 2.05, spacingY: 0.6 }
  const wallZ = STORE.minZ + 0.04

  const tags: THREE.BufferGeometry[] = []
  const hotTags: THREE.BufferGeometry[] = []

  for (let row = 0; row < RACK.rows; row += 1) {
    const y = RACK.topY - row * RACK.spacingY

    const rail = box(RACK.columns * RACK.spacingX, 0.03, 0.14, ROOM.shelfBody)
    place(root, rail, RACK.startX + ((RACK.columns - 1) * RACK.spacingX) / 2, y - FACING.height / 2, wallZ + 0.07)

    for (let column = 0; column < RACK.columns; column += 1) {
      const x = RACK.startX + column * RACK.spacingX
      const slot = row * RACK.columns + column

      const tag = new THREE.PlaneGeometry(0.2, 0.05)
      tag.translate(x, y - FACING.height / 2 - 0.06, wallZ + 0.02)
      if (slot % 5 === 2) hotTags.push(tag)
      else tags.push(tag)

      // Sold out: the tag stays, the case is gone.
      if (slot % 8 === 3) continue

      const title = facingPool[slot % facingPool.length]
      if (!title) continue
      const facing = panel(FACING.width, FACING.height, { map: boxArtTexture(title) })
      facing.rotation.x = FACING.tilt
      facing.position.set(x, y, wallZ + 0.09)
      root.add(facing)
      interactables.push({ object: facing, label: `Read ${title.title}`, kind: 'inspect', title })
    }
  }

  const mergeTags = (geometries: THREE.BufferGeometry[], color: number): void => {
    const merged = mergeGeometries(geometries, false)
    for (const geometry of geometries) geometry.dispose()
    if (merged) root.add(new THREE.Mesh(merged, createPS1Material({ color })))
  }
  mergeTags(tags, ROOM.tag)
  mergeTags(hotTags, BRAND.yellow)

  const centerX = RACK.startX + ((RACK.columns - 1) * RACK.spacingX) / 2
  const signWidth = RACK.columns * RACK.spacingX
  place(root, box(signWidth, 0.42, 0.08, BRAND.blue), centerX, 2.62, STORE.minZ + 0.1)
  place(root, box(signWidth, 0.09, 0.1, BRAND.yellow), centerX, 2.38, STORE.minZ + 0.11)
}

/**
 * A U open at the back, dead centre of the floor. Customers queue along the front bar; staff
 * step in around either wing. The feature wall closes the U from behind, so the last thing
 * anyone sees on the way out is the store's own name.
 */
function buildCounter(build: Build): void {
  const { root, colliders, interactables, addItem } = build
  const { halfWidth, frontZ, backZ, height, top } = COUNTER

  const bar = (width: number, depth: number, x: number, z: number): void => {
    colliders.push(place(root, box(width, height, depth, ROOM.counter), x, height / 2, z))
    place(root, box(width + 0.08, 0.06, depth + 0.08, ROOM.counterTop), x, top, z)
  }

  const frontDepth = 0.9
  const wingLength = backZ - frontZ
  bar(halfWidth * 2, frontDepth, 0, frontZ)
  bar(0.9, wingLength, -halfWidth + 0.45, frontZ + wingLength / 2)
  bar(0.9, wingLength, halfWidth - 0.45, frontZ + wingLength / 2)

  // Brand panel on the customer face of the front bar. Kept small: the feature wall carries a
  // full-size mark directly behind it, and two big ones at once just shout.
  const facePlate = panel(1.5, 0.66, { map: lacklusterLogoTexture() })
  facePlate.position.set(0, 0.52, frontZ - frontDepth / 2 - 0.01)
  facePlate.rotation.y = Math.PI
  root.add(facePlate)

  // --- Feature wall: the front wall across the middle bay, floor to ceiling ---
  place(root, box(FRONT_SOLID_HALF * 2, STORE.height, 0.24, BRAND.blue), 0, STORE.height / 2, FEATURE_WALL_Z)
  place(root, box(FRONT_SOLID_HALF * 2 + 0.1, 0.14, 0.3, BRAND.yellow), 0, 2.62, FEATURE_WALL_Z)

  const face = FEATURE_WALL_Z - 0.13

  const featureLogo = panel(4.2, 1.84, { map: lacklusterLogoTexture() })
  featureLogo.position.set(0, 1.92, face)
  featureLogo.rotation.y = Math.PI
  root.add(featureLogo)

  // The real tapes, kept behind the counter — the empty cases on the floor are just the sleeves.
  const tape: Item = { width: 0.03, height: 0.2, depth: 0.12, axis: 'x' }
  for (const y of [0.5, 0.82]) {
    place(root, box(7.4, 0.03, 0.2, ROOM.shelfTrim), 0, y - 0.12, face - 0.04)
    for (let i = 0; i < 110; i += 1) {
      if (Math.random() < 0.05) continue
      addItem(0x22262e, -3.6 + i * 0.066, y, face - 0.04, tape)
    }
  }

  // Two monitors playing whatever corporate sent this month.
  for (const x of [-3.6, 3.6] as const) {
    place(root, box(0.9, 0.7, 0.5, 0x2b2b31), x, 1.6, face - 0.25)
    const screen = panel(0.66, 0.5, { color: 0x6f8fb8, unlit: true })
    screen.position.set(x, 1.62, face - 0.5)
    screen.rotation.y = Math.PI
    root.add(screen)
  }

  // --- Stations, all within a step of each other inside the U ---
  const register = box(0.5, 0.35, 0.4, 0x3a3a42)
  place(root, register, -1.3, top + 0.2, frontZ)
  interactables.push({ object: register, label: 'Ring up a customer', kind: 'station', station: 'register' })

  const rewindDeck = box(0.6, 0.22, 0.45, 0x26262c)
  place(root, rewindDeck, 1.4, top + 0.13, frontZ)
  interactables.push({ object: rewindDeck, label: 'Rewind a tape', kind: 'station', station: 'rewind' })

  const returnBin = box(0.9, 0.7, 0.7, BRAND.blueDark)
  colliders.push(place(root, returnBin, -halfWidth - 0.9, 0.35, frontZ - 0.2))
  interactables.push({ object: returnBin, label: 'Check the return bin', kind: 'station', station: 'returns' })

  const crate = box(0.8, 0.5, 0.6, 0x7d6a4f)
  colliders.push(place(root, crate, -2.2, 0.25, backZ + 0.55))
  interactables.push({ object: crate, label: 'Open the shipment crate', kind: 'station', station: 'restock' })
}

/**
 * One-sheets in marquee frames. The bulbs are a single merged mesh per poster — a ring of
 * thirty little unlit boxes is free that way, and individually it would not be.
 */
function buildPosters({ root }: Build): void {
  const WIDTH = 0.68
  const HEIGHT = 1.02

  const hang = (id: PosterId, x: number, z: number, rotY: number): void => {
    const group = new THREE.Group()

    group.add(box(WIDTH + 0.22, HEIGHT + 0.22, 0.06, 0x14203f))
    const art = panel(WIDTH, HEIGHT, { map: posterTexture(id) })
    art.position.z = 0.05
    group.add(art)

    const bulbs: THREE.BufferGeometry[] = []
    const addBulb = (bx: number, by: number): void => {
      const bulb = new THREE.BoxGeometry(0.05, 0.05, 0.05)
      bulb.translate(bx, by, 0.06)
      bulbs.push(bulb)
    }
    const halfW = (WIDTH + 0.16) / 2
    const halfH = (HEIGHT + 0.16) / 2
    for (let i = 0; i < 7; i += 1) {
      const t = -halfW + (i / 6) * halfW * 2
      addBulb(t, halfH)
      addBulb(t, -halfH)
    }
    for (let i = 1; i < 9; i += 1) {
      const t = -halfH + (i / 9) * halfH * 2
      addBulb(-halfW, t)
      addBulb(halfW, t)
    }
    const merged = mergeGeometries(bulbs, false)
    for (const geometry of bulbs) geometry.dispose()
    if (merged) group.add(new THREE.Mesh(merged, createPS1Material({ color: 0xfff0b8, unlit: true })))

    group.position.set(x, 2.5, z)
    group.rotation.y = rotY
    root.add(group)
  }

  hang('hard-to-perish', STORE.minX + 0.16, -5.4, Math.PI / 2)
  hang('lizard-park', STORE.minX + 0.16, 0.4, Math.PI / 2)
  hang('shriek', STORE.maxX - 0.16, -5.4, -Math.PI / 2)
  hang('ogre-it', STORE.maxX - 0.16, 0.4, -Math.PI / 2)
}

/** The small stuff that makes a room look occupied rather than modelled. */
function buildProps(build: Build): void {
  const { root, colliders, addItem } = build

  // Impulse buys sit on the queue side of the counter, toward the exit. They must stay out of
  // the entrance sightline — anything tall there is the first thing a new player walks into.
  const candyX = 4.9
  const candyZ = 4.4
  colliders.push(place(root, box(1.8, 1.2, 0.5, ROOM.shelfBody), candyX, 0.6, candyZ))
  // Three shelves, three shapes: theatre-size candy boxes up top, bagged sweets in the middle,
  // microwave popcorn cartons along the bottom. Shape does the work that packaging would.
  const SNACK_ROWS = [
    { y: 1.06, item: { width: 0.07, height: 0.15, depth: 0.05, axis: 'x' } as Item, count: 23, step: 0.076 },
    { y: 0.78, item: { width: 0.1, height: 0.13, depth: 0.07, axis: 'x' } as Item, count: 16, step: 0.108 },
    { y: 0.5, item: { width: 0.14, height: 0.11, depth: 0.1, axis: 'x' } as Item, count: 12, step: 0.146 },
  ] as const
  const SNACK_COLORS = [
    [0xd8232a, 0xf5c518, 0x8e44ad, 0x2e8b57, 0xe8731a],
    [0x2f7fd0, 0xe4467a, 0x7ac143, 0xf5c518, 0xd8232a],
    [0xe8c547, 0xd8232a, 0xefe4c8],
  ] as const

  SNACK_ROWS.forEach((row, index) => {
    place(root, box(1.8, 0.03, 0.52, ROOM.shelfTrim), candyX, row.y - 0.09, candyZ)
    const palette = SNACK_COLORS[index] ?? SNACK_COLORS[0]
    const startX = candyX - (row.count * row.step) / 2
    for (let i = 0; i < row.count; i += 1) {
      const color = palette[(i * 3 + index) % palette.length] ?? 0xd8232a
      addItem(color, startX + i * row.step, row.y, candyZ - 0.1, row.item)
    }
  })
  place(root, box(1.9, 0.26, 0.06, BRAND.yellow), candyX, 1.35, candyZ - 0.24)

  // Drinks cooler: dark cabinet, lit glass door, rows of cans.
  const coolerX = 9.8
  const coolerZ = 5.4
  colliders.push(place(root, box(1.1, 2, 0.7, 0x2a2f36), coolerX, 1, coolerZ))
  const coolerGlass = panel(0.92, 1.5, { color: 0x9fd8e8, opacity: 0.32, unlit: true })
  coolerGlass.position.set(coolerX, 1.12, coolerZ - 0.36)
  coolerGlass.rotation.y = Math.PI
  root.add(coolerGlass)
  // Bottles up top where they fit, cans racked below — cola red, a blue, a citrus green, and
  // the clear one nobody could explain then either.
  const bottle: Item = { width: 0.085, height: 0.26, depth: 0.085, axis: 'x' }
  const can: Item = { width: 0.07, height: 0.13, depth: 0.07, axis: 'x' }
  const drinkColors = [0xd0453a, 0x2f5aa8, 0x6fbf3a, 0xe2e8ec, 0xe8871a]

  for (const [row, y] of [1.52, 1.22].entries()) {
    place(root, box(0.9, 0.02, 0.3, 0x3c424a), coolerX, y - 0.15, coolerZ - 0.2)
    for (let i = 0; i < 9; i += 1) {
      addItem(drinkColors[(i * 2 + row) % drinkColors.length] ?? 0xd0453a, coolerX - 0.34 + i * 0.086, y, coolerZ - 0.2, bottle)
    }
  }
  for (const [row, y] of [0.88, 0.62].entries()) {
    place(root, box(0.9, 0.02, 0.3, 0x3c424a), coolerX, y - 0.08, coolerZ - 0.2)
    for (let i = 0; i < 11; i += 1) {
      addItem(drinkColors[(i + row) % drinkColors.length] ?? 0xd0453a, coolerX - 0.36 + i * 0.072, y, coolerZ - 0.2, can)
    }
  }

  // A cardboard standee for whatever is big this month, angled at the entrance.
  const standeeTitle = newReleases()[0] ?? CATALOG[0]
  if (standeeTitle) {
    const standee = panel(1.1, 1.9, { map: boxArtTexture(standeeTitle), side: THREE.DoubleSide })
    standee.position.set(DOORS.entranceX + 2.6, 0.95, 6.6)
    standee.rotation.y = -0.6
    root.add(standee)
    place(root, box(1.1, 0.06, 0.5, 0x6b5b45), DOORS.entranceX + 2.6, 0.03, 6.6)
  }

  // Anti-theft pedestals inside both doors.
  for (const doorX of [DOORS.entranceX, DOORS.exitX]) {
    for (const side of [-1, 1] as const) {
      colliders.push(
        place(root, box(0.16, 1.5, 0.4, 0x30343c), doorX + side * (DOORS.halfWidth + 0.15), 0.75, STORE.maxZ - 1.5),
      )
    }
  }

  // Guide rack by the entrance, holding the free monthly magazine.
  const rackX = DOORS.entranceX - 1.9
  colliders.push(place(root, box(0.7, 1.1, 0.35, ROOM.shelfBody), rackX, 0.55, 6.9))
  for (const y of [0.72, 0.98]) {
    place(root, box(0.6, 0.02, 0.3, ROOM.tag), rackX, y, 6.82)
  }

  // Bins, because every store had one by each door and nobody ever drew them.
  for (const [x, z] of [
    [DOORS.exitX - 2.1, 6.8],
    [STORE.minX + 1.2, 6.8],
  ] as const) {
    colliders.push(place(root, box(0.5, 0.8, 0.5, 0x3a3f46), x, 0.4, z))
    place(root, box(0.56, 0.06, 0.56, ROOM.shelfTrim), x, 0.82, z)
  }

  // Floor arrows pointing the way round, in house yellow.
  for (let i = 0; i < 3; i += 1) {
    const arrow = panel(0.5, 0.5, { color: BRAND.yellowDim })
    arrow.rotation.x = -Math.PI / 2
    arrow.position.set(DOORS.entranceX + 0.4, 0.015, 6.2 - i * 1.3)
    root.add(arrow)
  }

  // A clock on the back wall, which is the joke: you keep looking at it.
  place(root, box(0.5, 0.5, 0.08, 0xe8e4d8), 10.6, 2.6, STORE.minZ + 0.1)
  place(root, unlitBox(0.4, 0.4, 0.02, 0x1b1e24), 10.6, 2.6, STORE.minZ + 0.15)
}
