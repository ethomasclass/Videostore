import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { createPS1Material } from '../render/ps1Material'
import { boxArtTexture } from '../render/boxArt'
import { lacklusterLogoTexture } from '../render/logoTexture'
import { posterTexture, type PosterId } from '../render/posterTexture'
import { BRAND, GENRE_COLOR, ROOM } from '../render/palette'
import { signTexture } from '../render/signTexture'
import { spineStripTexture } from '../render/spineTexture'
import { CATALOG, GENRE_LABEL, newReleases, type Genre, type Title } from '../data/catalog'
import { box, unlitBox, hitbox, panel, place, DOORS, FRONT_SOLID_HALF, STORE, VHS } from './buildKit'
import { buildParkingLot, buildStorefront } from './exterior'
import { carpetTexture, lightPoolTexture, tileTexture } from '../render/carpetTexture'
import { Rewinder } from './Rewinder'

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
  rewinder: Rewinder
  /** Where the camera sits, and what it looks at, when the player is on the terminal. */
  monitorView: { position: THREE.Vector3; target: THREE.Vector3 }
}

/** Where the player clocks in: just inside the entrance, looking down the first aisle. */
export const SPAWN = { x: DOORS.entranceX, z: 7.2 } as const

const GONDOLA = { length: 11, depth: 0.55, height: 1.7 } as const

/** How far a department header stands off the top of its run, on a pair of posts. */
const SIGN_RISE = 0.62
/**
 * Five tiers at a 30cm pitch. Three left half the gondola face as bare panel, which is not what
 * a stocked shelf looks like — the whole point of a wall of tape is that there is no wall left.
 */
const TIER_Y = [0.34, 0.64, 0.94, 1.24, 1.54] as const

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

/** Where carpet gives way to tile: the whole front-of-house runs on hard floor. */
const TILE_LINE_Z = 3.4

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
  rewinder: Rewinder
  monitorView: { position: THREE.Vector3; target: THREE.Vector3 }
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

  const build: Build = {
    root,
    colliders,
    interactables,
    addItem,
    rewinder: new Rewinder(),
    monitorView: { position: new THREE.Vector3(), target: new THREE.Vector3() },
  }

  buildShell(build)
  buildStorefront(root)
  buildParkingLot(root)
  buildFilmAisles(build)
  buildSideSections(build)
  buildPerimeterShelving(build)
  buildNewReleaseWall(build)
  buildCounter(build)
  buildPosters(build)
  buildBackWall(build)
  buildProps(build)

  for (const [color, geometries] of itemsByColor) {
    const merged = mergeGeometries(geometries, false)
    for (const geometry of geometries) geometry.dispose()
    if (merged) root.add(new THREE.Mesh(merged, createPS1Material({ color })))
  }

  return { root, colliders, interactables, rewinder: build.rewinder, monitorView: build.monitorView }
}

