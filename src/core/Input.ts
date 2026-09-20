export class Input {
  private readonly pressed = new Set<string>()
  private readonly consumed = new Set<string>()
  private yawDelta = 0
  private pitchDelta = 0
  private locked = false

  constructor(private readonly canvas: HTMLCanvasElement) {
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    document.addEventListener('pointerlockchange', this.onLockChange)
    document.addEventListener('mousemove', this.onMouseMove)
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

  requestLock(): void {
    void this.canvas.requestPointerLock()
  }

  releaseLock(): void {
    if (this.locked) document.exitPointerLock()
  }

  get isLocked(): boolean {
    return this.locked
  }

  isDown(code: string): boolean {
    return this.pressed.has(code)
  }

  /** True once per physical press — for interactions that must not repeat while held. */
  wasPressed(code: string): boolean {
    if (!this.pressed.has(code) || this.consumed.has(code)) return false
    this.consumed.add(code)
    return true
  }

  /** Accumulated mouse motion since the last call, in pixels. */
  takeLook(): { yaw: number; pitch: number } {
    const look = { yaw: this.yawDelta, pitch: this.pitchDelta }
    this.yawDelta = 0
    this.pitchDelta = 0
    return look
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    document.removeEventListener('pointerlockchange', this.onLockChange)
    document.removeEventListener('mousemove', this.onMouseMove)
  }
}
