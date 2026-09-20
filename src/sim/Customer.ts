import * as THREE from 'three'
import { createPS1Material } from '../render/ps1Material'
import { DOORS, STORE } from '../world/buildKit'
import { CATALOG, type Title } from '../data/catalog'

/**
 * One customer, walking a fixed round: in at the entrance, a browse at two shelves, the counter,
 * then out at the exit. Deliberately the simplest agent that produces the whole loop — there is
 * no steering or avoidance yet, because the shape of the loop is what needs to be right first.
 */

export type CustomerState = 'arriving' | 'browsing' | 'approaching' | 'waiting' | 'leaving' | 'away'

interface Leg {
  x: number
  z: number
  /** Seconds to stand here once arrived. */
  dwell: number
  state: CustomerState
}

const SPEED = 1.15
const ARRIVE_EPSILON = 0.22
/** How long after one customer leaves before the next walks in. */
const RESPAWN_DELAY = 14

const ROUTE: readonly Leg[] = [
  { x: DOORS.entranceX, z: STORE.maxZ - 1.4, dwell: 0, state: 'arriving' },
  { x: DOORS.entranceX, z: 4.4, dwell: 0, state: 'arriving' },
  { x: -7.75, z: 1.2, dwell: 4, state: 'browsing' },
  { x: -7.75, z: -3.5, dwell: 5, state: 'browsing' },
  { x: -4.25, z: -3.5, dwell: 4, state: 'browsing' },
  { x: -4.25, z: 3.8, dwell: 0, state: 'approaching' },
  { x: -1.2, z: 4.2, dwell: 0, state: 'waiting' },
]

const EXIT_ROUTE: readonly Leg[] = [
  { x: 4.6, z: 4.2, dwell: 0, state: 'leaving' },
  { x: DOORS.exitX, z: 6.6, dwell: 0, state: 'leaving' },
  { x: DOORS.exitX, z: STORE.maxZ + 1.5, dwell: 0, state: 'away' },
]

const SHIRTS = [0x8c3f3a, 0x3a5a8c, 0x4a7a4a, 0x7a5f8c, 0x8c7a3a]

function pickBasket(): Title[] {
  const picks: Title[] = []
  const wanted = 1 + Math.floor(Math.random() * 2)
  while (picks.length < wanted) {
    const title = CATALOG[Math.floor(Math.random() * CATALOG.length)]
    if (title && !picks.includes(title)) picks.push(title)
  }
  return picks
}

const FIRST = ['Dale', 'Marcy', 'Ron', 'Tina', 'Curtis', 'Bev', 'Doug', 'Shawna']
const LAST = ['Pruitt', 'Castellano', 'Boyd', 'Ferrara', 'Whitaker', 'Nunez', 'Blanchard']

const pick = <T,>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)]!

export class Customer {
  readonly root = new THREE.Group()

  state: CustomerState = 'away'
  basket: Title[] = []
  name = ''
  memberNumber = ''

  private route: readonly Leg[] = ROUTE
  private leg = 0
  private dwellLeft = 0
  private respawnIn = 3
  private stride = 0

  private readonly shirt: THREE.Mesh

  constructor() {
    const legs = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.8, 0.26),
      createPS1Material({ color: 0x2f3440 }),
    )
    legs.position.y = 0.4
    this.root.add(legs)

    this.shirt = new THREE.Mesh(
      new THREE.BoxGeometry(0.46, 0.6, 0.3),
      createPS1Material({ color: SHIRTS[0]! }),
    )
    this.shirt.position.y = 1.1
    this.root.add(this.shirt)

    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.26, 0.28, 0.26),
      createPS1Material({ color: 0xb98a62 }),
    )
    head.position.y = 1.54
    this.root.add(head)

    const hair = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.1, 0.28),
      createPS1Material({ color: 0x3a2a1e }),
    )
    hair.position.y = 1.69
    this.root.add(hair)

    this.root.visible = false
  }

  /** True while standing at the counter expecting to be served. */
  get isWaiting(): boolean {
    return this.state === 'waiting'
  }

  /** The player rang them up — send them to the door. */
  serve(): void {
    if (this.state !== 'waiting') return
    this.route = EXIT_ROUTE
    this.leg = 0
    this.dwellLeft = 0
    this.state = 'leaving'
  }

  reset(): void {
    this.state = 'away'
    this.root.visible = false
    this.respawnIn = 3
  }

  update(dt: number): void {
    if (this.state === 'away') {
      this.respawnIn -= dt
      if (this.respawnIn <= 0) this.enter()
      return
    }

    if (this.state === 'waiting') return

    if (this.dwellLeft > 0) {
      this.dwellLeft -= dt
      return
    }

    const leg = this.route[this.leg]
    if (!leg) return

    const dx = leg.x - this.root.position.x
    const dz = leg.z - this.root.position.z
    const distance = Math.hypot(dx, dz)

    if (distance < ARRIVE_EPSILON) {
      this.state = leg.state
      this.dwellLeft = leg.dwell
      this.leg += 1

      if (this.leg >= this.route.length) {
        if (this.state === 'away') {
          this.root.visible = false
          this.respawnIn = RESPAWN_DELAY
        }
        this.leg = this.route.length - 1
      }
      return
    }

    const step = Math.min(SPEED * dt, distance)
    this.root.position.x += (dx / distance) * step
    this.root.position.z += (dz / distance) * step
    this.root.rotation.y = Math.atan2(dx, dz)

    // A flat-footed trudge: the whole body dips a little on each step.
    this.stride += dt * 7
    this.root.position.y = Math.abs(Math.sin(this.stride)) * 0.045
  }

  private enter(): void {
    this.basket = pickBasket()
    this.name = `${pick(FIRST)} ${pick(LAST)}`
    this.memberNumber = `${1000 + Math.floor(Math.random() * 8999)}-${100 + Math.floor(Math.random() * 899)}`
    ;(this.shirt.material as THREE.ShaderMaterial).uniforms.uColor!.value.setHex(pick(SHIRTS))

    this.route = ROUTE
    this.leg = 0
    this.dwellLeft = 0
    this.state = 'arriving'
    this.root.position.set(DOORS.entranceX, 0, STORE.maxZ + 1.2)
    this.root.rotation.y = Math.PI
    this.root.visible = true
  }
}
