import type { StationKind } from '../world/Store'
import { CATALOG, type Title } from '../data/catalog'
import type { Scorecard } from './Scorecard'

export interface Job {
  id: number
  kind: StationKind
  label: string
  /** Seconds of real time left before the job goes sour. */
  timeLeft: number
  title?: Title
}

const TEMPLATES: Record<StationKind, { label: (title: Title) => string; patience: number }> = {
  returns: { label: () => 'Empty the return bin', patience: 90 },
  rewind: { label: (t) => `Rewind ${t.title}`, patience: 75 },
  shelf: { label: (t) => `Shelve ${t.title}`, patience: 110 },
  register: { label: () => 'Customer waiting at the register', patience: 45 },
  restock: { label: () => 'Break down the shipment crate', patience: 150 },
}

const pickTitle = (): Title => {
  const title = CATALOG[Math.floor(Math.random() * CATALOG.length)]
  if (!title) throw new Error('catalog is empty')
  return title
}

/**
 * Work arrives faster as the shift wears on, so the last twenty minutes before close are the
 * pressure peak. Jobs that time out cost score — that is the whole tension of the hour.
 */
export class JobBoard {
  readonly jobs: Job[] = []
  private nextId = 1
  private spawnTimer = 4

  reset(): void {
    this.jobs.length = 0
    this.nextId = 1
    this.spawnTimer = 4
  }

  private spawnInterval(progress: number): number {
    return 22 - progress * 13
  }

  update(dt: number, progress: number, scorecard: Scorecard): void {
    this.spawnTimer -= dt
    if (this.spawnTimer <= 0) {
      this.spawn()
      this.spawnTimer = this.spawnInterval(progress) * (0.7 + Math.random() * 0.6)
    }

    for (let i = this.jobs.length - 1; i >= 0; i -= 1) {
      const job = this.jobs[i]
      if (!job) continue
      job.timeLeft -= dt
      if (job.timeLeft > 0) continue

      this.jobs.splice(i, 1)
      if (job.kind === 'register') scorecard.customersLost += 1
      else if (job.kind === 'rewind') scorecard.tapesLeftUnrewound += 1
      else if (job.kind === 'shelf') scorecard.tapesShelvedWrong += 1
    }
  }

  private spawn(): void {
    const kinds: StationKind[] = ['register', 'rewind', 'shelf', 'returns', 'restock']
    const weights = [4, 3, 3, 1, 1]
    const total = weights.reduce((sum, weight) => sum + weight, 0)
    let roll = Math.random() * total
    let kind: StationKind = 'register'
    for (let i = 0; i < kinds.length; i += 1) {
      roll -= weights[i] ?? 0
      if (roll <= 0) {
        kind = kinds[i] ?? 'register'
        break
      }
    }

    // One queue per station is enough; stacking five identical jobs just reads as noise.
    if (this.jobs.filter((job) => job.kind === kind).length >= 2) return

    const template = TEMPLATES[kind]
    const title = pickTitle()
    this.jobs.push({
      id: this.nextId++,
      kind,
      label: template.label(title),
      timeLeft: template.patience,
      title,
    })
  }

  /** Resolves the most urgent job at a station. Returns false when there was nothing to do. */
  complete(kind: StationKind, scorecard: Scorecard): Job | null {
    let best: Job | null = null
    let bestIndex = -1
    this.jobs.forEach((job, index) => {
      if (job.kind !== kind) return
      if (!best || job.timeLeft < best.timeLeft) {
        best = job
        bestIndex = index
      }
    })
    if (!best || bestIndex < 0) return null

    this.jobs.splice(bestIndex, 1)
    switch (kind) {
      case 'register':
        scorecard.customersServed += 1
        break
      case 'rewind':
        scorecard.tapesRewound += 1
        break
      case 'shelf':
        scorecard.tapesShelvedCorrectly += 1
        break
      case 'returns':
      case 'restock':
        break
    }
    return best
  }
}
