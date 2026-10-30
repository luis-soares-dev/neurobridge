// Telas do Vigia (as regras ficam em session.ts/engine.ts; o relógio em useVigiaGame).
import { useEffect, useState } from 'react'
import { useBlocker, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../features/auth/authStore'
import { Button, LoadingScreen, Notice, ProgressBar, Screen } from '../../ui/components'
import {
  Countdown, DifficultyPicker, LeaveDialog, LevelDecision, PauseScreen, PreferencesPanel, SaveStatus,
  ScoreHeader, SoundChoice, useBeforeUnload, useFocusOnMount,
} from '../core/components'
import { readFlag, usePreferences, writeFlag } from '../core/preferences'
import { useRecommendedDifficulty } from '../core/useRecommendedDifficulty'
import type { DifficultyLevel } from '../core/types'
import { TARGET_COLOR, TIMING, TOTAL_TRIALS, distractorsFor, type StimulusColor } from './config'
import { RespondButton, Stimulus } from './components'
import { describeVigia, type VigiaResults } from './engine'
import { Tutorial } from './Tutorial'
import { useVigiaGame } from './useVigiaGame'

const TUTORIAL_FLAG = 'vigia:tutorial-done'

function Instructions({ initialDifficulty, offline, onStart, onTutorial, onBack }: {
  initialDifficulty: DifficultyLevel; offline: boolean
  onStart: (d: DifficultyLevel) => void; onTutorial: () => void; onBack: () => void
}) {
  const [selected, setSelected] = useState(initialDifficulty)
  const symbols = usePreferences(s => s.colorSymbols)
  const title = useFocusOnMount<HTMLHeadingElement>()
  return (
    <Screen>
      <section className="card card-split">
        <div className="split">
          <div className="stack">
            <div>
              <h1 ref={title} tabIndex={-1} style={{ color: 'var(--primary)', fontSize: '1.8rem' }}><span aria-hidden>🎯 </span>Vigia</h1>
              <p className="muted small">Desafio de atenção · {TOTAL_TRIALS} círculos, cerca de 1 minuto</p>
            </div>
            <div className="panel">
              <p style={{ color: 'var(--text-2)', marginBottom: '0.9rem' }}>
                Círculos coloridos aparecem um de cada vez. Aperte <strong style={{ color: 'var(--text)' }}>Espaço</strong> ou
                toque em <strong style={{ color: 'var(--text)' }}>Responder</strong> somente quando o círculo
                for <strong style={{ color: 'var(--text)' }}>azul</strong>{symbols ? ' (com a estrela ★)' : ''}.
              </p>
              <div className="examples">
                <figure>
                  <Stimulus color={TARGET_COLOR} size={56} />
                  <figcaption className="tiny" style={{ fontWeight: 700 }}>AZUL: RESPONDA</figcaption>
                </figure>
                <figure>
                  <div className="swatches">
                    {distractorsFor(selected).map(c => <Stimulus key={c} color={c} size={32} />)}
                  </div>
                  <figcaption className="tiny muted" style={{ fontWeight: 700 }}>OUTRAS: ESPERE</figcaption>
                </figure>
              </div>
              {selected >= 4 && <p className="tiny" style={{ color: 'var(--warning)', marginTop: '0.6rem' }}>Neste nível aparecem cores parecidas com o azul.</p>}
            </div>
            <Button variant="secondary" onClick={onTutorial}>Como jogar (tutorial)</Button>
          </div>
          <div className="stack">
            <SoundChoice />
            {offline && <Notice tone="warning">Sem conexão com o histórico. Usando o nível salvo neste aparelho.</Notice>}
            <DifficultyPicker value={selected} onChange={setSelected} detail={`${TIMING[selected].stimulus} ms por círculo`} />
            <PreferencesPanel showColorSymbols />
            <div className="sticky-action">
              <Button onClick={() => onStart(selected)}>Começar nível {selected}</Button>
            </div>
            <Button variant="secondary" onClick={onBack}>Voltar ao início</Button>
            <p className="subtle tiny center">Esc pausa a partida a qualquer momento.</p>
          </div>
        </div>
      </section>
    </Screen>
  )
}

function Arena({ completed, stimulus, onResponse, onPause }: {
  completed: number; stimulus: StimulusColor | null
  onResponse: () => void; onPause: () => void
}) {
  return (
    <Screen>
      <div className="arena">
        <div className="arena-top">
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '0.25rem 0.5rem', marginBottom: '0.4rem' }}>
            <span className="muted small">{completed} de {TOTAL_TRIALS}</span>
            <Button variant="ghost" onClick={onPause}>Pausar</Button>
          </div>
          <ProgressBar percent={(completed / TOTAL_TRIALS) * 100} label="Progresso da partida" />
        </div>
        <div className="arena-stage">
          {stimulus
            ? <Stimulus color={stimulus} size="calc(var(--stage) * 0.66)" />
            : <span className="arena-fixation" aria-hidden>+</span>}
        </div>
        <div className="arena-controls">
          <RespondButton onRespond={onResponse} autoFocus />
          <p className="muted small">Responda só ao círculo <strong style={{ color: 'var(--text)' }}>azul</strong></p>
        </div>
      </div>
    </Screen>
  )
}

