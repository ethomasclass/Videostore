import * as THREE from 'three'
import { Renderer } from '../render/Renderer'
import { FOG } from '../render/palette'
import { buildStore, type BuiltStore, type Interactable } from '../world/Store'
import { Player } from '../world/Player'
import { Input } from './Input'
import { ShiftClock } from './Clock'
import { JobBoard } from '../sim/Tasks'
import { Scorecard, VERDICT_COPY } from '../sim/Scorecard'
import { Hud } from '../ui/hud'

type Phase = 'title' | 'shift' | 'report'

const INTERACT_RANGE = 2.4
const MAX_DT = 1 / 20

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
  private readonly raycaster = new THREE.Raycaster()

  private phase: Phase = 'title'
  private lastFrame = 0

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new Renderer(canvas)
    this.scene.background = new THREE.Color(FOG.color)

    this.store = buildStore()
    this.scene.add(this.store.root)

    this.player = new Player(this.renderer.aspect)
    this.input = new Input(canvas, this.hud.touchUi)

    this.raycaster.far = INTERACT_RANGE
    this.hud.onStart = () => this.startShift()
    this.hud.showTitle()

    window.addEventListener('resize', () => this.onResize())
    window.addEventListener('orientationchange', () => this.onResize())
    canvas.addEventListener('click', () => {
      if (this.phase === 'shift') this.input.requestLock()
    })
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
    this.player.position.set(-0.25, this.player.position.y, 7.5)
    this.phase = 'shift'
    this.hud.showShift()
    this.input.requestLock()
  }

  private endShift(): void {
    this.phase = 'report'
    this.input.releaseLock()
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
    this.clock.advance(dt)
    this.player.update(dt, this.input, this.store.colliders)
    this.jobs.update(dt, this.clock.progress, this.scorecard)

    const target = this.findTarget()
    this.hud.setPrompt(target ? target.label : null)
    this.hud.setInteractEnabled(target !== null)
    if (this.input.consumeInteract() && target) {
      this.jobs.complete(target.kind, this.scorecard)
    }

    this.hud.setClock(this.clock.format())
    this.hud.setJobs(this.jobs.jobs)

    if (this.clock.isOver) this.endShift()
  }

  private findTarget(): Interactable | null {
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.player.camera)

    let closest: Interactable | null = null
    let closestDistance = Infinity
    for (const interactable of this.store.interactables) {
      const hits = this.raycaster.intersectObject(interactable.object, false)
      const hit = hits[0]
      if (hit && hit.distance < closestDistance) {
        closestDistance = hit.distance
        closest = interactable
      }
    }
    return closest
  }
}
