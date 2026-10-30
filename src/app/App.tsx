// Roteamento central da aplicação.
import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
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

export default function App() {
  const initialize = useAuthStore(s => s.initialize)

  useEffect(() => {
    if (supabaseConfigError) return
    return initialize()
  }, [initialize])

  if (supabaseConfigError) return <ConfigErrorScreen message={supabaseConfigError} />

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<AuthGuard><DashboardPage /></AuthGuard>} />
        <Route path="/jogar/vigia" element={<AuthGuard><VigiaGame /></AuthGuard>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
