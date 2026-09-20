export type Verdict = 'promoted' | 'kept' | 'written-up' | 'fired'

export interface ReportLine {
  label: string
  value: string
  /** -1 bad, 0 neutral, 1 good — drives the color on the review screen. */
  tone: -1 | 0 | 1
}

/**
 * The shift's only scoreboard. Every mechanic must land in exactly one of these counters,
 * otherwise it is decoration and should be cut.
 */
export class Scorecard {
  customersServed = 0
  customersLost = 0
  tapesRewound = 0
  tapesShelvedCorrectly = 0
  tapesShelvedWrong = 0
  tapesLeftUnrewound = 0
  registerErrors = 0
  /** Tapes taken out of tonight's shipment crate and put into circulation. */
  shipmentStocked = 0
  shipmentTotal = 0

  reset(): void {
    this.customersServed = 0
    this.customersLost = 0
    this.tapesRewound = 0
    this.tapesShelvedCorrectly = 0
    this.tapesShelvedWrong = 0
    this.tapesLeftUnrewound = 0
    this.registerErrors = 0
    this.shipmentStocked = 0
  }

  private ratio(good: number, bad: number): number {
    const total = good + bad
    return total === 0 ? 1 : good / total
  }

  get rewindCompliance(): number {
    return this.ratio(this.tapesRewound, this.tapesLeftUnrewound)
  }

  get shelvingAccuracy(): number {
    return this.ratio(this.tapesShelvedCorrectly, this.tapesShelvedWrong)
  }

  get serviceRate(): number {
    return this.ratio(this.customersServed, this.customersLost)
  }

  /** How much of the shipment made it out of the box before close. */
  get shipmentProgress(): number {
    return this.shipmentTotal === 0 ? 1 : this.shipmentStocked / this.shipmentTotal
  }

  /** 0..100. Weighted so that abandoning customers hurts most — that is what a manager sees. */
  get score(): number {
    const service = this.serviceRate * 40
    const rewind = this.rewindCompliance * 22
    const shelving = this.shelvingAccuracy * 18
    const shipment = this.shipmentProgress * 10
    const till = Math.max(0, 10 - this.registerErrors * 2.5)
    return Math.round(service + rewind + shelving + shipment + till)
  }

  /** A shift nobody worked scores 100 on ratios alone, so promotion needs real volume too. */
  static readonly PROMOTION_MINIMUM_CUSTOMERS = 12

  get verdict(): Verdict {
    const score = this.score
    const earnedIt = this.customersServed >= Scorecard.PROMOTION_MINIMUM_CUSTOMERS
    if (score >= 85 && this.customersLost <= 2 && earnedIt) return 'promoted'
    if (score >= 65) return 'kept'
    if (score >= 40) return 'written-up'
    return 'fired'
  }

  report(): ReportLine[] {
    const pct = (value: number): string => `${Math.round(value * 100)}%`
    const tone = (value: number, good: number, bad: number): -1 | 0 | 1 =>
      value >= good ? 1 : value <= bad ? -1 : 0

    return [
      { label: 'Customers Served', value: String(this.customersServed), tone: this.customersServed >= 12 ? 1 : 0 },
      { label: 'Walked Out', value: String(this.customersLost), tone: this.customersLost === 0 ? 1 : -1 },
      { label: 'Be Kind, Rewind', value: pct(this.rewindCompliance), tone: tone(this.rewindCompliance, 0.9, 0.6) },
      { label: 'Shelving Accuracy', value: pct(this.shelvingAccuracy), tone: tone(this.shelvingAccuracy, 0.9, 0.6) },
      {
        label: 'Shipment Stocked',
        value: `${this.shipmentStocked} / ${this.shipmentTotal}`,
        tone: tone(this.shipmentProgress, 0.99, 0.5),
      },
      { label: 'Register Errors', value: String(this.registerErrors), tone: this.registerErrors === 0 ? 1 : -1 },
      { label: 'Shift Score', value: `${this.score} / 100`, tone: tone(this.score / 100, 0.85, 0.5) },
    ]
  }
}

export const VERDICT_COPY: Record<Verdict, { title: string; body: string }> = {
  promoted: {
    title: 'Promoted — Shift Lead',
    body: 'Corporate saw the numbers. You get the keys, the clipboard, and eleven more cents an hour.',
  },
  kept: {
    title: 'Back Tomorrow',
    body: 'Nothing burned down. Nothing impressed anybody either. Same time tomorrow.',
  },
  'written-up': {
    title: 'Written Up',
    body: 'A page went in your file. The manager used the phrase "opportunity to improve."',
  },
  fired: {
    title: 'Let Go',
    body: 'Leave the name tag on the counter. Somebody else can face the horror wall.',
  },
}
