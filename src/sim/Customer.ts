import * as THREE from 'three'
import { createPS1Material } from '../render/ps1Material'
import { faceTexture, FACES } from '../render/faceTexture'
import { hitbox, DOORS, STORE } from '../world/buildKit'
import { CATALOG, type Title } from '../data/catalog'
import { dialogue, requestLine } from '../data/dialogue'

/**
 * One customer, walking a fixed round: in at the entrance, a browse at two shelves, the counter,
 * then out at the exit. Deliberately the simplest agent that produces the whole loop — there is
 * no steering or avoidance yet, because the shape of the loop is what needs to be right first.
 *
 * What they do have is a face, a pair of arms and something to say. A blocky torso that walks
 * to a mark and stands there is a placeholder; the same torso holding two tapes out across the
 * counter while it complains about its late fee is the game.
 */

export type CustomerState = 'arriving' | 'browsing' | 'approaching' | 'waiting' | 'leaving' | 'away'

export interface Speech {
  name: string
  text: string
}

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
/** How long they stand at the till before they start making remarks about it. */
const PATIENCE = 12

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

const SHIRTS = [0x8c3f3a, 0x3a5a8c, 0x4a7a4a, 0x7a5f8c, 0x8c7a3a, 0xb0663a, 0x2f6f6a]
const TROUSERS = [0x2f3440, 0x3d4658, 0x5a4a3a, 0x2a3a2a]
const HAIR = [0x3a2a1e, 0x1d1a16, 0x6b4a24, 0x8a6a3a, 0x59504a]

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

/** Shoulder pivot plus a forearm hanging off it, so the arm swings from the right place. */
function buildArm(side: -1 | 1): { pivot: THREE.Group; sleeve: THREE.Mesh; hand: THREE.Mesh } {
  const pivot = new THREE.Group()
  pivot.position.set(side * 0.28, 1.34, 0)

  const sleeve = new THREE.Mesh(
    new THREE.BoxGeometry(0.11, 0.34, 0.13),
    createPS1Material({ color: SHIRTS[0]! }),
  )
  sleeve.position.y = -0.17
  pivot.add(sleeve)

  const hand = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.12, 0.12),
    createPS1Material({ color: 0xb98a62 }),
  )
  hand.position.y = -0.4
  pivot.add(hand)

  return { pivot, sleeve, hand }
}

export class Customer {
  readonly root = new THREE.Group()
  /** What the player's crosshair has to land on to start a conversation. */
  readonly talkZone = hitbox(0.9, 1.9, 0.9)

  state: CustomerState = 'away'
  basket: Title[] = []
  name = ''
  memberNumber = ''

  private route: readonly Leg[] = ROUTE
  private leg = 0
  private dwellLeft = 0
  private respawnIn = 3
  private stride = 0
  private waitTime = 0
  private grumbled = false
  private pending: Speech | null = null
  /** Where they are turning to look, and for how long: being talked to turns a head. */
  private lookAt: THREE.Vector3 | null = null
  private lookLeft = 0

  private readonly shirt: THREE.Mesh
  private readonly trousers: THREE.Mesh
  private readonly head: THREE.Mesh
  private readonly hair: THREE.Mesh
  private readonly face: THREE.Mesh
  private readonly arms: readonly { pivot: THREE.Group; sleeve: THREE.Mesh; hand: THREE.Mesh }[]
  private readonly held = new THREE.Group()

