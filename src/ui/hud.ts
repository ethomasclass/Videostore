import type { Job } from '../sim/Tasks'
import type { ReportLine } from '../sim/Scorecard'
import { GENRE_LABEL, type Title } from '../data/catalog'
import type { TouchUiElements } from '../core/Input'
import { isTouchDevice } from '../core/TouchControls'

const need = <T extends HTMLElement>(id: string): T => {
  const element = document.getElementById(id)
  if (!element) throw new Error(`missing element #${id}`)
  return element as T
}

export class Hud {
  private readonly hud = need('hud')
  private readonly clockText = need('clock-time')
  private readonly taskList = need('hud-tasks')
  private readonly prompt = need('hud-prompt')
  private readonly titleScreen = need('screen-title')
  private readonly reportScreen = need('screen-report')
  private readonly reportLines = need('report-lines')
  private readonly reportVerdict = need('report-verdict')
  private readonly interactButton = need('btn-interact')
  private readonly speech = need('hud-speech')
  private readonly speechName = need('speech-name')
  private readonly speechText = need('speech-text')
  private readonly casePanel = need('case-panel')
  private readonly caseTitle = need('case-title')
  private readonly caseTagline = need('case-tagline')
  private readonly caseMeta = need('case-meta')
  private readonly caseSynopsis = need('case-synopsis')
  private readonly caseStarring = need('case-starring')
  private readonly toast = need('hud-toast')
  private caseWasDismissed = false
  private readonly taskRows = new Map<number, HTMLElement>()
  private toastTimer = 0

  readonly touchUi: TouchUiElements = {
    root: need('touch-ui'),
    surface: need('touch-surface'),
    stick: need('touch-stick'),
    knob: need('touch-knob'),
    interact: this.interactButton,
  }

  /** A phone has no E key to press, so the prompt drops the key hint there. */
  private readonly promptPrefix = isTouchDevice() ? '' : '[E] '

  private readonly soundButton = need('btn-sound')
  private readonly fidelityButton = need('btn-fidelity')
  private readonly chatterButton = need('btn-chatter')
  /** Whether a line is live, as opposed to whether its bubble is currently on screen. */
  private speechActive = false

  onStart: (() => void) | null = null
  onToggleSound: (() => void) | null = null
  onCycleFidelity: (() => void) | null = null
  onToggleChatter: (() => void) | null = null

  constructor() {
    need('btn-start').addEventListener('click', () => this.onStart?.())
    need('btn-again').addEventListener('click', () => this.onStart?.())
    need('btn-case-close').addEventListener('click', () => {
      this.caseWasDismissed = true
    })
    this.soundButton.addEventListener('click', () => this.onToggleSound?.())
    this.fidelityButton.addEventListener('click', () => this.onCycleFidelity?.())
    this.chatterButton.addEventListener('click', () => this.onToggleChatter?.())
  }

  setSoundMuted(muted: boolean): void {
    this.soundButton.textContent = muted ? 'Music off (M)' : 'Music on (M)'
    this.soundButton.classList.toggle('muted', muted)
  }

  setChatterEnabled(enabled: boolean): void {
    this.chatterButton.textContent = enabled ? 'Chatter on (C)' : 'Chatter off (C)'
    this.chatterButton.classList.toggle('muted', !enabled)
  }

  setFidelityLabel(label: string): void {
    this.fidelityButton.textContent = label
  }

  /** Stops the touch look-surface stealing taps meant for an open panel. */
  setModalOpen(open: boolean): void {
    this.touchUi.root.classList.toggle('modal', open)
  }

  showTitle(): void {
    this.titleScreen.hidden = false
    this.reportScreen.hidden = true
    this.hud.hidden = true
    this.touchUi.root.classList.remove('in-shift')
  }

  showShift(): void {
    this.titleScreen.hidden = true
    this.reportScreen.hidden = true
    this.hud.hidden = false
    this.touchUi.root.classList.add('in-shift')
  }

  setClock(text: string): void {
    this.clockText.textContent = text
  }

  setPrompt(text: string | null): void {
    this.prompt.hidden = text === null
    this.prompt.textContent = text === null ? '' : `${this.promptPrefix}${text}`
  }

  /** Dims the on-screen interact button when nothing is in range to act on. */
  setInteractEnabled(enabled: boolean): void {
    this.interactButton.classList.toggle('enabled', enabled)
  }

  /** The back of the box, as the player turns it over in their hands. */
  showCase(title: Title): void {
    this.caseWasDismissed = false
    this.caseTitle.textContent = title.title
    this.caseTagline.textContent = title.tagline
    this.caseSynopsis.textContent = title.synopsis
    this.caseStarring.textContent = `Starring ${title.starring[0]} and ${title.starring[1]}`
    this.caseMeta.replaceChildren(
      ...[
        GENRE_LABEL[title.genre],
        String(title.year),
        title.rating,
        `${title.runtime} min`,
        ...(title.newRelease ? ['New Release'] : []),
      ].map((text) => {
        const chip = document.createElement('span')
        chip.textContent = text
        return chip
      }),
    )
    this.casePanel.hidden = false
    this.setModalOpen(true)
  }

  hideCase(): void {
    this.casePanel.hidden = true
    this.setModalOpen(false)
  }

  /** True once if the player dismissed the case with the on-screen close button. */
  caseDismissed(): boolean {
    const dismissed = this.caseWasDismissed
    this.caseWasDismissed = false
    return dismissed
  }

  /** A customer said something. It hangs around for a few seconds and clears itself. */
  showSpeech(name: string, text: string): void {
    this.speechName.textContent = name
    this.speechText.textContent = text
    this.speechActive = true
    this.speech.hidden = false
  }

  hideSpeech(): void {
    this.speechActive = false
    this.speech.hidden = true
  }

