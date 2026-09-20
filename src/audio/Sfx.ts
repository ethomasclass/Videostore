import { audioContext, audioMaster } from './context'

/**
 * Synthesised sound effects. Everything here is a shaped noise burst or a filtered oscillator,
 * because the whole palette is mechanical: plastic on plastic, a motor, a latch, a keyswitch.
 *
 * Volumes are deliberately low. These fire constantly during a shift and sit under the radio.
 */
export class Sfx {
  private rewindSource: AudioBufferSourceNode | null = null
  private rewindGain: GainNode | null = null

  private get ctx(): AudioContext | null {
    return audioContext()
  }

  private noiseBuffer(context: AudioContext, seconds: number): AudioBuffer {
    const frames = Math.max(Math.floor(context.sampleRate * seconds), 1)
    const buffer = context.createBuffer(1, frames, context.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < frames; i += 1) data[i] = Math.random() * 2 - 1
    return buffer
  }

  private burst(options: {
    duration: number
    peak: number
    frequency: number
    type?: BiquadFilterType
    q?: number
    delay?: number
  }): void {
    const context = this.ctx
    const master = audioMaster()
    if (!context || !master) return

    const at = context.currentTime + (options.delay ?? 0)
    const source = context.createBufferSource()
    source.buffer = this.noiseBuffer(context, options.duration)

    const filter = context.createBiquadFilter()
    filter.type = options.type ?? 'bandpass'
    filter.frequency.value = options.frequency
    filter.Q.value = options.q ?? 1

    const gain = context.createGain()
    gain.gain.setValueAtTime(0, at)
    gain.gain.linearRampToValueAtTime(options.peak, at + 0.003)
    gain.gain.exponentialRampToValueAtTime(0.0001, at + options.duration)

    source.connect(filter).connect(gain).connect(master)
    source.start(at)
    source.stop(at + options.duration + 0.02)
  }

  private thump(frequency: number, drop: number, peak: number, delay = 0): void {
    const context = this.ctx
    const master = audioMaster()
    if (!context || !master) return

    const at = context.currentTime + delay
    const osc = context.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(frequency, at)
    osc.frequency.exponentialRampToValueAtTime(drop, at + 0.09)

    const gain = context.createGain()
    gain.gain.setValueAtTime(0, at)
    gain.gain.linearRampToValueAtTime(peak, at + 0.004)
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.13)

    osc.connect(gain).connect(master)
    osc.start(at)
    osc.stop(at + 0.2)
  }

  /** The flap dropping open — a latch release and a light plastic knock. */
  deckOpen(): void {
    this.burst({ duration: 0.05, peak: 0.16, frequency: 2600, q: 1.4 })
    this.burst({ duration: 0.09, peak: 0.1, frequency: 900, q: 0.8, delay: 0.04 })
    this.thump(190, 90, 0.1, 0.04)
  }

  /** The flap pushed shut and seating — firmer, with the click at the end. */
  deckClose(): void {
    this.burst({ duration: 0.07, peak: 0.1, frequency: 700, q: 0.7 })
    this.thump(160, 70, 0.16, 0.02)
    this.burst({ duration: 0.035, peak: 0.2, frequency: 3400, q: 2, delay: 0.07 })
  }

  /** The motor, held until stopRewind. Pitch drifts up as the spool fills. */
  startRewind(): void {
    const context = this.ctx
    const master = audioMaster()
    if (!context || !master || this.rewindSource) return

    const source = context.createBufferSource()
    source.buffer = this.noiseBuffer(context, 1)
    source.loop = true

    const band = context.createBiquadFilter()
    band.type = 'bandpass'
    band.frequency.setValueAtTime(760, context.currentTime)
    band.frequency.linearRampToValueAtTime(1250, context.currentTime + 2.4)
    band.Q.value = 5.5

    const gain = context.createGain()
    gain.gain.setValueAtTime(0, context.currentTime)
    gain.gain.linearRampToValueAtTime(0.075, context.currentTime + 0.12)

    source.connect(band).connect(gain).connect(master)
    source.start()

    this.rewindSource = source
    this.rewindGain = gain
  }

  /** Motor off, then the clunk of the tape hitting its stop. */
  stopRewind(): void {
    const context = this.ctx
    if (!context || !this.rewindSource || !this.rewindGain) return

    const at = context.currentTime
    this.rewindGain.gain.cancelScheduledValues(at)
    this.rewindGain.gain.setValueAtTime(this.rewindGain.gain.value, at)
    this.rewindGain.gain.exponentialRampToValueAtTime(0.0001, at + 0.14)
    this.rewindSource.stop(at + 0.18)

    this.rewindSource = null
    this.rewindGain = null

    this.burst({ duration: 0.05, peak: 0.18, frequency: 2000, q: 1.6, delay: 0.14 })
    this.thump(150, 66, 0.12, 0.15)
  }

  /** A case pushed into a row of other cases: a clack and its neighbours shifting. */
  shelfPlace(delay = 0): void {
    this.burst({ duration: 0.045, peak: 0.15, frequency: 2300, q: 1.2, delay })
    this.burst({ duration: 0.07, peak: 0.08, frequency: 1300, q: 0.9, delay: delay + 0.05 })
    this.burst({ duration: 0.05, peak: 0.05, frequency: 3000, q: 1.6, delay: delay + 0.11 })
  }

  /** One keyswitch on the till. */
  keyClick(): void {
    this.burst({ duration: 0.025, peak: 0.12, frequency: 3200, q: 2.4 })
  }

  /** The printer chewing out a receipt. */
  receipt(): void {
    for (let i = 0; i < 7; i += 1) {
      this.burst({ duration: 0.035, peak: 0.07, frequency: 1800, q: 1.2, delay: i * 0.055 })
    }
  }

  /** Something soft dropped into a bin, or a box opened. */
  thud(delay = 0): void {
    this.burst({ duration: 0.12, peak: 0.09, frequency: 420, type: 'lowpass', q: 0.6, delay })
    this.thump(120, 55, 0.14, delay)
  }
}
