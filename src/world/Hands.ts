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

/**
 * One per station, plus 'stock' — the crate is two different actions at the same station:
 * getting the box open, and then taking things out of it one at a time.
 */
export type HandAction =
  | 'rewind'
  | 'shelf'
  | 'register'
  | 'returns'
  | 'restock'
  | 'stock'
  | 'phone'
  | 'tidy'

type Vec3 = readonly [number, number, number]

interface Keyframe {
  /** Normalised time through the clip. */
  t: number
  pos: Vec3
  rot: Vec3
}

type Prop = 'tape' | 'case'

interface Clip {
  duration: number
  right: readonly Keyframe[]
  left?: readonly Keyframe[]
  /** What the right hand starts the clip holding. */
  holds: Prop | null
  /** What the left hand starts the clip holding, for two-handed business. */
  leftHolds?: Prop | null
  /** When the right hand's prop disappears — into the deck, or onto the shelf. */
  releaseAt?: number
  /** When the left hand's prop disappears. */
  leftReleaseAt?: number
  /** When a prop appears in the right hand mid-clip: the tape coming out of its sleeve. */
  takesAt?: number
  takes?: Prop
  /** Window over which the left hand's case swings open at its spine, like a book. */
  caseOpens?: readonly [number, number]
}

const REST_RIGHT: Vec3 = [0.29, -0.29, -0.54]
const REST_LEFT: Vec3 = [-0.31, -0.31, -0.58]

/**
 * Everything the hands actually do happens in a band between roughly -0.10 and -0.30 below
 * the eye line. Lower than that and the business plays out under the bottom edge of the
 * screen: the animation runs, nobody ever sees it, and the station reads as a keypress again.
 */
