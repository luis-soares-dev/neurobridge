// authStore.ts
// Gerencia o estado de autenticação de toda a aplicação.
// Zustand é uma biblioteca de gerenciamento de estado simples e leve para React.

import { create } from 'zustand'
import { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

// Define a "forma" do nosso estado de autenticação
interface AuthState {
  user: User | null      // O usuário logado (ou null se não logado)
  loading: boolean       // true enquanto verificamos se há sessão ativa

  signInWithGoogle: () => Promise<void>   // Inicia o login com Google
  signOut: () => Promise<void>            // Faz logout
  initialize: () => () => void            // Inicia o listener de auth (retorna função de limpeza)
}

export const useAuthStore = create<AuthState>((set) => ({
  // Estado inicial: sem usuário, ainda carregando
  user: null,
  loading: true,

  // Redireciona o usuário para a tela de login do Google
  signInWithGoogle: async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        // Após login, Google redireciona de volta para nossa home
        redirectTo: `${window.location.origin}/`,
      },
    })
    if (error) throw error
  },

  // Encerra a sessão do usuário
  signOut: async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    set({ user: null })
  },

  // Inicializa o listener de autenticação — deve ser chamado UMA vez no App.tsx
  initialize: () => {
    // 1. Verifica se já existe uma sessão salva no navegador
    supabase.auth.getSession().then(({ data: { session } }) => {
      set({ user: session?.user ?? null, loading: false })
    })

    // 2. Escuta mudanças de auth em tempo real (login, logout, expiração de token)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        set({ user: session?.user ?? null, loading: false })
      }
    )

    // Retorna função de limpeza para desregistrar o listener quando o App desmonta
    return () => subscription.unsubscribe()
  },
}))
