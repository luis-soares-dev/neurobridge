// Telas do Vigia (a lógica fica em useVigiaGame e engine).
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../features/auth/authStore'
import { Button, Card, Notice, ProgressBar, Screen, LoadingScreen } from '../../ui/components'
import { Countdown, DifficultyPicker, PauseScreen, PreferencesPanel, SaveStatus, ScoreHeader, useBeforeUnload } from '../core/components'
import { DIFFICULTY_LABELS } from '../core/difficulty'
import { usePreferences } from '../core/preferences'
import { useRecommendedDifficulty } from '../core/useRecommendedDifficulty'
import type { DifficultyLevel } from '../core/types'
import { COLORS, TARGET_COLOR, TIMING, TOTAL_TRIALS, distractorsFor, type StimulusColor } from './config'
import type { VigiaResults } from './engine'
import { useVigiaGame } from './useVigiaGame'

function Stimulus({ color, size }: { color: StimulusColor; size: number }) {
  const showSymbol = usePreferences(s => s.colorSymbols)
  const c = COLORS[color]
  return (
    <div
      role="img"
      aria-label={`Círculo ${c.label}`}
      style={{
        width: size, height: size, borderRadius: '50%', background: c.hex, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontSize: size * 0.45, lineHeight: 1, textShadow: '0 1px 3px #0008',
      }}
    >
      {showSymbol && <span aria-hidden>{c.symbol}</span>}
    </div>
  )
}