const CLIPS: Record<HandAction, Clip> = {
  /**
   * The whole business, not just the last beat of it: the sleeve comes up in the left hand,
   * the right hand opens it and draws the tape out, and only then does the tape go into the
   * deck. Loading a tape that materialised in your fist was the part that read as a menu.
   */
  rewind: {
    duration: 2.1,
    holds: null,
    leftHolds: 'case',
    takes: 'tape',
    takesAt: 0.46,
    releaseAt: 0.76,
    leftReleaseAt: 0.93,
    caseOpens: [0.28, 0.42],
    right: [
      { t: 0, pos: REST_RIGHT, rot: [0, -0.2, 0] },
      { t: 0.2, pos: [0.2, -0.2, -0.5], rot: [-0.2, -0.15, 0] },
      // Fingers on the cover, and the case visibly swings open under them.
      { t: 0.3, pos: [-0.02, -0.15, -0.47], rot: [-0.25, -0.05, -0.18] },
      { t: 0.42, pos: [-0.06, -0.15, -0.46], rot: [-0.28, 0.15, -0.2] },
      // Draws the tape clear, off to the right and high enough to actually see it.
      { t: 0.55, pos: [0.2, -0.12, -0.44], rot: [-0.18, -0.12, 0.38] },
      // And down into the deck.
      { t: 0.76, pos: [0.14, -0.26, -0.66], rot: [-0.45, -0.05, 0.05] },
      { t: 0.88, pos: [0.22, -0.26, -0.55], rot: [-0.18, -0.12, 0] },
      { t: 1, pos: REST_RIGHT, rot: [0, -0.2, 0] },
    ],
    left: [
      { t: 0, pos: REST_LEFT, rot: [0, 0.2, 0] },
      { t: 0.2, pos: [-0.16, -0.17, -0.5], rot: [-0.25, 0.18, 0] },
      // Holds it steady while the tape comes out, tipping it open a little.
      { t: 0.42, pos: [-0.16, -0.17, -0.5], rot: [-0.32, 0.22, -0.14] },
      { t: 0.6, pos: [-0.17, -0.19, -0.5], rot: [-0.28, 0.2, -0.1] },
      { t: 0.85, pos: [-0.28, -0.3, -0.56], rot: [-0.05, 0.2, 0] },
      { t: 1, pos: REST_LEFT, rot: [0, 0.2, 0] },
    ],
  },
  // Reach up and forward, push the case into the row, drop the arm.
  shelf: {
    duration: 1.35,
    holds: 'case',
    releaseAt: 0.62,
    right: [
      { t: 0, pos: REST_RIGHT, rot: [0, -0.2, 0] },
      { t: 0.3, pos: [0.22, -0.1, -0.52], rot: [-0.45, -0.15, 0.1] },
      { t: 0.55, pos: [0.2, -0.04, -0.7], rot: [-0.65, -0.1, 0.05] },
      // The push in, a slight give back, and the second tap that seats it flush.
      { t: 0.62, pos: [0.2, -0.04, -0.74], rot: [-0.68, -0.1, 0.05] },
      { t: 0.68, pos: [0.2, -0.05, -0.7], rot: [-0.62, -0.1, 0.05] },
      { t: 0.74, pos: [0.2, -0.04, -0.73], rot: [-0.66, -0.1, 0.05] },
      { t: 0.85, pos: [0.24, -0.16, -0.56], rot: [-0.3, -0.15, 0] },
      { t: 1, pos: REST_RIGHT, rot: [0, -0.2, 0] },
    ],
  },
  // Reach down into the open box and bring a sleeve up where you can see it.
  stock: {
    duration: 1.5,
    holds: null,
    takes: 'case',
    takesAt: 0.38,
    releaseAt: 0.96,
    right: [
      { t: 0, pos: REST_RIGHT, rot: [0, -0.2, 0] },
      { t: 0.25, pos: [0.26, -0.42, -0.52], rot: [0.42, -0.2, 0] },
      { t: 0.38, pos: [0.26, -0.46, -0.54], rot: [0.5, -0.2, 0] },
      // Up into view and held there a beat, tilted — the checking-the-label moment, which is
      // the whole difference between stocking and just grabbing.
      { t: 0.56, pos: [0.18, -0.14, -0.46], rot: [-0.08, -0.25, 0.12] },
      { t: 0.72, pos: [0.17, -0.13, -0.45], rot: [-0.12, -0.35, 0.22] },
      { t: 0.84, pos: [0.2, -0.15, -0.47], rot: [-0.08, -0.25, 0.12] },
      // Set aside to the right, out of frame, where the to-shelve pile lives.
      { t: 0.97, pos: [0.42, -0.3, -0.5], rot: [0.1, -0.4, 0] },
      { t: 1, pos: REST_RIGHT, rot: [0, -0.2, 0] },
    ],
  },
  // Squaring a shelf: three quick flat-palmed pushes along the row, left to right.
  tidy: {
    duration: 1.15,
    holds: null,
    right: [
      { t: 0, pos: REST_RIGHT, rot: [0, -0.2, 0] },
      { t: 0.18, pos: [-0.05, -0.12, -0.6], rot: [-0.4, -0.05, 0] },
      { t: 0.28, pos: [-0.05, -0.12, -0.66], rot: [-0.5, -0.05, 0] },
      { t: 0.42, pos: [0.1, -0.12, -0.6], rot: [-0.4, -0.1, 0] },
      { t: 0.52, pos: [0.1, -0.12, -0.66], rot: [-0.5, -0.1, 0] },
      { t: 0.66, pos: [0.25, -0.13, -0.6], rot: [-0.4, -0.15, 0] },
      { t: 0.76, pos: [0.25, -0.13, -0.66], rot: [-0.5, -0.15, 0] },
      { t: 1, pos: REST_RIGHT, rot: [0, -0.2, 0] },
    ],
  },
  // Right hand up to the ear with the handset, a listening beat, and back to the cradle.
  phone: {
    duration: 1.9,
    holds: null,
    right: [
      { t: 0, pos: REST_RIGHT, rot: [0, -0.2, 0] },
      { t: 0.14, pos: [0.24, -0.24, -0.46], rot: [-0.3, -0.2, 0] },
      { t: 0.3, pos: [0.17, -0.06, -0.3], rot: [-0.5, -0.35, -0.35] },
      { t: 0.75, pos: [0.17, -0.05, -0.29], rot: [-0.52, -0.38, -0.38] },
      { t: 0.88, pos: [0.24, -0.22, -0.44], rot: [-0.25, -0.2, 0] },
      { t: 1, pos: REST_RIGHT, rot: [0, -0.2, 0] },
    ],
  },
  // Two taps at the keyboard, then a reach across for the customer's card.
  register: {
    duration: 1.1,
    holds: null,
    right: [
      { t: 0, pos: REST_RIGHT, rot: [0, -0.2, 0] },
      { t: 0.2, pos: [0.22, -0.32, -0.58], rot: [-0.5, -0.1, 0] },
      { t: 0.34, pos: [0.22, -0.26, -0.56], rot: [-0.35, -0.1, 0] },
      { t: 0.5, pos: [0.18, -0.32, -0.6], rot: [-0.5, -0.05, 0] },
      { t: 0.72, pos: [0.3, -0.22, -0.64], rot: [-0.28, -0.35, 0] },
      { t: 1, pos: REST_RIGHT, rot: [0, -0.2, 0] },
    ],
  },
  // Lean down into the bin and come back up with a tape.
  returns: {
    duration: 1.2,
    holds: null,
    takes: 'tape',
    takesAt: 0.4,
    releaseAt: 0.95,
    right: [
      { t: 0, pos: REST_RIGHT, rot: [0, -0.2, 0] },
      { t: 0.35, pos: [0.24, -0.44, -0.48], rot: [0.38, -0.2, 0] },
      { t: 0.62, pos: [0.24, -0.18, -0.5], rot: [0.0, -0.2, 0] },
      { t: 0.85, pos: [0.26, -0.2, -0.52], rot: [-0.05, -0.2, 0] },
      { t: 1, pos: REST_RIGHT, rot: [0, -0.2, 0] },
    ],
  },
  // Both hands: pull the flaps open.
  restock: {
    duration: 1.45,
    holds: null,
    right: [
      { t: 0, pos: REST_RIGHT, rot: [0, -0.2, 0] },
      // Down to the flap, a grip beat, then the pull up and out as the flap gives.
      { t: 0.3, pos: [0.26, -0.36, -0.6], rot: [0.2, -0.3, 0] },
      { t: 0.42, pos: [0.26, -0.36, -0.62], rot: [0.24, -0.3, 0] },
      { t: 0.6, pos: [0.4, -0.2, -0.52], rot: [-0.1, -0.45, 0.1] },
      { t: 0.72, pos: [0.44, -0.26, -0.5], rot: [0, -0.5, 0] },
      { t: 1, pos: REST_RIGHT, rot: [0, -0.2, 0] },
    ],
    left: [
      { t: 0, pos: REST_LEFT, rot: [0, 0.2, 0] },
      { t: 0.3, pos: [-0.26, -0.38, -0.6], rot: [0.2, 0.3, 0] },
      { t: 0.42, pos: [-0.26, -0.38, -0.62], rot: [0.24, 0.3, 0] },
      { t: 0.6, pos: [-0.4, -0.22, -0.52], rot: [-0.1, 0.45, -0.1] },
      { t: 0.72, pos: [-0.44, -0.28, -0.5], rot: [0, 0.5, 0] },
      { t: 1, pos: REST_LEFT, rot: [0, 0.2, 0] },
    ],
  },
}