function buildShell({ root, colliders }: Build): void {
  const width = STORE.maxX - STORE.minX
  const depth = STORE.maxZ - STORE.minZ
  const cx = (STORE.minX + STORE.maxX) / 2
  const cz = (STORE.minZ + STORE.maxZ) / 2

  // Carpet through the shelving, hard tile across the front of the house where the counter is.
  // Both tessellated on purpose: affine texture error grows with polygon size, so a floor on one
  // 24x18 quad smears into streaks; at roughly a metre per quad the warp is back to a shimmer.
  const carpetDepth = TILE_LINE_Z - STORE.minZ
  const carpet = new THREE.Mesh(
    new THREE.PlaneGeometry(width, carpetDepth, width, Math.round(carpetDepth)),
    createPS1Material({ map: carpetTexture(width, carpetDepth) }),
  )
  carpet.rotation.x = -Math.PI / 2
  carpet.position.set(cx, 0, STORE.minZ + carpetDepth / 2)
  root.add(carpet)

  const tileDepth = STORE.maxZ - TILE_LINE_Z
  const tiles = new THREE.Mesh(
    new THREE.PlaneGeometry(width, tileDepth, width, Math.round(tileDepth)),
    createPS1Material({ map: tileTexture(width * 1.5, tileDepth * 1.5) }),
  )
  tiles.rotation.x = -Math.PI / 2
  tiles.position.set(cx, 0, TILE_LINE_Z + tileDepth / 2)
  root.add(tiles)

  // The metal edge strip where one meets the other.
  place(root, box(width, 0.02, 0.09, 0x9a968a), cx, 0.012, TILE_LINE_Z)

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

  // Department names printed into the band, which is how a customer navigates the room from
  // the door. Unlit, because printed signage under fluorescents is the brightest thing on a
  // wall and shading it sinks it into the mustard.
  const wallSign = (text: string, x: number, z: number, rotY: number): void => {
    const face = panel(3.2, 0.3, {
      map: signTexture(text, { background: BRAND.blue, aspect: 3.2 / 0.3, rule: false }),
      unlit: true,
    })
    face.position.set(x, stripeY, z)
    face.rotation.y = rotY
    root.add(face)
  }
  for (const [z, text] of [[-6, 'Drama'], [-1.4, 'Family'], [3.2, 'Comedy']] as const) {
    wallSign(text, STORE.minX + 0.12, z, Math.PI / 2)
  }
  for (const [z, text] of [[-6, 'Horror'], [-1.4, 'Action & Adventure'], [3.2, 'Music & Games']] as const) {
    wallSign(text, STORE.maxX - 0.12, z, -Math.PI / 2)
  }

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
  // Pools of light laid on the carpet under each fixture. The lighting model is per-vertex with
  // no falloff, so without these the floor takes one flat value and the troffers light nothing.
  const poolMaterial = createPS1Material({ map: lightPoolTexture(), unlit: true, opacity: 0.22 })
  poolMaterial.blending = THREE.AdditiveBlending
  poolMaterial.depthWrite = false

  // A dense regular grid, which is what the reference rooms actually have — the ceiling is
  // more light than tile, and that is why those stores read as bright rather than lit.
  for (let i = 0; i < 6; i += 1) {
    for (let j = 0; j < 4; j += 1) {
      const x = -10 + i * 4
      const z = -7 + j * 4.6

      const lamp = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.8), troffer)
      lamp.rotation.x = Math.PI / 2
      lamp.position.set(x, STORE.height - 0.02, z)
      root.add(lamp)

      const pool = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 5, 6, 5), poolMaterial)
      pool.rotation.x = -Math.PI / 2
      pool.position.set(x, 0.015, z)
      pool.renderOrder = 1
      root.add(pool)
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
  /**
   * Faces this run with drawn VHS spines instead of colored blocks — one strip per tier per
   * side. Anything that is not tape (games, music) keeps the blocks.
   */
  spines?: readonly [Genre, Genre]
  signColor: number
  /** Section names printed on the header sign, one per side of the run. */
  signText?: readonly [string, string]
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
    // Wide enough to carry the stock that stands proud of the gondola body.
    const board = box(depth + 0.34, 0.04, length, ROOM.shelfTrim)
    place(root, board, x, y - item.height / 2 - 0.02, centerZ)
  }

  tiers.forEach((y, tier) => {
    for (const side of [-1, 1] as const) {
      const count = Math.floor((length - 0.6) / item.width)
      const span = count * item.width

      if (options.spines) {
        const genre = options.spines[side === -1 ? 0 : 1]
        // One plane carries the whole row. The block behind it gives the row its depth, so the
        // shelf still reads as full when you look along it rather than at it.
        place(root, box(0.15, item.height, span, 0x1b1e25), x + side * (depth / 2 + 0.005), y, centerZ)
        const strip = panel(span, item.height, {
          map: spineStripTexture({ count, genre, seed: Math.round(x * 31 + centerZ * 7 + tier * 3 + side), gaps }),
        })
        // Proud of the gondola's own face, sitting on the deck the way a row of tapes does.
        strip.position.set(x + side * (depth / 2 + 0.081), y, centerZ)
        strip.rotation.y = side * (Math.PI / 2)
        root.add(strip)
        continue
      }

      const color = side === -1 ? colors[0] : colors[1]
      const startZ = centerZ - span / 2
      for (let i = 0; i < count; i += 1) {
        if (Math.random() < gaps) continue
        addItem(color, x + side * (depth / 2 - item.depth / 2 + 0.03), y, startZ + i * item.width, item)
      }
    }
  })

  // The header hangs clear of the stock rather than sitting on it: at a couple of centimetres
  // above the deck it crowds the aisle and blocks the view down the run, and it is also not
  // where a real one is — those swing from the ceiling or stand off a post.
  const signLength = Math.min(2.2, length - 0.4)
  const signY = height + SIGN_RISE
  for (const postZ of [centerZ - signLength / 2 + 0.12, centerZ + signLength / 2 - 0.12]) {
    place(root, box(0.04, SIGN_RISE, 0.04, ROOM.shelfTrim), x, height + SIGN_RISE / 2, postZ)
  }
  const sign = box(0.05, 0.34, signLength, signColor)
  place(root, sign, x, signY, centerZ)

  // The header reads from the aisle on either side, so it is two panels rather than one
  // double-sided plane: a double-sided texture shows up mirrored from behind.
  if (options.signText) {
    for (const side of [-1, 1] as const) {
      const text = options.signText[side === -1 ? 0 : 1]
      const face = panel(signLength, 0.34, {
        map: signTexture(text, { background: signColor, aspect: signLength / 0.34 }),
        unlit: true,
      })
      face.position.set(x + side * 0.031, signY, centerZ)
      face.rotation.y = side * (Math.PI / 2)
      root.add(face)
    }
  }

  if (options.label && options.station) {
    const zone = hitbox(depth + 0.4, height, length)
    zone.position.set(x, height / 2, centerZ)
    root.add(zone)
    interactables.push({ object: zone, label: options.label, kind: 'station', station: options.station })
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
        signText: [GENRE_LABEL[left], GENRE_LABEL[right]],
        spines: [left, right],
        label: 'Shelve a tape',
        station: 'shelf',
      })
    })
  })

  // Aisle markers hung over each run, so the store brands itself from anywhere on the floor.
  // Two single-sided panels back to back rather than one double-sided one: a double-sided
  // plane shows the art mirrored from behind, so half the aisles read RETSULKCAL.
  const aisleLogo = lacklusterLogoTexture({ width: 128, height: 32, compact: true })
  for (const x of FILM_AISLE_X) {
    for (const side of [-1, 1] as const) {
      const marker = panel(1.5, 0.38, { map: aisleLogo, unlit: true })
      marker.position.set(x + side * 0.02, 2.95, SHELF_SEGMENTS[0].centerZ)
      marker.rotation.y = side * (Math.PI / 2)
      build.root.add(marker)
    }
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
      signText: ['Video Games', 'Video Games'],
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
      signText: ['Music', 'Music'],
      gaps: 0.04,
    })
  }

  buildBargainBin(build, 10.4, -1.6)
}

