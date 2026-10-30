// Roteamento central da aplicação. Usa o roteador "de dados" do React Router,
// necessário para bloquear a navegação interna no meio de uma partida (useBlocker).
import { useEffect } from 'react'
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'
import { AuthGuard } from '../features/auth/AuthGuard'
import { LoginPage } from '../features/auth/LoginPage'
import { useAuthStore } from '../features/auth/authStore'
import { DashboardPage } from '../features/dashboard/DashboardPage'
import { VigiaGame } from '../games/vigia/VigiaGame'
import { supabaseConfigError } from '../services/supabase'
import { Card, Notice, Screen } from '../ui/components'

function ConfigErrorScreen({ message }: { message: string }) {
  return (
    <Screen>
      <Card>
        <div className="stack">
          <h1 style={{ fontSize: '1.4rem' }}>Configuração incompleta</h1>
          <Notice tone="error">{message}</Notice>
        </div>
      </Card>
    </Screen>
  )
}

const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/', element: <AuthGuard><DashboardPage /></AuthGuard> },
  { path: '/jogar/vigia', element: <AuthGuard><VigiaGame /></AuthGuard> },
  { path: '*', element: <Navigate to="/" replace /> },
])

export default function App() {
  const initialize = useAuthStore(s => s.initialize)

  useEffect(() => {
    if (supabaseConfigError) return
    return initialize()
  }, [initialize])

  if (supabaseConfigError) return <ConfigErrorScreen message={supabaseConfigError} />
  return <RouterProvider router={router} />
}
