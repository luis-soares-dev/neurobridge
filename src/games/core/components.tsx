// Telas e controles compartilhados pelos jogos.
import { useEffect, useRef, type ReactNode } from 'react'
import { SAVE_ERROR_MESSAGES, type SaveErrorKind } from '../../services/errors'
import { MAX_PENDING, type StoreOutcome } from './pendingResults'
import { Button, Card, Notice, Screen, Toggle } from '../../ui/components'
import { DIFFICULTY_LABELS, explainDecision, formatPoints, LEVEL_DOWN_BELOW, LEVEL_UP_ABOVE, MAX_DIFFICULTY, MIN_DIFFICULTY } from './difficulty'
import { usePreferences } from './preferences'
import { interpretScore } from './score'
import type { DifficultyLevel } from './types'

/** Leva o foco ao título quando a tela aparece (leitores de tela anunciam a nova tela). */
export function useFocusOnMount<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  useEffect(() => { ref.current?.focus() }, [])
  return ref
}

export function Countdown({ count, label = 'Prepare-se…' }: { count: number; label?: string }) {
  return (
    <Screen>
      <p className="muted">{label}</p>
      <div aria-hidden style={{ fontSize: 'clamp(4rem, 18dvh, 6rem)', fontWeight: 900, color: 'var(--primary)', lineHeight: 1 }}>{count}</div>
      {/* Anúncio único e educado, sem interromper a cada número. */}
      <p className="sr-only" aria-live="polite">A partida começa em 3 segundos.</p>
    </Screen>
  )
}

export function DifficultyPicker({ value, onChange, detail }: { value: DifficultyLevel; onChange: (d: DifficultyLevel) => void; detail?: ReactNode }) {
  const set = (n: number) => onChange(Math.min(MAX_DIFFICULTY, Math.max(MIN_DIFFICULTY, n)) as DifficultyLevel)
  return (
    <div className="panel center">
      <p className="eyebrow" id="nivel-titulo" style={{ marginBottom: '0.6rem' }}>Nível de dificuldade</p>
      <div role="group" aria-labelledby="nivel-titulo" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', marginBottom: '0.6rem' }}>
        <Button variant="round" onClick={() => set(value - 1)} disabled={value <= MIN_DIFFICULTY} aria-label="Diminuir nível">−</Button>
        <div style={{ minWidth: 0, flex: '0 1 9rem' }} aria-live="polite">
          <span style={{ fontSize: '1.6rem', fontWeight: 800 }}>{value}</span>
          <span className="subtle"> / {MAX_DIFFICULTY}</span>
          <p style={{ color: 'var(--primary)', fontSize: '0.9rem', fontWeight: 700 }}>{DIFFICULTY_LABELS[value]}</p>
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
        O nível se ajusta sozinho: pontuação acima de {formatPoints(LEVEL_UP_ABOVE)} sobe um nível; abaixo de {formatPoints(LEVEL_DOWN_BELOW)} desce.
      </p>
    </div>
  )
}

/** Pergunta, uma vez, se a pessoa quer sons. Até a escolha, o jogo fica em silêncio. */
export function SoundChoice() {
  const { sound, set } = usePreferences()
  if (sound !== null) return null
  return (
    <Notice tone="info">
      <p>Quer ouvir um som curto a cada resposta? Você pode mudar depois.</p>
      <div className="row">
        <Button variant="secondary" onClick={() => set({ sound: true })}>Ligar sons</Button>
        <Button variant="secondary" onClick={() => set({ sound: false })}>Sem sons</Button>
      </div>
    </Notice>
  )
}

export function PreferencesPanel({ showColorSymbols = false }: { showColorSymbols?: boolean }) {
  const { sound, colorSymbols, set } = usePreferences()
  return (
    <div className="panel stack" style={{ gap: '0.25rem' }}>
      <Toggle label="Sons de resposta" checked={sound === true} onChange={v => set({ sound: v })} />
      {showColorSymbols && (
        <Toggle label="Símbolos nas cores (para quem confunde cores)" checked={colorSymbols} onChange={v => set({ colorSymbols: v })} />
      )}
    </div>
  )
}

const PAUSE_REASONS = {
  user: null,
  hidden: 'Pausamos porque a página ficou em segundo plano.',
  render: 'Pausamos porque a tela parou de ser atualizada (por exemplo, janela encoberta ou aparelho sobrecarregado).',
  navigation: 'Pausamos para você decidir se quer sair.',
} as const

export function PauseScreen({ reason, showColorSymbols, onResume, onQuit }: {
  reason: keyof typeof PAUSE_REASONS | null; showColorSymbols?: boolean
  onResume: () => void; onQuit: () => void
}) {
  const title = useFocusOnMount<HTMLHeadingElement>()
  const why = reason ? PAUSE_REASONS[reason] : null
  return (
    <Screen>
      <Card>
        <div className="stack">
          <h2 ref={title} tabIndex={-1}>Partida pausada</h2>
          {why && <Notice tone="info">{why}</Notice>}
          <p className="muted small">Se um círculo estava na tela, aquela tentativa não conta e será refeita em outro momento da partida.</p>
          <PreferencesPanel showColorSymbols={showColorSymbols} />
          <Button onClick={onResume}>Continuar</Button>
          <Button variant="secondary" onClick={() => {
            if (window.confirm('Encerrar a partida? O resultado não será salvo.')) onQuit()
          }}>Encerrar sem salvar</Button>
          <p className="subtle tiny">Atalho: Esc pausa e continua.</p>
        </div>
      </Card>
    </Screen>
  )
}

