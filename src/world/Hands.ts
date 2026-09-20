import * as THREE from 'three'
import { createPS1Material } from '../render/ps1Material'
import { BRAND } from '../render/palette'

/**
 * First-person arms, parented to the camera. Two boxes an arm and one for whatever is being
 * held — at this fidelity the silhouette and the timing carry the performance, not the model.
 *
 * Actions take time, which is the point: a station that resolves on a keypress reads as a menu,
 * and the same station with a second of animation in front of it reads as work.
 */

/** Mirrors StationKind exactly: every station has exactly one animation. */
export type HandAction = 'rewind' | 'shelf' | 'register' | 'returns' | 'restock'

type Vec3 = readonly [number, number, number]

interface Keyframe {
  /** Normalised time through the clip. */
  t: number
  pos: Vec3
  rot: Vec3
}

interface Clip {
  duration: number
  right: readonly Keyframe[]
  left?: readonly Keyframe[]
  holds: 'tape' | 'case' | null
  /** When the held prop disappears — the moment the tape goes into the deck, or onto the shelf. */
  releaseAt?: number
}

const REST_RIGHT: Vec3 = [0.29, -0.29, -0.54]
const REST_LEFT: Vec3 = [-0.31, -0.31, -0.58]

const CLIPS: Record<HandAction, Clip> = {
  // Slot the tape into the deck, hold while it seats, withdraw.
  rewind: {
    duration: 1.25,
    holds: 'tape',
    releaseAt: 0.55,
    right: [
      { t: 0, pos: REST_RIGHT, rot: [0, -0.2, 0] },
      { t: 0.35, pos: [0.16, -0.26, -0.62], rot: [-0.3, -0.1, 0] },
      { t: 0.55, pos: [0.14, -0.28, -0.74], rot: [-0.45, -0.05, 0] },
      { t: 0.75, pos: [0.2, -0.3, -0.58], rot: [-0.2, -0.1, 0] },
      { t: 1, pos: REST_RIGHT, rot: [0, -0.2, 0] },
    ],
  },
  // Reach up and forward, push the case into the row, drop the arm.
  shelf: {
    duration: 1.35,
    holds: 'case',
    releaseAt: 0.62,
    right: [
      { t: 0, pos: REST_RIGHT, rot: [0, -0.2, 0] },
      { t: 0.3, pos: [0.24, -0.1, -0.6], rot: [-0.5, -0.15, 0.1] },
      { t: 0.62, pos: [0.22, -0.04, -0.78], rot: [-0.7, -0.1, 0.05] },
      { t: 0.8, pos: [0.26, -0.18, -0.6], rot: [-0.3, -0.15, 0] },
      { t: 1, pos: REST_RIGHT, rot: [0, -0.2, 0] },
    ],
  },
  // Two taps at the keyboard, then a reach across for the customer's card.
  register: {
    duration: 1.1,
    holds: null,
    right: [
      { t: 0, pos: REST_RIGHT, rot: [0, -0.2, 0] },
      { t: 0.2, pos: [0.22, -0.4, -0.62], rot: [-0.55, -0.1, 0] },
      { t: 0.34, pos: [0.22, -0.34, -0.6], rot: [-0.4, -0.1, 0] },
      { t: 0.5, pos: [0.18, -0.4, -0.64], rot: [-0.55, -0.05, 0] },
      { t: 0.72, pos: [0.3, -0.3, -0.7], rot: [-0.3, -0.35, 0] },
      { t: 1, pos: REST_RIGHT, rot: [0, -0.2, 0] },
    ],
  },
  // Lean down into the bin and come back up with a tape.
  returns: {
    duration: 1.2,
    holds: 'tape',
    releaseAt: 0.95,
    right: [
      { t: 0, pos: REST_RIGHT, rot: [0, -0.2, 0] },
      { t: 0.35, pos: [0.24, -0.54, -0.5], rot: [0.4, -0.2, 0] },
      { t: 0.6, pos: [0.24, -0.46, -0.54], rot: [0.1, -0.2, 0] },
      { t: 1, pos: REST_RIGHT, rot: [0, -0.2, 0] },
    ],
  },
  // Both hands: pull the flaps open.
  restock: {
    duration: 1.3,
    holds: null,
    right: [
      { t: 0, pos: REST_RIGHT, rot: [0, -0.2, 0] },
      { t: 0.4, pos: [0.3, -0.48, -0.66], rot: [0.2, -0.3, 0] },
      { t: 0.65, pos: [0.44, -0.42, -0.58], rot: [0, -0.5, 0] },
      { t: 1, pos: REST_RIGHT, rot: [0, -0.2, 0] },
    ],
    left: [
      { t: 0, pos: REST_LEFT, rot: [0, 0.2, 0] },
      { t: 0.4, pos: [-0.3, -0.5, -0.66], rot: [0.2, 0.3, 0] },
      { t: 0.65, pos: [-0.44, -0.44, -0.58], rot: [0, 0.5, 0] },
      { t: 1, pos: REST_LEFT, rot: [0, 0.2, 0] },
    ],
  },
}

const SKIN = 0xb98a62
const SLEEVE = 0x22407d

