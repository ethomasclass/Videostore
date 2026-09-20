/**
 * One AudioContext for the whole game. The radio and the sound effects both want a context and
 * a master gain, and browsers cap how many contexts a page may open — so they share.
 */

let context: AudioContext | null = null
let master: GainNode | null = null

export function audioContext(): AudioContext | null {
  if (context) return context

  const Ctor =
    window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null

  context = new Ctor()
  master = context.createGain()
  master.gain.value = 1
  master.connect(context.destination)
  return context
}

export function audioMaster(): GainNode | null {
  audioContext()
  return master
}

/** Must be called from a user gesture — browsers will not start audio otherwise. */
export function resumeAudio(): void {
  void audioContext()?.resume()
}

export function suspendAudio(): void {
  void context?.suspend()
}
