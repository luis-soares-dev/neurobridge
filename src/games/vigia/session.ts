// Ciclo de uma partida do Vigia como função pura: (estado, evento) → estado.
// O hook useVigiaGame só agenda os eventos no relógio; as regras ficam aqui e são testadas.
//
// Fases: contagem → apresentando (aguarda o quadro) → exposição → intervalo → … → concluída.
// Regras de interrupção:
//  - tentativa concluída é imutável (pausar no intervalo não apaga nada);
//  - pausa durante apresentação/exposição descarta a tentativa em andamento e devolve o
//    estímulo ao conjunto restante, que é reembaralhado (mantém 30 tentativas e 8 alvos);
//  - se a tela não for desenhada a tempo, a partida pausa sozinha (interrupção técnica),
//    em vez de registrar uma omissão que o jogador não teve chance de evitar.
import type { DifficultyLevel } from '../core/types'
import { shuffle, type Random } from '../core/random'
import { COUNTDOWN_FROM, TIMING } from './config'
import { makeTrial, type VigiaStimulus, type VigiaTrial } from './engine'

export type SessionPhase = 'countdown' | 'presenting' | 'exposure' | 'gap' | 'paused' | 'finished'
export type PauseReason = 'user' | 'hidden' | 'render' | 'navigation'

export interface SessionState {
  difficulty: DifficultyLevel
  phase: SessionPhase
  countdown: number
  /** Estímulos ainda não concluídos; o primeiro é o atual/próximo. */
  queue: VigiaStimulus[]
  /** Tentativas concluídas, em ordem. Nunca são alteradas depois de registradas. */
  trials: VigiaTrial[]
  /** Momento (relógio monotônico, ms) em que o estímulo atual foi desenhado. */
  exposureStart: number | null
  /** Tempo de resposta da tentativa atual, se houve resposta válida. */
  response: number | null
  /** Tempo ativo acumulado (sem contagem regressiva e sem pausas). */
  activeMs: number
  activeSince: number | null
  interruptions: number
  pauseReason: PauseReason | null
  /** Para onde a partida volta depois da contagem: um novo estímulo ou o resto do intervalo. */
  resumeTo: 'presenting' | 'gap'
  /** Quanto falta do intervalo atual (ms). Preservado na pausa: pausar não encurta intervalos. */
  gapLeft: number
  /** Momento em que o trecho atual do intervalo começou a correr. */
  gapStart: number | null
}

export type SessionEvent =
  | { type: 'tick'; at: number }
  | { type: 'frameShown'; at: number }
  | { type: 'frameTimeout'; at: number; random: Random }
  | { type: 'respond'; at: number }
  | { type: 'exposureEnd'; at: number }
  | { type: 'gapEnd'; at: number }
  | { type: 'pause'; at: number; reason: PauseReason; random: Random }
  | { type: 'resume' }

export function createSession(stimuli: VigiaStimulus[], difficulty: DifficultyLevel): SessionState {
  return {
    difficulty, phase: 'countdown', countdown: COUNTDOWN_FROM,
    queue: [...stimuli], trials: [], exposureStart: null, response: null,
    activeMs: 0, activeSince: null, interruptions: 0, pauseReason: null,
    resumeTo: 'presenting', gapLeft: 0, gapStart: null,
  }
}

const stopClock = (s: SessionState, at: number) =>
  s.activeSince === null ? s.activeMs : s.activeMs + Math.max(0, at - s.activeSince)

/** Fim do intervalo (ou da partida, se não houver mais estímulos). */
function afterGap(s: SessionState, at: number): SessionState {
  const base = { ...s, gapLeft: 0, gapStart: null }
  if (s.queue.length > 0) return { ...base, phase: 'presenting' }
  return { ...base, phase: 'finished', activeMs: stopClock(s, at), activeSince: null }
}

function interrupt(s: SessionState, at: number, reason: PauseReason, random: Random): SessionState {
  const midTrial = s.phase === 'presenting' || s.phase === 'exposure'
  const inGap = s.phase === 'gap'
  return {
    ...s,
    phase: 'paused',
    pauseReason: reason,
    // A tentativa interrompida volta para o conjunto restante, em posição aleatória.
    queue: midTrial ? shuffle(s.queue, random) : s.queue,
    interruptions: s.interruptions + (midTrial ? 1 : 0),
    exposureStart: null,
    response: null,
    activeMs: stopClock(s, at),
    activeSince: null,
    // No intervalo, guarda quanto falta; ao continuar, o intervalo termina antes do próximo estímulo.
    resumeTo: inGap ? 'gap' : 'presenting',
    gapLeft: inGap ? Math.max(0, s.gapLeft - (at - (s.gapStart ?? at))) : 0,
    gapStart: null,
  }
}

export function reduceSession(s: SessionState, e: SessionEvent): SessionState {
  switch (e.type) {
    case 'tick': {
      if (s.phase !== 'countdown') return s
      if (s.countdown > 1) return { ...s, countdown: s.countdown - 1 }
      const running = { ...s, countdown: 0, activeSince: e.at }
      if (s.resumeTo === 'gap') return { ...running, phase: 'gap', gapStart: e.at }
      // Sem estímulos restantes não há o que apresentar: a partida termina.
      return s.queue.length > 0 ? { ...running, phase: 'presenting' } : afterGap(running, e.at)
    }

    case 'frameShown':
      if (s.phase !== 'presenting') return s
      return { ...s, phase: 'exposure', exposureStart: e.at, response: null }

    case 'frameTimeout':
      return s.phase === 'presenting' ? interrupt(s, e.at, 'render', e.random) : s

    case 'respond': {
      if (s.phase !== 'exposure' || s.response !== null || s.exposureStart === null) return s
      const rt = e.at - s.exposureStart
      // Resposta depois do fim da janela não conta (não é "puxada" para o limite).
      if (rt < 0 || rt > TIMING[s.difficulty].stimulus) return s
      return { ...s, response: rt }
    }

    case 'exposureEnd': {
      if (s.phase !== 'exposure' || s.queue.length === 0) return s
      const [current, ...rest] = s.queue
      return {
        ...s, phase: 'gap', queue: rest, exposureStart: null, response: null,
        trials: [...s.trials, makeTrial(current, s.response, s.difficulty)],
        gapLeft: TIMING[s.difficulty].iti, gapStart: e.at,
      }
    }

    case 'gapEnd':
      return s.phase === 'gap' ? afterGap(s, e.at) : s

    case 'pause':
      if (s.phase === 'paused' || s.phase === 'finished') return s
      // Na contagem nada está correndo; o destino da retomada continua o mesmo.
      if (s.phase === 'countdown') return { ...s, phase: 'paused', pauseReason: e.reason }
      return interrupt(s, e.at, e.reason, e.random)

    case 'resume':
      if (s.phase !== 'paused') return s
      return { ...s, phase: 'countdown', countdown: COUNTDOWN_FROM, pauseReason: null }
  }
}

/** Estímulo que deve estar na tela agora (ou null). */
export function visibleStimulus(s: SessionState): VigiaStimulus | null {
  return s.phase === 'presenting' || s.phase === 'exposure' ? s.queue[0] ?? null : null
}