/** Beige base, dark keys, a shallow tilt. Merged, so a full key field costs one draw call. */
function buildKeyboard(root: THREE.Group, x: number, y: number, z: number): void {
  const group = new THREE.Group()

  group.add(box(0.44, 0.022, 0.17, 0xc9c2ad))

  const keys: THREE.BufferGeometry[] = []
  const addKey = (kx: number, kz: number, width = 0.026) => {
    const key = new THREE.BoxGeometry(width, 0.011, 0.022)
    key.translate(kx, 0.016, kz)
    keys.push(key)
  }

  for (let row = 0; row < 4; row += 1) {
    const count = row === 0 ? 14 : 13
    const indent = row * 0.008
    for (let column = 0; column < count; column += 1) {
      addKey(-0.195 + indent + column * 0.03, -0.055 + row * 0.028)
    }
  }
  addKey(0, 0.062, 0.16)

  const merged = mergeGeometries(keys, false)
  for (const key of keys) key.dispose()
  if (merged) group.add(new THREE.Mesh(merged, createPS1Material({ color: 0x6b6459 })))

  group.position.set(x, y, z)
  group.rotation.x = -0.07
  root.add(group)
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

  const sign = box(1.4, 0.32, 0.06, SECTION.bargain)
  place(root, sign, x, 1.15, z - 0.75)
  const signFace = panel(1.4, 0.32, {
    map: signTexture('Previously Viewed', { background: SECTION.bargain, aspect: 1.4 / 0.32 }),
    unlit: true,
  })
  signFace.position.set(x, 1.15, z - 0.79)
  signFace.rotation.y = Math.PI
  root.add(signFace)
}

/** Wall-hung stock down both side walls, which is where the overflow genres lived. */
function buildPerimeterShelving({ root }: Build): void {
  const item: Item = { width: VHS.width, height: VHS.height, depth: VHS.depth, axis: 'z' }
  // Stops short of the poster line: the top row used to sit where the frames hang.
  const tiers = [0.45, 0.78, 1.11, 1.44, 1.77]
  const span = 12.4

  for (const [wallX, facing, genres] of [
    [STORE.minX + 0.3, 1, ['drama', 'family', 'comedy']],
    [STORE.maxX - 0.3, -1, ['horror', 'action', 'scifi']],
  ] as const) {
    const backing = box(0.3, 1.9, 13, ROOM.shelfBody)
    place(root, backing, wallX - facing * 0.15, 1.05, -2)

    tiers.forEach((y, tier) => {
      const board = box(0.34, 0.04, 13, ROOM.shelfTrim)
      place(root, board, wallX, y - item.height / 2 - 0.02, -2)

      const genre = genres[tier % genres.length] ?? 'drama'
      const count = Math.floor(span / item.width)
      place(root, box(0.13, item.height, count * item.width, 0x1b1e25), wallX + facing * 0.05, y, -2)
      const strip = panel(count * item.width, item.height, {
        map: spineStripTexture({ count, genre, seed: Math.round(wallX * 13 + tier * 5), gaps: 0.09 }),
      })
      strip.position.set(wallX + facing * 0.12, y, -2)
      strip.rotation.y = facing * (Math.PI / 2)
      root.add(strip)
    })
  }
}