function buildArm(mirror: number): { group: THREE.Group; anchor: THREE.Object3D } {
  const group = new THREE.Group()

  // Kept short on purpose: a longer forearm reaches back toward the near plane and fills a
  // third of the screen with one untextured face.
  const sleeve = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.09, 0.2),
    createPS1Material({ color: SLEEVE }),
  )
  sleeve.position.set(0, 0, 0.1)
  group.add(sleeve)

  const hand = new THREE.Mesh(
    new THREE.BoxGeometry(0.095, 0.065, 0.14),
    createPS1Material({ color: SKIN }),
  )
  hand.position.set(0, 0, -0.03)
  group.add(hand)

  const thumb = new THREE.Mesh(
    new THREE.BoxGeometry(0.028, 0.045, 0.065),
    createPS1Material({ color: SKIN }),
  )
  thumb.position.set(mirror * -0.048, 0.02, -0.03)
  group.add(thumb)

  // Props hang off the hand so they inherit its motion for free.
  const anchor = new THREE.Object3D()
  anchor.position.set(0, 0.02, -0.11)
  group.add(anchor)

  return { group, anchor }
}

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t
/** Ease in and out, so nothing starts or stops with a snap. */
const ease = (t: number): number => t * t * (3 - 2 * t)

function sample(frames: readonly Keyframe[], t: number): { pos: Vec3; rot: Vec3 } {
  const first = frames[0]!
  if (t <= first.t) return { pos: first.pos, rot: first.rot }

  for (let i = 1; i < frames.length; i += 1) {
    const b = frames[i]!
    if (t > b.t) continue
    const a = frames[i - 1]!
    const span = b.t - a.t
    const k = ease(span <= 0 ? 1 : (t - a.t) / span)
    return {
      pos: [lerp(a.pos[0], b.pos[0], k), lerp(a.pos[1], b.pos[1], k), lerp(a.pos[2], b.pos[2], k)],
      rot: [lerp(a.rot[0], b.rot[0], k), lerp(a.rot[1], b.rot[1], k), lerp(a.rot[2], b.rot[2], k)],
    }
  }

  const last = frames[frames.length - 1]!
  return { pos: last.pos, rot: last.rot }
}

export class Hands {
  readonly root = new THREE.Group()

  private readonly right = buildArm(1)
  private readonly left = buildArm(-1)
  private readonly tape: THREE.Mesh
  private readonly case: THREE.Mesh

  private clip: Clip | null = null
  private elapsed = 0
  private sway = 0

  constructor() {
    this.root.add(this.right.group, this.left.group)

    // A bare tape, and a sleeve with the house colours on it.
    this.tape = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.19, 0.026),
      createPS1Material({ color: 0x1b1b20 }),
    )
    this.tape.rotation.x = Math.PI / 2
    this.tape.visible = false
    this.right.anchor.add(this.tape)

    this.case = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.2, 0.032),
      createPS1Material({ color: BRAND.blue }),
    )
    this.case.rotation.x = Math.PI / 2
    this.case.visible = false
    this.right.anchor.add(this.case)

    this.applyPose(this.right.group, { pos: REST_RIGHT, rot: [0, -0.2, 0] })
    this.applyPose(this.left.group, { pos: REST_LEFT, rot: [0, 0.2, 0] })
  }

  get isBusy(): boolean {
    return this.clip !== null
  }

  /** Returns the clip length so the caller can hold the player still for exactly that long. */
  play(action: HandAction): number {
    this.clip = CLIPS[action]
    this.elapsed = 0
    this.tape.visible = this.clip.holds === 'tape'
    this.case.visible = this.clip.holds === 'case'
    return this.clip.duration
  }

  update(dt: number, moving: boolean): void {
    if (this.clip) {
      this.elapsed += dt
      const t = Math.min(this.elapsed / this.clip.duration, 1)

      this.applyPose(this.right.group, sample(this.clip.right, t))
      if (this.clip.left) this.applyPose(this.left.group, sample(this.clip.left, t))

      if (this.clip.releaseAt !== undefined && t >= this.clip.releaseAt) {
        this.tape.visible = false
        this.case.visible = false
      }

      if (t >= 1) {
        this.clip = null
        this.applyPose(this.right.group, { pos: REST_RIGHT, rot: [0, -0.2, 0] })
        this.applyPose(this.left.group, { pos: REST_LEFT, rot: [0, 0.2, 0] })
      }
      return
    }

    // Idle: a slow breath, and a wider swing while walking.
    this.sway += dt * (moving ? 7 : 1.6)
    const amount = moving ? 0.035 : 0.008
    const bob = Math.sin(this.sway) * amount
    const drift = Math.cos(this.sway * 0.5) * amount * 0.6

    this.right.group.position.set(REST_RIGHT[0] + drift, REST_RIGHT[1] + bob, REST_RIGHT[2])
    this.left.group.position.set(REST_LEFT[0] - drift, REST_LEFT[1] - bob, REST_LEFT[2])
  }

  private applyPose(group: THREE.Group, pose: { pos: Vec3; rot: Vec3 }): void {
    group.position.set(pose.pos[0], pose.pos[1], pose.pos[2])
    group.rotation.set(pose.rot[0], pose.rot[1], pose.rot[2])
  }
}