const SKIN = 0xb98a62
const SLEEVE = 0x22407d

/**
 * The two props, built rather than coloured. A plain blue block in a blue sleeve is a block
 * you cannot see — which is why the case looked like nothing was happening. A rental clamshell
 * is near-black with a cream spine label on it, and that reads instantly against an arm.
 */
interface CaseProp {
  group: THREE.Group
  /** The front cover, hinged at the spine. Swinging it is what "opening the case" is. */
  lid: THREE.Group
}

function buildCaseProp(): CaseProp {
  const group = new THREE.Group()

  // Back half of the clamshell, with the house band down the spine edge.
  const back = new THREE.Mesh(
    new THREE.BoxGeometry(0.145, 0.235, 0.016),
    createPS1Material({ color: 0x17171d }),
  )
  back.position.z = -0.01
  group.add(back)

  const spine = new THREE.Mesh(
    new THREE.BoxGeometry(0.02, 0.235, 0.038),
    createPS1Material({ color: BRAND.blue }),
  )
  spine.position.x = -0.062
  group.add(spine)

  // Inside the shell: the dark well the tape sits in, revealed when the cover opens.
  const well = new THREE.Mesh(
    new THREE.BoxGeometry(0.115, 0.2, 0.012),
    createPS1Material({ color: 0x0c0d11 }),
  )
  well.position.z = 0.002
  group.add(well)

  // Front cover on a hinge at the spine, carrying the title sticker.
  const lid = new THREE.Group()
  lid.position.set(-0.052, 0, 0.012)
  group.add(lid)

  const cover = new THREE.Mesh(
    new THREE.BoxGeometry(0.145, 0.235, 0.014),
    createPS1Material({ color: 0x1b1c23 }),
  )
  cover.position.x = 0.052
  lid.add(cover)

  const label = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.07, 0.018),
    createPS1Material({ color: 0xe4dfcd }),
  )
  label.position.set(0.062, 0.055, 0)
  lid.add(label)

  // Held with its face toward the player. Flat-on — which is how these were posed before —
  // presents the 3cm edge to the camera, so the whole prop reads as a dark sliver and the
  // animation looks like nothing is in your hands at all.
  group.rotation.x = 0.22
  group.visible = false
  return { group, lid }
}