function Results({ game, onReplay, onHome, onReauth }: {
  game: ReturnType<typeof useVigiaGame> & { results: VigiaResults }
  onReplay: () => void; onHome: () => void; onReauth: () => void
}) {
  const { results, saving, saved, saveError, storedLocally, interruptions } = game
  const canLeave = saved || storedLocally || saveError?.kind === 'rejected'
  return (
    <Screen>
      <section className="card card-wide">
        <ScoreHeader score={results.score.score} difficulty={results.difficulty} description={describeVigia(results)} />
        <div className="stat-grid" style={{ marginBottom: '0.5rem' }}>
          <div className="stat"><strong style={{ color: 'var(--success)' }}>{results.hits} de {results.hits + results.misses}</strong><span>Azuis respondidos</span></div>
          <div className="stat"><strong style={{ color: 'var(--warning)' }}>{results.falseAlarms}</strong><span>Respostas a outras cores</span></div>
          <div className="stat"><strong style={{ color: 'var(--primary)' }}>{results.avgRT > 0 ? `${results.avgRT} ms` : '—'}</strong><span>Tempo médio nos azuis</span></div>
          <div className="stat"><strong>{Math.round(results.score.precision * 100)}%</strong><span>Índice de resposta</span></div>
        </div>
        <p className="subtle tiny" style={{ marginBottom: '1rem' }}>
          Índice de resposta = % dos azuis respondidos menos % das outras cores respondidas.
          {interruptions > 0 && ` ${interruptions} ${interruptions === 1 ? 'tentativa foi refeita' : 'tentativas foram refeitas'} por causa de pausa.`}
        </p>
        <SaveStatus
          xp={results.xpEarned} saving={saving} saved={saved} error={saveError?.kind ?? null} storedLocally={storedLocally}
          onRetry={game.retrySave} onReauth={onReauth} onDiscard={() => { game.discardResult(); onHome() }}
        />
        <div style={{ marginBottom: '1rem' }}>
          <LevelDecision score={results.score.score} current={results.difficulty} next={results.score.nextDifficulty} />
          {!saved && <p className="subtle tiny" style={{ marginTop: '0.3rem' }}>Valores calculados neste aparelho; os oficiais vêm do servidor ao salvar.</p>}
        </div>
        <div className="stack">
          <div className="row">
            <Button variant="secondary" onClick={onHome} disabled={!canLeave}>Início</Button>
            <Button onClick={onReplay} disabled={!(saved || storedLocally)}>Jogar de novo</Button>
          </div>
          {!canLeave && !saving && (
            <Button variant="ghost" style={{ width: '100%' }} onClick={() => {
              if (window.confirm('Sair sem salvar esta partida? O resultado desta tela será perdido.')) onHome()
            }}>Sair sem salvar</Button>
          )}
          <p className="subtle tiny">A pontuação mede o desempenho nesta partida. Não é avaliação médica ou psicológica.</p>
        </div>
      </section>
    </Screen>
  )
}

export function VigiaGame() {
  const navigate = useNavigate()
  const userId = useAuthStore(state => state.user?.id)
  const signOut = useAuthStore(state => state.signOut)
  const recommendation = useRecommendedDifficulty(userId, 'vigia')
  const game = useVigiaGame()
  const [showTutorial, setShowTutorial] = useState(() => !readFlag(userId, TUTORIAL_FLAG))
  useBeforeUnload(game.inProgress)

  // Navegação interna (voltar, links) no meio da partida pede confirmação.
  const blocker = useBlocker(({ currentLocation, nextLocation }) =>
    game.inProgress && currentLocation.pathname !== nextLocation.pathname)
  const { pause } = game
  useEffect(() => { if (blocker.state === 'blocked') pause('navigation') }, [blocker.state, pause])

  const goHome = () => navigate('/')
  if (blocker.state === 'blocked') {
    return <LeaveDialog onStay={() => blocker.reset()} onLeave={() => { game.quit(); blocker.proceed() }} />
  }

  switch (game.phase) {
    case 'instructions':
      if (showTutorial) return <Tutorial onFinish={() => { writeFlag(userId, TUTORIAL_FLAG); setShowTutorial(false) }} />
      return recommendation.loading
        ? <LoadingScreen message="Carregando seu progresso…" />
        : <Instructions
            initialDifficulty={recommendation.difficulty} offline={recommendation.error}
            onStart={game.startGame} onTutorial={() => setShowTutorial(true)} onBack={goHome}
          />
    case 'countdown':
      return <Countdown count={game.countdown} />
    case 'paused':
      return <PauseScreen reason={game.pauseReason} showColorSymbols onResume={game.resume} onQuit={game.quit} />
    case 'playing':
      return <Arena completed={game.completedTrials} stimulus={game.stimulus?.color ?? null} onResponse={game.handleResponse} onPause={() => game.pause('user')} />
    case 'results':
      return game.results && (
        <Results
          game={{ ...game, results: game.results }}
          onReplay={() => game.startGame(game.results!.score.nextDifficulty)}
          onHome={goHome}
          onReauth={() => { void signOut().catch(() => {}).finally(() => navigate('/login')) }}
        />
      )
  }
}
