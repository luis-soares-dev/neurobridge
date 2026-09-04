// VigiGame.tsx — Apresentação do Jogo Vigia (sem lógica de jogo)

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useVigiGame, TIMING_CONFIG } from './useVigiGame'
import type { VigiResults } from './useVigiGame'
import type { DifficultyLevel } from '@/types'
import { interpretKScore } from '@/lib/kscore'

const COLOR_MAP: Record<string, string> = {
  azul:     '#3b82f6',
  vermelho: '#ef4444',
  verde:    '#22c55e',
  laranja:  '#f97316',
  ciano:    '#06b6d4',
  roxo:     '#8b5cf6',
}

const DIFFICULTY_LABELS: Record<number, string> = {
  1: 'Iniciante', 2: 'Iniciante', 3: 'Básico',
  4: 'Básico+',   5: 'Intermédio', 6: 'Intermédio+',
  7: 'Avançado',  8: 'Avançado+',  9: 'Expert', 10: 'Master',
}

// ── Tela de Instruções ──────────────────────────────────────────────────────

function Instructions({
  savedDifficulty,
  onStart,
}: {
  savedDifficulty: DifficultyLevel
  onStart: (d: DifficultyLevel) => void
}) {
  const [selected, setSelected] = useState<DifficultyLevel>(savedDifficulty)
  const timing = TIMING_CONFIG[selected] ?? TIMING_CONFIG[3]

  const distractorColors =
    selected <= 3 ? ['vermelho', 'verde', 'laranja'] :
    selected <= 6 ? ['vermelho', 'verde', 'laranja', 'ciano'] :
                    ['vermelho', 'verde', 'laranja', 'ciano', 'roxo']

  const dec = () => setSelected(d => Math.max(1, d - 1) as DifficultyLevel)
  const inc = () => setSelected(d => Math.min(10, d + 1) as DifficultyLevel)

  return (
    <div style={styles.center}>
      <div style={{ ...styles.card, maxWidth: 440 }}>
        <h1 style={{ color: '#6c8ef5', fontSize: '1.8rem', marginBottom: '0.2rem' }}>
          🎯 Jogo Vigia
        </h1>
        <p style={{ color: '#7070a0', fontSize: '0.88rem', marginBottom: '1.25rem' }}>
          Treino de atenção sustentada
        </p>

        {/* Seletor de dificuldade */}
        <div style={{
          background: '#0f0f1a',
          border: '1px solid #2a2a4a',
          borderRadius: '0.75rem',
          padding: '1rem 1.25rem',
          marginBottom: '1rem',
        }}>
          <p style={{ color: '#a0a0c0', fontSize: '0.72rem', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>
            NÍVEL DE DIFICULDADE
          </p>

          {/* Picker −/+ */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', marginBottom: '0.75rem' }}>
            <button onClick={dec} disabled={selected <= 1} style={styles.levelBtn}>−</button>
            <div style={{ textAlign: 'center', minWidth: 120 }}>
              <span style={{ color: '#ffffff', fontSize: '1.6rem', fontWeight: 800 }}>{selected}</span>
              <span style={{ color: '#5a5a8a', fontSize: '1rem' }}> / 10</span>
              <p style={{ color: '#6c8ef5', fontSize: '0.8rem', fontWeight: 600, margin: '0.1rem 0 0' }}>
                {DIFFICULTY_LABELS[selected]}
              </p>
              <p style={{ color: '#5a5a8a', fontSize: '0.72rem' }}>{timing.stimulus}ms por estímulo</p>
            </div>
            <button onClick={inc} disabled={selected >= 10} style={styles.levelBtn}>+</button>
          </div>

          {/* Barra de nível visual */}
          <div style={{ display: 'flex', gap: 3, marginBottom: '0.75rem' }}>
            {Array.from({ length: 10 }, (_, i) => (
              <div key={i} style={{
                flex: 1, height: 4, borderRadius: 2,
                background: i < selected ? '#6c8ef5' : '#2a2a4a',
                transition: 'background 0.2s',
              }} />
            ))}
          </div>

          {/* K-Score thresholds */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: '0.4rem',
            fontSize: '0.72rem',
            textAlign: 'center',
          }}>
            {[
              { label: 'K < 40', sub: '→ desce nível', color: '#f97316' },
              { label: 'K 40–70', sub: '→ mantém', color: '#6c8ef5' },
              { label: 'K > 70', sub: '→ sobe nível', color: '#22c55e' },
            ].map(z => (
              <div key={z.label} style={{
                background: '#1a1a2e', borderRadius: '0.4rem',
                padding: '0.4rem 0.3rem',
                border: `1px solid ${z.color}22`,
              }}>
                <p style={{ color: z.color, fontWeight: 700 }}>{z.label}</p>
                <p style={{ color: '#5a5a8a', marginTop: '0.1rem' }}>{z.sub}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Instrução da tarefa */}
        <div style={styles.instructionBox}>
          <p style={{ color: '#c0c0e0', fontSize: '0.88rem', lineHeight: 1.6, marginBottom: '0.75rem' }}>
            Círculos coloridos aparecem um por vez.<br />
            Prime <strong style={{ color: '#ffffff' }}>SPACE</strong> (ou clica) apenas no círculo{' '}
            <strong style={{ color: '#3b82f6' }}>azul</strong>:
          </p>

          <div style={{ display: 'flex', gap: '1.25rem', justifyContent: 'center', marginBottom: '0.75rem' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ ...styles.circle, background: COLOR_MAP.azul, width: 56, height: 56, margin: '0 auto' }} />
              <p style={{ color: '#3b82f6', fontWeight: 700, marginTop: '0.4rem', fontSize: '0.75rem' }}>AZUL → SPACE</p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ display: 'flex', gap: '0.3rem', justifyContent: 'center' }}>
                {distractorColors.map(c => (
                  <div key={c} style={{ ...styles.circle, background: COLOR_MAP[c], width: 34, height: 34 }} />
                ))}
              </div>
              <p style={{ color: '#7070a0', fontWeight: 600, marginTop: '0.4rem', fontSize: '0.75rem' }}>
                OUTRAS → IGNORAR
              </p>
            </div>
          </div>

          {selected >= 4 && (
            <p style={{ color: '#06b6d4', fontSize: '0.75rem', lineHeight: 1.5 }}>
              ⚠️ Neste nível surgem cores parecidas com o azul — concentra-te!
            </p>
          )}
          <p style={{ color: '#4a4a6a', fontSize: '0.72rem', marginTop: '0.5rem' }}>
            30 estímulos · ~1 minuto · sons de feedback ativados 🔊
          </p>
        </div>

        <button onClick={() => onStart(selected)} style={styles.primaryButton}>
          Começar nível {selected}
        </button>
      </div>
    </div>
  )
}

// ── Contagem Regressiva ─────────────────────────────────────────────────────

function Countdown({ count }: { count: number }) {
  return (
    <div style={styles.center}>
      <div style={{ textAlign: 'center' }}>
        <p style={{ color: '#7070a0', marginBottom: '1rem' }}>Prepara-te…</p>
        <div style={{ fontSize: '6rem', fontWeight: 900, color: '#6c8ef5', lineHeight: 1 }}>{count}</div>
      </div>
    </div>
  )
}

// ── Arena do Jogo ───────────────────────────────────────────────────────────

function GameArena({
  trialIndex, totalTrials, showStimulus, stimulusColor, onResponse,
}: {
  trialIndex: number; totalTrials: number
  showStimulus: boolean; stimulusColor: string | null
  onResponse: () => void
}) {
  const progress = (trialIndex / totalTrials) * 100
  return (
    <div style={{ ...styles.center, flexDirection: 'column', gap: '2rem' }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
          <span style={{ color: '#7070a0', fontSize: '0.8rem' }}>Progresso</span>
          <span style={{ color: '#7070a0', fontSize: '0.8rem' }}>{trialIndex}/{totalTrials}</span>
        </div>
        <div style={{ background: '#2a2a4a', borderRadius: 9999, height: 6 }}>
          <div style={{ background: '#6c8ef5', borderRadius: 9999, height: '100%', width: `${progress}%`, transition: 'width 0.3s' }} />
        </div>
      </div>

      <div style={{
        width: 180, height: 180,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: '50%', background: '#1a1a2e', border: '2px solid #2a2a4a',
      }}>
        {showStimulus && stimulusColor ? (
          <div style={{
            ...styles.circle, width: 120, height: 120,
            background: COLOR_MAP[stimulusColor] ?? '#888',
            boxShadow: `0 0 30px ${COLOR_MAP[stimulusColor] ?? '#888'}66`,
          }} />
        ) : (
          <div style={{ color: '#3a3a5a', fontSize: '2rem', userSelect: 'none' }}>+</div>
        )}
      </div>

      <button onClick={onResponse} style={{ ...styles.primaryButton, width: 240, fontSize: '1rem', padding: '1rem', background: '#3b82f6' }}>
        RESPONDER (SPACE)
      </button>
      <p style={{ color: '#4a4a6a', fontSize: '0.8rem' }}>
        Responde apenas ao círculo <span style={{ color: '#3b82f6', fontWeight: 700 }}>AZUL</span>
      </p>
    </div>
  )
}

// ── Resultados ──────────────────────────────────────────────────────────────

function Results({ results, saving, onReplay, onDashboard }: {
  results: VigiResults; saving: boolean
  onReplay: () => void; onDashboard: () => void
}) {
  const interp = interpretKScore(results.kResult.kScore)
  const kPct   = Math.round(results.kResult.kScore * 100)
  const next   = results.kResult.nextDifficulty

  const diffChange =
    next > results.difficulty ? `↑ Sobe para nível ${next}` :
    next < results.difficulty ? `↓ Desce para nível ${next}` :
    `→ Mantém nível ${next}`
  const diffColor =
    next > results.difficulty ? '#22c55e' :
    next < results.difficulty ? '#f97316' : '#6c8ef5'

  return (
    <div style={styles.center}>
      <div style={{ ...styles.card, maxWidth: 480 }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '0.25rem' }}>{interp.emoji}</div>
        <h2 style={{ color: interp.color, fontSize: '1.6rem', marginBottom: '0.25rem' }}>{interp.label}</h2>
        <p style={{ color: '#7070a0', fontSize: '0.85rem', marginBottom: '1.5rem' }}>{interp.description}</p>

        <div style={{ background: '#0f0f1a', border: `2px solid ${interp.color}44`, borderRadius: '0.75rem', padding: '1.25rem', marginBottom: '1.25rem' }}>
          <p style={{ color: '#7070a0', fontSize: '0.75rem', marginBottom: '0.25rem' }}>K-SCORE</p>
          <p style={{ color: interp.color, fontSize: '3rem', fontWeight: 900, lineHeight: 1 }}>{kPct}</p>
          <p style={{ color: '#4a4a6a', fontSize: '0.7rem', marginTop: '0.25rem' }}>de 100 · nível {results.difficulty}</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
          {[
            { label: 'Acertos',        value: results.hits,        color: '#22c55e' },
            { label: 'Erros (miss)',   value: results.misses,      color: '#ef4444' },
            { label: 'Falsos alarmes', value: results.falseAlarms, color: '#f97316' },
            { label: 'Tempo médio',    value: results.avgRT > 0 ? `${results.avgRT}ms` : '—', color: '#6c8ef5' },
          ].map(s => (
            <div key={s.label} style={{ background: '#1a1a2e', borderRadius: '0.5rem', padding: '0.75rem', textAlign: 'center' }}>
              <p style={{ color: s.color, fontSize: '1.4rem', fontWeight: 700 }}>{s.value}</p>
              <p style={{ color: '#7070a0', fontSize: '0.7rem' }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* XP + estado de gravação */}
        <div style={{
          background: '#1a1a10', border: '1px solid #fbbf2422',
          borderRadius: '0.5rem', padding: '0.75rem 1rem',
          marginBottom: '0.75rem',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ color: '#fbbf24', fontWeight: 700, fontSize: '1.05rem' }}>
            +{results.xpEarned} XP
          </span>
          <span style={{ color: saving ? '#5a5a8a' : '#3a6a3a', fontSize: '0.75rem' }}>
            {saving ? '⏳ A guardar…' : '✓ Guardado'}
          </span>
        </div>

        {/* Próxima dificuldade */}
        <div style={{
          background: '#0f0f1a', border: '1px solid #2a2a4a',
          borderRadius: '0.5rem', padding: '0.6rem 1rem',
          marginBottom: '1.25rem', fontSize: '0.82rem', color: diffColor,
        }}>
          {diffChange} · {DIFFICULTY_LABELS[next] ?? 'Básico'}
          <span style={{ color: '#4a4a6a', marginLeft: '0.5rem', fontSize: '0.72rem' }}>
            (próximo jogo)
          </span>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={onDashboard} style={{ ...styles.secondaryButton, flex: 1 }}>Dashboard</button>
          <button onClick={onReplay}   style={{ ...styles.primaryButton,   flex: 1 }}>Jogar de novo</button>
        </div>
      </div>
    </div>
  )
}

// ── Componente Principal ────────────────────────────────────────────────────

export function VigiGame() {
  const navigate = useNavigate()
  const {
    phase, countdown, trialIndex, totalTrials,
    showStimulus, currentStimulus, results, saving,
    difficulty, startGame, handleResponse,
  } = useVigiGame()

  return (
    <div style={{ minHeight: '100vh', background: '#0f0f1a', padding: '1rem' }}>
      {phase === 'instructions' && (
        <Instructions savedDifficulty={difficulty} onStart={startGame} />
      )}
      {phase === 'countdown' && <Countdown count={countdown} />}
      {phase === 'playing' && (
        <GameArena
          trialIndex={trialIndex} totalTrials={totalTrials}
          showStimulus={showStimulus}
          stimulusColor={currentStimulus?.color ?? null}
          onResponse={handleResponse}
        />
      )}
      {phase === 'results' && results && (
        <Results
          results={results} saving={saving}
          onReplay={startGame}
          onDashboard={() => navigate('/')}
        />
      )}
    </div>
  )
}

// ── Estilos ─────────────────────────────────────────────────────────────────

const styles = {
  center: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif',
  } as React.CSSProperties,
  card: {
    background: '#1a1a2e', border: '1px solid #2a2a4a',
    borderRadius: '1rem', padding: '2rem',
    width: '100%', maxWidth: 420, textAlign: 'center' as const,
  } as React.CSSProperties,
  instructionBox: {
    background: '#0f0f1a', borderRadius: '0.75rem',
    padding: '1rem', marginBottom: '1.25rem',
  } as React.CSSProperties,
  circle: { borderRadius: '50%', display: 'inline-block' } as React.CSSProperties,
  primaryButton: {
    display: 'block', width: '100%', padding: '0.85rem',
    background: '#6c8ef5', color: '#ffffff',
    border: 'none', borderRadius: '0.5rem',
    fontSize: '1rem', fontWeight: 700, cursor: 'pointer',
  } as React.CSSProperties,
  secondaryButton: {
    display: 'block', width: '100%', padding: '0.85rem',
    background: 'transparent', color: '#a0a0c0',
    border: '1px solid #2a2a4a', borderRadius: '0.5rem',
    fontSize: '1rem', fontWeight: 600, cursor: 'pointer',
  } as React.CSSProperties,
  levelBtn: {
    width: 40, height: 40, borderRadius: '50%',
    background: '#2a2a4a', color: '#a0a0c0',
    border: '1px solid #3a3a6a', fontSize: '1.3rem',
    cursor: 'pointer', display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    fontWeight: 700, lineHeight: 1,
  } as React.CSSProperties,
}
