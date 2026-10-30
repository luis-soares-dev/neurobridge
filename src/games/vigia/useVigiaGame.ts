// Liga o ciclo puro da partida (session.ts) ao relógio, à tela e ao salvamento.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useAuthStore } from '../../features/auth/authStore'
import { classifySaveError, type SaveErrorKind } from '../../services/errors'
import { playFalseAlarmSound, playHitSound } from '../core/audio'
import { normalizeDifficulty, readDifficulty } from '../core/difficulty'
import { removePending, type StoreOutcome } from '../core/pendingResults'
import type { DifficultyLevel } from '../core/types'
import { TIMING, TOTAL_TRIALS } from './config'
import { computeResults, generateStimuli, type VigiaResults } from './engine'
import { buildPayload, sendPending, storePending, type SessionInfo } from './persistSession'
import { createSession, reduceSession, visibleStimulus, type PauseReason, type SessionEvent, type SessionState } from './session'

/** Relógio substituível (testes e diagnóstico). Usa sempre o tempo monotônico. */
export interface GameClock {
  now(): number
  setTimeout(fn: () => void, ms: number): number
  clearTimeout(id: number): void
  requestFrame(fn: () => void): number
  cancelFrame(id: number): void
}

export const realClock: GameClock = {
  now: () => performance.now(),
  setTimeout: (fn, ms) => window.setTimeout(fn, ms),
  clearTimeout: id => window.clearTimeout(id),
  requestFrame: fn => window.requestAnimationFrame(() => fn()),
  cancelFrame: id => window.cancelAnimationFrame(id),
}

/** Sem quadro desenhado neste prazo, a partida pausa (interrupção técnica). */
export const FRAME_TIMEOUT_MS = 300

export type VigiaPhase = 'instructions' | 'countdown' | 'playing' | 'paused' | 'results'

export interface SaveFailure { kind: SaveErrorKind }

