// ──────────────────────────────────────────────────────────────────────────────
// NeuroBridge — Cliente Supabase
//
// ANALOGIA SIMPLES:
// O Supabase é como uma "central de serviços" hospedada na nuvem.
// Ele cuida de tudo que precisamos de backend:
//   - Banco de dados (PostgreSQL)
//   - Autenticação (Google, Apple)
//   - Storage (para futuras imagens/áudios)
//   - Edge Functions (lógica de servidor quando necessário)
//
// Este arquivo cria a "conexão" com essa central.
// Todos os outros arquivos importam daqui para falar com o banco.
// ──────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

// As variáveis VITE_* são lidas do arquivo .env.local
// Nunca exponha a SERVICE_ROLE key — a ANON key é pública por design
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    '❌ Variáveis de ambiente do Supabase não encontradas.\n' +
    'Copie .env.example para .env.local e preencha os valores.'
  )
}

// Cria o cliente com tipagem do banco (Database)
// Isso significa que o TypeScript vai autocompletar os nomes
// das tabelas e colunas enquanto você escreve — sem erros de digitação
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Salva a sessão no localStorage — usuário não precisa logar
    // toda vez que abre o app
    persistSession: true,
    autoRefreshToken: true,
  },
})

// ── HELPERS DE AUTENTICAÇÃO ───────────────────────────────────────────────────

/** Login com Google (abre popup) */
export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  })
  if (error) throw error
}

/** Login com Apple (abre popup) */
export async function signInWithApple() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'apple',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  })
  if (error) throw error
}

/** Logout */
export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

/** Retorna o usuário logado ou null */
export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}
