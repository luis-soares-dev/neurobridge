// App.tsx
// Roteamento central da aplicação.
// Cada Route define: URL → qual componente renderizar.

import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import { AuthGuard } from './components/AuthGuard'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { VigiGame } from './games/vigia/VigiGame'

export default function App() {
  const { initialize } = useAuthStore()

  useEffect(() => {
    const cleanup = initialize()
    return cleanup
  }, [initialize])

  return (
    <BrowserRouter>
      <Routes>
        {/* Rota pública */}
        <Route path="/login" element={<LoginPage />} />

        {/* Rotas protegidas (exigem login) */}
        <Route path="/" element={<AuthGuard><DashboardPage /></AuthGuard>} />
        <Route path="/jogar/vigia" element={<AuthGuard><VigiGame /></AuthGuard>} />

        {/* Qualquer rota desconhecida → home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
