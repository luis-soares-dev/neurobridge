// Protege páginas que exigem login: sem sessão, redireciona para /login.
import { Fragment, type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { LoadingScreen } from '../../ui/components'
import { useAuthStore } from './authStore'

export function AuthGuard({ children }: { children: ReactNode }) {
  const { user, loading } = useAuthStore()
  if (loading) return <LoadingScreen />
  if (!user) return <Navigate to="/login" replace />
  // A chave por conta desmonta a página inteira ao trocar de conta: nenhum estado de
  // tela (partida, XP, progresso) de uma conta aparece para outra.
  return <Fragment key={user.id}>{children}</Fragment>
}