function buildNewReleaseWall({ root, interactables }: Build): void {
  const releases = newReleases()
  const facingPool = releases.length >= 6 ? releases : [...releases, ...CATALOG.slice(0, 12)]
  // Faced almost edge to edge, the way a release wall actually looks — and it means the
  // crosshair lands on a case rather than in the gap between two of them.
  const FACING = { width: 0.38, height: 0.52, tilt: -0.28 }
  const CASE_DEPTH = 0.05
  const RACK = { columns: 30, rows: 3, startX: -9.2, spacingX: 0.42, topY: 2.05, spacingY: 0.6 }
  const wallZ = STORE.minZ + 0.04

  const tags: THREE.BufferGeometry[] = []
  const hotTags: THREE.BufferGeometry[] = []
  const cases: THREE.BufferGeometry[] = []

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

      // A case, not a picture of one: the sleeve art rides on the front of a thin black body,
      // so the wall has edges and shadow gaps in it from anywhere off-axis. The bodies all
      // share a color, so they merge into a single mesh at the end of the pass.
      const body = new THREE.BoxGeometry(FACING.width, FACING.height, CASE_DEPTH)
      body.applyMatrix4(new THREE.Matrix4().makeRotationX(FACING.tilt))
      body.translate(x, y, wallZ + 0.09)
      cases.push(body)

      const facing = panel(FACING.width, FACING.height, { map: boxArtTexture(title) })
      facing.rotation.x = FACING.tilt
      // The tilted case's own front normal is (0, -sin t, cos t), so the art rides out along
      // that rather than straight down +Z, or it sinks into the body at the top edge.
      const lift = CASE_DEPTH / 2 + 0.002
      facing.position.set(x, y - Math.sin(FACING.tilt) * lift, wallZ + 0.09 + Math.cos(FACING.tilt) * lift)
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
  mergeTags(cases, 0x17171d)

  const centerX = RACK.startX + ((RACK.columns - 1) * RACK.spacingX) / 2
  const signWidth = RACK.columns * RACK.spacingX
  place(root, box(signWidth, 0.42, 0.08, BRAND.blue), centerX, 2.62, STORE.minZ + 0.1)
  const releaseSign = panel(signWidth, 0.42, {
    map: signTexture('New Releases', { background: BRAND.blue, aspect: signWidth / 0.42 }),
    unlit: true,
  })
  releaseSign.position.set(centerX, 2.62, STORE.minZ + 0.15)
  root.add(releaseSign)
  place(root, box(signWidth, 0.09, 0.1, BRAND.yellow), centerX, 2.38, STORE.minZ + 0.11)
}