export function useVigiaGame(clock: GameClock = realClock) {
  const userId = useAuthStore(state => state.user?.id)
  const [difficulty, setDifficulty] = useState<DifficultyLevel>(() => readDifficulty(userId))
  const [session, setSession] = useState<SessionState | null>(null)
  const [results, setResults] = useState<VigiaResults | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<SaveFailure | null>(null)
  /** Resultado de guardar a partida neste aparelho, conhecido antes do envio. */
  const [storeOutcome, setStoreOutcome] = useState<StoreOutcome | null>(null)

  const sessionRef = useRef<SessionState | null>(null)
  const infoRef = useRef<SessionInfo>({ id: '', userId: '', durationMs: 0 })
  const timersRef = useRef<number[]>([])
  const savingRef = useRef(false)

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(id => clock.clearTimeout(id))
    timersRef.current = []
  }, [clock])

  // dispatch e schedule se chamam mutuamente; a referência evita dependências circulares.
  const dispatchRef = useRef<(e: SessionEvent) => void>(() => {})

  const schedule = useCallback((s: SessionState) => {
    clearTimers()
    const later = (ms: number, make: () => SessionEvent) => {
      timersRef.current.push(clock.setTimeout(() => dispatchRef.current(make()), ms))
    }
    const { stimulus } = TIMING[s.difficulty]
    switch (s.phase) {
      case 'countdown':
        later(1000, () => ({ type: 'tick', at: clock.now() }))
        break
      case 'presenting':
        later(FRAME_TIMEOUT_MS, () => ({ type: 'frameTimeout', at: clock.now(), random: Math.random }))
        break
      case 'exposure': {
        const elapsed = clock.now() - (s.exposureStart ?? clock.now())
        later(Math.max(0, stimulus - elapsed), () => ({ type: 'exposureEnd', at: clock.now() }))
        break
      }
      case 'gap':
        later(s.gapLeft, () => ({ type: 'gapEnd', at: clock.now() }))
        break
    }
  }, [clearTimers, clock])

  const dispatch = useCallback((e: SessionEvent) => {
    const prev = sessionRef.current
    if (!prev) return
    const next = reduceSession(prev, e)
    if (next === prev) return
    sessionRef.current = next
    setSession(next)
    if (next.phase !== prev.phase || next.countdown !== prev.countdown) schedule(next)
  }, [schedule])
  dispatchRef.current = dispatch

  // Apresentação: depois que o estímulo entra no DOM, espera dois quadros de animação. O
  // primeiro marca o início (é o quadro que deve pintá-lo); o segundo indica que o navegador
  // seguiu renderizando. É uma aproximação: não certifica que os pixels chegaram à tela.
  const presentingKey = session?.phase === 'presenting' ? `${session.trials.length}:${session.interruptions}` : null
  useLayoutEffect(() => {
    if (!presentingKey) return
    let second = 0
    const first = clock.requestFrame(() => {
      const paintedAt = clock.now()
      second = clock.requestFrame(() => dispatchRef.current({ type: 'frameShown', at: paintedAt }))
    })
    return () => { clock.cancelFrame(first); clock.cancelFrame(second) }
  }, [presentingKey, clock])

  const saveResults = useCallback(async (value: VigiaResults) => {
    if (savingRef.current) return
    savingRef.current = true
    setSaving(true)
    setSaveError(null)
    // Guarda neste aparelho antes de enviar: a tela sabe na hora se há cópia recuperável.
    setStoreOutcome(storePending(value, infoRef.current))
    try {
      const official = await sendPending(infoRef.current.userId, buildPayload(value, infoRef.current))
      // O servidor é a fonte oficial de pontuação e XP.
      setResults(r => r && {
        ...r,
        score: { ...r.score, score: official.score, nextDifficulty: official.nextDifficulty },
        xpEarned: official.xpEarned,
      })
      setSaved(true)
    } catch (error) {
      setSaveError({ kind: classifySaveError(error) })
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }, [])

  // Fim da partida: calcula, mostra e envia (tempo ativo, sem pausas nem contagem).
  useEffect(() => {
    if (session?.phase !== 'finished' || results) return
    infoRef.current = { ...infoRef.current, durationMs: session.activeMs }
    const finalResults = computeResults(session.trials, session.difficulty)
    setResults(finalResults)
    void saveResults(finalResults)
  }, [session, results, saveResults])

  const startGame = useCallback((chosen?: DifficultyLevel) => {
    if (savingRef.current || !userId) return
    const d = normalizeDifficulty(chosen ?? difficulty)
    infoRef.current = { id: crypto.randomUUID(), userId, durationMs: 0 }
    const s = createSession(generateStimuli(d), d)
    sessionRef.current = s
    setDifficulty(d)
    setSession(s)
    setResults(null)
    setSaved(false)
    setSaveError(null)
    setStoreOutcome(null)
    schedule(s)
  }, [difficulty, userId, schedule])

  const handleResponse = useCallback(() => {
    const prev = sessionRef.current
    if (!prev) return
    dispatch({ type: 'respond', at: clock.now() })
    const next = sessionRef.current
    if (next && next.response !== null && prev.response === null) {
      if (prev.queue[0]?.isTarget) playHitSound()
      else playFalseAlarmSound()
    }
  }, [dispatch, clock])

  const pause = useCallback((reason: PauseReason = 'user') => {
    dispatch({ type: 'pause', at: clock.now(), reason, random: Math.random })
  }, [dispatch, clock])

  const resume = useCallback(() => dispatch({ type: 'resume' }), [dispatch])

  /** Abandona a partida em andamento (nada é salvo). */
  const quit = useCallback(() => {
    clearTimers()
    sessionRef.current = null
    setSession(null)
  }, [clearTimers])

  /** Descarta um resultado que o servidor recusou definitivamente. */
  const discardResult = useCallback(() => {
    if (infoRef.current.userId) removePending(infoRef.current.userId, infoRef.current.id)
    quit()
    setResults(null)
    setSaveError(null)
    setStoreOutcome(null)
  }, [quit])

  useEffect(() => clearTimers, [clearTimers])

  const phase = session?.phase
  const viewPhase: VigiaPhase =
    !session ? 'instructions'
    : phase === 'countdown' ? 'countdown'
    : phase === 'paused' ? 'paused'
    : phase === 'finished' ? 'results'
    : 'playing'

  // Atalhos ficam suspensos enquanto a tela mostra outra coisa por cima da partida (ex.: a
  // confirmação de saída): sem isso, Esc retomaria a partida sem nenhum estímulo visível.
  const shortcutsSuspendedRef = useRef(false)
  const setShortcutsSuspended = useCallback((value: boolean) => { shortcutsSuspendedRef.current = value }, [])

  // Teclado: Espaço responde; Esc pausa e continua.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (shortcutsSuspendedRef.current) return
      if (e.code === 'Space' && viewPhase === 'playing') {
        e.preventDefault()
        if (!e.repeat) handleResponse()
      } else if (e.code === 'Escape') {
        if (viewPhase === 'playing' || viewPhase === 'countdown') pause('user')
        else if (viewPhase === 'paused') resume()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleResponse, pause, resume, viewPhase])

  // Trocar de aba ou minimizar pausa a partida, para não registrar omissões falsas.
  useEffect(() => {
    const onVisibility = () => { if (document.hidden) pause('hidden') }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [pause])

  return {
    phase: viewPhase,
    countdown: session?.countdown ?? 0,
    completedTrials: session?.trials.length ?? 0,
    totalTrials: TOTAL_TRIALS,
    stimulus: session ? visibleStimulus(session) : null,
    pauseReason: session?.pauseReason ?? null,
    interruptions: session?.interruptions ?? 0,
    results, saving, saved, saveError, difficulty, storeOutcome,
    storedLocally: storeOutcome === 'stored',
    inProgress: viewPhase === 'countdown' || viewPhase === 'playing' || viewPhase === 'paused',
    /** Resultado que se perderia ao sair: não confirmado pelo servidor e sem cópia neste aparelho. */
    unrecoverable: viewPhase === 'results' && results !== null && !saved
      && storeOutcome !== 'stored' && saveError?.kind !== 'rejected',
    retrySave: () => { if (results) void saveResults(results) },
    startGame, handleResponse, pause, resume, quit, discardResult, setShortcutsSuspended,
  }
}
