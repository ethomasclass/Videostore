import type { StationKind } from '../world/Store'
import { CATALOG, GENRE_LABEL, type Title } from '../data/catalog'
import type { Scorecard } from './Scorecard'

export interface Job {
  id: number
  kind: StationKind
  label: string
  /** Seconds of real time left before the job goes sour. */
  timeLeft: number
  /** What timeLeft started at, so the board can draw how far gone a job is. */
  patience: number
  title?: Title
}

const TEMPLATES: Record<StationKind, { label: (title: Title) => string; patience: number }> = {
  returns: { label: () => 'Empty the return bin', patience: 90 },
  rewind: { label: (t) => `Rewind ${t.title}`, patience: 75 },
  // The genre is the job: a tape only counts as shelved if it goes back to its own section.
  shelf: { label: (t) => `Shelve ${t.title} \u2014 ${GENRE_LABEL[t.genre]}`, patience: 110 },
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
  /** Jobs that ran out of time since the last drain, so the HUD can show them failing. */
  private readonly expired: Job[] = []
  private nextId = 1
  private spawnTimer = 4

  /** Takes the jobs that have timed out since the last call. */
  drainExpired(): Job[] {
    return this.expired.splice(0, this.expired.length)
  }

  reset(): void {
    this.jobs.length = 0
    this.expired.length = 0
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
      this.expired.push(job)
      if (job.kind === 'register') scorecard.customersLost += 1
      else if (job.kind === 'rewind') scorecard.tapesLeftUnrewound += 1
      else if (job.kind === 'shelf') scorecard.tapesShelvedWrong += 1
    }
  }

  /** Work raised by something in the world rather than by the spawner — a customer, say. */
  addJob(kind: StationKind, label: string, patience: number): number {
    const id = this.nextId++
    this.jobs.push({ id, kind, label, timeLeft: patience, patience })
    return id
  }

  hasJob(id: number): boolean {
    return this.jobs.some((job) => job.id === id)
  }

  completeById(id: number, scorecard: Scorecard): Job | null {
    const index = this.jobs.findIndex((job) => job.id === id)
    if (index < 0) return null
    const [job] = this.jobs.splice(index, 1)
    if (!job) return null
    this.credit(job.kind, scorecard)
    return job
  }

  /**
   * Work that one finished job creates: a tape you just rewound is a tape that now has to go
   * back on the floor. Capped, because a chain that always adds is a chain that buries you.
   */
  addFollowUp(kind: StationKind, title: Title, cap = 3): Job | null {
    if (this.jobs.filter((job) => job.kind === kind).length >= cap) return null
    const template = TEMPLATES[kind]
    const job: Job = {
      id: this.nextId++,
      kind,
      label: template.label(title),
      timeLeft: template.patience,
      patience: template.patience,
      title,
    }
    this.jobs.push(job)
    return job
  }

  /** The jobs at a station, most urgent first. Used to pick what a shelf run can take. */
  pending(kind: StationKind): Job[] {
    return this.jobs.filter((job) => job.kind === kind).sort((a, b) => a.timeLeft - b.timeLeft)
  }

  private spawn(): void {
    // No 'register' here: a customer at the counter raises that job, so spawning it at random
    // would put a queue on the board with nobody standing in it.
    const kinds: StationKind[] = ['rewind', 'shelf', 'returns', 'restock']
    const weights = [3, 3, 1, 1]
    const total = weights.reduce((sum, weight) => sum + weight, 0)
    let roll = Math.random() * total
    let kind: StationKind = 'rewind'
    for (let i = 0; i < kinds.length; i += 1) {
      roll -= weights[i] ?? 0
      if (roll <= 0) {
        kind = kinds[i] ?? 'rewind'
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
      patience: template.patience,
      title,
    })
  }

  private credit(kind: StationKind, scorecard: Scorecard): void {
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
  }
}