/** A leaning stack of tapes in their sleeves, label edge out. Used all over the counter. */
function tapeStack(root: THREE.Group, x: number, y: number, z: number, count: number, rotY = 0): void {
  const group = new THREE.Group()
  for (let i = 0; i < count; i += 1) {
    const tape = box(0.195, 0.028, 0.105, 0x1b1e25)
    // Nobody stacks these square. A couple of degrees of yaw per tape is the whole read.
    tape.rotation.y = (i % 2 === 0 ? 1 : -1) * (0.02 + (i % 3) * 0.015)
    tape.position.set((i % 3) * 0.006 - 0.006, 0.014 + i * 0.03, (i % 2) * 0.005)
    group.add(tape)

    const label = box(0.15, 0.016, 0.004, 0xe4dfcd)
    label.rotation.y = tape.rotation.y
    label.position.set(tape.position.x, tape.position.y, tape.position.z + 0.053)
    group.add(label)
  }
  group.position.set(x, y, z)
  group.rotation.y = rotY
  root.add(group)
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

  // Cabinetry on the staff side, which is the one warm surface in an otherwise blue object.
  for (let i = 0; i < 7; i += 1) {
    place(root, box(0.92, 0.72, 0.04, ROOM.counterCabinet), -3.1 + i * 1.03, 0.44, frontZ + frontDepth / 2 + 0.01)
    place(root, box(0.86, 0.03, 0.05, 0x8d7a58), -3.1 + i * 1.03, 0.74, frontZ + frontDepth / 2 + 0.02)
  }

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
  // Each station gets a generous aim volume over its prop. Sized so that standing anywhere
  // behind the counter and glancing down lands on the right one.
  const station = (
    label: string,
    kind: StationKind,
    size: readonly [number, number, number],
    at: readonly [number, number, number],
  ): void => {
    const zone = hitbox(size[0], size[1], size[2])
    zone.position.set(at[0], at[1], at[2])
    root.add(zone)
    interactables.push({ object: zone, label, kind: 'station', station: kind })
  }

  station('Use the rental system', 'register', [2.4, 1.2, 1.6], [-1.3, top + 0.3, frontZ - 0.1])

  build.rewinder.root.position.set(1.6, top + 0.02, frontZ + 0.1)
  build.rewinder.root.rotation.y = Math.PI
  root.add(build.rewinder.root)
  station('Rewind a tape', 'rewind', [1.5, 1.1, 1.5], [1.6, top + 0.3, frontZ - 0.1])

  // Tucked against the outside of the left wing. In the middle of the floor it stood squarely
  // in the only lane between the two doors.
  const returnBin = box(0.9, 0.7, 0.7, BRAND.blueDark)
  colliders.push(place(root, returnBin, -halfWidth - 0.6, 0.35, frontZ + 0.6))
  place(root, box(0.7, 0.05, 0.4, ROOM.shelfTrim), -halfWidth - 0.6, 0.72, frontZ + 0.6)
  station('Check the return bin', 'returns', [1.3, 1.5, 1.2], [-halfWidth - 0.6, 0.7, frontZ + 0.6])

  // Against the feature wall in the corner, off the staff walkway it used to sit in.
  const crate = box(0.8, 0.5, 0.6, 0x7d6a4f)
  colliders.push(place(root, crate, -4.3, 0.25, FEATURE_WALL_Z - 0.62))
  station('Open the shipment crate', 'restock', [1.3, 1.3, 1.1], [-4.3, 0.55, FEATURE_WALL_Z - 0.62])

  // --- The terminal: a whole beige computer, facing the staff side of the counter ---
  const monitorX = -1.3
  const monitorZ = frontZ - 0.1
  const monitorY = top + 0.23
  const BEIGE = 0xc9c2ad
  const BEIGE_DARK = 0xb0a894

  // Tilt-and-swivel foot, then the tube, then the recessed screen in its dark surround.
  place(root, box(0.3, 0.05, 0.26, BEIGE_DARK), monitorX, top + 0.05, monitorZ)
  place(root, box(0.46, 0.4, 0.42, BEIGE), monitorX, monitorY, monitorZ)
  place(root, box(0.38, 0.3, 0.02, 0x1d1c18), monitorX, monitorY + 0.02, monitorZ + 0.21)
  const screen = panel(0.32, 0.24, { color: 0x6b4a12, unlit: true })
  screen.position.set(monitorX, monitorY + 0.02, monitorZ + 0.225)
  root.add(screen)
  // Vent slots and a power LED, which is most of what reads as "computer" at this size.
  place(root, box(0.3, 0.012, 0.02, BEIGE_DARK), monitorX, monitorY + 0.19, monitorZ + 0.2)
  place(root, unlitBox(0.02, 0.012, 0.01, 0x6fe07a), monitorX + 0.16, monitorY - 0.16, monitorZ + 0.215)
  // The back is what the shop floor sees, so it gets the vent stack and a cable of its own.
  for (let i = 0; i < 4; i += 1) {
    place(root, box(0.3, 0.014, 0.02, BEIGE_DARK), monitorX, monitorY + 0.12 - i * 0.06, monitorZ - 0.21)
  }
  place(root, box(0.03, 0.22, 0.03, 0x2a2a30), monitorX - 0.1, monitorY - 0.22, monitorZ - 0.22)

  buildKeyboard(root, monitorX, top + 0.02, monitorZ + 0.44)

  // The box itself, sat on the counter beside the screen the way they always were.
  place(root, box(0.46, 0.13, 0.4, BEIGE), monitorX - 1.05, top + 0.08, monitorZ + 0.05)
  place(root, box(0.16, 0.02, 0.02, BEIGE_DARK), monitorX - 1.15, top + 0.08, monitorZ + 0.25)
  place(root, unlitBox(0.018, 0.018, 0.01, 0xe0a33a), monitorX - 0.92, top + 0.08, monitorZ + 0.25)

  build.monitorView.position.set(monitorX, monitorY + 0.05, monitorZ + 0.92)
  build.monitorView.target.set(monitorX, monitorY + 0.01, monitorZ + 0.21)

  // --- The rest of the desk ---
  // A counter with one computer on it looks like a kiosk. A counter mid-shift has the work
  // piled on it: what came back in and has not been rewound, what has been rewound and has not
  // been walked out to the floor, and the small stuff nobody ever tidied. Everything lives in
  // the band the player can actually see over the bar, and clear of the two wings.
  const staffZ = frontZ + 0.26
  const customerZ = frontZ - 0.32

  // Returns waiting on the deck, stacked beside it where the player's hands reach.
  tapeStack(root, 2.25, top, staffZ - 0.16, 6, 0.12)
  tapeStack(root, 2.62, top, staffZ + 0.1, 4, -0.2)
  place(root, box(0.5, 0.12, 0.34, BRAND.yellow), 2.42, top + 0.06, staffZ + 0.3)
  const rewindTag = panel(0.48, 0.1, {
    map: signTexture('To Rewind', { background: BRAND.yellow, color: BRAND.blueDark, aspect: 4.8 }),
    unlit: true,
  })
  rewindTag.position.set(2.42, top + 0.06, staffZ + 0.48)
  root.add(rewindTag)

  // Done and waiting to go back out: a crate of sleeves, faced so the spines read from here.
  const crateX = -2.45
  place(root, box(0.66, 0.36, 0.5, 0x9a5f3a), crateX, top + 0.18, staffZ + 0.02)
  for (const [i, z] of [staffZ - 0.09, staffZ + 0.11].entries()) {
    const count = 16
    place(root, box(0.52, VHS.height, 0.03, 0x1b1e25), crateX, top + 0.3, z)
    const strip = panel(count * VHS.width, VHS.height, {
      map: spineStripTexture({ count, genre: i === 0 ? 'comedy' : 'action', seed: 401 + i, gaps: 0.02 }),
    })
    strip.position.set(crateX, top + 0.3, z + 0.02)
    root.add(strip)
  }
  const shelveTag = panel(0.62, 0.11, {
    map: signTexture('To Shelve', { background: BRAND.blue, aspect: 5.6 }),
    unlit: true,
  })
  shelveTag.position.set(crateX, top + 0.42, staffZ + 0.28)
  root.add(shelveTag)

  // Receipt printer, with a curl of paper coming out of it.
  place(root, box(0.26, 0.18, 0.28, BEIGE), -1.95, top + 0.09, staffZ + 0.2)
  place(root, box(0.22, 0.02, 0.12, 0xf0ecdd), -1.95, top + 0.19, staffZ + 0.04)

  // The phone. Beige, corded, and permanently ringing.
  place(root, box(0.24, 0.07, 0.28, BEIGE_DARK), 0.72, top + 0.035, staffZ + 0.22)
  place(root, box(0.26, 0.06, 0.1, 0x2f3138), 0.72, top + 0.1, staffZ + 0.12)
  place(root, box(0.02, 0.02, 0.2, 0x2f3138), 0.9, top + 0.02, staffZ + 0.4)

  // Pens, a tape dispenser, a stack of membership forms: the litter of a working till.
  place(root, box(0.1, 0.14, 0.1, 0x2f5aa8), 1.25, top + 0.07, staffZ + 0.1)
  for (let i = 0; i < 4; i += 1) {
    place(root, box(0.014, 0.16, 0.014, [0xd8232a, 0x1b1e25, 0x2e8b57, 0x2f5aa8][i] ?? 0x1b1e25), 1.22 + i * 0.02, top + 0.18, staffZ + 0.1)
  }
  place(root, box(0.18, 0.09, 0.12, 0x3a3f48), 1.6, top + 0.045, staffZ + 0.16)
  place(root, box(0.26, 0.04, 0.2, 0xefe9d8), -0.5, top + 0.02, staffZ + 0.1)
  place(root, box(0.12, 0.025, 0.12, 0xf0d24a), -0.15, top + 0.012, staffZ + 0.3)

  // The till itself, dead centre where the customer expects it: a beige box with a raised
  // display, a blue keypad and a drawer that never sat quite flush.
  const tillX = 0.05
  place(root, box(0.52, 0.3, 0.44, BEIGE), tillX, top + 0.15, staffZ - 0.02)
  place(root, box(0.3, 0.16, 0.06, BEIGE_DARK), tillX, top + 0.38, staffZ + 0.12)
  const tillScreen = panel(0.24, 0.1, { color: 0x7fd08a, unlit: true })
  tillScreen.position.set(tillX, top + 0.38, staffZ + 0.15)
  root.add(tillScreen)
  place(root, box(0.34, 0.1, 0.26, 0x2f5aa8), tillX, top + 0.33, staffZ - 0.1)
  place(root, box(0.5, 0.06, 0.05, BEIGE_DARK), tillX, top + 0.08, staffZ - 0.25)

  // A spike of rental slips and a stack of paper bags, which is what the till sat between.
  place(root, box(0.1, 0.02, 0.1, 0x6b6459), tillX + 0.45, top + 0.02, staffZ + 0.18)
  place(root, box(0.01, 0.16, 0.01, 0x9aa0a4), tillX + 0.45, top + 0.1, staffZ + 0.18)
  place(root, box(0.09, 0.06, 0.09, 0xefe9d8), tillX + 0.45, top + 0.06, staffZ + 0.18)
  place(root, box(0.3, 0.09, 0.22, 0xc6b58a), -1.2, top + 0.05, staffZ + 0.3)

  // The boombox on the end of the wing, which is what the radio in this room is coming out of.
  place(root, box(0.5, 0.26, 0.22, 0x2b2f36), halfWidth - 0.45, top + 0.13, backZ - 0.35)
  for (const dx of [-0.14, 0.14]) {
    const cone = panel(0.16, 0.16, { color: 0x4a5058, unlit: true })
    cone.position.set(halfWidth - 0.45 + dx, top + 0.13, backZ - 0.24)
    root.add(cone)
  }
  place(root, box(0.16, 0.08, 0.02, 0x14171d), halfWidth - 0.45, top + 0.13, backZ - 0.24)

  // Customer side: the impulse rack of candy at the till, and the sign-up clipboard.
  place(root, box(0.34, 0.06, 0.34, 0xd8232a), 1.15, top + 0.03, customerZ)
  for (let i = 0; i < 9; i += 1) {
    place(root, box(0.06, 0.12, 0.04, [0xf5c518, 0x8e44ad, 0x2e8b57][i % 3] ?? 0xf5c518), 1.02 + (i % 3) * 0.07, top + 0.11, customerZ - 0.07 + Math.floor(i / 3) * 0.07)
  }
  place(root, box(0.28, 0.02, 0.36, 0x8d7a58), -0.55, top + 0.01, customerZ)
  place(root, box(0.24, 0.01, 0.32, 0xf0ecdd), -0.55, top + 0.025, customerZ)

  // A rewind placard standing on the customer face of the bar, because of course there was one.
  place(root, box(0.6, 0.22, 0.03, BRAND.yellow), -1.9, top + 0.13, customerZ - 0.04)
  const placard = panel(0.58, 0.2, {
    map: signTexture('Be Kind Rewind', { background: BRAND.yellow, color: BRAND.blueDark, aspect: 2.9 }),
    unlit: true,
  })
  placard.position.set(-1.9, top + 0.13, customerZ - 0.058)
  placard.rotation.y = Math.PI
  root.add(placard)
}

