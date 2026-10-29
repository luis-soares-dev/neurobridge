// useVigiGame.ts — Lógica completa do Jogo Vigia

import { useState, useRef, useCallback, useEffect } from 'react'
import { calculateKScore, calculateXP } from '@/lib/kscore'
import { persistSession } from './persistSession'
import { useAuthStore } from '@/store/authStore'
import { readDifficulty, normalizeDifficulty } from '@/lib/gameProgress'
import { playHitSound, playFalseAlarmSound } from '@/lib/audio'
import type { Trial, DifficultyLevel, KScoreResult } from '@/types'

// ── Tipos ───────────────────────────────────────────────────────────────────

// Nível 1-3: cores fáceis · Nível 4-6: +ciano · Nível 7-10: +roxo
export type StimulusColor = 'azul' | 'vermelho' | 'verde' | 'laranja' | 'ciano' | 'roxo'
export type VigiPhase = 'instructions' | 'countdown' | 'playing' | 'results'

export interface VigiStimulus {
  color: StimulusColor
  isTarget: boolean
}

export interface VigiTrialResult {
  color: StimulusColor
  isTarget: boolean
  responded: boolean
  responseTime: number | null
  isCorrect: boolean
}

export interface VigiResults {
  trials: VigiTrialResult[]
  hits: number
  misses: number
  falseAlarms: number
  correctRejections: number
  accuracy: number
  avgRT: number
  kResult: KScoreResult
  xpEarned: number
  difficulty: DifficultyLevel
}

// ── Configurações ───────────────────────────────────────────────────────────

const TOTAL_TRIALS    = 30
const TARGET_COUNT    = 8
const COUNTDOWN_FROM  = 3


export const TARGET_COLOR: StimulusColor = 'azul'

// Timing adapta-se: quanto mais alto o nível, menor o tempo de reação
export const TIMING_CONFIG: Record<number, { stimulus: number; iti: number }> = {
  1:  { stimulus: 1100, iti: 900 },
  2:  { stimulus: 1000, iti: 800 },
  3:  { stimulus: 900,  iti: 700 },
  4:  { stimulus: 800,  iti: 600 },
  5:  { stimulus: 700,  iti: 550 },
  6:  { stimulus: 650,  iti: 500 },
  7:  { stimulus: 600,  iti: 450 },
  8:  { stimulus: 550,  iti: 400 },
  9:  { stimulus: 500,  iti: 350 },
  10: { stimulus: 450,  iti: 300 },
}

// Distratores mais semelhantes ao alvo = maior dificuldade visual
function getDistractorColors(difficulty: DifficultyLevel): StimulusColor[] {
  if (difficulty <= 3) return ['vermelho', 'verde', 'laranja']
  if (difficulty <= 6) return ['vermelho', 'verde', 'laranja', 'ciano']
  return ['vermelho', 'verde', 'laranja', 'ciano', 'roxo']
}

// ── Geração de estímulos ────────────────────────────────────────────────────

function generateStimuli(difficulty: DifficultyLevel): VigiStimulus[] {
  const distractors = getDistractorColors(difficulty)
  const items: VigiStimulus[] = [
    ...Array(TARGET_COUNT).fill(null).map(() => ({ color: 'azul' as StimulusColor, isTarget: true })),
    ...Array(TOTAL_TRIALS - TARGET_COUNT).fill(null).map((_, i) => ({
      color: distractors[i % distractors.length],
      isTarget: false,
    })),
  ]
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[items[i], items[j]] = [items[j], items[i]]
  }
  return items
}

// ── Resultados ──────────────────────────────────────────────────────────────

function computeResults(
  trials: VigiTrialResult[],
  difficulty: DifficultyLevel,
  timing: { stimulus: number; iti: number }
): VigiResults {
  const hits              = trials.filter(t =>  t.isTarget &&  t.responded).length
  const misses            = trials.filter(t =>  t.isTarget && !t.responded).length
  const falseAlarms       = trials.filter(t => !t.isTarget &&  t.responded).length
  const correctRejections = trials.filter(t => !t.isTarget && !t.responded).length
  const accuracy          = hits + misses > 0 ? hits / (hits + misses) : 0

  const rts = trials
    .filter(t => t.isTarget && t.responded && t.responseTime !== null)
    .map(t => t.responseTime as number)
  const avgRT = rts.length > 0 ? Math.round(rts.reduce((a, b) => a + b, 0) / rts.length) : 0

  const kTrials: Trial[] = trials.map(t => ({
    isCorrect: t.isCorrect,
    responseTime: t.responseTime ?? timing.stimulus + timing.iti,
    difficulty,
    timestamp: Date.now(),
  }))

  const kResult  = calculateKScore(kTrials, difficulty)
  const xpEarned = calculateXP(kResult.kScore, difficulty, trials.length)

  return { trials, hits, misses, falseAlarms, correctRejections, accuracy, avgRT, kResult, xpEarned, difficulty }
}

// ── Persistência ────────────────────────────────────────────────────────────

// ── Hook principal ──────────────────────────────────────────────────────────

