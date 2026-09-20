/**
 * The in-store music bed. An original composition, synthesised on the fly rather than streamed:
 * a period-correct store loop is a few kilobytes of arithmetic, and shipping one as audio would
 * dwarf the rest of the build.
 *
 * It is written the way mall and rental-chain background music actually was — a major-seventh
 * turnaround at a walking tempo, brushed drums, and a melody that resolves politely every eight
 * bars and never asks for attention.
 */

const BPM = 104
const STEPS_PER_BAR = 16
const BARS = 8
const TOTAL_STEPS = STEPS_PER_BAR * BARS

/** Scheduler: look this far ahead, and wake this often to refill. */
const LOOKAHEAD_SECONDS = 0.22
const TICK_MS = 30

type Quality = 'maj7' | 'min7' | 'dom7'

const INTERVALS: Record<Quality, readonly number[]> = {
  maj7: [0, 4, 7, 11],
  min7: [0, 3, 7, 10],
  dom7: [0, 4, 7, 10],
}

/** F – Dm – B♭ – C, turned around through Gm the second time. */
const PROGRESSION: ReadonlyArray<{ root: number; quality: Quality }> = [
  { root: 65, quality: 'maj7' },
  { root: 62, quality: 'min7' },
  { root: 58, quality: 'maj7' },
  { root: 60, quality: 'dom7' },
  { root: 65, quality: 'maj7' },
  { root: 62, quality: 'min7' },
  { root: 67, quality: 'min7' },
  { root: 60, quality: 'dom7' },
]

/** Which chord tone the melody takes, per bar. -1 rests. */
const MELODY: ReadonlyArray<readonly number[]> = [
  [2, -1, 3, -1, 1, -1, 2, -1],
  [1, -1, 2, -1, 0, -1, -1, -1],
  [3, -1, 2, -1, 1, -1, 0, -1],
  [1, -1, 0, -1, 1, -1, 2, -1],
  [2, -1, 3, -1, 1, -1, 2, -1],
  [3, -1, 2, -1, 1, -1, -1, -1],
  [0, -1, 1, -1, 2, -1, 3, -1],
  [2, -1, 1, -1, 0, -1, -1, -1],
]

const midiToHz = (midi: number): number => 440 * 2 ** ((midi - 69) / 12)

export class StoreRadio {
  private context: AudioContext | null = null
  private master: GainNode | null = null
  private timer: number | null = null
  private step = 0
  private nextStepTime = 0
  private muted = false

  get isMuted(): boolean {
    return this.muted
  }

  /** Must be called from a user gesture — browsers will not start audio otherwise. */
  start(): void {
    if (!this.context) this.build()
    const context = this.context
    if (!context) return

    void context.resume()
    if (this.timer !== null) return

    this.step = 0
    this.nextStepTime = context.currentTime + 0.1
    this.timer = window.setInterval(this.tick, TICK_MS)
  }

  stop(): void {
    if (this.timer !== null) {
      window.clearInterval(this.timer)
      this.timer = null
    }
    void this.context?.suspend()
  }

  toggleMute(): boolean {
    this.muted = !this.muted
    if (this.master && this.context) {
      this.master.gain.setTargetAtTime(this.muted ? 0 : 0.5, this.context.currentTime, 0.05)
    }
    return this.muted
  }

  private build(): void {
    const Ctor = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return
    const context = new Ctor()

    // Ceiling speakers in a carpeted room: no top end, and a slap of space around everything.
    const master = context.createGain()
    master.gain.value = this.muted ? 0 : 0.5

    const tone = context.createBiquadFilter()
    tone.type = 'lowpass'
    tone.frequency.value = 2600

    const delay = context.createDelay(0.5)
    delay.delayTime.value = 0.26
    const feedback = context.createGain()
    feedback.gain.value = 0.22
    const wet = context.createGain()
    wet.gain.value = 0.16

    tone.connect(master)
    tone.connect(delay)
    delay.connect(feedback)
    feedback.connect(delay)
    delay.connect(wet)
    wet.connect(master)
    master.connect(context.destination)

    this.context = context
    this.master = master
    this.bus = tone
  }

  private bus: BiquadFilterNode | null = null

  private tick = (): void => {
    const context = this.context
    if (!context) return

    const secondsPerStep = 60 / BPM / 4
    while (this.nextStepTime < context.currentTime + LOOKAHEAD_SECONDS) {
      this.scheduleStep(this.step, this.nextStepTime)
      this.nextStepTime += secondsPerStep
      this.step = (this.step + 1) % TOTAL_STEPS
    }
  }

