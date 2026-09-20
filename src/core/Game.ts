import * as THREE from 'three'
import { Renderer, DEFAULT_FIDELITY, FIDELITY_LABEL, FIDELITY_ORDER, type Fidelity } from '../render/Renderer'
import { FOG } from '../render/palette'
import { buildStore, SPAWN, type BuiltStore, type Interactable } from '../world/Store'
import type { Title } from '../data/catalog'
import { Player } from '../world/Player'
import { Input } from './Input'
import { ShiftClock } from './Clock'
import { JobBoard } from '../sim/Tasks'
import { Scorecard, VERDICT_COPY } from '../sim/Scorecard'
import { Hud } from '../ui/hud'
import { Terminal } from '../ui/terminal'
import { StoreRadio } from '../audio/StoreRadio'
import { Sfx } from '../audio/Sfx'
import { Hands } from '../world/Hands'
import { Customer } from '../sim/Customer'
import type { StationKind } from '../world/Store'

type Phase = 'title' | 'shift' | 'report'

/** Anything the crosshair can land on: a fixture in the store, or the person standing in it. */
type Target = Interactable | { kind: 'talk'; label: string }

/** How long a spoken line stays up. Long enough to read, short enough not to nag. */
const speechDuration = (text: string): number => Math.min(9, 3.2 + text.length * 0.035)

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
  private readonly terminal = new Terminal()
  private readonly sfx = new Sfx()
  private readonly hands = new Hands()
  private readonly customer = new Customer()
  private readonly raycaster = new THREE.Raycaster()

  private phase: Phase = 'title'
  private lastFrame = 0
  private reading = false
  private fidelity: Fidelity = DEFAULT_FIDELITY
  /** An action in progress: the player is pinned in place until its animation finishes. */
  private busy: { station: StationKind; timeLeft: number } | null = null
  private customerJobId: number | null = null
  /** The deck keeps running after the hands are done, so the job settles when it ejects. */
  private rewindPending = false
  /** 0 at the player's own eyes, 1 parked in front of the terminal's CRT. */
  private monitorZoom = 0
  private readonly monitorQuaternion = new THREE.Quaternion()

  private readonly interactObjects: THREE.Object3D[]
  /** Counts down whatever the customer last said. */
  private speechLeft = 0
  private readonly byObject = new Map<THREE.Object3D, Interactable>()

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new Renderer(canvas)
    this.scene.background = new THREE.Color(FOG.color)

    this.store = buildStore()
    this.scene.add(this.store.root)

    this.interactObjects = this.store.interactables.map((entry) => entry.object)
    for (const entry of this.store.interactables) this.byObject.set(entry.object, entry)
    // The customer is not a fixture, so their talk volume rides alongside the store's own.
    this.interactObjects.push(this.customer.talkZone)

    this.player = new Player(this.renderer.aspect)
    // The camera joins the scene graph so the arms, parented to it, are actually traversed.
    this.scene.add(this.player.camera)
    this.player.camera.add(this.hands.root)
    this.scene.add(this.customer.root)

    this.input = new Input(canvas, this.hud.touchUi)

    // The monitor pose is fixed, so resolve its orientation once rather than every frame.
    // This dummy must be a camera: Object3D.lookAt aims an object's +Z at the target, while a
    // camera's -Z is its forward, so a plain Object3D here faces exactly backwards.
    const framing = new THREE.PerspectiveCamera()
    framing.position.copy(this.store.monitorView.position)
    framing.lookAt(this.store.monitorView.target)
    this.monitorQuaternion.copy(framing.quaternion)

    this.terminal.setKeyPressListener(() => this.sfx.keyClick())

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
    this.player.frozen = false
    this.busy = null
    this.customerJobId = null
    this.customer.reset()
    this.hud.hideSpeech()
    this.speechLeft = 0
    this.rewindPending = false
    this.monitorZoom = 0
    this.phase = 'shift'
    this.hud.showShift()
    this.input.requestLock()
    // Browsers only allow audio to start from a gesture, and clocking in is one.
    this.radio.start()
  }

  private endShift(): void {
    this.phase = 'report'
    this.input.releaseLock()
    this.terminal.close()
    this.hud.setModalOpen(false)
    this.radio.stop()
    this.hud.hideSpeech()
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

    this.customer.update(dt)
    this.syncCustomerJob()
    this.updateSpeech(dt)

    this.store.rewinder.update(dt, this.sfx)
    if (this.rewindPending && !this.store.rewinder.isRunning) {
      this.rewindPending = false
      this.jobs.complete('rewind', this.scorecard)
    }

    if (this.terminal.isOpen) {
      this.updateTerminal()
    } else if (this.reading) {
      this.updateReading()
    } else {
      this.player.update(dt, this.input, this.store.colliders)

      if (this.busy) {
        this.busy.timeLeft -= dt
        if (this.busy.timeLeft <= 0) this.finishAction()
        this.hud.setPrompt(null)
        this.hud.setInteractEnabled(false)
      } else {
        const target = this.findTarget()
        this.hud.setPrompt(target ? target.label : null)
        this.hud.setInteractEnabled(target !== null)

        if (this.input.consumeMuteToggle()) this.hud.setSoundMuted(this.radio.toggleMute())
        if (this.input.consumeFidelityToggle()) this.cycleFidelity()

        if (this.input.consumeInteract() && target) {
          if (target.kind === 'station') this.beginStation(target.station)
          else if (target.kind === 'talk') this.customer.chat(this.player.position)
          else this.openCase(target.title)
        }
      }
    }

    this.hands.update(dt, this.player.isMoving)
    this.applyMonitorZoom(dt)

    // Dev-only probe. Scripted playtests need to know where they ended up; dead reckoning
    // through acceleration and collisions does not survive contact with the floor plan.
    if (import.meta.env.DEV) {
      ;(window as unknown as Record<string, unknown>).__tp = (x: number, z: number, yaw: number, pitch = 0) =>
        this.player.teleport(x, z, yaw, pitch)
      ;(window as unknown as Record<string, unknown>).__probe = {
        pos: this.player.position.toArray().map((n) => Number(n.toFixed(2))),
        yaw: Number(this.player.heading.toFixed(3)),
        customer: this.customer.state,
        rewinding: this.store.rewinder.isRunning,
        zoom: Number(this.monitorZoom.toFixed(2)),
      }
    }

    if (this.clock.isOver) this.endShift()
  }

  /**
   * The register is the one station that opens the rental system instead of resolving on the
   * spot — the sale is the terminal's to complete, and the animation plays after it.
   */
  private beginStation(station: StationKind): void {
    if (station === 'register') {
      this.hud.setModalOpen(true)
      this.terminal.open(
        this.customer.isWaiting
          ? {
              name: this.customer.name,
              memberNumber: this.customer.memberNumber,
              basket: this.customer.basket,
            }
          : null,
      )
      this.input.releaseLock()
      return
    }

    this.busy = { station, timeLeft: this.hands.play(station) }
    this.player.frozen = true

    switch (station) {
      case 'shelf':
        this.sfx.shelfPlace(0.6)
        break
      case 'rewind':
        // Load the tape, then walk away — the deck finishes on its own time.
        this.sfx.deckOpen()
        this.store.rewinder.start()
        this.rewindPending = true
        break
      case 'returns':
      case 'restock':
        this.sfx.thud(0.35)
        break
    }
  }

  /**
   * Slides the view from the player's own eyes to a fixed pose in front of the CRT. Blending
   * every frame off the player's current pose means the shot stays correct however they were
   * standing when they leaned in.
   */
  private applyMonitorZoom(dt: number): void {
    const wanted = this.terminal.isOpen ? 1 : 0
    this.monitorZoom = THREE.MathUtils.damp(this.monitorZoom, wanted, 9, dt)

    this.hands.root.visible = this.monitorZoom < 0.45
    if (this.monitorZoom < 0.001) return

    const camera = this.player.camera
    camera.position.lerp(this.store.monitorView.position, this.monitorZoom)
    camera.quaternion.slerp(this.monitorQuaternion, this.monitorZoom)
  }

  private finishAction(): void {
    const station = this.busy?.station
    this.busy = null
    this.player.frozen = false
    // The register is settled by the terminal, and the rewinder settles when the deck ejects.
    if (station && station !== 'register' && station !== 'rewind') {
      this.jobs.complete(station, this.scorecard)
    }
  }

  private updateTerminal(): void {
    this.input.takeLook()

    if (this.terminal.consumeCompleted()) {
      this.terminal.close()
      this.hud.setModalOpen(false)
      this.input.requestLock()
      if (this.customerJobId !== null) {
        this.jobs.completeById(this.customerJobId, this.scorecard)
        this.customerJobId = null
      }
      this.customer.serve()
      this.sfx.receipt()
      this.busy = { station: 'register', timeLeft: this.hands.play('register') }
      this.player.frozen = true
      return
    }

    if (this.terminal.consumeClosed() || this.input.consumeCancel()) {
      this.terminal.close()
      this.hud.setModalOpen(false)
      this.input.requestLock()
    }
  }

  /** Whatever the customer came out with goes straight to the HUD, and times itself out. */
  private updateSpeech(dt: number): void {
    const line = this.customer.consumeSpeech()
    if (line) {
      this.hud.showSpeech(line.name, line.text)
      this.speechLeft = speechDuration(line.text)
      return
    }

    if (this.speechLeft > 0) {
      this.speechLeft -= dt
      if (this.speechLeft <= 0) this.hud.hideSpeech()
    }
  }

  /** Keeps the board and the person at the counter describing the same thing. */
  private syncCustomerJob(): void {
    if (this.customer.isWaiting && this.customerJobId === null) {
      const first = this.customer.name.split(' ')[0] ?? 'A customer'
      this.customerJobId = this.jobs.addJob('register', `${first} is waiting at the register`, 60)
    }

    // The job left the board without the terminal closing it, so it timed out — the walkout is
    // already counted, and the customer should stop standing there.
    if (this.customerJobId !== null && !this.jobs.hasJob(this.customerJobId)) {
      this.customerJobId = null
      this.customer.serve()
    }
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
  private findTarget(): Target | null {
    this.raycaster.setFromCamera(CENTER, this.player.camera)
    const hit = this.raycaster.intersectObjects(this.interactObjects, false)[0]
    if (!hit) return null

    if (hit.object === this.customer.talkZone) {
      // The volume travels with a customer who may have gone home, so check they are in fact
      // standing there before offering to talk to them.
      if (!this.customer.isPresent) return null
      const first = this.customer.name.split(' ')[0] ?? 'them'
      return { kind: 'talk', label: `Talk to ${first}` }
    }

    return this.byObject.get(hit.object) ?? null
  }
}
