// AuthGuard.tsx
// Componente "guarda de rota" — protege páginas que exigem login.
// Se o usuário não estiver autenticado, redireciona automaticamente para /login.

import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

interface AuthGuardProps {
  children: React.ReactNode  // O conteúdo protegido que será renderizado se estiver logado
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { user, loading } = useAuthStore()
  const navigate = useNavigate()

  useEffect(() => {
    // Só redireciona depois que terminou de verificar a sessão
    if (!loading && !user) {
      navigate('/login', { replace: true })
    }
  }, [user, loading, navigate])

  // Enquanto verifica a sessão, mostra tela de carregamento
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: '#0f0f1a',
        color: '#6c8ef5',
        fontSize: '1.1rem',
        fontFamily: 'system-ui, sans-serif',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>🧠</div>
          <div>Carregando...</div>
        </div>
      </div>
    )
  }

  // Se não tem usuário, não renderiza nada (o useEffect já redireciona)
  if (!user) return null

  // Usuário autenticado: renderiza o conteúdo protegido
  return <>{children}</>
}
