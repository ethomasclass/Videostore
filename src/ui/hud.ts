import type { Job } from '../sim/Tasks'
import type { ReportLine } from '../sim/Scorecard'
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

  readonly touchUi: TouchUiElements = {
    root: need('touch-ui'),
    surface: need('touch-surface'),
    stick: need('touch-stick'),
    knob: need('touch-knob'),
    interact: this.interactButton,
  }

  /** A phone has no E key to press, so the prompt drops the key hint there. */
  private readonly promptPrefix = isTouchDevice() ? '' : '[E] '

  onStart: (() => void) | null = null

  constructor() {
    need('btn-start').addEventListener('click', () => this.onStart?.())
    need('btn-again').addEventListener('click', () => this.onStart?.())
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