/**
 * The back wall to the right of the release rack was eight metres of bare mustard, which is
 * the one part of the room that still read as a model rather than a shop. It gets what that
 * stretch of wall actually carried: a staff-picks board, a pair of framed one-sheets, the
 * clock everybody watched from the counter, and a rewind reminder in the signage band.
 */
function buildBackWall({ root, interactables }: Build): void {
  const wallZ = STORE.minZ + 0.06

  // --- Staff picks: a corkboard of hand-chosen sleeves with the clerk's card under each ---
  const boardX = 5.9
  place(root, box(3.1, 1.55, 0.07, 0x9a7d4e), boardX, 1.62, wallZ)
  place(root, box(3.26, 0.08, 0.1, ROOM.shelfTrim), boardX, 2.44, wallZ)

  const header = panel(3.26, 0.34, {
    map: signTexture('Staff Picks', { background: BRAND.blue, aspect: 3.26 / 0.34 }),
    unlit: true,
  })
  header.position.set(boardX, 2.7, wallZ + 0.05)
  root.add(header)
  place(root, box(3.26, 0.4, 0.09, BRAND.blue), boardX, 2.7, wallZ)

  const picks = CATALOG.filter((title) => !title.newRelease).slice(0, 6)
  picks.forEach((title, index) => {
    const column = index % 3
    const row = Math.floor(index / 3)
    const x = boardX - 1 + column * 1
    const y = 2.02 - row * 0.74

    const sleeve = panel(0.44, 0.62, { map: boxArtTexture(title) })
    sleeve.position.set(x, y, wallZ + 0.05)
    // A couple of degrees off square each, because nobody ever pinned one of these up straight.
    sleeve.rotation.z = ((index % 3) - 1) * 0.035
    root.add(sleeve)
    interactables.push({ object: sleeve, label: `Read ${title.title}`, kind: 'inspect', title })

    place(root, box(0.3, 0.09, 0.02, 0xefe9d8), x, y - 0.38, wallZ + 0.05)
  })

  // --- Two framed one-sheets, the pair that faced you walking the back of the store ---
  hangPoster(root, 'shriek', 9.3, 2.1, wallZ + 0.03, 0)
  hangPoster(root, 'lizard-park', 10.9, 2.1, wallZ + 0.03, 0)

  // --- The clock. Every shift in one of these was measured against it. ---
  const clockX = 8.2
  const clockY = 2.95
  place(root, box(0.62, 0.62, 0.08, 0x2b2f38), clockX, clockY, wallZ)
  const dial = panel(0.5, 0.5, { color: 0xf2eddc, unlit: true })
  dial.position.set(clockX, clockY, wallZ + 0.05)
  root.add(dial)
  for (let i = 0; i < 12; i += 1) {
    const angle = (i / 12) * Math.PI * 2
    place(root, unlitBox(0.02, 0.04, 0.01, 0x2b2f38), clockX + Math.sin(angle) * 0.2, clockY + Math.cos(angle) * 0.2, wallZ + 0.06)
  }
  // Hands parked at six, which is when the shift starts.
  const hour = unlitBox(0.02, 0.13, 0.01, 0x2b2f38)
  place(root, hour, clockX, clockY - 0.065, wallZ + 0.07)
  const minute = unlitBox(0.018, 0.19, 0.01, 0x2b2f38)
  place(root, minute, clockX, clockY + 0.095, wallZ + 0.07)

  // --- The reminder, printed into the band under the ceiling ---
  const rewindSign = panel(4.4, 0.3, {
    map: signTexture('Be Kind \u00b7 Please Rewind', { background: BRAND.blue, aspect: 4.4 / 0.3, rule: false }),
    unlit: true,
  })
  rewindSign.position.set(7.4, STORE.height - 0.18, STORE.minZ + 0.12)
  root.add(rewindSign)

  // --- A drop-off slot in the wall, because the bin by the counter is the after-hours one ---
  place(root, box(1.4, 0.9, 0.12, ROOM.shelfBody), 3.9, 1.05, wallZ)
  place(root, box(1.0, 0.16, 0.06, 0x14171d), 3.9, 1.22, wallZ + 0.08)
  const slotSign = panel(1.4, 0.22, {
    map: signTexture('Returns', { background: BRAND.yellow, color: BRAND.blueDark, aspect: 1.4 / 0.22 }),
    unlit: true,
  })
  slotSign.position.set(3.9, 0.78, wallZ + 0.08)
  root.add(slotSign)
}

