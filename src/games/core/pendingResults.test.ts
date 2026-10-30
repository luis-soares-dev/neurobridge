import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearInvalidPending, countInvalidPending, listPending, MAX_PENDING, PENDING_TTL_MS, pendingExpiresAt,
  removePending, savePending, type PendingResult,
} from './pendingResults'

const values = new Map<string, string>()
let blocked = false
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  getItem: (k: string) => values.get(k) ?? null,
  setItem: (k: string, v: string) => { if (blocked) throw new Error('cheio'); values.set(k, v) },
  removeItem: (k: string) => values.delete(k),
} })
beforeEach(() => { values.clear(); blocked = false })

const item = (sessionId: string, createdAt: number, score = 0.5): PendingResult => ({
  v: 1, gameId: 'vigia', sessionId, createdAt, summary: { difficulty: 3, score }, payload: { sessionId },
})
const KEY = 'neurobridge:ana:pending'

describe('partidas pendentes neste aparelho', () => {
  it('separa por conta e não duplica o mesmo ID', () => {
    savePending('ana', item('a1', 1000), 1000)
    savePending('ana', item('a1', 1000), 1000)
    savePending('bruno', item('b1', 1000), 1000)
    expect(listPending('ana', 2000).map(x => x.sessionId)).toEqual(['a1'])
    expect(listPending('bruno', 2000).map(x => x.sessionId)).toEqual(['b1'])
  })

  it('descarta pendências vencidas, informa a validade e remove após confirmação', () => {
    savePending('ana', item('velha', 1), 1)
    savePending('ana', item('nova', PENDING_TTL_MS), PENDING_TTL_MS)
    expect(listPending('ana', PENDING_TTL_MS + 1).map(x => x.sessionId)).toEqual(['nova'])
    expect(pendingExpiresAt(listPending('ana', PENDING_TTL_MS + 1)[0])).toBe(2 * PENDING_TTL_MS)
    removePending('ana', 'nova')
    expect(listPending('ana')).toEqual([])
  })

  it('informa quando o aparelho não permite guardar, sem quebrar', () => {
    blocked = true
    expect(savePending('ana', item('x', 1), 1)).toBe('unavailable')
    expect(listPending('ana')).toEqual([])
  })
})

describe('fila cheia', () => {
  it('a 11ª partida não é guardada e nenhuma das 10 anteriores desaparece', () => {
    for (let i = 0; i < MAX_PENDING; i++) expect(savePending('ana', item(`p${i}`, 1000 + i), 2000)).toBe('stored')
    expect(savePending('ana', item('p10', 1010), 2000)).toBe('full')
    expect(listPending('ana', 2000).map(x => x.sessionId)).toEqual(Array.from({ length: 10 }, (_, i) => `p${i}`))
  })

  it('com a fila cheia, atualizar uma pendência existente continua possível', () => {
    for (let i = 0; i < MAX_PENDING; i++) savePending('ana', item(`p${i}`, 1000 + i), 2000)
    expect(savePending('ana', item('p3', 1003, 0.9), 2000)).toBe('stored')
    expect(listPending('ana', 2000).find(x => x.sessionId === 'p3')!.summary.score).toBe(0.9)
  })

  it('pendências vencidas liberam espaço', () => {
    for (let i = 0; i < MAX_PENDING; i++) savePending('ana', item(`p${i}`, 1 + i), 1 + i)
    expect(savePending('ana', item('nova', PENDING_TTL_MS + 100), PENDING_TTL_MS + 100)).toBe('stored')
  })
})

describe('leitura de registros guardados', () => {
  it.each([
    ['sem resumo', { v: 1, gameId: 'vigia', sessionId: 'x', createdAt: 1000, payload: { sessionId: 'x' } }],
    ['data inválida', { ...item('x', 1000), createdAt: Number.NaN }],
    ['data como texto', { ...item('x', 1000), createdAt: '1000' }],
    ['sem dados da partida', { ...item('x', 1000), payload: undefined }],
    ['ID interno diferente', { ...item('x', 1000), payload: { sessionId: 'y' } }],
    ['versão desconhecida', { ...item('x', 1000), v: 99 }],
    ['jogo desconhecido', { ...item('x', 1000), gameId: 'outro' }],
    ['nível fora do intervalo', { ...item('x', 1000), summary: { difficulty: 42, score: 0.5 } }],
    ['pontuação fora do intervalo', { ...item('x', 1000), summary: { difficulty: 3, score: 7 } }],
    ['não é objeto', 'texto'],
  ])('isola registro %s sem afetar os válidos', (_, bad) => {
    values.set(KEY, JSON.stringify([item('ok1', 1000), bad, item('ok2', 1001)]))
    expect(listPending('ana', 2000).map(x => x.sessionId)).toEqual(['ok1', 'ok2'])
    expect(countInvalidPending('ana')).toBe(1)
  })

  it('aceita registros do formato inicial (sem campo de versão)', () => {
    const legacy: Record<string, unknown> = { ...item('antigo', 1000) }
    delete legacy.v
    values.set(KEY, JSON.stringify([legacy]))
    expect(listPending('ana', 2000).map(x => x.sessionId)).toEqual(['antigo'])
  })

  it('registros inválidos não são apagados por gravações; só pela limpeza pedida', () => {
    values.set(KEY, JSON.stringify([{ sessionId: 'x', createdAt: 1000 }]))
    savePending('ana', item('nova', 1500), 2000)
    removePending('ana', 'nova')
    expect(countInvalidPending('ana')).toBe(1)
    savePending('ana', item('nova', 1500), 2000)
    clearInvalidPending('ana')
    expect(countInvalidPending('ana')).toBe(0)
    expect(listPending('ana', 2000).map(x => x.sessionId)).toEqual(['nova'])
  })

  it('conteúdo ilegível não trava a leitura e não é sobrescrito', () => {
    values.set(KEY, '{nao é json')
    expect(listPending('ana')).toEqual([])
    expect(countInvalidPending('ana')).toBe(1)
    expect(savePending('ana', item('x', 1000), 1000)).toBe('unavailable')
    expect(values.get(KEY)).toBe('{nao é json')
    clearInvalidPending('ana')
    expect(values.has(KEY)).toBe(false)
  })
})