const TONE_COLORS = { great: 'var(--success)', good: 'var(--primary)', mid: 'var(--warning)', low: 'var(--danger)' }

/** Cabeçalho de resultados: rótulo, pontuação exata e descrição do que aconteceu. */
export function ScoreHeader({ score, difficulty, description }: { score: number; difficulty: DifficultyLevel; description: string }) {
  const interp = interpretScore(score)
  const color = TONE_COLORS[interp.tone]
  const title = useFocusOnMount<HTMLHeadingElement>()
  return (
    <>
      <div style={{ fontSize: '2.5rem' }} aria-hidden>{interp.emoji}</div>
      <h2 ref={title} tabIndex={-1} style={{ color, fontSize: '1.6rem' }}>{interp.label}</h2>
      <p className="muted small" style={{ marginBottom: '1rem' }}>{description}</p>
      <div className="panel" style={{ borderColor: `color-mix(in srgb, ${color} 45%, transparent)`, marginBottom: '1rem' }}>
        <p className="eyebrow">Pontuação da partida</p>
        <p style={{ color, fontSize: '3rem', fontWeight: 900, lineHeight: 1.1 }}>{formatPoints(score)}</p>
        <p className="subtle tiny">de 100 · nível {difficulty}</p>
      </div>
    </>
  )
}

export function LevelDecision({ score, current, next }: { score: number; current: DifficultyLevel; next: DifficultyLevel }) {
  const color = next > current ? 'var(--success)' : next < current ? 'var(--warning)' : 'var(--primary)'
  return (
    <p className="panel small" style={{ color, padding: '0.6rem 1rem' }}>
      {explainDecision(score, current, next)} <span className="subtle">({DIFFICULTY_LABELS[next]})</span>
    </p>
  )
}

export function SaveStatus({ xp, saving, saved, error, storeOutcome, onRetry, onReauth, onDiscard }: {
  xp: number; saving: boolean; saved: boolean; error: SaveErrorKind | null; storeOutcome: StoreOutcome | null
  onRetry: () => void; onReauth: () => void; onDiscard: () => void
}) {
  const storedLocally = storeOutcome === 'stored'
  const status = saving ? 'Salvando…' : saved ? '✓ Salvo na sua conta' : storedLocally ? 'Guardado neste aparelho' : 'Não salvo'
  return (
    <div className="stack" style={{ marginBottom: '0.75rem' }}>
      <div className="panel" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', padding: '0.75rem 1rem' }}>
        <span>
          <strong style={{ color: 'var(--xp)', fontSize: '1.05rem' }}>+{xp} XP</strong>
          <span className="subtle tiny"> de participação</span>
        </span>
        <span role="status" className="small" style={{ color: saved ? 'var(--success)' : 'var(--muted)' }}>{status}</span>
      </div>
      {error && (
        <div role="alert" className="notice notice-error">
          <p>{SAVE_ERROR_MESSAGES[error]}</p>
          {storeOutcome === 'full' && error !== 'rejected' && (
            <p className="tiny">
              Já há {MAX_PENDING} partidas aguardando envio neste aparelho, então esta não pôde ser guardada.
              Envie-a antes de sair desta tela (ou envie as pendentes pela tela inicial).
            </p>
          )}
          {storeOutcome === 'unavailable' && error !== 'rejected' && (
            <p className="tiny">Este aparelho não permitiu guardar a partida: envie antes de sair desta tela.</p>
          )}
          <div className="row">
            {error === 'auth' && <Button variant="secondary" onClick={onReauth}>Entrar novamente</Button>}
            {error === 'rejected' && <Button variant="secondary" onClick={onDiscard}>Descartar esta partida</Button>}
            {error !== 'auth' && error !== 'rejected' && (
              <Button variant="secondary" onClick={onRetry} disabled={saving}>Tentar enviar de novo</Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/** Pede confirmação ao fechar/recarregar a página com trabalho em andamento. */
export function useBeforeUnload(active: boolean) {
  useEffect(() => {
    if (!active) return
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [active])
}

/** Confirmação de saída quando a navegação interna é bloqueada. */
export function LeaveDialog({ kind, onStay, onLeave }: { kind: 'match' | 'result'; onStay: () => void; onLeave: () => void }) {
  const title = useFocusOnMount<HTMLHeadingElement>()
  const text = kind === 'match'
    ? { title: 'Sair da partida?', body: 'A partida em andamento não será salva.', stay: 'Continuar jogando' }
    : { title: 'Sair sem salvar o resultado?', body: 'Este resultado ainda não chegou à sua conta e não pôde ser guardado neste aparelho. Se sair agora, ele será perdido.', stay: 'Ficar e tentar enviar' }
  return (
    <Screen>
      <Card>
        <div className="stack" role="alertdialog" aria-labelledby="sair-titulo" aria-describedby="sair-texto">
          <h2 id="sair-titulo" ref={title} tabIndex={-1}>{text.title}</h2>
          <p id="sair-texto" className="muted">{text.body}</p>
          <Button onClick={onStay}>{text.stay}</Button>
          <Button variant="secondary" onClick={onLeave}>Sair sem salvar</Button>
        </div>
      </Card>
    </Screen>
  )
}
