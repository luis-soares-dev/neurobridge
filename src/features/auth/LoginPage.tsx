// Página de login (Google).
import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Button, Card, Notice, Screen } from '../../ui/components'
import { useAuthStore } from './authStore'

/** Erro devolvido pelo provedor OAuth na URL (ex.: login cancelado). */
function oauthErrorFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search + '&' + window.location.hash.replace(/^#/, ''))
  return params.get('error_description') ? 'O login não foi concluído. Tente novamente.' : null
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  )
}

export function LoginPage() {
  const { user, loading: checkingSession, signInWithGoogle } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(oauthErrorFromUrl)

  if (!checkingSession && user) return <Navigate to="/" replace />

  const handleGoogleLogin = async () => {
    setLoading(true)
    setError(null)
    try {
      await signInWithGoogle() // redireciona para o Google
    } catch {
      setError('Não foi possível iniciar o login. Tente novamente.')
      setLoading(false)
    }
  }

  return (
    <Screen>
      <Card>
        <div className="stack">
          <div style={{ fontSize: '3rem' }} aria-hidden>🧠</div>
          <h1 style={{ color: 'var(--primary)', fontSize: '1.8rem' }}>NeuroBridge</h1>
          <p className="muted" style={{ marginBottom: '1rem' }}>Jogos rápidos de atenção e memória, no seu ritmo.</p>
          <Button
            onClick={handleGoogleLogin}
            disabled={loading}
            style={{ background: loading ? 'var(--border)' : '#fff', color: loading ? 'var(--muted)' : '#1a1a2e' }}
          >
            {!loading && <GoogleIcon />}
            {loading ? 'Redirecionando…' : 'Entrar com Google'}
          </Button>
          {error && <Notice tone="error">{error}</Notice>}
          <p className="subtle tiny" style={{ marginTop: '1rem' }}>
            Ao entrar, você concorda com os termos de uso.<br />
            Os jogos são entretenimento e treino; não substituem avaliação profissional.
          </p>
        </div>
      </Card>
    </Screen>
  )
}
