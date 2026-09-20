const STICK_RADIUS = 58
/** Touch drags cover fewer pixels than a mouse sweep, so looking needs more per pixel. */
const LOOK_SCALE = 1.6

export const isTouchDevice = (): boolean =>
  window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0

/**
 * Left half of the screen is a floating stick that appears wherever the thumb lands; right half
 * is look. Each is bound to the pointer id that started it, so moving one never steals the other.
 */
export class TouchControls {
  forward = 0
  strafe = 0

  private yawDelta = 0
  private pitchDelta = 0
  private interactQueued = false

  private stickId: number | null = null
  private stickOrigin = { x: 0, y: 0 }
  private lookId: number | null = null
  private lookLast = { x: 0, y: 0 }

  constructor(
    private readonly surface: HTMLElement,
    private readonly stickElement: HTMLElement,
    private readonly knobElement: HTMLElement,
    interactButton: HTMLElement,
  ) {
    this.surface.addEventListener('pointerdown', this.onDown)
    this.surface.addEventListener('pointermove', this.onMove)
    this.surface.addEventListener('pointerup', this.onUp)
    this.surface.addEventListener('pointercancel', this.onUp)

    interactButton.addEventListener('pointerdown', (event) => {
      event.preventDefault()
      event.stopPropagation()
      this.interactQueued = true
    })
  }

  private onDown = (event: PointerEvent): void => {
    if (event.pointerType === 'mouse') return
    event.preventDefault()

    if (event.clientX < window.innerWidth / 2) {
      if (this.stickId !== null) return
      this.stickId = event.pointerId
      this.stickOrigin = { x: event.clientX, y: event.clientY }
      this.stickElement.style.left = `${event.clientX}px`
      this.stickElement.style.top = `${event.clientY}px`
      this.stickElement.classList.add('active')
      this.moveKnob(0, 0)
    } else {
      if (this.lookId !== null) return
      this.lookId = event.pointerId
      this.lookLast = { x: event.clientX, y: event.clientY }
    }
  }

  private onMove = (event: PointerEvent): void => {
    if (event.pointerType === 'mouse') return

    if (event.pointerId === this.stickId) {
      event.preventDefault()
      const dx = event.clientX - this.stickOrigin.x
      const dy = event.clientY - this.stickOrigin.y
      const distance = Math.hypot(dx, dy)
      const clamped = Math.min(distance, STICK_RADIUS)
      const angle = Math.atan2(dy, dx)
      const kx = Math.cos(angle) * clamped
      const ky = Math.sin(angle) * clamped

      this.moveKnob(kx, ky)
      this.strafe = kx / STICK_RADIUS
      this.forward = -ky / STICK_RADIUS
      return
    }

    if (event.pointerId === this.lookId) {
      event.preventDefault()
      this.yawDelta -= (event.clientX - this.lookLast.x) * LOOK_SCALE
      this.pitchDelta -= (event.clientY - this.lookLast.y) * LOOK_SCALE
      this.lookLast = { x: event.clientX, y: event.clientY }
    }
  }

  private onUp = (event: PointerEvent): void => {
    if (event.pointerId === this.stickId) {
      this.stickId = null
      this.forward = 0
      this.strafe = 0
      this.stickElement.classList.remove('active')
    } else if (event.pointerId === this.lookId) {
      this.lookId = null
    }
  }

  private moveKnob(x: number, y: number): void {
    this.knobElement.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`
  }

  takeLook(): { yaw: number; pitch: number } {
    const look = { yaw: this.yawDelta, pitch: this.pitchDelta }
    this.yawDelta = 0
    this.pitchDelta = 0
    return look
  }

  consumeInteract(): boolean {
    const queued = this.interactQueued
    this.interactQueued = false
    return queued
  }

  dispose(): void {
    this.surface.removeEventListener('pointerdown', this.onDown)
    this.surface.removeEventListener('pointermove', this.onMove)
    this.surface.removeEventListener('pointerup', this.onUp)
    this.surface.removeEventListener('pointercancel', this.onUp)
  }
}
