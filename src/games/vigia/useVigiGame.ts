// useVigiGame.ts — Lógica completa do Jogo Vigia

import { useState, useRef, useCallback, useEffect } from 'react'
import { calculateKScore, calculateXP } from '@/lib/kscore'
import { supabase } from '@/lib/supabase'
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
const VIGIA_DIFF_KEY  = 'vigia_difficulty'

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

function getSavedDifficulty(): DifficultyLevel {
  try {
    const v = parseInt(localStorage.getItem(VIGIA_DIFF_KEY) ?? '3', 10)
    return (Math.min(Math.max(v, 1), 10) as DifficultyLevel)
  } catch { return 3 }
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

async function persistSession(results: VigiResults): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase.from('sessions').insert({
      user_id: user.id,
      game_id: 'vigia',
      domain: 'atencao',
      k_score: results.kResult.kScore,
      difficulty_level: results.difficulty,
      xp_earned: results.xpEarned,
      total_trials: results.trials.length,
      correct_trials: results.hits + results.correctRejections,
      ended_at: new Date().toISOString(),
    })

    const { data: profile } = await supabase
      .from('profiles').select('xp_total').eq('id', user.id).single()

    const newXP    = (profile?.xp_total ?? 0) + results.xpEarned
    const newLevel = Math.floor(newXP / 500) + 1

    await supabase.from('profiles')
      .update({ xp_total: newXP, level: newLevel, updated_at: new Date().toISOString() })
      .eq('id', user.id)

    localStorage.setItem(VIGIA_DIFF_KEY, String(results.kResult.nextDifficulty))
  } catch (err) {
    console.error('Erro ao persistir sessão:', err)
  }
}

// ── Hook principal ──────────────────────────────────────────────────────────

export function useVigiGame() {
  const [difficulty, setDifficulty] = useState<DifficultyLevel>(getSavedDifficulty)
  const timing = TIMING_CONFIG[difficulty] ?? TIMING_CONFIG[3]

  const [phase, setPhase]               = useState<VigiPhase>('instructions')
  const [countdown, setCountdown]       = useState(COUNTDOWN_FROM)
  const [trialIndex, setTrialIndex]     = useState(0)
  const [showStimulus, setShowStimulus] = useState(false)
  const [results, setResults]           = useState<VigiResults | null>(null)
  const [saving, setSaving]             = useState(false)

  // stimuli como state para poder ser regenerado ao mudar dificuldade
  const [stimuli, setStimuli] = useState<VigiStimulus[]>(() => generateStimuli(getSavedDifficulty()))

  const stimulusActiveRef  = useRef(false)
  const respondedRef       = useRef(false)
  const responseTimeRef    = useRef(0)
  const trialResultsRef    = useRef<VigiTrialResult[]>([])
  // Ref para saber a cor do estímulo atual no momento da resposta (para o som)
  const currentStimulusRef = useRef<VigiStimulus | null>(null)

  // ── Inicia o jogo com a dificuldade escolhida ─────────────────────────────
  const startGame = useCallback((chosenDifficulty?: DifficultyLevel) => {
    const d = chosenDifficulty ?? difficulty
    setDifficulty(d)
    setStimuli(generateStimuli(d))      // regera estímulos para o nível certo
    trialResultsRef.current = []
    currentStimulusRef.current = null
    setResults(null)
    setSaving(false)
    setCountdown(COUNTDOWN_FROM)
    setTrialIndex(0)
    setPhase('countdown')
  }, [difficulty])

  // ── Resposta (Space ou botão) ─────────────────────────────────────────────
  const handleResponse = useCallback(() => {
    if (stimulusActiveRef.current && !respondedRef.current) {
      respondedRef.current    = true
      responseTimeRef.current = Date.now()
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
      setSaving(true)
      persistSession(finalResults).finally(() => setSaving(false))
      return
    }

    respondedRef.current    = false
    responseTimeRef.current = 0

    const stimulus = stimuli[trialIndex]
    currentStimulusRef.current = stimulus   // disponível para handleResponse

    const stimulusStart = Date.now()
    stimulusActiveRef.current = true
    setShowStimulus(true)

    const hideTimer = setTimeout(() => {
      stimulusActiveRef.current  = false
      currentStimulusRef.current = null
      setShowStimulus(false)

      const responded = respondedRef.current
      const rt        = responded ? responseTimeRef.current - stimulusStart : null
      const isCorrect = (stimulus.isTarget && responded) || (!stimulus.isTarget && !responded)

      trialResultsRef.current.push({
        color: stimulus.color, isTarget: stimulus.isTarget,
        responded, responseTime: rt, isCorrect,
      })

      const itiTimer = setTimeout(() => setTrialIndex(i => i + 1), timing.iti)
      ;(hideTimer as unknown as { itiRef: ReturnType<typeof setTimeout> }).itiRef = itiTimer
    }, timing.stimulus)

    return () => {
      stimulusActiveRef.current = false
      clearTimeout(hideTimer)
      // @ts-ignore
      clearTimeout(hideTimer.itiRef)
    }
  }, [phase, trialIndex, stimuli, difficulty, timing])

  // ── Listener de teclado ───────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space') { e.preventDefault(); handleResponse() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleResponse])

  return {
    phase, countdown, trialIndex,
    totalTrials: TOTAL_TRIALS,
    showStimulus,
    currentStimulus: stimuli[trialIndex] ?? null,
    results, saving, difficulty, timing,
    startGame, handleResponse,
  }
}
