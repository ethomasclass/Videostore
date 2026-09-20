import * as THREE from 'three'
import { createPS1Material } from '../render/ps1Material'
import type { Sfx } from '../audio/Sfx'

/**
 * The rewinder on the counter, as a prop that actually does the job: the flap drops, a tape
 * slides in, the spools turn, the flap shuts, and it ejects. The player's hands cover the first
 * beat of it, so what this has to sell is the middle — the part where you stand and wait.
 */

type Phase = 'idle' | 'open' | 'insert' | 'spin' | 'eject'

const TIMINGS: Record<Exclude<Phase, 'idle'>, number> = {
  open: 0.35,
  insert: 0.5,
  spin: 2.6,
  eject: 0.55,
}

const SLOT_Y = 0.12
const ease = (t: number): number => t * t * (3 - 2 * t)

export class Rewinder {
  readonly root = new THREE.Group()

  private readonly flap: THREE.Mesh
  private readonly tape: THREE.Mesh
  private readonly spools: THREE.Mesh[] = []
  private readonly indicator: THREE.Mesh

  private phase: Phase = 'idle'
  private elapsed = 0
  private spin = 0
  /** Extra seconds the flap stays open before the tape slides in. */
  private openHold = 0

  constructor() {
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.22, 0.45),
      createPS1Material({ color: 0x26262c }),
    )
    body.position.y = 0.11
    this.root.add(body)

    // The loading flap, hinged along its top edge so it swings out and down.
    const hinge = new THREE.Group()
    hinge.position.set(0, 0.19, -0.225)
    this.root.add(hinge)

    this.flap = new THREE.Mesh(
      new THREE.BoxGeometry(0.46, 0.14, 0.02),
      createPS1Material({ color: 0x33333b }),
    )
    this.flap.position.y = -0.07
    hinge.add(this.flap)
    this.flapHinge = hinge

    this.tape = new THREE.Mesh(
      new THREE.BoxGeometry(0.19, 0.026, 0.105),
      createPS1Material({ color: 0x141418 }),
    )
    this.tape.visible = false
    this.root.add(this.tape)

    // Two spool windows in the top of the tape, which is the only moving part you can see.
    for (const offset of [-0.045, 0.045]) {
      const spool = new THREE.Mesh(
        new THREE.BoxGeometry(0.05, 0.004, 0.05),
        createPS1Material({ color: 0x8e8e98 }),
      )
      spool.position.set(offset, 0.016, 0)
      this.tape.add(spool)
      this.spools.push(spool)
    }

    this.indicator = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.02, 0.01),
      createPS1Material({ color: 0x2a2a30, unlit: true }),
    )
    this.indicator.position.set(0.22, 0.13, -0.235)
    this.root.add(this.indicator)
  }

  private readonly flapHinge: THREE.Group

  get isRunning(): boolean {
    return this.phase !== 'idle'
  }

  /**
   * Returns the full cycle length, so the caller can time the job around it. `holdOpen` keeps
   * the flap waiting: the player's hands have a case to open and a tape to pull out of it
   * first, and the deck should not swallow a tape that is not there yet.
   */
  start(holdOpen = 0): number {
    if (this.phase !== 'idle') return 0
    this.phase = 'open'
    this.elapsed = 0
    this.openHold = Math.max(0, holdOpen)
    return TIMINGS.open + this.openHold + TIMINGS.insert + TIMINGS.spin + TIMINGS.eject
  }

  update(dt: number, sfx: Sfx): void {
    if (this.phase === 'idle') return
    this.elapsed += dt

    const limit = TIMINGS[this.phase] + (this.phase === 'open' ? this.openHold : 0)
    const t = Math.min(this.elapsed / limit, 1)

    switch (this.phase) {
      case 'open':
        // The flap drops at its own speed and then just waits, however long the hold is.
        this.flapHinge.rotation.x = ease(Math.min(this.elapsed / TIMINGS.open, 1)) * 1.15
        if (t >= 1) this.advance('insert', sfx)
        break

      case 'insert': {
        this.tape.visible = true
        // Slides in from the player's side of the deck and settles into the slot.
        this.tape.position.set(0, SLOT_Y, THREE.MathUtils.lerp(-0.42, -0.02, ease(t)))
        if (t >= 1) this.advance('spin', sfx)
        break
      }

      case 'spin':
        this.flapHinge.rotation.x = (1 - ease(Math.min(t * 6, 1))) * 1.15
        this.spin += dt * 26
        for (const spool of this.spools) spool.rotation.y = this.spin
        this.setIndicator(0xd0453a)
        if (t >= 1) this.advance('eject', sfx)
        break

      case 'eject':
        this.flapHinge.rotation.x = ease(Math.min(t * 3, 1)) * 1.15
        this.tape.position.z = THREE.MathUtils.lerp(-0.02, -0.4, ease(t))
        this.setIndicator(0x2a2a30)
        if (t >= 1) {
          this.tape.visible = false
          this.flapHinge.rotation.x = 0
          this.phase = 'idle'
          this.elapsed = 0
        }
        break
    }
  }

  private advance(next: Phase, sfx: Sfx): void {
    this.phase = next
    this.elapsed = 0
    if (next === 'spin') {
      sfx.deckClose()
      sfx.startRewind()
    }
    if (next === 'eject') {
      sfx.stopRewind()
      sfx.deckOpen()
    }
  }

  private setIndicator(color: number): void {
    const material = this.indicator.material as THREE.ShaderMaterial
    material.uniforms.uColor!.value.setHex(color)
  }
}
