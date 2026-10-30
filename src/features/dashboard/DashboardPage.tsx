// Página inicial após o login: XP, nível e lista de jogos.
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { GAMES } from '../../games/catalog'
import { DIFFICULTY_LABELS, formatPoints } from '../../games/core/difficulty'
import { levelFromXp, XP_PER_LEVEL } from '../../games/core/score'
import type { DifficultyLevel, GameInfo, GameProgress } from '../../games/core/types'
import { useRecommendedDifficulty } from '../../games/core/useRecommendedDifficulty'
import { getProfileXp, getProgress } from '../../services/sessions'
import { Button, Notice, ProgressBar } from '../../ui/components'
import { useFocusOnMount } from '../../games/core/components'
import { useAuthStore } from '../auth/authStore'
import { PendingNotice } from './PendingNotice'

interface DashboardData { xp: number; progress: GameProgress[]; loading: boolean; error: boolean }
const EMPTY: DashboardData = { xp: 0, progress: [], loading: true, error: false }

function useDashboardData(userId: string | undefined) {
  const [state, setState] = useState<DashboardData>(EMPTY)
  const [reloadKey, setReloadKey] = useState(0)
  useEffect(() => {
    if (!userId) return
    let cancelled = false
    // Recomeça do zero: nada da leitura anterior fica na tela enquanto esta carrega.
    setState(EMPTY)
    Promise.all([getProfileXp(userId), getProgress(userId)])
      .then(([xp, progress]) => { if (!cancelled) setState({ xp, progress, loading: false, error: false }) })
      .catch(() => { if (!cancelled) setState({ ...EMPTY, loading: false, error: true }) })
    return () => { cancelled = true }
  }, [userId, reloadKey])
  const reload = useCallback(() => setReloadKey(k => k + 1), [])
  return { ...state, reload }
}

function GameCard({ game, progress, level }: { game: GameInfo; progress?: GameProgress; level?: DifficultyLevel }) {
  const navigate = useNavigate()
  const content = (
    <>
      <span style={{ fontSize: '2rem' }} aria-hidden>{game.icon}</span>
      <div style={{ flex: 1 }}>
        <p style={{ fontWeight: 700 }}>{game.name}</p>
        <p className="muted small">{game.available ? game.tagline : `${game.tagline} · Em breve`}</p>
        {progress && progress.totalSessions > 0 && (
          <p className="subtle tiny">
            Última: {formatPoints(progress.lastScore ?? 0)} · Melhor: {formatPoints(progress.bestScore ?? 0)} · {progress.totalSessions} {progress.totalSessions === 1 ? 'partida' : 'partidas'}
          </p>
        )}
        {game.available && level && <p className="subtle tiny">Próxima partida: nível {level} · {DIFFICULTY_LABELS[level]}</p>}
      </div>
      {game.available && <span className="chip" aria-hidden>JOGAR</span>}
    </>
  )
  if (!game.available) return <div className="game-card" aria-disabled>{content}</div>
  return <button type="button" className="game-card" onClick={() => navigate(game.route)} aria-label={`Jogar ${game.name}`}>{content}</button>
}

export function DashboardPage() {
  const { user, signOut } = useAuthStore()
  const { xp, progress, loading, error, reload } = useDashboardData(user?.id)
  const vigia = useRecommendedDifficulty(user?.id, 'vigia')
  const [signOutError, setSignOutError] = useState(false)
  const { level, xpInLevel, percent } = levelFromXp(xp)
  const title = useFocusOnMount<HTMLHeadingElement>()

  const name = user?.user_metadata?.full_name?.split(' ')[0] ?? user?.email?.split('@')[0] ?? 'Jogador'

  const handleSignOut = async () => {
    setSignOutError(false)
    try { await signOut() } catch { setSignOutError(true) }
  }

  return (
    <div style={{ minHeight: '100dvh' }}>
      <header style={{
        borderBottom: '1px solid var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem',
        padding: 'max(0.75rem, env(safe-area-inset-top)) max(1rem, env(safe-area-inset-right)) 0.75rem max(1rem, env(safe-area-inset-left))',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '1.4rem' }} aria-hidden>🧠</span>
          <span style={{ color: 'var(--primary)', fontWeight: 700, fontSize: '1.1rem' }}>NeuroBridge</span>
        </div>
        <Button variant="ghost" onClick={handleSignOut}>Sair</Button>
      </header>

      <main style={{ maxWidth: 960, margin: '0 auto', padding: '1.5rem max(1rem, env(safe-area-inset-right)) 2rem max(1rem, env(safe-area-inset-left))' }} className="stack">
        {signOutError && <Notice tone="error">Não foi possível sair. Verifique sua conexão e tente novamente.</Notice>}
        <div>
          <h1 ref={title} tabIndex={-1} style={{ fontSize: '1.6rem', overflowWrap: 'anywhere' }}>Olá, {name}! <span aria-hidden>👋</span></h1>
          <p className="muted">Pronto para jogar hoje?</p>
        </div>

        {user && <PendingNotice userId={user.id} onSent={reload} />}

        <section className="panel" style={{ background: 'var(--surface)', padding: '1.25rem 1.5rem' }} aria-label="Seu progresso">
          {loading ? (
            <p role="status" className="subtle small">Carregando perfil…</p>
          ) : error ? (
            <Notice tone="warning">
              Não foi possível carregar seu XP.
              <div className="row"><Button variant="secondary" onClick={reload}>Tentar de novo</Button></div>
            </Notice>
          ) : (
            <div className="stack" style={{ gap: '0.5rem' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem' }}>
                <p>
                  <span style={{ color: 'var(--xp)', fontWeight: 800, fontSize: '1.4rem' }}>{xp.toLocaleString('pt-BR')}</span>
                  <span className="muted small"> XP de participação</span>
                </p>
                <span className="chip">Nível {level}</span>
              </div>
              <ProgressBar percent={percent} color="var(--xp)" label={`Progresso para o nível ${level + 1}`} />
              <p className="subtle tiny">{xpInLevel} / {XP_PER_LEVEL} XP para o nível {level + 1}. O XP soma a cada partida concluída; não mede habilidade.</p>
            </div>
          )}
        </section>

        <h2 className="eyebrow" style={{ marginTop: '0.5rem' }}>Jogos</h2>
        <div className="games-grid">
          {GAMES.map(game => (
            <GameCard
              key={game.id}
              game={game}
              progress={loading ? undefined : progress.find(p => p.gameId === game.id)}
              level={game.id === 'vigia' && !vigia.loading ? vigia.difficulty : undefined}
            />
          ))}
        </div>
      </main>
    </div>
  )
}
