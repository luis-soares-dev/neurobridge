// Cliente Supabase único da aplicação.
// Use apenas a chave pública (anon). Nunca coloque a service_role no frontend.
import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** Mensagem exibida no lugar do app quando o ambiente não está configurado. */
export const supabaseConfigError: string | null = supabaseUrl && supabaseAnonKey
  ? null
  : 'Variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY não encontradas. Copie .env.example para .env.local e preencha os valores.'

// Sem configuração, o cliente aponta para um endereço inválido e o App mostra o aviso.
export const supabase = createClient<Database>(
  supabaseUrl || 'http://localhost.invalid',
  supabaseAnonKey || 'missing-anon-key',
  { auth: { persistSession: true, autoRefreshToken: true } },
)
