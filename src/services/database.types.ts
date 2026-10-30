// Tipos do banco (espelham supabase/migrations).
// Quando houver acesso ao projeto, gere automaticamente com:
//   npx supabase gen types typescript --project-id SEU_ID > src/services/database.types.ts

type GameIdColumn = 'vigia' | 'lente' | 'duo'
type DomainColumn = 'atencao' | 'memoria' | 'flexibilidade' | 'velocidade' | 'raciocinio'
type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Views: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
    Functions: {
      save_vigia_session: {
        Args: { p_session_id: string; p_duration_ms: number; p_difficulty: number; p_trials: Json }
        Returns: Json
      }
    }
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
        Insert: { id: string; name?: string | null; avatar_url?: string | null }
        Update: { name?: string | null; avatar_url?: string | null }
        Relationships: []
      }
      sessions: {
        Row: {
          id: string
          user_id: string
          game_id: GameIdColumn
          domain: DomainColumn
          started_at: string
          ended_at: string | null
          k_score: number | null
          difficulty_level: number
          xp_earned: number
          total_trials: number
          correct_trials: number
        }
        Insert: never
        Update: never
        Relationships: []
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
        Insert: never
        Update: never
        Relationships: []
      }
      progress: {
        Row: {
          id: string
          user_id: string
          game_id: GameIdColumn
          domain: string
          last_k_score: number | null
          best_k_score: number | null
          total_sessions: number
          last_played_at: string | null
          k_score_history: number[] | null
        }
        Insert: never
        Update: never
        Relationships: []
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
        Insert: never
        Update: never
        Relationships: []
      }
    }
  }
}