  constructor() {
    this.trousers = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.8, 0.26),
      createPS1Material({ color: TROUSERS[0]! }),
    )
    this.trousers.position.y = 0.4
    this.root.add(this.trousers)

    this.shirt = new THREE.Mesh(
      new THREE.BoxGeometry(0.46, 0.6, 0.3),
      createPS1Material({ color: SHIRTS[0]! }),
    )
    this.shirt.position.y = 1.1
    this.root.add(this.shirt)

    this.head = new THREE.Mesh(
      new THREE.BoxGeometry(0.26, 0.28, 0.26),
      createPS1Material({ color: 0xb98a62 }),
    )
    this.head.position.y = 1.54
    this.root.add(this.head)

    // The face is its own plate a hair proud of the head, rather than a material group on the
    // box: one shader material per mesh is the deal everywhere else in this project.
    this.face = new THREE.Mesh(
      new THREE.PlaneGeometry(0.26, 0.28),
      createPS1Material({ map: faceTexture('curtains') }),
    )
    this.face.position.set(0, 1.54, 0.132)
    this.root.add(this.face)

    this.hair = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.1, 0.28),
      createPS1Material({ color: HAIR[0]! }),
    )
    this.hair.position.y = 1.69
    this.root.add(this.hair)

    this.arms = [buildArm(-1), buildArm(1)]
    for (const arm of this.arms) this.root.add(arm.pivot)

    // What they carry to the counter. Parented to the right hand, so handing it over is just
    // the arm animation — the tapes go where the arm goes.
    this.arms[1]?.pivot.add(this.held)
    this.held.position.set(0, -0.46, 0.04)

    this.talkZone.position.y = 0.95
    this.root.add(this.talkZone)

    this.root.visible = false
  }

  /** True while standing at the counter expecting to be served. */
  get isWaiting(): boolean {
    return this.state === 'waiting'
  }

  get isPresent(): boolean {
    return this.state !== 'away'
  }

  /** The player rang them up — send them to the door. */
  serve(): void {
    if (this.state !== 'waiting') return
    this.route = EXIT_ROUTE
    this.leg = 0
    this.dwellLeft = 0
    this.state = 'leaving'
    this.held.visible = false
    this.say(dialogue('farewell'))
  }

  /** The player walked up and pressed the talk key. */
  chat(from?: THREE.Vector3): void {
    if (!this.isPresent) return
    if (from) {
      this.lookAt = from.clone()
      this.lookLeft = 5
    }
    this.say(this.state === 'waiting' ? this.counterLine() : dialogue('browsing'))
  }

  /** Takes whatever the customer has said since the last call, if anything. */
  consumeSpeech(): Speech | null {
    const line = this.pending
    this.pending = null
    return line
  }

  reset(): void {
    this.state = 'away'
    this.root.visible = false
    this.respawnIn = 3
    this.pending = null
  }

  update(dt: number): void {
    if (this.state === 'away') {
      this.respawnIn -= dt
      if (this.respawnIn <= 0) this.enter()
      return
    }

    this.updateLook(dt)

    if (this.state === 'waiting') {
      this.waitTime += dt
      // Arms out across the counter, holding the tapes where the clerk can take them.
      this.poseHandOver(dt)
      if (!this.grumbled && this.waitTime > PATIENCE) {
        this.grumbled = true
        this.say(dialogue('impatient'))
      }
      return
    }

    if (this.dwellLeft > 0) {
      this.dwellLeft -= dt
      this.swingArms(dt, false)
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

      // Reaching the till is always a transition: the waiting branch returns above, so this
      // runs exactly once per visit.
      if (this.state === 'waiting') {
        // Square up to the counter — which is at +Z from the queue side, and +Z is the way
        // the face plate points — and open with whatever they came in to say.
        this.root.rotation.y = 0
        this.waitTime = 0
        this.grumbled = false
        this.say(this.counterLine())
      }

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
    this.swingArms(dt, true)
  }

  /** Turning to whoever is talking to them — the one bit of body language they have. */
  private updateLook(dt: number): void {
    if (this.lookLeft <= 0 || !this.lookAt) return
    this.lookLeft -= dt
    const dx = this.lookAt.x - this.root.position.x
    const dz = this.lookAt.z - this.root.position.z
    if (dx === 0 && dz === 0) return
    const wanted = Math.atan2(dx, dz)
    // Shortest way round, so nobody spins three quarters of a turn to say hello.
    let delta = wanted - this.root.rotation.y
    while (delta > Math.PI) delta -= Math.PI * 2
    while (delta < -Math.PI) delta += Math.PI * 2
    this.root.rotation.y += delta * Math.min(1, dt * 6)
  }

  /** Opposed swing while walking, easing back to hanging when they stop. */
  private swingArms(dt: number, walking: boolean): void {
    const amplitude = walking ? Math.sin(this.stride) * 0.5 : 0
    this.arms.forEach((arm, index) => {
      const target = index === 0 ? amplitude : -amplitude
      arm.pivot.rotation.x = THREE.MathUtils.damp(arm.pivot.rotation.x, target, 12, dt)
      arm.pivot.rotation.z = THREE.MathUtils.damp(arm.pivot.rotation.z, 0, 12, dt)
    })
    // They pick up what they came for on the way to the till, and carry it from there.
    this.held.visible = this.basket.length > 0 && this.state === 'approaching'
  }

  private poseHandOver(dt: number): void {
    this.arms.forEach((arm, index) => {
      // Right arm out with the tapes, left one along for the ride.
      arm.pivot.rotation.x = THREE.MathUtils.damp(arm.pivot.rotation.x, index === 1 ? -1.35 : -0.5, 8, dt)
      arm.pivot.rotation.z = THREE.MathUtils.damp(arm.pivot.rotation.z, index === 1 ? 0.12 : -0.08, 8, dt)
    })
    this.held.visible = this.basket.length > 0
  }

  /** Half the time they name what they want, half the time they just start talking. */
  private counterLine(): string {
    const title = this.basket[0]
    return title && Math.random() < 0.5 ? requestLine(title) : dialogue('counter')
  }

  private say(text: string): void {
    this.pending = { name: this.name, text }
  }

  private enter(): void {
    this.basket = pickBasket()
    this.name = `${pick(FIRST)} ${pick(LAST)}`
    this.memberNumber = `${1000 + Math.floor(Math.random() * 8999)}-${100 + Math.floor(Math.random() * 899)}`

    // A fresh person each time: face, skin, hair, shirt, trousers.
    const face = pick(FACES)
    ;(this.face.material as THREE.ShaderMaterial).uniforms.uMap!.value = faceTexture(face.id)
    ;(this.head.material as THREE.ShaderMaterial).uniforms.uColor!.value.setHex(face.skin)
    const shirt = pick(SHIRTS)
    ;(this.shirt.material as THREE.ShaderMaterial).uniforms.uColor!.value.setHex(shirt)
    ;(this.hair.material as THREE.ShaderMaterial).uniforms.uColor!.value.setHex(pick(HAIR))
    ;(this.trousers.material as THREE.ShaderMaterial).uniforms.uColor!.value.setHex(pick(TROUSERS))
    for (const arm of this.arms) {
      ;(arm.sleeve.material as THREE.ShaderMaterial).uniforms.uColor!.value.setHex(shirt)
      ;(arm.hand.material as THREE.ShaderMaterial).uniforms.uColor!.value.setHex(face.skin)
    }

    // Rebuild what they are carrying: one sleeve per title in the basket.
    this.held.clear()
    this.basket.forEach((_, index) => {
      const sleeve = new THREE.Mesh(
        new THREE.BoxGeometry(0.13, 0.22, 0.04),
        createPS1Material({ color: 0x1b1e25 }),
      )
      sleeve.position.set(0, index * 0.05, 0)
      sleeve.rotation.x = Math.PI / 2
      this.held.add(sleeve)
    })
    this.held.visible = false

    this.route = ROUTE
    this.leg = 0
    this.dwellLeft = 0
    this.state = 'arriving'
    this.lookLeft = 0
    this.lookAt = null
    this.root.position.set(DOORS.entranceX, 0, STORE.maxZ + 1.2)
    this.root.rotation.y = Math.PI
    this.root.visible = true
    this.say(dialogue('greeting'))
  }
}