  private scheduleStep(step: number, time: number): void {
    const bar = Math.floor(step / STEPS_PER_BAR)
    const beat = step % STEPS_PER_BAR
    const chord = PROGRESSION[bar]
    if (!chord) return
    const tones = INTERVALS[chord.quality]

    // Kick on one and three, with a pickup into the turnaround.
    if (beat === 0 || beat === 8) this.kick(time)
    if (beat === 14 && bar % 4 === 3) this.kick(time)

    // Brushed backbeat.
    if (beat === 4 || beat === 12) this.snare(time)

    // Hats on the eighths, softer on the offbeat.
    if (beat % 2 === 0) this.hat(time, beat % 4 === 0 ? 0.05 : 0.03)

    // Walking bass: root, fifth, root, leading tone.
    if (beat === 0) this.bass(time, chord.root - 24)
    if (beat === 6) this.bass(time, chord.root - 24 + 7)
    if (beat === 8) this.bass(time, chord.root - 24)
    if (beat === 12) this.bass(time, chord.root - 24 + (bar % 2 === 0 ? 5 : -2))

    // The pad lands on the bar and holds.
    if (beat === 0) {
      for (const interval of tones) this.pad(time, chord.root - 12 + interval)
    }

    // Melody sits on the eighths above the chord.
    if (beat % 2 === 0) {
      const figure = MELODY[bar]
      const degree = figure?.[beat / 2] ?? -1
      if (degree >= 0) {
        const interval = tones[degree % tones.length] ?? 0
        this.lead(time, chord.root + 12 + interval)
      }
    }
  }

  private envelope(gain: GainNode, time: number, peak: number, attack: number, decay: number): void {
    gain.gain.setValueAtTime(0, time)
    gain.gain.linearRampToValueAtTime(peak, time + attack)
    gain.gain.exponentialRampToValueAtTime(0.0001, time + attack + decay)
  }

  private voice(type: OscillatorType, frequency: number, time: number, duration: number): OscillatorNode | null {
    const context = this.context
    if (!context || !this.bus) return null
    const osc = context.createOscillator()
    osc.type = type
    osc.frequency.setValueAtTime(frequency, time)
    osc.start(time)
    osc.stop(time + duration + 0.05)
    return osc
  }

  private bass(time: number, midi: number): void {
    const context = this.context
    if (!context || !this.bus) return
    const osc = this.voice('triangle', midiToHz(midi), time, 0.4)
    if (!osc) return
    const gain = context.createGain()
    this.envelope(gain, time, 0.34, 0.01, 0.38)
    osc.connect(gain).connect(this.bus)
  }

  private pad(time: number, midi: number): void {
    const context = this.context
    if (!context || !this.bus) return
    const osc = this.voice('triangle', midiToHz(midi), time, 1.6)
    if (!osc) return
    // A touch flat against its neighbours, which is what keeps a pad from sounding like a test tone.
    osc.detune.setValueAtTime(-4, time)
    const gain = context.createGain()
    this.envelope(gain, time, 0.075, 0.12, 1.5)
    osc.connect(gain).connect(this.bus)
  }

  private lead(time: number, midi: number): void {
    const context = this.context
    if (!context || !this.bus) return
    const osc = this.voice('sine', midiToHz(midi), time, 0.5)
    if (!osc) return
    const gain = context.createGain()
    this.envelope(gain, time, 0.16, 0.02, 0.45)
    osc.connect(gain).connect(this.bus)
  }

  private kick(time: number): void {
    const context = this.context
    if (!context || !this.bus) return
    const osc = context.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(115, time)
    osc.frequency.exponentialRampToValueAtTime(44, time + 0.11)
    const gain = context.createGain()
    this.envelope(gain, time, 0.5, 0.004, 0.2)
    osc.connect(gain).connect(this.bus)
    osc.start(time)
    osc.stop(time + 0.3)
  }

  private noise(time: number, duration: number, peak: number, cutoff: number, type: BiquadFilterType): void {
    const context = this.context
    if (!context || !this.bus) return
    const frames = Math.floor(context.sampleRate * duration)
    const buffer = context.createBuffer(1, Math.max(frames, 1), context.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1

    const source = context.createBufferSource()
    source.buffer = buffer
    const filter = context.createBiquadFilter()
    filter.type = type
    filter.frequency.value = cutoff
    const gain = context.createGain()
    this.envelope(gain, time, peak, 0.002, duration)
    source.connect(filter).connect(gain).connect(this.bus)
    source.start(time)
    source.stop(time + duration + 0.02)
  }

  private snare(time: number): void {
    this.noise(time, 0.16, 0.16, 1700, 'bandpass')
  }

  private hat(time: number, peak: number): void {
    this.noise(time, 0.05, peak, 7000, 'highpass')
  }

  dispose(): void {
    this.stop()
    void this.context?.close()
    this.context = null
    this.master = null
    this.bus = null
  }
}
