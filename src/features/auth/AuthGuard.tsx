// Protege páginas que exigem login: sem sessão, redireciona para /login.
import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { LoadingScreen } from '../../ui/components'
import { useAuthStore } from './authStore'

export function AuthGuard({ children }: { children: ReactNode }) {
  const { user, loading } = useAuthStore()
  if (loading) return <LoadingScreen />
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}