function buildTapeProp(): THREE.Group {
  const group = new THREE.Group()

  group.add(
    new THREE.Mesh(
      new THREE.BoxGeometry(0.125, 0.21, 0.03),
      createPS1Material({ color: 0x1b1b20 }),
    ),
  )

  // A barcode sticker and the window over the spools: the two things that say "tape".
  const sticker = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.045, 0.034),
    createPS1Material({ color: 0xd8d2c0 }),
  )
  sticker.position.y = -0.07
  group.add(sticker)

  const window = new THREE.Mesh(
    new THREE.BoxGeometry(0.075, 0.03, 0.034),
    createPS1Material({ color: 0x55585f }),
  )
  window.position.y = 0.055
  group.add(window)

  group.rotation.x = 0.18
  group.visible = false
  return group
}

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
  private readonly tape: THREE.Group
  private readonly case: CaseProp
  private readonly leftTape: THREE.Group
  private readonly leftCase: CaseProp

  private clip: Clip | null = null
  private elapsed = 0
  private sway = 0

  constructor() {
    this.root.add(this.right.group, this.left.group)

    // One pair per hand, so both can hold something at once — cheaper than reparenting a
    // single prop mid-clip and it lets the tape come out of a sleeve the other hand is holding.
    this.tape = buildTapeProp()
    this.case = buildCaseProp()
    this.right.anchor.add(this.tape, this.case.group)

    this.leftTape = buildTapeProp()
    this.leftCase = buildCaseProp()
    this.left.anchor.add(this.leftTape, this.leftCase.group)

    this.applyPose(this.right.group, { pos: REST_RIGHT, rot: [0, -0.2, 0] })
    this.applyPose(this.left.group, { pos: REST_LEFT, rot: [0, 0.2, 0] })
  }

  /**
   * How long into the rewind clip the tape actually reaches the deck. The deck waits this out
   * with its flap open, so the two animations meet instead of talking over each other.
   */
  get loadReach(): number {
    const clip = CLIPS.rewind
    return clip.duration * (clip.releaseAt ?? 0.75) - 0.35
  }

  /** What is in each hand, for the dev probe: scripted tests cannot see the screen corners. */
  get held(): string {
    const name = (tape: THREE.Object3D, sleeve: CaseProp): string =>
      tape.visible ? 'tape' : sleeve.group.visible ? 'case' : '-'
    return `${name(this.leftTape, this.leftCase)}/${name(this.tape, this.case)}`
  }

  get isBusy(): boolean {
    return this.clip !== null
  }

  /** Returns the clip length so the caller can hold the player still for exactly that long. */
  play(action: HandAction): number {
    this.clip = CLIPS[action]
    this.elapsed = 0
    this.tape.visible = this.clip.holds === 'tape'
    this.case.group.visible = this.clip.holds === 'case'
    this.leftTape.visible = this.clip.leftHolds === 'tape'
    this.leftCase.group.visible = this.clip.leftHolds === 'case'
    this.case.lid.rotation.y = 0
    this.leftCase.lid.rotation.y = 0
    return this.clip.duration
  }

  update(dt: number, moving: boolean): void {
    if (this.clip) {
      this.elapsed += dt
      const t = Math.min(this.elapsed / this.clip.duration, 1)

      this.applyPose(this.right.group, sample(this.clip.right, t))
      if (this.clip.left) this.applyPose(this.left.group, sample(this.clip.left, t))

      // The tape leaving the sleeve, then the sleeve and the tape being put down: three
      // moments, each just a prop blinking on or off under a hand that is already moving.
      if (this.clip.takesAt !== undefined && t >= this.clip.takesAt) {
        if (this.clip.takes === 'tape') this.tape.visible = true
        if (this.clip.takes === 'case') this.case.group.visible = true
      }

      if (this.clip.releaseAt !== undefined && t >= this.clip.releaseAt) {
        this.tape.visible = false
        this.case.group.visible = false
      }

      if (this.clip.leftReleaseAt !== undefined && t >= this.clip.leftReleaseAt) {
        this.leftTape.visible = false
        this.leftCase.group.visible = false
      }

      // The cover swings on its own schedule inside the clip, so the hand and the case agree
      // about when the opening happens.
      if (this.clip.caseOpens) {
        const [begin, finish] = this.clip.caseOpens
        const open = Math.min(Math.max((t - begin) / Math.max(finish - begin, 0.001), 0), 1)
        this.leftCase.lid.rotation.y = -ease(open) * 2.3
      }

      if (t >= 1) {
        this.clip = null
        this.tape.visible = false
        this.case.group.visible = false
        this.leftTape.visible = false
        this.leftCase.group.visible = false
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
