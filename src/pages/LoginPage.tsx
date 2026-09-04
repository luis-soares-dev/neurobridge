// LoginPage.tsx
// Página de login do NeuroBridge.
// Por enquanto tem apenas o botão "Entrar com Google".

import { useState } from 'react'
import { useAuthStore } from '../store/authStore'

export function LoginPage() {
  const { signInWithGoogle } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleGoogleLogin = async () => {
    setLoading(true)
    setError(null)
    try {
      await signInWithGoogle()
      // signInWithGoogle redireciona para o Google — o código abaixo não executa
    } catch {
      setError('Não foi possível iniciar o login. Tente novamente.')
      setLoading(false)
    }
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: '#0f0f1a',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      padding: '1rem',
    }}>
      {/* Card central */}
      <div style={{
        background: '#1a1a2e',
        border: '1px solid #2a2a4a',
        borderRadius: '1rem',
        padding: '2.5rem 2rem',
        width: '100%',
        maxWidth: '400px',
        textAlign: 'center',
      }}>
        {/* Logo */}
        <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🧠</div>
        <h1 style={{
          color: '#6c8ef5',
          fontSize: '1.8rem',
          fontWeight: 700,
          marginBottom: '0.25rem',
        }}>
          NeuroBridge
        </h1>
        <p style={{
          color: '#7070a0',
          fontSize: '0.95rem',
          marginBottom: '2rem',
        }}>
          Treino cognitivo para mentes neurodivergentes
        </p>

        {/* Botão Google */}
        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.75rem',
            width: '100%',
            padding: '0.75rem 1.5rem',
            background: loading ? '#2a2a4a' : '#ffffff',
            color: loading ? '#7070a0' : '#1a1a2e',
            border: 'none',
            borderRadius: '0.5rem',
            fontSize: '1rem',
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'opacity 0.2s',
          }}
        >
          {/* Ícone Google (SVG inline) */}
          {!loading && (
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
          )}
          {loading ? 'Redirecionando...' : 'Entrar com Google'}
        </button>

        {/* Mensagem de erro */}
        {error && (
          <p style={{
            color: '#ef4444',
            fontSize: '0.875rem',
            marginTop: '1rem',
          }}>
            {error}
          </p>
        )}

        {/* Rodapé */}
        <p style={{
          color: '#4a4a6a',
          fontSize: '0.75rem',
          marginTop: '2rem',
          lineHeight: '1.5',
        }}>
          Ao entrar, você concorda com nossos termos de uso.<br />
          Seus dados são protegidos e nunca compartilhados.
        </p>
      </div>
    </div>
  )
}
