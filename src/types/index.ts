// ──────────────────────────────────────────────────────────────────────────────
// NeuroBridge — Tipos globais do sistema
//
// "Tipo" em TypeScript é como uma planta baixa de um prédio:
// define o formato exato de cada dado que o sistema usa.
// Se você tentar usar um dado no formato errado, o TypeScript avisa
// ANTES de rodar — isso evita bugs em produção.
// ──────────────────────────────────────────────────────────────────────────────

// ── USUÁRIO ──────────────────────────────────────────────────────────────────

/** Perfil do usuário logado */
export interface User {
  id: string
  email: string
  name: string | null
  avatarUrl: string | null
  xpTotal: number      // XP acumulado de todas as sessões
  level: number        // Nível atual (1-50)
  createdAt: string
}

// ── JOGOS ────────────────────────────────────────────────────────────────────

/** Identificadores dos jogos disponíveis no MVP */
export type GameId = 'vigia' | 'lente' | 'duo'

/** Domínios cognitivos que os jogos treinam */
export type CognitiveDomain = 'atencao' | 'memoria' | 'flexibilidade' | 'velocidade' | 'raciocinio'

/** Dificuldade: 1 (mais fácil) a 10 (mais difícil) */
export type DifficultyLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10

// ── TRIAL (tentativa) ────────────────────────────────────────────────────────

/**
 * Uma "trial" é uma única tentativa dentro de um jogo.
 * No Vigia: apareceu um estímulo → usuário reagiu (ou não) → isso é uma trial.
 */
export interface Trial {
  isCorrect: boolean       // Acertou ou errou?
  responseTime: number     // Tempo de reação em milissegundos
  difficulty: DifficultyLevel
  timestamp: number        // Quando aconteceu (Date.now())
}

// ── K-SCORE ──────────────────────────────────────────────────────────────────

/**
 * Resultado do cálculo do K-Score para uma janela de trials.
 *
 * K = acurácia × (1 / RT_norm) × consistência
 *
 * - acurácia: % de acertos (0 a 1)
 * - RT_norm: tempo de resposta normalizado pelo tempo de referência
 * - consistência: estabilidade dos tempos de resposta (1 - desvio/média)
 *
 * Faixas:
 *   0.75+  = Excelente
 *   0.50+  = Bom
 *   0.30+  = Em desenvolvimento
 *   <0.30  = Continue praticando
 */
export interface KScoreResult {
  kScore: number           // 0 a 1 (nunca passa de 1)
  accuracy: number         // % de acertos (0 a 1)
  avgResponseTime: number  // Tempo médio de resposta em ms
  consistency: number      // Estabilidade (0 a 1)
  nextDifficulty: DifficultyLevel  // Dificuldade recomendada para próxima sessão
}

// ── SESSÃO DE JOGO ───────────────────────────────────────────────────────────

/** Uma sessão completa de jogo (do início ao fim) */
export interface GameSession {
  id: string
  userId: string
  gameId: GameId
  domain: CognitiveDomain
  startedAt: string
  endedAt: string | null
  kScore: number
  difficultyLevel: DifficultyLevel
  xpEarned: number
  totalTrials: number
  correctTrials: number
}

// ── PROGRESSO ────────────────────────────────────────────────────────────────

/** Progresso agregado por jogo (histórico de K-scores) */
export interface GameProgress {
  gameId: GameId
  domain: CognitiveDomain
  lastKScore: number
  bestKScore: number
  totalSessions: number
  lastPlayedAt: string
  kScoreHistory: number[]  // Últimos 30 valores para o gráfico
}

// ── FREEMIUM ─────────────────────────────────────────────────────────────────

export type SubscriptionTier = 'free' | 'pro'

export interface Subscription {
  tier: SubscriptionTier
  validUntil: string | null
}