export function useVigiGame() {
  const userId = useAuthStore(state => state.user?.id)
  const [difficulty, setDifficulty] = useState<DifficultyLevel>(() => readDifficulty(userId))
  const timing = TIMING_CONFIG[difficulty] ?? TIMING_CONFIG[3]

  const [phase, setPhase]               = useState<VigiPhase>('instructions')
  const [countdown, setCountdown]       = useState(COUNTDOWN_FROM)
  const [trialIndex, setTrialIndex]     = useState(0)
  const [showStimulus, setShowStimulus] = useState(false)
  const [results, setResults]           = useState<VigiResults | null>(null)
  const [saving, setSaving]             = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const savingRef = useRef(false)
  const sessionRef = useRef({ id: '', userId: '', startedAt: '' })

  const saveResults = useCallback(async (value: VigiResults) => {
    if (savingRef.current) return
    savingRef.current = true
    setSaving(true)
    setSaveError(null)
    try {
      const session = sessionRef.current
      await persistSession(value, session.id, session.userId, session.startedAt)
      setSaved(true)
    } catch {
      setSaveError('Não foi possível salvar. Sua partida continua nesta tela. Tente novamente antes de sair.')
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }, [])

  // stimuli como state para poder ser regenerado ao mudar dificuldade
  const [stimuli, setStimuli] = useState<VigiStimulus[]>(() => generateStimuli(readDifficulty(userId)))

  const stimulusActiveRef  = useRef(false)
  const respondedRef       = useRef(false)
  const responseTimeRef    = useRef(0)
  const trialResultsRef    = useRef<VigiTrialResult[]>([])
  // Ref para saber a cor do estímulo atual no momento da resposta (para o som)
  const currentStimulusRef = useRef<VigiStimulus | null>(null)

  // ── Inicia o jogo com a dificuldade escolhida ─────────────────────────────
  const startGame = useCallback((chosenDifficulty?: DifficultyLevel) => {
    if (savingRef.current || !userId) return
    const d = normalizeDifficulty(chosenDifficulty ?? difficulty)
    sessionRef.current = { id: crypto.randomUUID(), userId, startedAt: new Date().toISOString() }
    setSaved(false)
    setSaveError(null)
    setDifficulty(d)
    setStimuli(generateStimuli(d))      // regera estímulos para o nível certo
    trialResultsRef.current = []
    currentStimulusRef.current = null
    setResults(null)
    setSaving(false)
    setCountdown(COUNTDOWN_FROM)
    setTrialIndex(0)
    setPhase('countdown')
  }, [difficulty, userId])

  // ── Resposta (Space ou botão) ─────────────────────────────────────────────
  const handleResponse = useCallback(() => {
    if (stimulusActiveRef.current && !respondedRef.current) {
      respondedRef.current    = true
      responseTimeRef.current = performance.now()
      // Toca o som certo conforme o estímulo visível
      if (currentStimulusRef.current?.isTarget) {
        playHitSound()
      } else {
        playFalseAlarmSound()
      }
    }
  }, [])

  // ── Countdown ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'countdown') return
    if (countdown === 0) { setPhase('playing'); return }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [phase, countdown])

  // ── Loop principal ────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'playing') return

    if (trialIndex >= TOTAL_TRIALS) {
      const finalResults = computeResults(trialResultsRef.current, difficulty, timing)
      setResults(finalResults)
      setPhase('results')
      void saveResults(finalResults)
      return
    }

    respondedRef.current    = false
    responseTimeRef.current = 0

    const stimulus = stimuli[trialIndex]
    currentStimulusRef.current = stimulus   // disponível para handleResponse

    const stimulusStart = performance.now()
    stimulusActiveRef.current = true
    setShowStimulus(true)

    let itiTimer: ReturnType<typeof setTimeout> | undefined
    const hideTimer = setTimeout(() => {
      stimulusActiveRef.current  = false
      currentStimulusRef.current = null
      setShowStimulus(false)

      const responded = respondedRef.current
      const rt        = responded ? Math.round(responseTimeRef.current - stimulusStart) : null
      const isCorrect = (stimulus.isTarget && responded) || (!stimulus.isTarget && !responded)

      trialResultsRef.current.push({
        color: stimulus.color, isTarget: stimulus.isTarget,
        responded, responseTime: rt, isCorrect,
      })

      itiTimer = setTimeout(() => setTrialIndex(i => i + 1), timing.iti)
    }, timing.stimulus)

    return () => {
      stimulusActiveRef.current = false
      clearTimeout(hideTimer)
      clearTimeout(itiTimer)
    }
  }, [phase, trialIndex, stimuli, difficulty, timing, saveResults])

  // ── Listener de teclado ───────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (phase === 'playing' && e.code === 'Space' && !e.repeat) { e.preventDefault(); handleResponse() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleResponse, phase])

  return {
    phase, countdown, trialIndex,
    totalTrials: TOTAL_TRIALS,
    showStimulus,
    currentStimulus: stimuli[trialIndex] ?? null,
    results, saving, saved, saveError, difficulty, timing,
    retrySave: () => results && void saveResults(results),
    startGame, handleResponse,
  }
}

