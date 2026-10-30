// Tutorial interativo do Vigia: uma ação por vez, no ritmo da pessoa. Não gera XP nem é salvo.
import { useCallback, useEffect, useRef, useState } from 'react'
import { Button, Card, Notice, Screen } from '../../ui/components'
import { playFalseAlarmSound, playHitSound } from '../core/audio'
import { SoundChoice, useFocusOnMount } from '../core/components'
import { usePreferences } from '../core/preferences'
import { shuffle } from '../core/random'
import { Stimulus, RespondButton } from './components'
import type { StimulusColor } from './config'

type Step = 'target' | 'other' | 'practice' | 'done'

const OTHER_WAIT_MS = 2500
const PRACTICE: StimulusColor[] = ['azul', 'verde', 'laranja', 'azul', 'vermelho', 'verde']
const PRACTICE_ON_MS = 1500
const PRACTICE_GAP_MS = 1000

/** Escuta o Espaço enquanto `active`. */
function useSpace(active: boolean, onPress: () => void) {
  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return
      e.preventDefault()
      if (!e.repeat) onPress()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, onPress])
}

function StepTitle({ children }: { children: string }) {
  const ref = useFocusOnMount<HTMLHeadingElement>()
  return <h2 ref={ref} tabIndex={-1} style={{ fontSize: '1.3rem' }}>{children}</h2>
}

function TargetStep({ onNext }: { onNext: () => void }) {
  const [done, setDone] = useState(false)
  const symbols = usePreferences(s => s.colorSymbols)
  const respond = useCallback(() => { if (!done) { playHitSound(); setDone(true) } }, [done])
  useSpace(!done, respond)
  return (
    <div className="stack center">
      <StepTitle>1 de 3 · O círculo azul</StepTitle>
      <p className="muted">
        Quando aparecer o círculo <strong style={{ color: 'var(--text)' }}>azul</strong>{symbols ? ' (com a estrela ★)' : ''}, aperte
        <strong style={{ color: 'var(--text)' }}> Espaço</strong> ou toque em <strong style={{ color: 'var(--text)' }}>Responder</strong>. Experimente agora.
      </p>
      <div style={{ display: 'flex', justifyContent: 'center', padding: '0.5rem 0' }}><Stimulus color="azul" size={96} /></div>
      {done
        ? <><Notice tone="info"><span role="status">Isso! Você respondeu ao azul. ✓</span></Notice><Button onClick={onNext} autoFocus>Próximo</Button></>
        : <div style={{ display: 'flex', justifyContent: 'center' }}><RespondButton onRespond={respond} /></div>}
    </div>
  )
}

function OtherStep({ onNext }: { onNext: () => void }) {
  const [state, setState] = useState<'waiting' | 'pressed' | 'passed'>('waiting')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (state !== 'waiting') return
    const t = window.setTimeout(() => setState('passed'), OTHER_WAIT_MS)
    return () => window.clearTimeout(t)
  }, [state, attempt])
  const respond = useCallback(() => {
    if (state !== 'waiting') return
    playFalseAlarmSound()
    setState('pressed')
  }, [state])
  useSpace(state === 'waiting', respond)
  return (
    <div className="stack center">
      <StepTitle>2 de 3 · Outras cores</StepTitle>
      <p className="muted">Se o círculo for de <strong style={{ color: 'var(--text)' }}>outra cor</strong>, não faça nada. Espere ele sumir.</p>
      <div style={{ display: 'flex', justifyContent: 'center', padding: '0.5rem 0', minHeight: 112 }}>
        {state === 'waiting' && <Stimulus color="vermelho" size={96} />}
      </div>
      {state === 'waiting' && <div style={{ display: 'flex', justifyContent: 'center' }}><RespondButton onRespond={respond} /></div>}
      {state === 'pressed' && (
        <>
          <Notice tone="info"><span role="status">Esse não era azul. Tudo bem, vamos tentar de novo.</span></Notice>
          <Button onClick={() => { setAttempt(a => a + 1); setState('waiting') }} autoFocus>Tentar de novo</Button>
        </>
      )}
      {state === 'passed' && (
        <>
          <Notice tone="info"><span role="status">Muito bem, você esperou. ✓</span></Notice>
          <Button onClick={onNext} autoFocus>Próximo</Button>
        </>
      )}
    </div>
  )
}

