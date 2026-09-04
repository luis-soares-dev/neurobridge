// DashboardPage.tsx — Dashboard principal após login.

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { supabase } from '../lib/supabase'

const VIGIA_DIFFICULTY_KEY = 'vigia_difficulty'

function getSavedDifficulty(): number {
  try { return parseInt(localStorage.getItem(VIGIA_DIFFICULTY_KEY) ?? '3', 10) }
  catch { return 3 }
}

const DIFFICULTY_LABELS: Record<number, string> = {
  1: 'Iniciante', 2: 'Iniciante', 3: 'Básico',
  4: 'Básico+',   5: 'Intermédio', 6: 'Intermédio+',
  7: 'Avançado',  8: 'Avançado+',  9: 'Expert', 10: 'Master',
}

export function DashboardPage() {
  const { user, signOut } = useAuthStore()
  const navigate = useNavigate()

  const [xpTotal, setXpTotal]  = useState<number>(0)
  const [level, setLevel]      = useState<number>(1)
  const [loading, setLoading]  = useState(true)
  const vigiaDifficulty        = getSavedDifficulty()

  const name = user?.user_metadata?.full_name?.split(' ')[0]
    ?? user?.email?.split('@')[0]
    ?? 'Jogador'

  // Carrega perfil do Supabase com async/await
  useEffect(() => {
    if (!user) return
    async function load() {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('xp_total, level')
          .eq('id', user!.id)
          .single()
        if (data) {
          setXpTotal(data.xp_total ?? 0)
          setLevel(data.level ?? 1)
        }
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user])

  // Barra de XP dentro do nível atual (cada 500 XP = 1 nível)
  const xpForLevel  = (level - 1) * 500
  const xpInLevel   = xpTotal - xpForLevel
  const progressPct = Math.min(Math.round((xpInLevel / 500) * 100), 100)

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0f0f1a',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      color: '#ffffff',
    }}>
      {/* Header */}
      <header style={{
        borderBottom: '1px solid #1a1a2e',
        padding: '1rem 1.5rem',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '1.4rem' }}>🧠</span>
          <span style={{ color: '#6c8ef5', fontWeight: 700, fontSize: '1.1rem' }}>NeuroBridge</span>
        </div>
        <button onClick={signOut} style={{
          background: 'transparent', color: '#7070a0',
          border: '1px solid #2a2a4a', borderRadius: '0.4rem',
          padding: '0.4rem 0.9rem', cursor: 'pointer', fontSize: '0.85rem',
        }}>
          Sair
        </button>
      </header>

      <main style={{ maxWidth: 680, margin: '0 auto', padding: '2rem 1.5rem' }}>
        {/* Saudação */}
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: '0.25rem' }}>
            Olá, {name}! 👋
          </h1>
          <p style={{ color: '#7070a0', fontSize: '0.95rem', marginBottom: '1.25rem' }}>
            Pronto para treinar hoje?
          </p>

          {/* Card de XP */}
          <div style={{
            background: '#1a1a2e', border: '1px solid #2a2a4a',
            borderRadius: '0.75rem', padding: '1.25rem 1.5rem',
          }}>
            {loading ? (
              <p style={{ color: '#4a4a6a', fontSize: '0.85rem' }}>A carregar perfil…</p>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.6rem' }}>
                  <div>
                    <span style={{ color: '#fbbf24', fontWeight: 800, fontSize: '1.4rem' }}>
                      {xpTotal.toLocaleString()}
                    </span>
                    <span style={{ color: '#7070a0', fontSize: '0.8rem', marginLeft: '0.3rem' }}>XP total</span>
                  </div>
                  <div style={{
                    background: '#6c8ef522', color: '#6c8ef5',
                    borderRadius: 9999, padding: '0.2rem 0.65rem',
                    fontSize: '0.8rem', fontWeight: 700,
                  }}>
                    Nível {level}
                  </div>
                </div>
                <div style={{ background: '#0f0f1a', borderRadius: 9999, height: 6, marginBottom: '0.35rem' }}>
                  <div style={{
                    background: '#fbbf24', borderRadius: 9999,
                    height: '100%', width: `${progressPct}%`,
                    transition: 'width 0.6s ease',
                  }} />
                </div>
                <p style={{ color: '#5a5a8a', fontSize: '0.72rem' }}>
                  {xpInLevel} / 500 XP para o nível {level + 1}
                </p>
              </>
            )}
          </div>
        </div>

        {/* Jogos */}
        <h2 style={{ color: '#a0a0c0', fontSize: '0.78rem', letterSpacing: '0.1em', marginBottom: '1rem' }}>
          JOGOS
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {/* Vigia */}
          <button
            onClick={() => navigate('/jogar/vigia')}
            style={{
              background: '#1a1a2e', border: '1px solid #2a2a4a',
              borderRadius: '0.75rem', padding: '1.25rem 1.5rem',
              cursor: 'pointer', textAlign: 'left', width: '100%',
              display: 'flex', alignItems: 'center', gap: '1rem',
              transition: 'border-color 0.2s',
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = '#6c8ef5')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = '#2a2a4a')}
          >
            <span style={{ fontSize: '2rem' }}>🎯</span>
            <div style={{ flex: 1 }}>
              <p style={{ fontWeight: 700, color: '#ffffff', marginBottom: '0.2rem' }}>Vigia</p>
              <p style={{ color: '#7070a0', fontSize: '0.85rem' }}>
                Atenção sustentada · {vigiaDifficulty >= 4 ? 'Cores avançadas' : '~1 minuto'}
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{
                background: '#6c8ef522', color: '#6c8ef5',
                borderRadius: 9999, padding: '0.25rem 0.75rem',
                fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem',
              }}>
                JOGAR
              </div>
              <div style={{ color: '#5a5a8a', fontSize: '0.7rem' }}>
                Nível {vigiaDifficulty} · {DIFFICULTY_LABELS[vigiaDifficulty] ?? 'Básico'}
              </div>
            </div>
          </button>

          {/* Lente — em breve */}
          <div style={{
            background: '#13131f', border: '1px solid #1a1a2e',
            borderRadius: '0.75rem', padding: '1.25rem 1.5rem',
            display: 'flex', alignItems: 'center', gap: '1rem', opacity: 0.5,
          }}>
            <span style={{ fontSize: '2rem' }}>🔍</span>
            <div>
              <p style={{ fontWeight: 700, color: '#ffffff', marginBottom: '0.2rem' }}>Lente</p>
              <p style={{ color: '#7070a0', fontSize: '0.85rem' }}>Memória de trabalho · Em breve</p>
            </div>
          </div>

          {/* Duo — em breve */}
          <div style={{
            background: '#13131f', border: '1px solid #1a1a2e',
            borderRadius: '0.75rem', padding: '1.25rem 1.5rem',
            display: 'flex', alignItems: 'center', gap: '1rem', opacity: 0.5,
          }}>
            <span style={{ fontSize: '2rem' }}>🔀</span>
            <div>
              <p style={{ fontWeight: 700, color: '#ffffff', marginBottom: '0.2rem' }}>Duo</p>
              <p style={{ color: '#7070a0', fontSize: '0.85rem' }}>Flexibilidade cognitiva · Em breve</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
