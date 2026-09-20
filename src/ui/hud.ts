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
  private readonly casePanel = need('case-panel')
  private readonly caseTitle = need('case-title')
  private readonly caseTagline = need('case-tagline')
  private readonly caseMeta = need('case-meta')
  private readonly caseSynopsis = need('case-synopsis')
  private readonly caseStarring = need('case-starring')
  private caseWasDismissed = false

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

  onStart: (() => void) | null = null
  onToggleSound: (() => void) | null = null
  onCycleFidelity: (() => void) | null = null

  constructor() {
    need('btn-start').addEventListener('click', () => this.onStart?.())
    need('btn-again').addEventListener('click', () => this.onStart?.())
    need('btn-case-close').addEventListener('click', () => {
      this.caseWasDismissed = true
    })
    this.soundButton.addEventListener('click', () => this.onToggleSound?.())
    this.fidelityButton.addEventListener('click', () => this.onCycleFidelity?.())
  }

  setSoundMuted(muted: boolean): void {
    this.soundButton.textContent = muted ? 'Music off' : 'Music on'
    this.soundButton.classList.toggle('muted', muted)
  }

  setFidelityLabel(label: string): void {
    this.fidelityButton.textContent = label
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
  }

  hideCase(): void {
    this.casePanel.hidden = true
  }

  /** True once if the player dismissed the case with the on-screen close button. */
  caseDismissed(): boolean {
    const dismissed = this.caseWasDismissed
    this.caseWasDismissed = false
    return dismissed
  }

  setJobs(jobs: readonly Job[]): void {
    // Most urgent first, capped — a wall of text is not readable mid-shift.
    const visible = [...jobs].sort((a, b) => a.timeLeft - b.timeLeft).slice(0, 4)
    this.taskList.replaceChildren(
      ...visible.map((job) => {
        const row = document.createElement('div')
        row.className = 'task'
        if (job.timeLeft < 20) row.classList.add('urgent')
        row.textContent = job.label
        return row
      }),
    )
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