  /**
   * Parks the bubble over whoever is speaking. Screen coordinates come from projecting their
   * head, and the clamp keeps a bubble on screen when its owner is walking off the edge of it.
   */
  anchorSpeech(x: number, y: number, onScreen: boolean): void {
    if (!this.speechActive) return
    // A line from someone you cannot see has nothing to point at, and a bubble parked in the
    // middle of the screen with no owner is just something in the way. It comes back by
    // itself if you turn around while they are still talking.
    this.speech.hidden = !onScreen
    if (!onScreen) return
    const width = this.speech.offsetWidth
    const margin = 12
    const clampedX = Math.max(width / 2 + margin, Math.min(window.innerWidth - width / 2 - margin, x))
    const clampedY = Math.max(this.speech.offsetHeight + margin, Math.min(window.innerHeight - margin, y))
    this.speech.style.left = `${clampedX}px`
    this.speech.style.top = `${clampedY}px`
  }

  /**
   * The checklist. Rows are kept by job id and reconciled rather than rebuilt, so a row can
   * hold its place while it animates — a list that is thrown away every frame cannot tick
   * anything off, it can only make things vanish, which is the opposite of satisfying.
   */
  setJobs(jobs: readonly Job[]): void {
    // Most urgent first, capped, with the standing jobs kept at the bottom whatever happens —
    // the shipment has all night left on it, so by urgency alone it would never be on screen.
    const pinned = jobs.filter((job) => job.pinned)
    const visible = [
      ...jobs.filter((job) => !job.pinned).sort((a, b) => a.timeLeft - b.timeLeft).slice(0, 4),
      ...pinned,
    ]
    const seen = new Set<number>()

    for (const job of visible) {
      seen.add(job.id)
      let row = this.taskRows.get(job.id)
      if (!row) {
        row = this.buildTaskRow(job)
        this.taskRows.set(job.id, row)
        this.taskList.append(row)
      }
      const text = row.querySelector('.task-text')
      if (text && text.textContent !== job.label) text.textContent = job.label
      row.classList.toggle('urgent', job.timeLeft < 20)
      const bar = row.querySelector<HTMLElement>('.task-bar span')
      // A standing job has no deadline to draw, so it shows how much of it is done instead of
      // a bar that never moves.
      if (bar && !job.pinned) bar.style.width = `${Math.max(0, Math.min(1, job.timeLeft / job.patience)) * 100}%`
      if (job.pinned) row.classList.add('standing')
    }

    // Anything gone from the board that was not resolved explicitly just leaves.
    for (const [id, row] of this.taskRows) {
      if (seen.has(id) || row.dataset.resolving) continue
      this.taskRows.delete(id)
      row.remove()
    }

    // The list is sorted by urgency, so keep the DOM in that order without rebuilding it.
    visible.forEach((job, index) => {
      const row = this.taskRows.get(job.id)
      if (row && this.taskList.children[index] !== row) this.taskList.insertBefore(row, this.taskList.children[index] ?? null)
    })
  }

  private buildTaskRow(job: Job): HTMLElement {
    const row = document.createElement('div')
    row.className = 'task'

    const check = document.createElement('span')
    check.className = 'task-check'

    const text = document.createElement('span')
    text.className = 'task-text'
    text.textContent = job.label

    const bar = document.createElement('div')
    bar.className = 'task-bar'
    const fill = document.createElement('span')
    // A deadline bar starts full and drains; a standing job's bar starts empty and fills.
    if (job.pinned) fill.style.width = '0%'
    bar.append(fill)

    row.append(check, text, bar)
    return row
  }

  /** Fills a standing job's bar by how much of it is done rather than how long is left. */
  setJobProgress(id: number, fraction: number): void {
    const bar = this.taskRows.get(id)?.querySelector<HTMLElement>('.task-bar span')
    if (bar) bar.style.width = `${Math.max(0, Math.min(1, fraction)) * 100}%`
  }

  /**
   * Strikes a job off, or marks it blown. The row holds its place for the length of the
   * animation and then collapses, which is the difference between "that is done" and
   * "something disappeared from a list".
   */
  resolveJob(id: number, outcome: 'done' | 'failed'): void {
    const row = this.taskRows.get(id)
    if (!row || row.dataset.resolving) return
    row.dataset.resolving = outcome
    row.classList.remove('urgent')
    row.classList.add(outcome === 'done' ? 'done' : 'failed')
    this.taskRows.delete(id)
    window.setTimeout(() => row.remove(), 900)
  }

  /** A line of feedback under the crosshair: what just happened, and whether it was right. */
  showToast(text: string, tone: 'good' | 'bad' = 'good'): void {
    this.toast.textContent = text
    this.toast.dataset.tone = tone
    this.toast.hidden = false
    window.clearTimeout(this.toastTimer)
    this.toastTimer = window.setTimeout(() => {
      this.toast.hidden = true
    }, 2200)
  }

  showReport(lines: readonly ReportLine[], verdictTitle: string, verdictBody: string): void {
    this.hud.hidden = true
    this.titleScreen.hidden = true
    this.reportScreen.hidden = false
    this.touchUi.root.classList.remove('in-shift')

    this.reportLines.replaceChildren(
      ...lines.map((line) => {
        const row = document.createElement('div')
        row.className = 'report-line'
        row.dataset.tone = String(line.tone)

        const label = document.createElement('span')
        label.textContent = line.label
        const value = document.createElement('strong')
        value.textContent = line.value

        row.append(label, value)
        return row
      }),
    )

    const heading = document.createElement('strong')
    heading.textContent = verdictTitle
    const body = document.createElement('span')
    body.textContent = verdictBody
    this.reportVerdict.replaceChildren(heading, body)
  }
}
