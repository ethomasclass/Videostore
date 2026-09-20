import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { createPS1Material } from '../render/ps1Material'
import { lacklusterLogoTexture } from '../render/logoTexture'
import { duskSkyTexture } from '../render/skyTexture'
import { BRAND } from '../render/palette'
import { box, unlitBox, panel, makeFogless, DOORS, GLASS, LOT_Y, STORE } from './buildKit'

/**
 * Full-height shopfront glazing, with the entrance at the left and the exit at the right.
 * Splitting the two doors is what makes the floor read as one-way: in past the new releases,
 * around the aisles, out past the counter.
 */
export function buildStorefront(root: THREE.Group): void {
  const width = STORE.maxX - STORE.minX
  const cx = (STORE.minX + STORE.maxX) / 2
  const z = STORE.maxZ
  const doorXs = [DOORS.entranceX, DOORS.exitX]

  const kick = box(width, GLASS.sillY, 0.18, BRAND.blue)
  kick.position.set(cx, GLASS.sillY / 2, z)
  root.add(kick)

  const bulkhead = box(width, STORE.height - GLASS.headY, 0.18, BRAND.blue)
  bulkhead.position.set(cx, (STORE.height + GLASS.headY) / 2, z)
  root.add(bulkhead)

  const bulkheadTrim = box(width, 0.1, 0.22, BRAND.yellow)
  bulkheadTrim.position.set(cx, GLASS.headY + 0.1, z)
  root.add(bulkheadTrim)

  // Drawn last and without depth writes, so the lot reads through it.
  const glassMaterial = createPS1Material({
    color: 0x9fc4d8,
    opacity: 0.14,
    side: THREE.DoubleSide,
    unlit: true,
  })
  glassMaterial.depthWrite = false
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(width, GLASS.headY - GLASS.sillY), glassMaterial)
  glass.position.set(cx, (GLASS.sillY + GLASS.headY) / 2, z)
  glass.renderOrder = 2
  root.add(glass)

  const nearDoor = (x: number): boolean =>
    doorXs.some((doorX) => Math.abs(x - doorX) < DOORS.halfWidth + 0.3)

  for (let x = STORE.minX; x <= STORE.maxX + 0.01; x += 2.4) {
    if (nearDoor(x)) continue
    const mullion = box(0.12, GLASS.headY - GLASS.sillY, 0.2, BRAND.blueDark)
    mullion.position.set(x, (GLASS.sillY + GLASS.headY) / 2, z)
    root.add(mullion)
  }

  for (const doorX of doorXs) {
    for (const side of [-1, 1] as const) {
      const post = box(0.16, GLASS.headY, 0.24, BRAND.blueDark)
      post.position.set(doorX + side * DOORS.halfWidth, GLASS.headY / 2, z)
      root.add(post)
    }
    const header = box(DOORS.halfWidth * 2 + 0.3, 0.22, 0.24, BRAND.blueDark)
    header.position.set(doorX, GLASS.headY - 0.11, z)
    root.add(header)

    // The rubber entry mat, indoors of each door.
    const mat = panel(DOORS.halfWidth * 2, 1.6, { color: 0x1d2026 })
    mat.rotation.x = -Math.PI / 2
    mat.position.set(doorX, 0.012, z - 1.1)
    root.add(mat)
  }

  // Door signage: IN over the left, OUT over the right.
  for (const [doorX, color] of [
    [DOORS.entranceX, BRAND.yellow],
    [DOORS.exitX, 0xd0453a],
  ] as const) {
    const plate = box(0.9, 0.2, 0.06, color)
    plate.position.set(doorX, GLASS.headY + 0.1, z - 0.16)
    root.add(plate)
  }

  // The pylon sign, readable from the aisle and from the lot.
  const logo = lacklusterLogoTexture()
  for (const facing of [-1, 1] as const) {
    const sign = panel(4.2, 1.84, { map: logo, unlit: facing === 1 })
    sign.position.set(0, STORE.height - 0.42, z - facing * 0.12)
    if (facing === -1) sign.rotation.y = Math.PI
    root.add(sign)
  }
}

