// Telas e controles compartilhados pelos jogos.
import { useEffect, type ReactNode } from 'react'
import { Button, Card, Screen, Toggle } from '../../ui/components'
import { DIFFICULTY_LABELS, LEVEL_DOWN_BELOW, LEVEL_UP_ABOVE, MAX_DIFFICULTY, MIN_DIFFICULTY } from './difficulty'
import { usePreferences } from './preferences'
import { interpretScore, scoreToPercent } from './score'
import type { DifficultyLevel } from './types'

export function Countdown({ count, label = 'Prepare-se…' }: { count: number; label?: string }) {
  return (
    <Screen>
      <p className="muted">{label}</p>
      <div aria-live="assertive" style={{ fontSize: '6rem', fontWeight: 900, color: 'var(--primary)', lineHeight: 1 }}>{count}</div>
    </Screen>
  )
}

export function DifficultyPicker({ value, onChange, detail }: { value: DifficultyLevel; onChange: (d: DifficultyLevel) => void; detail?: ReactNode }) {
  const set = (n: number) => onChange(Math.min(MAX_DIFFICULTY, Math.max(MIN_DIFFICULTY, n)) as DifficultyLevel)
  return (
    <div className="panel">
      <p className="eyebrow" style={{ marginBottom: '0.75rem' }}>Nível de dificuldade</p>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', marginBottom: '0.75rem' }}>
        <Button variant="round" onClick={() => set(value - 1)} disabled={value <= MIN_DIFFICULTY} aria-label="Diminuir nível">−</Button>
        <div style={{ minWidth: 120 }} aria-live="polite">
          <span style={{ fontSize: '1.6rem', fontWeight: 800 }}>{value}</span>
          <span className="subtle"> / {MAX_DIFFICULTY}</span>
          <p style={{ color: 'var(--primary)', fontSize: '0.82rem', fontWeight: 700 }}>{DIFFICULTY_LABELS[value]}</p>
          {detail && <p className="subtle tiny">{detail}</p>}
        </div>
        <Button variant="round" onClick={() => set(value + 1)} disabled={value >= MAX_DIFFICULTY} aria-label="Aumentar nível">+</Button>
      </div>
      <div style={{ display: 'flex', gap: 3, marginBottom: '0.6rem' }} aria-hidden>
        {Array.from({ length: MAX_DIFFICULTY }, (_, i) => (
          <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i < value ? 'var(--primary)' : 'var(--border)' }} />
        ))}
      </div>
      <p className="muted tiny">
        O nível se ajusta sozinho: pontuação acima de {LEVEL_UP_ABOVE * 100} sobe, abaixo de {LEVEL_DOWN_BELOW * 100} desce.
      </p>
    </div>
  )
}

export function PreferencesPanel({ showColorSymbols = false }: { showColorSymbols?: boolean }) {
  const { sound, colorSymbols, set } = usePreferences()
  return (
    <div className="panel stack">
      <Toggle label="Sons de resposta" checked={sound} onChange={v => set({ sound: v })} />
      {showColorSymbols && (
        <Toggle label="Símbolos nas cores (para quem confunde cores)" checked={colorSymbols} onChange={v => set({ colorSymbols: v })} />
      )}
    </div>
  )
}

export function PauseScreen({ onResume, onQuit }: { onResume: () => void; onQuit: () => void }) {
  return (
    <Screen>
      <Card>
        <div className="stack">
          <h2>Partida pausada</h2>
          <p className="muted small">A tentativa em andamento será repetida quando você continuar.</p>
          <PreferencesPanel />
          <Button onClick={onResume} autoFocus>Continuar</Button>
          <Button variant="secondary" onClick={() => {
            if (window.confirm('Encerrar a partida? O resultado não será salvo.')) onQuit()
          }}>Encerrar sem salvar</Button>
          <p className="subtle tiny">Atalho: Esc</p>
        </div>
      </Card>
    </Screen>
  )
}

const TONE_COLORS = { great: 'var(--success)', good: 'var(--primary)', mid: 'var(--warning)', low: 'var(--danger)' }

/** Cabeçalho de resultados: rótulo, pontuação 0–100 e aviso de que não é avaliação clínica. */
export function ScoreHeader({ score, difficulty }: { score: number; difficulty: DifficultyLevel }) {
  const interp = interpretScore(score)
  const color = TONE_COLORS[interp.tone]
  return (
    <>
      <div style={{ fontSize: '2.5rem' }} aria-hidden>{interp.emoji}</div>
      <h2 style={{ color, fontSize: '1.6rem' }}>{interp.label}</h2>
      <p className="muted small" style={{ marginBottom: '1.25rem' }}>{interp.description}</p>
      <div className="panel" style={{ borderColor: `color-mix(in srgb, ${color} 40%, transparent)`, marginBottom: '1.25rem' }}>
        <p className="eyebrow">Pontuação</p>
        <p style={{ color, fontSize: '3rem', fontWeight: 900, lineHeight: 1.1 }}>{scoreToPercent(score)}</p>
        <p className="subtle tiny">de 100 · nível {difficulty}</p>
      </div>
    </>
  )
}

export function SaveStatus({ xp, saving, saved, error, onRetry }: { xp: number; saving: boolean; saved: boolean; error: string | null; onRetry: () => void }) {
  return (
    <div className="stack" style={{ marginBottom: '0.75rem' }}>
      <div className="panel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem' }}>
        <span style={{ color: 'var(--xp)', fontWeight: 800, fontSize: '1.05rem' }}>+{xp} XP</span>
        <span role="status" className="small" style={{ color: saved ? 'var(--success)' : 'var(--muted)' }}>
          {saving ? 'Salvando…' : saved ? '✓ Salvo' : 'Não salvo'}
        </span>
      </div>
      {error && (
        <div role="alert" className="notice notice-error stack">
          <p>{error}</p>
          <Button variant="secondary" onClick={onRetry} disabled={saving}>Tentar salvar novamente</Button>
        </div>
      )}
    </div>
  )
}

/** Pede confirmação ao fechar/recarregar a página com trabalho não salvo. */
export function useBeforeUnload(active: boolean) {
  useEffect(() => {
    if (!active) return
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [active])
}