interface PracticeResult { color: StimulusColor; responded: boolean }

function PracticeStep({ onDone }: { onDone: (correct: number) => void }) {
  const [order] = useState(() => shuffle(PRACTICE))
  const [index, setIndex] = useState(0)
  const [visible, setVisible] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const respondedRef = useRef(false)
  const resultsRef = useRef<PracticeResult[]>([])

  useEffect(() => {
    if (index >= order.length) {
      onDone(resultsRef.current.filter(r => (r.color === 'azul') === r.responded).length)
      return
    }
    respondedRef.current = false
    setVisible(true)
    let gap = 0
    const hide = window.setTimeout(() => {
      setVisible(false)
      const color = order[index]
      const responded = respondedRef.current
      resultsRef.current.push({ color, responded })
      const right = (color === 'azul') === responded
      setFeedback(right ? '✓ Certo' : color === 'azul' ? '✗ Era azul: era para responder' : '✗ Não era azul: era para esperar')
      gap = window.setTimeout(() => { setFeedback(null); setIndex(i => i + 1) }, PRACTICE_GAP_MS)
    }, PRACTICE_ON_MS)
    return () => { window.clearTimeout(hide); window.clearTimeout(gap) }
  }, [index, order, onDone])

  const respond = useCallback(() => {
    if (!visible || respondedRef.current) return
    respondedRef.current = true
    if (order[index] === 'azul') playHitSound()
    else playFalseAlarmSound()
  }, [visible, index, order])
  useSpace(true, respond)

  return (
    <div className="stack center">
      <StepTitle>3 de 3 · Treino rápido</StepTitle>
      <p className="muted">Seis círculos, mais devagar que no jogo. Não vale pontos.</p>
      <p className="subtle tiny">{Math.min(index + 1, order.length)} de {order.length}</p>
      <div className="arena-stage" style={{ alignSelf: 'center', ['--stage' as string]: '150px' }}>
        {visible && index < order.length
          ? <Stimulus color={order[index]} size={100} />
          : <span className="arena-fixation" aria-hidden>+</span>}
      </div>
      <p role="status" aria-live="polite" style={{ minHeight: '1.5em', fontWeight: 700 }}>{feedback ?? ''}</p>
      <div style={{ display: 'flex', justifyContent: 'center' }}><RespondButton onRespond={respond} /></div>
    </div>
  )
}

export function Tutorial({ onFinish }: { onFinish: () => void }) {
  const [step, setStep] = useState<Step>('target')
  const [round, setRound] = useState(0)
  const [score, setScore] = useState(0)
  const finishPractice = useCallback((correct: number) => { setScore(correct); setStep('done') }, [])
  return (
    <Screen>
      <Card>
        <div className="stack">
          <p className="eyebrow center">Como jogar o Vigia</p>
          <SoundChoice />
          {step === 'target' && <TargetStep onNext={() => setStep('other')} />}
          {step === 'other' && <OtherStep onNext={() => setStep('practice')} />}
          {step === 'practice' && <PracticeStep key={round} onDone={finishPractice} />}
          {step === 'done' && (
            <div className="stack center">
              <StepTitle>Pronto!</StepTitle>
              <p className="muted">No treino, você acertou {score} de {PRACTICE.length}. No jogo são 30 círculos, e o nível se ajusta ao seu ritmo.</p>
              <Button onClick={onFinish}>Ir para o jogo</Button>
              <Button variant="secondary" onClick={() => { setRound(r => r + 1); setStep('practice') }}>Treinar de novo</Button>
            </div>
          )}
          {step !== 'done' && <Button variant="ghost" style={{ alignSelf: 'center' }} onClick={onFinish}>Pular tutorial</Button>}
        </div>
      </Card>
    </Screen>
  )
}
