import * as THREE from 'three'
import { Renderer, FIDELITY_LABEL, FIDELITY_ORDER, type Fidelity } from '../render/Renderer'
import { FOG } from '../render/palette'
import { buildStore, SPAWN, type BuiltStore, type Interactable } from '../world/Store'
import type { Title } from '../data/catalog'
import { Player } from '../world/Player'
import { Input } from './Input'
import { ShiftClock } from './Clock'
import { JobBoard } from '../sim/Tasks'
import { Scorecard, VERDICT_COPY } from '../sim/Scorecard'
import { Hud } from '../ui/hud'
import { StoreRadio } from '../audio/StoreRadio'

type Phase = 'title' | 'shift' | 'report'

const INTERACT_RANGE = 2.4
const MAX_DT = 1 / 20
/** Screen centre, where the crosshair is. Reused so the hot loop allocates nothing. */
const CENTER = new THREE.Vector2(0, 0)

export class Game {
  private readonly renderer: Renderer
  private readonly scene = new THREE.Scene()
  private readonly store: BuiltStore
  private readonly player: Player
  private readonly input: Input
  private readonly clock = new ShiftClock()
  private readonly jobs = new JobBoard()
  private readonly scorecard = new Scorecard()
  private readonly hud = new Hud()
  private readonly radio = new StoreRadio()
  private readonly raycaster = new THREE.Raycaster()

  private phase: Phase = 'title'
  private lastFrame = 0
  private reading = false
  private fidelity: Fidelity = 'ps1'

  private readonly interactObjects: THREE.Object3D[]
  private readonly byObject = new Map<THREE.Object3D, Interactable>()

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new Renderer(canvas)
    this.scene.background = new THREE.Color(FOG.color)

    this.store = buildStore()
    this.scene.add(this.store.root)

    this.interactObjects = this.store.interactables.map((entry) => entry.object)
    for (const entry of this.store.interactables) this.byObject.set(entry.object, entry)

    this.player = new Player(this.renderer.aspect)
    this.input = new Input(canvas, this.hud.touchUi)

    this.raycaster.far = INTERACT_RANGE
    this.hud.onStart = () => this.startShift()
    this.hud.onToggleSound = () => this.hud.setSoundMuted(this.radio.toggleMute())
    this.hud.onCycleFidelity = () => this.cycleFidelity()
    this.hud.setFidelityLabel(FIDELITY_LABEL[this.fidelity])
    this.hud.showTitle()

    window.addEventListener('resize', () => this.onResize())
    window.addEventListener('orientationchange', () => this.onResize())
    canvas.addEventListener('click', () => {
      if (this.phase === 'shift') this.input.requestLock()
    })
  }

  private cycleFidelity(): void {
    const next = FIDELITY_ORDER[(FIDELITY_ORDER.indexOf(this.fidelity) + 1) % FIDELITY_ORDER.length]
    if (!next) return
    this.fidelity = next
    this.player.camera.aspect = this.renderer.setFidelity(next)
    this.player.camera.updateProjectionMatrix()
    this.hud.setFidelityLabel(FIDELITY_LABEL[next])
  }

  private onResize(): void {
    this.player.camera.aspect = this.renderer.resize()
    this.player.camera.updateProjectionMatrix()
  }

  start(): void {
    this.lastFrame = performance.now()
    requestAnimationFrame(this.frame)
  }

  private startShift(): void {
    this.clock.reset()
    this.jobs.reset()
    this.scorecard.reset()
    this.player.position.set(SPAWN.x, this.player.position.y, SPAWN.z)
    this.phase = 'shift'
    this.hud.showShift()
    this.input.requestLock()
    // Browsers only allow audio to start from a gesture, and clocking in is one.
    this.radio.start()
  }

  private endShift(): void {
    this.phase = 'report'
    this.input.releaseLock()
    this.radio.stop()
    const verdict = VERDICT_COPY[this.scorecard.verdict]
    this.hud.showReport(this.scorecard.report(), verdict.title, verdict.body)
  }

  private frame = (now: number): void => {
    // Clamped so a tabbed-out window does not teleport the player through a shelf.
    const dt = Math.min((now - this.lastFrame) / 1000, MAX_DT)
    this.lastFrame = now

    if (this.phase === 'shift') this.updateShift(dt)

    this.renderer.render(this.scene, this.player.camera)
    requestAnimationFrame(this.frame)
  }

  private updateShift(dt: number): void {
    // The clock never stops for reading a box. Browsing on the job has a cost.
    this.clock.advance(dt)
    this.jobs.update(dt, this.clock.progress, this.scorecard)
    this.hud.setClock(this.clock.format())
    this.hud.setJobs(this.jobs.jobs)

    if (this.reading) {
      this.updateReading()
    } else {
      this.player.update(dt, this.input, this.store.colliders)

      const target = this.findTarget()
      this.hud.setPrompt(target ? target.label : null)
      this.hud.setInteractEnabled(target !== null)

      if (this.input.consumeMuteToggle()) this.hud.setSoundMuted(this.radio.toggleMute())
      if (this.input.consumeFidelityToggle()) this.cycleFidelity()

      if (this.input.consumeInteract() && target) {
        if (target.kind === 'station') this.jobs.complete(target.station, this.scorecard)
        else this.openCase(target.title)
      }
    }

    if (this.clock.isOver) this.endShift()
  }

  private openCase(title: Title): void {
    this.reading = true
    this.hud.showCase(title)
    this.hud.setPrompt(null)
    this.input.releaseLock()
  }

  private updateReading(): void {
    // Drain look input so a drag behind the panel does not spin the camera while reading.
    this.input.takeLook()
    if (this.input.consumeInteract() || this.input.consumeCancel() || this.hud.caseDismissed()) {
      this.reading = false
      this.hud.hideCase()
      this.input.requestLock()
    }
  }

  /**
   * One batched raycast against every interactable at once. Casting per interactable was fine
   * for five stations; it is not once every case on the New Release wall is readable.
   */
  private findTarget(): Interactable | null {
    this.raycaster.setFromCamera(CENTER, this.player.camera)
    const hit = this.raycaster.intersectObjects(this.interactObjects, false)[0]
    return hit ? this.byObject.get(hit.object) ?? null : null
  }
}
