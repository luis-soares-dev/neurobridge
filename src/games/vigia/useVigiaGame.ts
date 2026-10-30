// Liga as regras puras do Vigia (engine.ts) ao relógio e à tela.
import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuthStore } from '../../features/auth/authStore'
import { playFalseAlarmSound, playHitSound } from '../core/audio'
import { normalizeDifficulty, readDifficulty } from '../core/difficulty'
import type { DifficultyLevel } from '../core/types'
import { COUNTDOWN_FROM, TIMING, TOTAL_TRIALS } from './config'
import { computeResults, generateStimuli, makeTrial, type VigiaResults, type VigiaStimulus, type VigiaTrial } from './engine'
import { persistSession, type SessionInfo } from './persistSession'

export type VigiaPhase = 'instructions' | 'countdown' | 'playing' | 'paused' | 'results'

export function useVigiaGame() {
  const userId = useAuthStore(state => state.user?.id)
  const [difficulty, setDifficulty] = useState<DifficultyLevel>(() => readDifficulty(userId))
  const timing = TIMING[difficulty]

  const [phase, setPhase] = useState<VigiaPhase>('instructions')
  const [countdown, setCountdown] = useState(COUNTDOWN_FROM)
  const [trialIndex, setTrialIndex] = useState(0)
  const [showStimulus, setShowStimulus] = useState(false)
  const [stimuli, setStimuli] = useState<VigiaStimulus[]>([])
  const [results, setResults] = useState<VigiaResults | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const savingRef = useRef(false)
  const sessionRef = useRef<SessionInfo & { startedAt: number }>({ id: '', userId: '', durationMs: 0, startedAt: 0 })
  const trialResultsRef = useRef<VigiaTrial[]>([])
  const stimulusActiveRef = useRef(false)
  const stimulusStartRef = useRef(0)
  const respondedAtRef = useRef<number | null>(null)
  const currentStimulusRef = useRef<VigiaStimulus | null>(null)

  const saveResults = useCallback(async (value: VigiaResults) => {
    if (savingRef.current) return
    savingRef.current = true
    setSaving(true)
    setSaveError(null)
    try {
      const official = await persistSession(value, sessionRef.current)
      // O servidor é a fonte oficial de pontuação e XP.
      setResults(r => r && {
        ...r,
        score: { ...r.score, score: official.score, nextDifficulty: official.nextDifficulty },
        xpEarned: official.xpEarned,
      })
      setSaved(true)
    } catch {
      setSaveError('Não foi possível salvar. Sua partida continua nesta tela. Tente novamente antes de sair.')
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }, [])

  const startGame = useCallback((chosen?: DifficultyLevel) => {
    if (savingRef.current || !userId) return
    const d = normalizeDifficulty(chosen ?? difficulty)
    sessionRef.current = { id: crypto.randomUUID(), userId, durationMs: 0, startedAt: performance.now() }
    trialResultsRef.current = []
    currentStimulusRef.current = null
    setDifficulty(d)
    setStimuli(generateStimuli(d))
    setResults(null)
    setSaved(false)
    setSaveError(null)
    setTrialIndex(0)
    setCountdown(COUNTDOWN_FROM)
    setPhase('countdown')
  }, [difficulty, userId])

  const handleResponse = useCallback(() => {
    if (!stimulusActiveRef.current || respondedAtRef.current !== null) return
    respondedAtRef.current = performance.now()
    if (currentStimulusRef.current?.isTarget) playHitSound()
    else playFalseAlarmSound()
  }, [])

  // A tentativa em andamento é descartada e repetida ao continuar.
  const pause = useCallback(() => {
    setPhase(p => (p === 'playing' || p === 'countdown' ? 'paused' : p))
  }, [])

  const resume = useCallback(() => {
    setCountdown(COUNTDOWN_FROM)
    setPhase(p => (p === 'paused' ? 'countdown' : p))
  }, [])

  // Contagem regressiva (no início e ao voltar da pausa).
  useEffect(() => {
    if (phase !== 'countdown') return
    if (countdown === 0) { setPhase('playing'); return }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [phase, countdown])

  // Laço principal: mostra o estímulo, mede a resposta, espera o intervalo.
  useEffect(() => {
    if (phase !== 'playing') return

    if (trialIndex >= TOTAL_TRIALS) {
      sessionRef.current.durationMs = Math.round(performance.now() - sessionRef.current.startedAt)
      const finalResults = computeResults(trialResultsRef.current, difficulty)
      setResults(finalResults)
      setPhase('results')
      void saveResults(finalResults)
      return
    }

    // Se a partida foi pausada no meio desta tentativa, ela recomeça do zero.
    trialResultsRef.current.length = trialIndex
    respondedAtRef.current = null
    const stimulus = stimuli[trialIndex]
    let hideTimer: ReturnType<typeof setTimeout> | undefined
    let itiTimer: ReturnType<typeof setTimeout> | undefined

    setShowStimulus(true)
    // O tempo conta a partir do quadro em que o estímulo é desenhado. Se o navegador
    // não entregar o quadro (janela encoberta), a tentativa começa mesmo assim.
    let started = false
    const begin = () => {
      if (started) return
      started = true
      stimulusStartRef.current = performance.now()
      currentStimulusRef.current = stimulus
      stimulusActiveRef.current = true
      hideTimer = setTimeout(() => {
        stimulusActiveRef.current = false
        currentStimulusRef.current = null
        setShowStimulus(false)
        const respondedAt = respondedAtRef.current
        trialResultsRef.current.push(makeTrial(
          stimulus, respondedAt === null ? null : respondedAt - stimulusStartRef.current, difficulty,
        ))
        itiTimer = setTimeout(() => setTrialIndex(i => i + 1), timing.iti)
      }, timing.stimulus)
    }
    const frame = requestAnimationFrame(begin)
    const frameFallback = setTimeout(begin, 50)

    return () => {
      cancelAnimationFrame(frame)
      clearTimeout(frameFallback)
      stimulusActiveRef.current = false
      currentStimulusRef.current = null
      clearTimeout(hideTimer)
      clearTimeout(itiTimer)
    }
  }, [phase, trialIndex, stimuli, difficulty, timing, saveResults])

  useEffect(() => {
    if (phase === 'paused') setShowStimulus(false)
  }, [phase])

  // Teclado: Espaço responde; Esc pausa e continua.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' && phase === 'playing') {
        e.preventDefault()
        if (!e.repeat) handleResponse()
      } else if (e.code === 'Escape') {
        if (phase === 'playing' || phase === 'countdown') pause()
        else if (phase === 'paused') resume()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleResponse, pause, resume, phase])

  // Trocar de aba ou minimizar pausa a partida, para não registrar omissões falsas.
  useEffect(() => {
    const onVisibility = () => { if (document.hidden) pause() }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [pause])

  const inProgress = phase === 'countdown' || phase === 'playing' || phase === 'paused'

  return {
    phase, countdown, trialIndex, totalTrials: TOTAL_TRIALS,
    showStimulus,
    currentStimulus: stimuli[trialIndex] ?? null,
    results, saving, saved, saveError, difficulty,
    hasUnsavedWork: inProgress || (results !== null && !saved),
    retrySave: () => { if (results) void saveResults(results) },
    startGame, handleResponse, pause, resume,
  }
}
