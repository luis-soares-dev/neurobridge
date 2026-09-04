// ──────────────────────────────────────────────────────────────────────────────
// NeuroBridge — Tipos do banco de dados (gerados do schema SQL)
//
// Este arquivo mapeia as tabelas do Supabase para TypeScript.
// Na prática profissional, este arquivo é gerado automaticamente pelo comando:
//   npx supabase gen types typescript --project-id SEU_ID > src/lib/database.types.ts
//
// Por enquanto, escrevemos manualmente para entender o que cada coisa faz.
// ──────────────────────────────────────────────────────────────────────────────

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          name: string | null
          avatar_url: string | null
          xp_total: number
          level: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          name?: string | null
          avatar_url?: string | null
          xp_total?: number
          level?: number
        }
        Update: {
          name?: string | null
          avatar_url?: string | null
          xp_total?: number
          level?: number
          updated_at?: string
        }
      }
      sessions: {
        Row: {
          id: string
          user_id: string
          game_id: 'vigia' | 'lente' | 'duo'
          domain: 'atencao' | 'memoria' | 'flexibilidade' | 'velocidade' | 'raciocinio'
          started_at: string
          ended_at: string | null
          k_score: number | null
          difficulty_level: number
          xp_earned: number
          total_trials: number
          correct_trials: number
        }
        Insert: {
          id?: string
          user_id: string
          game_id: 'vigia' | 'lente' | 'duo'
          domain: 'atencao' | 'memoria' | 'flexibilidade' | 'velocidade' | 'raciocinio'
          difficulty_level?: number
        }
        Update: {
          ended_at?: string
          k_score?: number
          difficulty_level?: number
          xp_earned?: number
          total_trials?: number
          correct_trials?: number
        }
      }
      game_events: {
        Row: {
          id: string
          session_id: string
          user_id: string
          event_type: string
          is_correct: boolean
          response_time: number | null
          difficulty: number
          occurred_at: string
        }
        Insert: {
          session_id: string
          user_id: string
          event_type: string
          is_correct: boolean
          response_time?: number | null
          difficulty: number
        }
        Update: never
      }
      progress: {
        Row: {
          id: string
          user_id: string
          game_id: 'vigia' | 'lente' | 'duo'
          domain: string
          last_k_score: number | null
          best_k_score: number | null
          total_sessions: number
          last_played_at: string | null
          k_score_history: number[]
        }
        Insert: {
          user_id: string
          game_id: 'vigia' | 'lente' | 'duo'
          domain: string
        }
        Update: {
          last_k_score?: number
          best_k_score?: number
          total_sessions?: number
          last_played_at?: string
          k_score_history?: number[]
        }
      }
      streaks: {
        Row: {
          id: string
          user_id: string
          current_streak: number
          longest_streak: number
          last_active_at: string | null
          shields: number
        }
        Insert: { user_id: string }
        Update: {
          current_streak?: number
          longest_streak?: number
          last_active_at?: string
          shields?: number
        }
      }
    }
  }
}
