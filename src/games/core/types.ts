// Tipos compartilhados por todos os jogos da plataforma.

/** Identificadores dos jogos (mesmos valores do CHECK em sessions.game_id). */
export type GameId = 'vigia' | 'lente' | 'duo'

/** Habilidade que cada jogo exercita (mesmos valores de sessions.domain). */
export type CognitiveDomain = 'atencao' | 'memoria' | 'flexibilidade' | 'velocidade' | 'raciocinio'

/** Dificuldade: 1 (mais fácil) a 10 (mais difícil). */
export type DifficultyLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10

/**
 * Pontuação de uma partida. É uma medida de desempenho no jogo,
 * não uma avaliação clínica.
 */
export interface ScoreResult {
  /** 0 a 1, com 3 casas decimais (igual à coluna sessions.k_score). */
  score: number
  /** Componente de precisão (0 a 1). */
  precision: number
  /** Componente de velocidade (0 a 1). */
  speed: number
  /** Dificuldade sugerida para a próxima partida. */
  nextDifficulty: DifficultyLevel
}

/** Ficha de um jogo no catálogo da plataforma. */
export interface GameInfo {
  id: GameId
  name: string
  domain: CognitiveDomain
  tagline: string
  icon: string
  route: string
  available: boolean
}

/** Progresso agregado de um jogo (tabela progress). */
export interface GameProgress {
  gameId: GameId
  lastScore: number | null
  bestScore: number | null
  totalSessions: number
  lastPlayedAt: string | null
  scoreHistory: number[]
}