/** Dusk lot beyond the glass: enough to give the windows something to be windows onto. */
export function buildParkingLot(root: THREE.Group): void {
  const cx = (STORE.minX + STORE.maxX) / 2
  const lotDepth = 30
  const lotCenterZ = STORE.maxZ + lotDepth / 2

  // Sky backdrop. Fogless — fog is tuned for an 18m room and would grey this out completely.
  const sky = new THREE.Mesh(
    new THREE.PlaneGeometry(190, 54, 8, 4),
    makeFogless(createPS1Material({ map: duskSkyTexture(), unlit: true })),
  )
  sky.position.set(cx, 14, STORE.maxZ + 52)
  // Faces back toward the store; a plane's default normal points away and gets culled.
  sky.rotation.y = Math.PI
  root.add(sky)

  const asphalt = panel(70, lotDepth, { color: 0x44474f })
  asphalt.rotation.x = -Math.PI / 2
  asphalt.position.set(cx, LOT_Y, lotCenterZ)
  root.add(asphalt)

  const curb = box(70, 0.18, 0.4, 0x8b8b84)
  curb.position.set(cx, LOT_Y + 0.09, STORE.maxZ + 0.6)
  root.add(curb)

  // Bay stripes, merged — there is no reason for thirty draw calls of paint.
  const stripes: THREE.BufferGeometry[] = []
  for (let i = 0; i < 20; i += 1) {
    const stripe = new THREE.PlaneGeometry(0.12, 5)
    stripe.rotateX(-Math.PI / 2)
    stripe.translate(-24 + i * 2.5, LOT_Y + 0.01, STORE.maxZ + 4.4)
    stripes.push(stripe)
  }
  const stripeGeometry = mergeGeometries(stripes, false)
  for (const geometry of stripes) geometry.dispose()
  if (stripeGeometry) root.add(new THREE.Mesh(stripeGeometry, createPS1Material({ color: 0xd8d2b8 })))

  car(root, -9.4, STORE.maxZ + 4.4, 0x8c2f2a)
  car(root, -4.6, STORE.maxZ + 4.4, 0x6f7480)
  car(root, 2.1, STORE.maxZ + 4.4, 0xb7b2a6)
  car(root, 9.8, STORE.maxZ + 4.4, 0x3f5a3a)

  lampPost(root, -13, STORE.maxZ + 9)
  lampPost(root, 5, STORE.maxZ + 9)

  // A low treeline at the lot's edge, so the horizon is not a hard seam against the sky.
  for (let i = 0; i < 14; i += 1) {
    const height = 3 + ((i * 7) % 5) * 0.6
    const tree = box(3.4, height, 1, 0x1f2a24)
    tree.position.set(-32 + i * 5, LOT_Y + height / 2, STORE.maxZ + 30)
    root.add(tree)
  }
}

/** Six boxes and two lamps. At this distance and this resolution, that is a car. */
function car(root: THREE.Group, x: number, z: number, color: number): void {
  const group = new THREE.Group()

  const body = box(1.85, 0.62, 4.3, color)
  body.position.y = 0.62
  group.add(body)

  const cabin = box(1.66, 0.56, 2.1, color)
  cabin.position.set(0, 1.2, -0.15)
  group.add(cabin)

  const glazing = box(1.7, 0.4, 1.9, 0x1b2028)
  glazing.position.set(0, 1.22, -0.15)
  group.add(glazing)

  for (const side of [-1, 1] as const) {
    for (const end of [-1, 1] as const) {
      const wheel = box(0.22, 0.52, 0.52, 0x17181c)
      wheel.position.set(side * 0.92, 0.3, end * 1.45)
      group.add(wheel)
    }
  }

  for (const side of [-1, 1] as const) {
    const tail = unlitBox(0.34, 0.12, 0.05, 0xd0453a)
    tail.position.set(side * 0.62, 0.78, 2.16)
    group.add(tail)
  }

  group.position.set(x, LOT_Y, z)
  root.add(group)
}

function lampPost(root: THREE.Group, x: number, z: number): void {
  const pole = box(0.16, 6, 0.16, 0x4a4d52)
  pole.position.set(x, LOT_Y + 3, z)
  root.add(pole)

  const head = unlitBox(1.1, 0.16, 0.5, 0xfff1c4)
  head.position.set(x, LOT_Y + 6, z)
  root.add(head)

  const pool = panel(7, 7, { color: 0x6d6852, opacity: 0.4, unlit: true })
  pool.rotation.x = -Math.PI / 2
  pool.position.set(x, LOT_Y + 0.02, z)
  root.add(pool)
}
