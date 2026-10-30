// Classificação de falhas de salvamento: cada tipo pede uma ação diferente do jogador.
export type SaveErrorKind =
  | 'network'    // sem conexão — tentar de novo depois
  | 'timeout'    // servidor não respondeu a tempo — tentar de novo
  | 'auth'       // sessão expirada ou conta diferente — entrar novamente
  | 'rate'       // partidas em sequência rápida demais — aguardar e tentar de novo
  | 'rejected'   // o servidor recusou os dados — não adianta reenviar
  | 'unexpected' // resposta fora do contrato ou erro desconhecido — tentar de novo

export class SaveError extends Error {
  constructor(public readonly kind: SaveErrorKind, message: string) {
    super(message)
    this.name = 'SaveError'
  }
}

/** Falhas definitivas não devem ser reenviadas automaticamente. */
export const isPermanent = (kind: SaveErrorKind) => kind === 'rejected'

interface ErrorLike { message?: unknown; code?: unknown; status?: unknown }

export function classifySaveError(error: unknown, status?: number): SaveErrorKind {
  if (error instanceof SaveError) return error.kind
  const e = (error ?? {}) as ErrorLike
  const message = typeof e.message === 'string' ? e.message : String(error)
  const code = typeof e.code === 'string' ? e.code : ''
  if (/^(AbortError|TimeoutError)/.test(message)) return 'timeout'
  if (status === 0 || /^(TypeError|FetchError)|Failed to fetch|NetworkError|Load failed/i.test(message)) return 'network'
  if (status === 401 || status === 403 || code === 'PGRST301' || /JWT|session missing|Autenticação necessária|Perfil não encontrado/i.test(message)) return 'auth'
  if (/sequência rápida/i.test(message)) return 'rate'
  if (code === 'P0001' || code === '22P02' || code === '23505') return 'rejected'
  return 'unexpected'
}

export const SAVE_ERROR_MESSAGES: Record<SaveErrorKind, string> = {
  network: 'Sem conexão com o servidor. A partida ficou guardada neste aparelho e pode ser enviada quando a conexão voltar.',
  timeout: 'O servidor demorou a responder. A partida ficou guardada neste aparelho; tente enviar de novo.',
  auth: 'Sua sessão expirou ou mudou de conta. Entre novamente com a mesma conta para enviar; a partida fica guardada neste aparelho.',
  rate: 'Esta partida chegou logo depois da anterior. Aguarde um minuto e tente enviar de novo.',
  rejected: 'O servidor não aceitou esta partida porque os dados estão inconsistentes. Ela não pode ser salva.',
  unexpected: 'Não foi possível confirmar o salvamento. A partida ficou guardada neste aparelho; tente de novo.',
}
