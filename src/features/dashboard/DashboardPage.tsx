// Página inicial após o login: XP, nível e lista de jogos.
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { GAMES } from '../../games/catalog'
import { DIFFICULTY_LABELS } from '../../games/core/difficulty'
import { levelFromXp, scoreToPercent, XP_PER_LEVEL } from '../../games/core/score'
import type { GameInfo, GameProgress } from '../../games/core/types'
import { useRecommendedDifficulty } from '../../games/core/useRecommendedDifficulty'
import { getProfileXp, getProgress } from '../../services/sessions'
import { Button, Notice, ProgressBar } from '../../ui/components'
import { useAuthStore } from '../auth/authStore'

function useDashboardData(userId: string | undefined) {
  const [state, setState] = useState<{ xp: number; progress: GameProgress[]; loading: boolean; error: boolean }>({
    xp: 0, progress: [], loading: true, error: false,
  })
  useEffect(() => {
    if (!userId) return
    let cancelled = false
    setState(s => ({ ...s, loading: true, error: false }))
    Promise.all([getProfileXp(userId), getProgress(userId)])
      .then(([xp, progress]) => { if (!cancelled) setState({ xp, progress, loading: false, error: false }) })
      .catch(() => { if (!cancelled) setState(s => ({ ...s, loading: false, error: true })) })
    return () => { cancelled = true }
  }, [userId])
  return state
}

function GameCard({ game, progress, level }: { game: GameInfo; progress?: GameProgress; level?: number }) {
  const navigate = useNavigate()
  const content = (
    <>
      <span style={{ fontSize: '2rem' }} aria-hidden>{game.icon}</span>
      <div style={{ flex: 1, textAlign: 'left' }}>
        <p style={{ fontWeight: 700 }}>{game.name}</p>
        <p className="muted small">{game.available ? game.tagline : `${game.tagline} · Em breve`}</p>
        {progress && progress.totalSessions > 0 && (
          <p className="subtle tiny">
            Última: {scoreToPercent(progress.lastScore ?? 0)} · Melhor: {scoreToPercent(progress.bestScore ?? 0)} · {progress.totalSessions} {progress.totalSessions === 1 ? 'partida' : 'partidas'}
          </p>
        )}
      </div>
      {game.available && (
        <div style={{ textAlign: 'right' }}>
          <span className="chip">JOGAR</span>
          {level && <p className="subtle tiny" style={{ marginTop: '0.25rem' }}>Nível {level} · {DIFFICULTY_LABELS[level as keyof typeof DIFFICULTY_LABELS]}</p>}
        </div>
      )}
    </>
  )
  const style = {
    display: 'flex', alignItems: 'center', gap: '1rem', width: '100%',
    background: game.available ? 'var(--surface)' : 'var(--surface-sunken)',
    border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1.1rem 1.25rem',
  } as const
  if (!game.available) return <div style={{ ...style, opacity: 0.55 }} aria-disabled>{content}</div>
  return (
    <button type="button" onClick={() => navigate(game.route)} style={{ ...style, cursor: 'pointer' }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--primary)')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
      {content}
    </button>
  )
}

export function DashboardPage() {
  const { user, signOut } = useAuthStore()
  const { xp, progress, loading, error } = useDashboardData(user?.id)
  const vigia = useRecommendedDifficulty(user?.id, 'vigia')
  const [signOutError, setSignOutError] = useState(false)
  const { level, xpInLevel, percent } = levelFromXp(xp)

  const name = user?.user_metadata?.full_name?.split(' ')[0] ?? user?.email?.split('@')[0] ?? 'Jogador'

  const handleSignOut = async () => {
    setSignOutError(false)
    try { await signOut() } catch { setSignOutError(true) }
  }

  return (
    <div style={{ minHeight: '100vh' }}>
      <header style={{ borderBottom: '1px solid var(--surface)', padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '1.4rem' }} aria-hidden>🧠</span>
          <span style={{ color: 'var(--primary)', fontWeight: 700, fontSize: '1.1rem' }}>NeuroBridge</span>
        </div>
        <Button variant="ghost" onClick={handleSignOut}>Sair</Button>
      </header>

      <main style={{ maxWidth: 680, margin: '0 auto', padding: '2rem 1rem' }} className="stack">
        {signOutError && <Notice tone="error">Não foi possível sair. Verifique sua conexão e tente novamente.</Notice>}
        <div>
          <h1 style={{ fontSize: '1.6rem' }}>Olá, {name}! <span aria-hidden>👋</span></h1>
          <p className="muted">Pronto para jogar hoje?</p>
        </div>

        <section className="panel" style={{ background: 'var(--surface)', padding: '1.25rem 1.5rem' }} aria-label="Seu progresso">
          {loading ? (
            <p role="status" className="subtle small">Carregando perfil…</p>
          ) : error ? (
            <Notice tone="warning">Não foi possível carregar seu XP. Atualize a página para tentar novamente.</Notice>
          ) : (
            <div className="stack" style={{ gap: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <p>
                  <span style={{ color: 'var(--xp)', fontWeight: 800, fontSize: '1.4rem' }}>{xp.toLocaleString('pt-BR')}</span>
                  <span className="muted small"> XP total</span>
                </p>
                <span className="chip">Nível {level}</span>
              </div>
              <ProgressBar percent={percent} color="var(--xp)" label={`Progresso para o nível ${level + 1}`} />
              <p className="subtle tiny">{xpInLevel} / {XP_PER_LEVEL} XP para o nível {level + 1}</p>
            </div>
          )}
        </section>

        <h2 className="eyebrow" style={{ marginTop: '1rem' }}>Jogos</h2>
        <div className="stack">
          {GAMES.map(game => (
            <GameCard
              key={game.id}
              game={game}
              progress={progress.find(p => p.gameId === game.id)}
              level={game.id === 'vigia' && !vigia.loading ? vigia.difficulty : undefined}
            />
          ))}
        </div>
      </main>
    </div>
  )
}
