// Estado de autenticação da aplicação (Zustand).
import { create } from 'zustand'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../../services/supabase'

interface AuthState {
  user: User | null
  /** true enquanto a sessão salva no navegador ainda está sendo verificada. */
  loading: boolean
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
  /** Inicia o listener de autenticação; chamar uma vez no App. Retorna a limpeza. */
  initialize: () => () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,

  signInWithGoogle: async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/` },
    })
    if (error) throw error
  },

  signOut: async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    set({ user: null })
  },

  initialize: () => {
    // Se um evento de login/logout chegar antes da leitura inicial, ele é mais recente:
    // a resposta atrasada de getSession() não pode sobrescrevê-lo.
    let eventSeen = false
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      eventSeen = true
      set({ user: session?.user ?? null, loading: false })
    })
    supabase.auth.getSession()
      .then(({ data: { session } }) => { if (!eventSeen) set({ user: session?.user ?? null, loading: false }) })
      .catch(() => { if (!eventSeen) set({ user: null, loading: false }) })
    return () => subscription.unsubscribe()
  },
}))
