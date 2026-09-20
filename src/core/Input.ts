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

  private readonly pressed = new Set<string>()
  private readonly consumed = new Set<string>()
  private yawDelta = 0
  private pitchDelta = 0
  private locked = false

  constructor(private readonly canvas: HTMLCanvasElement, touchUi?: TouchUiElements) {
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    document.addEventListener('pointerlockchange', this.onLockChange)
    document.addEventListener('mousemove', this.onMouseMove)

    if (touchUi && isTouchDevice()) {
      this.touch = new TouchControls(touchUi.surface, touchUi.stick, touchUi.knob, touchUi.interact)
      touchUi.root.hidden = false
    }
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    if (event.repeat) return
    this.pressed.add(event.code)
  }

  private onKeyUp = (event: KeyboardEvent): void => {
    this.pressed.delete(event.code)
    this.consumed.delete(event.code)
  }

  private onLockChange = (): void => {
    this.locked = document.pointerLockElement === this.canvas
  }

  private onMouseMove = (event: MouseEvent): void => {
    if (!this.locked) return
    this.yawDelta -= event.movementX
    this.pitchDelta -= event.movementY
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
    if (!this.pressed.has('KeyE') || this.consumed.has('KeyE')) return false
    this.consumed.add('KeyE')
    return true
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    document.removeEventListener('pointerlockchange', this.onLockChange)
    document.removeEventListener('mousemove', this.onMouseMove)
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
