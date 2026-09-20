import * as THREE from 'three'
import { createPS1Material } from '../render/ps1Material'
import { GENRE_COLOR } from '../render/palette'
import { CATALOG, type Title } from '../data/catalog'

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
      // Hinged along the edge, so the panel hangs off it rather than pivoting about its middle.
      flap.position.z = (spec.axis === 'x' ? spec.sign : spec.sign) * (spec.d / 2)
      hinge.add(flap)
      hinge.userData.sign = spec.sign
      this.flaps.push(hinge)
    }

    // The stock itself: sleeves standing on end, in genre colours so the box reads as full.
    for (let i = 0; i < SHIPMENT_SIZE; i += 1) {
      const genre = CATALOG[i % CATALOG.length]?.genre ?? 'action'
      const sleeve = new THREE.Mesh(
        new THREE.BoxGeometry(0.11, 0.2, 0.034),
        createPS1Material({ color: GENRE_COLOR[genre] }),
      )
      sleeve.position.set(-0.22 + (i % 5) * 0.11, 0.32, i < 5 ? -0.1 : 0.12)
      sleeve.rotation.y = (i % 3) * 0.06
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
    for (const sleeve of this.stack) {
      sleeve.visible = true
      sleeve.position.y = 0.32
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
      this.liftTime += dt
      const t = Math.min(this.liftTime / 0.55, 1)
      this.lifting.position.y = 0.32 + ease(t) * 0.45
      if (t >= 1) {
        this.lifting.visible = false
        this.lifting.position.y = 0.32
        this.lifting = null
      }
    }
  }

  private applyLid(): void {
    for (const hinge of this.flaps) {
      const sign = (hinge.userData.sign as number) ?? 1
      // Just past flat, so the flaps sag outward the way wet cardboard does.
      hinge.rotation.x = -sign * ease(this.lid) * 1.75
    }
  }
}