function Instructions({ initialDifficulty, offline, onStart, onBack }: {
  initialDifficulty: DifficultyLevel; offline: boolean
  onStart: (d: DifficultyLevel) => void; onBack: () => void
}) {
  const [selected, setSelected] = useState(initialDifficulty)
  const distractors = distractorsFor(selected)
  return (
    <Screen>
      <Card>
        <div className="stack">
          <div>
            <h1 style={{ color: 'var(--primary)', fontSize: '1.8rem' }}><span aria-hidden>🎯 </span>Vigia</h1>
            <p className="muted small">Desafio de atenção</p>
          </div>
          {offline && <Notice tone="warning">Sem conexão com o histórico. Usando o nível salvo neste navegador.</Notice>}
          <DifficultyPicker value={selected} onChange={setSelected} detail={`${TIMING[selected].stimulus} ms por círculo`} />
          <div className="panel">
            <p style={{ color: 'var(--text-2)', fontSize: '0.92rem', marginBottom: '0.9rem' }}>
              Círculos coloridos aparecem um de cada vez. Aperte <strong>Espaço</strong> (ou toque no botão)
              somente quando o círculo for <strong style={{ color: COLORS.azul.hex }}>azul</strong>.
            </p>
            <div style={{ display: 'flex', gap: '1.25rem', justifyContent: 'center', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem' }}>
                <Stimulus color={TARGET_COLOR} size={56} />
                <p className="tiny" style={{ color: COLORS.azul.hex, fontWeight: 700 }}>AZUL → RESPONDA</p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem' }}>
                <div style={{ display: 'flex', gap: '0.3rem', minHeight: 56, alignItems: 'center' }}>
                  {distractors.map(c => <Stimulus key={c} color={c} size={32} />)}
                </div>
                <p className="tiny muted" style={{ fontWeight: 700 }}>OUTRAS → IGNORE</p>
              </div>
            </div>
            {selected >= 4 && <p className="tiny" style={{ color: COLORS.ciano.hex }}>Neste nível aparecem cores parecidas com o azul. Atenção!</p>}
            <p className="subtle tiny" style={{ marginTop: '0.4rem' }}>{TOTAL_TRIALS} círculos · cerca de 1 minuto · Esc pausa</p>
          </div>
          <PreferencesPanel showColorSymbols />
          <Button onClick={() => onStart(selected)}>Começar nível {selected}</Button>
          <Button variant="secondary" onClick={onBack}>Voltar ao início</Button>
        </div>
      </Card>
    </Screen>
  )
}

function Arena({ trialIndex, showStimulus, color, onResponse, onPause }: {
  trialIndex: number; showStimulus: boolean; color: StimulusColor | null
  onResponse: () => void; onPause: () => void
}) {
  return (
    <Screen>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
          <span className="muted small">{trialIndex}/{TOTAL_TRIALS}</span>
          <Button variant="ghost" onClick={onPause}>Pausar</Button>
        </div>
        <ProgressBar percent={(trialIndex / TOTAL_TRIALS) * 100} label="Progresso da partida" />
      </div>
      <div style={{
        width: 180, height: 180, margin: '1rem 0', display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: '50%', background: 'var(--surface)', border: '2px solid var(--border)',
      }}>
        {showStimulus && color
          ? <Stimulus color={color} size={120} />
          : <span aria-hidden style={{ color: 'var(--border-strong)', fontSize: '2rem', userSelect: 'none' }}>+</span>}
      </div>
      {/* onPointerDown responde no toque, sem esperar o clique terminar. */}
      <Button
        onPointerDown={e => { e.preventDefault(); onResponse() }}
        onKeyDown={e => { if (e.key === 'Enter') onResponse() }}
        style={{ width: 260, minHeight: 64, fontSize: '1.05rem', background: COLORS.azul.hex, touchAction: 'manipulation' }}
      >
        RESPONDER (Espaço)
      </Button>
      <p className="muted small">Responda só ao círculo <strong style={{ color: COLORS.azul.hex }}>azul</strong></p>
    </Screen>
  )
}

function Results({ results, saving, saved, saveError, onRetry, onReplay, onDashboard }: {
  results: VigiaResults; saving: boolean; saved: boolean; saveError: string | null
  onRetry: () => void; onReplay: () => void; onDashboard: () => void
}) {
  const next = results.score.nextDifficulty
  const change = next > results.difficulty ? { text: `↑ Próxima partida: nível ${next}`, color: 'var(--success)' }
    : next < results.difficulty ? { text: `↓ Próxima partida: nível ${next}`, color: 'var(--warning)' }
    : { text: `→ Próxima partida: nível ${next}`, color: 'var(--primary)' }
  return (
    <Screen>
      <Card wide>
        <ScoreHeader score={results.score.score} difficulty={results.difficulty} />
        <div className="stat-grid" style={{ marginBottom: '1.25rem' }}>
          <div className="stat"><strong style={{ color: 'var(--success)' }}>{results.hits}/{results.hits + results.misses}</strong><span>Azuis respondidos</span></div>
          <div className="stat"><strong style={{ color: 'var(--warning)' }}>{results.falseAlarms}</strong><span>Respostas a outras cores</span></div>
          <div className="stat"><strong style={{ color: 'var(--primary)' }}>{results.avgRT > 0 ? `${results.avgRT} ms` : '—'}</strong><span>Tempo médio</span></div>
          <div className="stat"><strong>{Math.round(results.score.precision * 100)}%</strong><span>Precisão</span></div>
        </div>
        <SaveStatus xp={results.xpEarned} saving={saving} saved={saved} error={saveError} onRetry={onRetry} />
        <p className="panel small" style={{ color: change.color, marginBottom: '1rem', padding: '0.6rem 1rem' }}>
          {change.text} · {DIFFICULTY_LABELS[next]}
        </p>
        <div className="stack">
          <div className="row">
            <Button variant="secondary" onClick={onDashboard} disabled={!saved}>Início</Button>
            <Button onClick={onReplay} disabled={!saved}>Jogar de novo</Button>
          </div>
          {!saved && !saving && (
            <Button variant="ghost" style={{ width: '100%' }} onClick={() => {
              if (window.confirm('Sair sem salvar esta partida? O resultado desta tela será perdido.')) onDashboard()
            }}>Sair sem salvar</Button>
          )}
          <p className="subtle tiny">
            A pontuação mede o desempenho nesta partida. Não é avaliação médica ou psicológica.
          </p>
        </div>
      </Card>
    </Screen>
  )
}

export function VigiaGame() {
  const navigate = useNavigate()
  const userId = useAuthStore(state => state.user?.id)
  const recommendation = useRecommendedDifficulty(userId, 'vigia')
  const game = useVigiaGame()
  useBeforeUnload(game.hasUnsavedWork)
  const goHome = () => navigate('/')

  switch (game.phase) {
    case 'instructions':
      return recommendation.loading
        ? <LoadingScreen message="Carregando seu progresso…" />
        : <Instructions key={userId} initialDifficulty={recommendation.difficulty} offline={recommendation.error} onStart={game.startGame} onBack={goHome} />
    case 'countdown':
      return <Countdown count={game.countdown} />
    case 'paused':
      return <PauseScreen onResume={game.resume} onQuit={goHome} />
    case 'playing':
      return (
        <Arena
          trialIndex={game.trialIndex} showStimulus={game.showStimulus}
          color={game.currentStimulus?.color ?? null}
          onResponse={game.handleResponse} onPause={game.pause}
        />
      )
    case 'results':
      return game.results && (
        <Results
          results={game.results} saving={game.saving} saved={game.saved} saveError={game.saveError}
          onRetry={game.retrySave}
          onReplay={() => game.startGame(game.results!.score.nextDifficulty)}
          onDashboard={goHome}
        />
      )
  }
}
