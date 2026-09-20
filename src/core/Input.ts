import { TouchControls, isTouchDevice } from './TouchControls'

export interface Movement {
  forward: number
  strafe: number
}

/**
 * A drag is bounded by the window; a locked mouse is not. Scaling the drag up means one sweep
 * across the canvas turns you most of the way round, which is what makes an embedded build
 * playable at all.
 */
const DRAG_GAIN = 1.7

/** Arrow-key turn rate, in the same pixels-per-second the mouse deltas are measured in. */
const ARROW_SPEED = 760

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
  /**
   * Pointer lock is refused outright in a sandboxed iframe, which is exactly where this game
   * gets embedded. Once we have been told no, stop asking — every retry throws and spams the
   * console — and let the caller offer the player the fallbacks instead.
   */
  private lockBlocked = false
  /**
   * Fires the moment pointer lock is refused. The refusal can arrive a tick after the request
   * — Chrome rejects the promise rather than throwing when the frame is merely un-permitted —
   * so anything that wants to react to it has to be told, not poll once and give up.
   */
  onLockBlocked: (() => void) | null = null

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

  private static readonly CLAIMED = new Set([
    'ArrowUp',
    'ArrowDown',
    'ArrowLeft',
    'ArrowRight',
    'Space',
  ])

  private onKeyDown = (event: KeyboardEvent): void => {
    // Arrows and space scroll the host page otherwise, which drags the whole game out of view.
    if (Input.CLAIMED.has(event.code)) event.preventDefault()
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
    // Locked, the mouse looks around on its own. Unlocked — embedded, usually — a held drag
    // does the same job, scaled up, because a drag can only ever be one window wide.
    if (this.locked) {
      this.yawDelta -= event.movementX
      this.pitchDelta -= event.movementY
      return
    }
    if (!this.dragging) return
    this.yawDelta -= event.movementX * DRAG_GAIN
    this.pitchDelta -= event.movementY * DRAG_GAIN
  }

  private onMouseDown = (event: MouseEvent): void => {
    if (event.button !== 0) return
    this.dragging = true
    this.canvas.classList.add('dragging')
  }

  private onMouseUp = (): void => {
    this.dragging = false
    this.canvas.classList.remove('dragging')
  }

  /** False once the browser has refused pointer lock, so the UI can say what to do instead. */
  get pointerLockBlocked(): boolean {
    return this.lockBlocked
  }

  /** Pointer lock is a desktop affordance; a touch device drives look by dragging instead. */
  requestLock(): void {
    if (this.touch || this.lockBlocked) return
    // Chrome throws synchronously when the frame is sandboxed without allow-pointer-lock, and
    // rejects asynchronously in other refusals, so both have to be caught.
    try {
      const request = this.canvas.requestPointerLock() as unknown
      if (request instanceof Promise) request.catch(() => this.blockLock())
    } catch {
      this.blockLock()
    }
  }

  private blockLock(): void {
    if (this.lockBlocked) return
    this.lockBlocked = true
    this.canvas.classList.add('drag-to-look')
    this.onLockBlocked?.()
  }

  releaseLock(): void {
    // Unconditional: `locked` tracks an event that may not have landed yet, and a missed release
    // leaves the cursor captured with a modal open, which reads as the UI being dead.
    if (document.exitPointerLock) document.exitPointerLock()
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

  /**
   * Accumulated look motion since the last call, in pixels. `dt` drives the arrow keys, which
   * are the one way to look around that no embedding can take away; callers that only want to
   * drain the mouse (a modal is open) pass nothing and get no key-driven turn.
   */
  takeLook(dt = 0): { yaw: number; pitch: number } {
    const look = { yaw: this.yawDelta, pitch: this.pitchDelta }
    this.yawDelta = 0
    this.pitchDelta = 0

    if (dt > 0) {
      const turn = (this.pressed.has('ArrowLeft') ? 1 : 0) - (this.pressed.has('ArrowRight') ? 1 : 0)
      const tilt = (this.pressed.has('ArrowUp') ? 1 : 0) - (this.pressed.has('ArrowDown') ? 1 : 0)
      look.yaw += turn * ARROW_SPEED * dt
      look.pitch += tilt * ARROW_SPEED * dt
    }

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

  /** True once per press of C — turning customer chatter on and off. */
  consumeChatterToggle(): boolean {
    return this.consumeKey('KeyC')
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
