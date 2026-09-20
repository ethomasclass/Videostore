/**
 * One shift is one sitting: 60 real minutes covering 6:00 PM to close at 11:00 PM.
 * That makes every real second five in-game seconds.
 */
export const SHIFT = {
  realSeconds: 60 * 60,
  openHour: 18,
  closeHour: 23,
} as const

export class ShiftClock {
  private elapsed = 0

  get progress(): number {
    return Math.min(this.elapsed / SHIFT.realSeconds, 1)
  }

  get isOver(): boolean {
    return this.elapsed >= SHIFT.realSeconds
  }

  advance(dt: number): void {
    this.elapsed = Math.min(this.elapsed + dt, SHIFT.realSeconds)
  }

  reset(): void {
    this.elapsed = 0
  }

  /** In-game wall clock, as the register display would show it. */
  format(): string {
    const totalMinutes = (SHIFT.closeHour - SHIFT.openHour) * 60 * this.progress
    const hour24 = SHIFT.openHour + Math.floor(totalMinutes / 60)
    const minute = Math.floor(totalMinutes % 60)
    const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12
    const suffix = hour24 >= 12 ? 'PM' : 'AM'
    return `${hour12}:${String(minute).padStart(2, '0')} ${suffix}`
  }
}
