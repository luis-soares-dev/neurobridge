// audio.ts — Feedback sonoro usando Web Audio API
//
// ANALOGIA: O AudioContext é como uma mesa de som virtual no browser.
// O OscillatorNode gera a onda sonora (tipo, frequência).
// O GainNode controla o volume e faz o fade-out suave.
// Tudo nativo — sem bibliotecas externas, sem ficheiros de áudio.

let audioCtx: AudioContext | null = null

/** Devolve (ou cria) o AudioContext partilhado pela sessão. */
function getCtx(): AudioContext | null {
  try {
    if (!audioCtx || audioCtx.state === 'closed') {
      audioCtx = new AudioContext()
    }
    // Em alguns browsers o contexto começa suspenso até interação do utilizador.
    // O jogo só toca sons após o utilizador ter clicado, por isso está OK.
    if (audioCtx.state === 'suspended') {
      audioCtx.resume()
    }
    return audioCtx
  } catch {
    return null
  }
}

/**
 * Gera um bipe sintético.
 * @param frequency  Hz — altura do som (agudo = alto, grave = baixo)
 * @param duration   segundos — quanto tempo dura
 * @param type       forma de onda: 'sine' (suave) | 'sawtooth' (áspero) | 'square'
 * @param gainValue  volume 0..1
 */
function beep(
  frequency: number,
  duration: number,
  type: OscillatorType = 'sine',
  gainValue: number = 0.25
): void {
  const ctx = getCtx()
  if (!ctx) return
  try {
    const osc  = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.type = type
    osc.frequency.setValueAtTime(frequency, ctx.currentTime)

    // Começa no volume definido e cai exponencialmente até silêncio
    gain.gain.setValueAtTime(gainValue, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)

    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + duration)
  } catch {
    // Audio não crítico — nunca quebrar o jogo por causa de som
  }
}

// ── Sons do jogo ────────────────────────────────────────────────────────────

/**
 * Acerto: utilizador pressionou SPACE no círculo azul (alvo correto).
 * Som: "ding" agudo e curto — reforço positivo.
 */
export function playHitSound(): void {
  beep(880, 0.09, 'sine', 0.28)
}

/**
 * Falso alarme: utilizador pressionou SPACE num distrator (cor errada).
 * Som: "bzzzt" grave e áspero — sinal de erro sem ser punitivo.
 */
export function playFalseAlarmSound(): void {
  beep(160, 0.18, 'sawtooth', 0.20)
}
