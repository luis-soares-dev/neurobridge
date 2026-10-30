// Feedback sonoro com a Web Audio API — sem arquivos de áudio nem bibliotecas.
import { usePreferences } from './preferences'

let audioCtx: AudioContext | null = null

function getCtx(): AudioContext | null {
  try {
    if (!audioCtx || audioCtx.state === 'closed') audioCtx = new AudioContext()
    // Alguns navegadores começam suspensos até a primeira interação.
    if (audioCtx.state === 'suspended') void audioCtx.resume()
    return audioCtx
  } catch {
    return null
  }
}

function beep(frequency: number, duration: number, type: OscillatorType = 'sine', gainValue = 0.25): void {
  if (usePreferences.getState().sound !== true) return
  const ctx = getCtx()
  if (!ctx) return
  try {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = type
    osc.frequency.setValueAtTime(frequency, ctx.currentTime)
    gain.gain.setValueAtTime(gainValue, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + duration)
  } catch {
    // Som não é crítico — nunca interromper o jogo por causa dele.
  }
}

/** Resposta certa: bipe agudo e curto. */
export function playHitSound(): void {
  beep(880, 0.09, 'sine', 0.28)
}

/** Resposta indevida: som grave, curto e sem tom punitivo. */
export function playFalseAlarmSound(): void {
  beep(160, 0.18, 'sawtooth', 0.2)
}