/**
 * One-sheets in marquee frames. The bulbs are a single merged mesh per poster — a ring of
 * thirty little unlit boxes is free that way, and individually it would not be.
 */
const POSTER = { width: 0.68, height: 1.02 } as const

/** One framed one-sheet with its ring of bulbs, hung flat against whichever wall. */
function hangPoster(root: THREE.Group, id: PosterId, x: number, y: number, z: number, rotY: number): void {
  {
    const WIDTH = POSTER.width
    const HEIGHT = POSTER.height
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

    group.position.set(x, y, z)
    group.rotation.y = rotY
    root.add(group)
  }
}

function buildPosters({ root }: Build): void {
  hangPoster(root, 'hard-to-perish', STORE.minX + 0.16, 2.5, -5.4, Math.PI / 2)
  hangPoster(root, 'lizard-park', STORE.minX + 0.16, 2.5, 0.4, Math.PI / 2)
  hangPoster(root, 'shriek', STORE.maxX - 0.16, 2.5, -5.4, -Math.PI / 2)
  hangPoster(root, 'ogre-it', STORE.maxX - 0.16, 2.5, 0.4, -Math.PI / 2)
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
    // Front art only, with a plain card back behind it. A double-sided plane shows the artwork
    // mirrored from behind, which reads as a rendering fault rather than as cardboard.
    const standee = new THREE.Group()
    const art = panel(1.1, 1.9, { map: boxArtTexture(standeeTitle) })
    art.position.z = 0.012
    standee.add(art)
    const backing = box(1.1, 1.9, 0.02, 0x8a7a5e)
    standee.add(backing)
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
