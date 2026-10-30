// Partidas concluídas que ainda não foram confirmadas pelo servidor, guardadas neste
// aparelho por conta. Servem para recuperar o envio depois de recarregar, fechar a aba
// ou perder a conexão. Não são proteção contra adulteração: o servidor revalida tudo.
import type { GameId } from './types'

export const PENDING_TTL_MS = 7 * 24 * 60 * 60 * 1000
const MAX_PENDING = 10

export interface PendingResult<P = unknown> {
  gameId: GameId
  sessionId: string
  createdAt: number
  /** Resumo para exibir ao jogador (estimativa local, não oficial). */
  summary: { difficulty: number; score: number }
  payload: P
}

const key = (userId: string) => `neurobridge:${userId}:pending`

function read(userId: string): PendingResult[] {
  try {
    const raw = JSON.parse(localStorage.getItem(key(userId)) ?? '[]')
    return Array.isArray(raw) ? raw.filter(x => x && typeof x.sessionId === 'string' && typeof x.createdAt === 'number') : []
  } catch {
    return []
  }
}

function write(userId: string, items: PendingResult[]): boolean {
  try {
    if (items.length) localStorage.setItem(key(userId), JSON.stringify(items))
    else localStorage.removeItem(key(userId))
    return true
  } catch {
    return false // armazenamento bloqueado ou cheio: o jogo segue, sem recuperação local
  }
}

/** Lista as pendências válidas da conta, descartando as vencidas. */
export function listPending(userId: string, now = Date.now()): PendingResult[] {
  const all = read(userId)
  const valid = all.filter(x => now - x.createdAt < PENDING_TTL_MS)
  if (valid.length !== all.length) write(userId, valid)
  return valid.sort((a, b) => a.createdAt - b.createdAt)
}

/** Guarda (ou mantém) a pendência. Retorna false se o aparelho não permitir guardar. */
export function savePending(userId: string, item: PendingResult, now = Date.now()): boolean {
  const others = listPending(userId, now).filter(x => x.sessionId !== item.sessionId)
  return write(userId, [...others, item].slice(-MAX_PENDING))
}

export function removePending(userId: string, sessionId: string): void {
  write(userId, read(userId).filter(x => x.sessionId !== sessionId))
}
