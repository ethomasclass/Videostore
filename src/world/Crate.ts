import * as THREE from 'three'
import { createPS1Material } from '../render/ps1Material'
import { GENRE_COLOR } from '../render/palette'
import { CATALOG, type Genre, type Title } from '../data/catalog'

/**
 * The shipment crate: a cardboard box of new stock that has to be out on the floor before
 * close. It is the one job that does not arrive on its own schedule — it sits in the corner
 * all shift being your fault, and every tape you pull out of it is a tape that then needs
 * shelving. That is the balance: the crate is always available and never urgent, so it is
 * what gets abandoned when the counter gets busy.
 */

/** How many tapes are in tonight's shipment. */
export const SHIPMENT_SIZE = 10

const CARD = 0x9a7a52
const CARD_DARK = 0x836540
const BODY = { width: 0.8, height: 0.5, depth: 0.6 } as const
/** Sleeves stand with their top third above the rim, which is how a packed box looks. */
const STOCK_Y = 0.57

const ease = (t: number): number => t * t * (3 - 2 * t)

export class Crate {
  readonly root = new THREE.Group()

  /** What is still in the box. */
  private left = SHIPMENT_SIZE
  private readonly stack: THREE.Mesh[] = []
  private readonly flaps: THREE.Group[] = []
  /** 0 shut, 1 flat open. */
  private lid = 0
  private lidTarget = 0
  /** The tape currently being lifted out, and how far through that lift it is. */
  private lifting: THREE.Mesh | null = null
  private liftTime = 0
  private liftBase = STOCK_Y

  constructor() {
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(BODY.width, BODY.height, BODY.depth),
      createPS1Material({ color: CARD }),
    )
    body.position.y = BODY.height / 2
    this.root.add(body)

    // A shipping label on the side that faces the room.
    const label = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.2, 0.01),
      createPS1Material({ color: 0xe8e2d0, decal: true }),
    )
    label.position.set(0, BODY.height / 2, BODY.depth / 2 + 0.006)
    this.root.add(label)

    // Four flaps hinged along the top edges, so opening it is the box unfolding itself.
    const flapSpecs = [
      { w: BODY.width, d: BODY.depth / 2, x: 0, z: -BODY.depth / 2, axis: 'x' as const, sign: -1 },
      { w: BODY.width, d: BODY.depth / 2, x: 0, z: BODY.depth / 2, axis: 'x' as const, sign: 1 },
      { w: BODY.depth, d: BODY.width / 2, x: -BODY.width / 2, z: 0, axis: 'z' as const, sign: -1 },
      { w: BODY.depth, d: BODY.width / 2, x: BODY.width / 2, z: 0, axis: 'z' as const, sign: 1 },
    ]

    for (const spec of flapSpecs) {
      const hinge = new THREE.Group()
      hinge.position.set(spec.x, BODY.height, spec.z)
      if (spec.axis === 'z') hinge.rotation.y = Math.PI / 2
      this.root.add(hinge)

      const flap = new THREE.Mesh(
        new THREE.BoxGeometry(spec.w, 0.012, spec.d),
        createPS1Material({ color: CARD_DARK }),
      )
      // Hinged along the edge, with the panel reaching *inward* across the top of the box —
      // that is the closed state, and it is what makes the open state read as the flap
      // swinging up over the hinge and down the outside.
      flap.position.z = -spec.sign * (spec.d / 2)
      hinge.add(flap)
      hinge.userData.sign = spec.sign
      this.flaps.push(hinge)
    }

    // The stock itself: sleeves standing on end, in genre colours so the box reads as full.
    // Cycled through the genre colours rather than taken off the front of the catalogue,
    // which handed out four reds in a row and made a packed box read as two objects.
    const SPREAD: Genre[] = ['action', 'comedy', 'horror', 'scifi', 'family', 'drama']
    for (let i = 0; i < SHIPMENT_SIZE; i += 1) {
      const genre = SPREAD[(i * 2 + Math.floor(i / 5)) % SPREAD.length] ?? 'action'
      const sleeve = new THREE.Mesh(
        new THREE.BoxGeometry(0.11, 0.2, 0.034),
        createPS1Material({ color: GENRE_COLOR[genre] }),
      )
      // A packed box is never level: each sleeve sits a centimetre or two off its neighbour.
      sleeve.position.set(-0.22 + (i % 5) * 0.11, STOCK_Y - (i % 3) * 0.018, i < 5 ? -0.11 : 0.13)
      sleeve.rotation.y = (i % 3) * 0.06 - 0.04
      sleeve.rotation.z = ((i % 4) - 1.5) * 0.03
      sleeve.visible = false
      this.root.add(sleeve)
      this.stack.push(sleeve)
    }
  }

  get remaining(): number {
    return this.left
  }

  get isEmpty(): boolean {
    return this.left === 0
  }

  get isOpen(): boolean {
    return this.lidTarget > 0
  }

  reset(): void {
    this.left = SHIPMENT_SIZE
    this.lid = 0
    this.lidTarget = 0
    this.lifting = null
    for (const [index, sleeve] of this.stack.entries()) {
      sleeve.position.y = STOCK_Y - (index % 3) * 0.018
    }
    this.applyLid()
  }

  /** First interaction just opens the box. Returns true when that is all it did. */
  open(): boolean {
    if (this.lidTarget > 0) return false
    this.lidTarget = 1
    return true
  }

  /** Pulls one out. Returns the title it turned out to be, or null if the box is empty. */
  take(): Title | null {
    if (this.left === 0) return null
    this.left -= 1
    const sleeve = this.stack[this.left]
    if (sleeve) {
      this.lifting = sleeve
      this.liftBase = sleeve.position.y
      this.liftTime = 0
    }
    return CATALOG[Math.floor(Math.random() * CATALOG.length)] ?? null
  }

  update(dt: number): void {
    if (this.lid !== this.lidTarget) {
      this.lid = THREE.MathUtils.damp(this.lid, this.lidTarget, 6, dt)
      if (Math.abs(this.lid - this.lidTarget) < 0.004) this.lid = this.lidTarget
      this.applyLid()
    }

    if (this.lifting) {
      // applyLid counts it as already gone, so keep it on screen until the lift finishes.
      this.lifting.visible = true
      this.liftTime += dt
      const t = Math.min(this.liftTime / 0.55, 1)
      this.lifting.position.y = this.liftBase + ease(t) * 0.4
      if (t >= 1) {
        this.lifting.visible = false
        this.lifting.position.y = this.liftBase
        this.lifting = null
      }
    }
  }

  private applyLid(): void {
    const open = ease(this.lid)
    for (const hinge of this.flaps) {
      const sign = (hinge.userData.sign as number) ?? 1
      // A bit past 180 degrees, so each flap lands just outside its own wall and sags.
      hinge.rotation.x = sign * open * 3.3
    }

    // Shut, the stock is under the flaps and nobody can see it; open, it should be standing
    // proud of the rim. Both, rather than sleeves poking through a closed lid.
    for (const [index, sleeve] of this.stack.entries()) {
      sleeve.visible = index < this.left && this.lid > 0.12
    }
  }
}
