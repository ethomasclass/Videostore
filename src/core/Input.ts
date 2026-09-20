import { TouchControls, isTouchDevice } from './TouchControls'

export interface Movement {
  forward: number
  strafe: number
}

/**
 * One surface over keyboard+mouse and touch. Callers ask for intent — movement, look, interact —
 * rather than for specific keys, so neither the player controller nor the game loop has to know
 * which input device is driving.
 */
export class Input {
  readonly touch: TouchControls | null = null

  /** Keys currently held — for continuous actions like walking. */
  private readonly pressed = new Set<string>()
  /**
   * Presses waiting to be acted on. A tap that starts and ends between two frames never shows
   * up as held, so one-shot actions read this instead and no quick press is ever dropped.
   */
  private readonly queued = new Set<string>()
  private yawDelta = 0
  private pitchDelta = 0
  private locked = false
  private dragging = false

  constructor(private readonly canvas: HTMLCanvasElement, touchUi?: TouchUiElements) {
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    document.addEventListener('pointerlockchange', this.onLockChange)
    document.addEventListener('mousemove', this.onMouseMove)
    canvas.addEventListener('mousedown', this.onMouseDown)
    window.addEventListener('mouseup', this.onMouseUp)

    if (touchUi && isTouchDevice()) {
      this.touch = new TouchControls(touchUi.surface, touchUi.stick, touchUi.knob, touchUi.interact)
      touchUi.root.hidden = false
    }
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    if (event.repeat) return
    this.pressed.add(event.code)
    this.queued.add(event.code)
  }

  private onKeyUp = (event: KeyboardEvent): void => {
    this.pressed.delete(event.code)
  }

  private onLockChange = (): void => {
    this.locked = document.pointerLockElement === this.canvas
  }

  private onMouseMove = (event: MouseEvent): void => {
    // Pointer lock is unavailable in some embeddings, so an unlocked drag looks around instead.
    if (!this.locked && !this.dragging) return
    this.yawDelta -= event.movementX
    this.pitchDelta -= event.movementY
  }

  private onMouseDown = (event: MouseEvent): void => {
    if (event.button === 0) this.dragging = true
  }

  private onMouseUp = (): void => {
    this.dragging = false
  }

  /** Pointer lock is a desktop affordance; a touch device drives look by dragging instead. */
  requestLock(): void {
    if (this.touch) return
    void this.canvas.requestPointerLock()
  }

  releaseLock(): void {
    if (this.locked) document.exitPointerLock()
  }

  get movement(): Movement {
    const forward = (this.pressed.has('KeyW') ? 1 : 0) - (this.pressed.has('KeyS') ? 1 : 0)
    const strafe = (this.pressed.has('KeyD') ? 1 : 0) - (this.pressed.has('KeyA') ? 1 : 0)
    if (!this.touch) return { forward, strafe }
    // Whichever device is actually being used wins; they are never both live in practice.
    return {
      forward: forward !== 0 ? forward : this.touch.forward,
      strafe: strafe !== 0 ? strafe : this.touch.strafe,
    }
  }

  get isRunning(): boolean {
    return this.pressed.has('ShiftLeft') || this.pressed.has('ShiftRight')
  }

  /** Accumulated look motion since the last call, in pixels. */
  takeLook(): { yaw: number; pitch: number } {
    const look = { yaw: this.yawDelta, pitch: this.pitchDelta }
    this.yawDelta = 0
    this.pitchDelta = 0

    if (this.touch) {
      const touchLook = this.touch.takeLook()
      look.yaw += touchLook.yaw
      look.pitch += touchLook.pitch
    }
    return look
  }

  /** True once per press of E or of the on-screen interact button. */
  consumeInteract(): boolean {
    if (this.touch?.consumeInteract()) return true
    return this.consumeKey('KeyE')
  }

  /** True once per press of Escape — backing out of whatever is open. */
  consumeCancel(): boolean {
    return this.consumeKey('Escape')
  }

  /** True once per press of M — silencing the store radio. */
  consumeMuteToggle(): boolean {
    return this.consumeKey('KeyM')
  }

  /** True once per press of V — cycling the visual fidelity. */
  consumeFidelityToggle(): boolean {
    return this.consumeKey('KeyV')
  }

  private consumeKey(code: string): boolean {
    return this.queued.delete(code)
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    document.removeEventListener('pointerlockchange', this.onLockChange)
    document.removeEventListener('mousemove', this.onMouseMove)
    this.canvas.removeEventListener('mousedown', this.onMouseDown)
    window.removeEventListener('mouseup', this.onMouseUp)
    this.touch?.dispose()
  }
}

export interface TouchUiElements {
  root: HTMLElement
  surface: HTMLElement
  stick: HTMLElement
  knob: HTMLElement
  interact: HTMLElement
}
