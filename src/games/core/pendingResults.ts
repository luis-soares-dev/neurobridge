// Partidas concluídas que ainda não foram confirmadas pelo servidor, guardadas neste
// aparelho por conta. Servem para recuperar o envio depois de recarregar, fechar a aba
// ou perder a conexão. Não são proteção contra adulteração: o servidor revalida tudo.
//
// Garantias:
//  - nenhuma pendência válida e dentro da validade é apagada por falta de espaço;
//    com a fila cheia, a nova partida simplesmente não é guardada (e o app avisa);
//  - registros ilegíveis ou de formato desconhecido são isolados: não aparecem na lista,
//    não travam a tela e só são apagados quando a pessoa pede.
import type { GameId } from './types'

export const PENDING_VERSION = 1
export const PENDING_TTL_MS = 7 * 24 * 60 * 60 * 1000
export const MAX_PENDING = 10
const GAME_IDS: readonly GameId[] = ['vigia', 'lente', 'duo']

export interface PendingResult<P = unknown> {
  v: typeof PENDING_VERSION
  gameId: GameId
  sessionId: string
  createdAt: number
  /** Resumo para exibir ao jogador (estimativa local, não oficial). */
  summary: { difficulty: number; score: number }
  payload: P
}

/** Resultado de tentar guardar: guardada, fila cheia ou aparelho sem armazenamento. */
export type StoreOutcome = 'stored' | 'full' | 'unavailable'

const key = (userId: string) => `neurobridge:${userId}:pending`

const isObject = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)

/** Confere o formato completo de um registro guardado. */
export function isValidPending(x: unknown): x is PendingResult {
  if (!isObject(x)) return false
  // Registros sem "v" vêm da primeira versão deste formato, que é igual à 1.
  if (x.v !== undefined && x.v !== PENDING_VERSION) return false
  if (!GAME_IDS.includes(x.gameId as GameId)) return false
  if (typeof x.sessionId !== 'string' || x.sessionId.length === 0 || x.sessionId.length > 100) return false
  if (typeof x.createdAt !== 'number' || !Number.isFinite(x.createdAt) || x.createdAt <= 0 || Number.isNaN(new Date(x.createdAt).getTime())) return false
  const s = x.summary
  if (!isObject(s) || !Number.isInteger(s.difficulty) || (s.difficulty as number) < 1 || (s.difficulty as number) > 10) return false
  if (typeof s.score !== 'number' || !(s.score >= 0 && s.score <= 1)) return false
  return isObject(x.payload) && x.payload.sessionId === x.sessionId
}

/** Lê o conteúdo bruto. Conteúdo que não é uma lista conta como um registro ilegível. */
function readRaw(userId: string): { items: unknown[]; unreadable: boolean } {
  try {
    const text = localStorage.getItem(key(userId))
    if (text === null) return { items: [], unreadable: false }
    const parsed: unknown = JSON.parse(text)
    return Array.isArray(parsed) ? { items: parsed, unreadable: false } : { items: [], unreadable: true }
  } catch {
    return { items: [], unreadable: true }
  }
}

function writeRaw(userId: string, items: unknown[]): boolean {
  try {
    if (items.length) localStorage.setItem(key(userId), JSON.stringify(items))
    else localStorage.removeItem(key(userId))
    return true
  } catch {
    return false // armazenamento bloqueado ou cheio
  }
}

const expired = (x: PendingResult, now: number) => now - x.createdAt >= PENDING_TTL_MS

/** Pendências válidas e dentro da validade, da mais antiga para a mais nova. */
export function listPending(userId: string, now = Date.now()): PendingResult[] {
  return readRaw(userId).items
    .filter(isValidPending)
    .filter(x => !expired(x, now))
    .sort((a, b) => a.createdAt - b.createdAt)
}

/** Quantos registros guardados não puderam ser lidos (isolados, não exibidos). */
export function countInvalidPending(userId: string): number {
  const { items, unreadable } = readRaw(userId)
  return items.filter(x => !isValidPending(x)).length + (unreadable ? 1 : 0)
}

/** Data a partir da qual a pendência deixa de ser oferecida para envio. */
export const pendingExpiresAt = (x: PendingResult) => x.createdAt + PENDING_TTL_MS

/**
 * Guarda (ou atualiza) a pendência. Com a fila cheia, não descarta nenhuma outra:
 * devolve 'full' e a nova partida fica só na tela até ser enviada.
 */
export function savePending(userId: string, item: PendingResult, now = Date.now()): StoreOutcome {
  const { items, unreadable } = readRaw(userId)
  if (unreadable) return 'unavailable' // não sobrescreve conteúdo que não conseguimos ler
  // Vencidas saem (já não são oferecidas); inválidas ficam isoladas até a pessoa limpar.
  const kept = items.filter(x => !(isValidPending(x) && expired(x, now)))
  const index = kept.findIndex(x => isValidPending(x) && x.sessionId === item.sessionId)
  if (index >= 0) {
    kept[index] = item
  } else {
    if (kept.filter(isValidPending).length >= MAX_PENDING) return 'full'
    kept.push(item)
  }
  return writeRaw(userId, kept) ? 'stored' : 'unavailable'
}

export function removePending(userId: string, sessionId: string): void {
  const { items, unreadable } = readRaw(userId)
  if (unreadable) return
  writeRaw(userId, items.filter(x => !(isValidPending(x) && x.sessionId === sessionId)))
}

/** Apaga só os registros ilegíveis, a pedido da pessoa. As pendências válidas continuam. */
export function clearInvalidPending(userId: string): void {
  const { items } = readRaw(userId)
  writeRaw(userId, items.filter(isValidPending))
}
