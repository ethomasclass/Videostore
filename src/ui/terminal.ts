import type { Title } from '../data/catalog'

/**
 * The rental system, as a text terminal. Every screen is a list of rows and a list of function
 * keys, which is both what these systems actually were and the smallest thing that can grow:
 * adding late fees or a member search later means adding a screen, not rewiring the UI.
 */

export interface Transaction {
  name: string
  memberNumber: string
  basket: readonly Title[]
}

type Screen = 'idle' | 'member' | 'rental' | 'done'

const need = <T extends HTMLElement>(id: string): T => {
  const element = document.getElementById(id)
  if (!element) throw new Error(`missing element #${id}`)
  return element as T
}

/** Two nights for a new release, five for anything else — the standard everyone argued about. */
const priceOf = (title: Title): number => (title.newRelease ? 3.49 : 2.49)
const nightsOf = (title: Title): number => (title.newRelease ? 2 : 5)
const money = (value: number): string => `$${value.toFixed(2)}`

export class Terminal {
  private readonly panel = need('terminal')
  private readonly body = need('terminal-body')
  private readonly keys = need('terminal-keys')
  private readonly status = need('terminal-status')

  private screen: Screen = 'idle'
  private transaction: Transaction | null = null
  private completed = false
  private closed = false
  /** Function key -> action, rebuilt with every screen. Keyboard is the primary interface. */
  private bindings = new Map<string, () => void>()
  private onKeyPress: ((key: string) => void) | null = null

  constructor() {
    need('terminal-close').addEventListener('click', () => {
      this.closed = true
    })

    // These were keyboard terminals, and the player's cursor is captured by pointer lock for
    // most of a shift — so every row is reachable by key, and clicking is the extra.
    window.addEventListener('keydown', (event) => {
      if (this.panel.hidden) return
      const action = this.bindings.get(event.code)
      if (!action) return
      event.preventDefault()
      this.onKeyPress?.(event.code)
      action()
    })
  }

  /** Lets the caller play a keyswitch click without the terminal knowing about audio. */
  setKeyPressListener(listener: (key: string) => void): void {
    this.onKeyPress = listener
  }

  get isOpen(): boolean {
    return !this.panel.hidden
  }

  open(transaction: Transaction | null): void {
    this.transaction = transaction
    this.screen = transaction ? 'member' : 'idle'
    this.completed = false
    this.closed = false
    this.panel.hidden = false
    this.render()
  }

  close(): void {
    this.panel.hidden = true
  }

  /** True once when the sale went through, so the caller can settle up and move the customer on. */
  consumeCompleted(): boolean {
    const done = this.completed
    this.completed = false
    return done
  }

  /** True once when the player backed out. */
  consumeClosed(): boolean {
    const done = this.closed
    this.closed = false
    return done
  }

  private row(text: string, className = ''): HTMLElement {
    const line = document.createElement('div')
    line.className = `term-line ${className}`.trim()
    line.textContent = text
    return line
  }

  private key(code: string, label: string, action: () => void): HTMLElement {
    this.bindings.set(code, action)
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'term-key'
    button.textContent = label
    button.addEventListener('click', () => {
      this.onKeyPress?.(code)
      action()
    })
    return button
  }

  private render(): void {
    this.bindings.clear()
    const transaction = this.transaction

    if (this.screen === 'idle' || !transaction) {
      this.status.textContent = 'READY'
      this.body.replaceChildren(
        this.row('NO CUSTOMER AT THE COUNTER.', 'term-dim'),
        this.row(''),
        this.row('WAIT FOR A MEMBER TO APPROACH,'),
        this.row('OR PRESS ESC TO STEP AWAY.', 'term-dim'),
      )
      this.keys.replaceChildren(this.key('Escape', '[ESC] STEP AWAY', () => { this.closed = true }))
      return
    }

    if (this.screen === 'member') {
      this.status.textContent = 'MEMBER RECORD'
      this.body.replaceChildren(
        this.row(`MEMBER      ${transaction.name.toUpperCase()}`),
        this.row(`CARD NO.    ${transaction.memberNumber}`),
        this.row('STATUS      GOOD STANDING', 'term-good'),
        this.row('LATE FEES   $0.00'),
        this.row(''),
        this.row(`${transaction.basket.length} ITEM(S) AT THE COUNTER.`, 'term-dim'),
      )
      this.keys.replaceChildren(
        this.key('F1', '[F1] START RENTAL', () => {
          this.screen = 'rental'
          this.render()
        }),
        this.key('Escape', '[ESC] STEP AWAY', () => { this.closed = true }),
      )
      return
    }

    if (this.screen === 'rental') {
      const total = transaction.basket.reduce((sum, title) => sum + priceOf(title), 0)
      this.status.textContent = 'RENTAL — OPEN'
      this.body.replaceChildren(
        ...transaction.basket.map((title) =>
          this.row(
            `${title.title.toUpperCase().slice(0, 26).padEnd(28)}${nightsOf(title)}N  ${money(priceOf(title))}`,
          ),
        ),
        this.row(''),
        this.row(`${'TOTAL'.padEnd(28)}    ${money(total)}`, 'term-good'),
        this.row(''),
        this.row('DUE BACK BY 11:00 PM. BE KIND, REWIND.', 'term-dim'),
      )
      this.keys.replaceChildren(
        this.key('F3', '[F3] COMPLETE SALE', () => {
          this.screen = 'done'
          this.completed = true
          this.render()
        }),
        this.key('Escape', '[ESC] STEP AWAY', () => { this.closed = true }),
      )
      return
    }

    this.status.textContent = 'COMPLETE'
    this.body.replaceChildren(
      this.row('TRANSACTION COMPLETE.', 'term-good'),
      this.row(''),
      this.row('RECEIPT PRINTED.'),
      this.row('THANK YOU FOR RENTING AT LACKLUSTER.', 'term-dim'),
    )
    this.keys.replaceChildren(this.key('Escape', '[ESC] CLOSE', () => { this.closed = true }))
  }
}
