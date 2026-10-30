// Aviso de partidas guardadas neste aparelho que ainda não chegaram ao servidor.
import { useCallback, useState } from 'react'
import {
  clearInvalidPending, countInvalidPending, listPending, MAX_PENDING, pendingExpiresAt, removePending, type PendingResult,
} from '../../games/core/pendingResults'
import { formatPoints } from '../../games/core/difficulty'
import { sendPending } from '../../games/vigia/persistSession'
import { classifySaveError, SAVE_ERROR_MESSAGES, type SaveErrorKind } from '../../services/errors'
import type { SaveVigiaPayload } from '../../services/sessions'
import { Button, Notice } from '../../ui/components'

const dateTimeFmt = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
const dateFmt = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' })

export function PendingNotice({ userId, onSent }: { userId: string; onSent: () => void }) {
  const [items, setItems] = useState<PendingResult[]>(() => listPending(userId))
  const [invalid, setInvalid] = useState(() => countInvalidPending(userId))
  const [sending, setSending] = useState(false)
  const [errors, setErrors] = useState<Record<string, SaveErrorKind>>({})

  const refresh = useCallback(() => {
    setItems(listPending(userId))
    setInvalid(countInvalidPending(userId))
  }, [userId])

  const sendAll = useCallback(async () => {
    setSending(true)
    const next: Record<string, SaveErrorKind> = {}
    let anySent = false
    for (const item of listPending(userId)) {
      if (item.gameId !== 'vigia') continue
      try {
        await sendPending(userId, item.payload as SaveVigiaPayload)
        anySent = true
      } catch (error) {
        next[item.sessionId] = classifySaveError(error)
        // Partidas em sequência: a próxima só é aceita depois do tempo mínimo de jogo.
        if (next[item.sessionId] === 'rate' || next[item.sessionId] === 'network') break
      }
    }
    setErrors(next)
    refresh()
    setSending(false)
    if (anySent) onSent()
  }, [userId, onSent, refresh])

  const discard = (sessionId: string) => {
    removePending(userId, sessionId)
    refresh()
  }

  if (items.length === 0 && invalid === 0) return null
  return (
    <div className="stack">
      {items.length > 0 && (
        <Notice tone="warning">
          <p>
            {items.length === 1 ? 'Há 1 partida guardada' : `Há ${items.length} partidas guardadas`} neste aparelho que ainda
            não {items.length === 1 ? 'foi enviada' : 'foram enviadas'} para a sua conta.
            {items.length >= MAX_PENDING && ` O limite é ${MAX_PENDING}: novas partidas não serão guardadas até que estas sejam enviadas.`}
          </p>
          <ul style={{ margin: '0.5rem 0 0 1.1rem' }}>
            {items.map(item => (
              <li key={item.sessionId} style={{ marginTop: '0.3rem' }}>
                {dateTimeFmt.format(item.createdAt)} · nível {item.summary.difficulty} · {formatPoints(item.summary.score)} pontos (estimativa)
                <span className="tiny" style={{ display: 'block', color: 'var(--text-2)' }}>Guardada até {dateFmt.format(pendingExpiresAt(item))}</span>
                {errors[item.sessionId] && <p className="tiny" style={{ color: 'var(--text-2)' }}>{SAVE_ERROR_MESSAGES[errors[item.sessionId]]}</p>}
                {errors[item.sessionId] === 'rejected' && (
                  <Button variant="ghost" onClick={() => discard(item.sessionId)} style={{ marginTop: '0.3rem' }}>Descartar esta partida</Button>
                )}
              </li>
            ))}
          </ul>
          <div className="row">
            <Button variant="secondary" onClick={() => void sendAll()} disabled={sending}>{sending ? 'Enviando…' : 'Enviar agora'}</Button>
          </div>
        </Notice>
      )}
      {invalid > 0 && (
        <Notice tone="info">
          <p>
            {invalid === 1 ? 'Um registro guardado neste aparelho não pôde ser lido' : `${invalid} registros guardados neste aparelho não puderam ser lidos`} e
            foi deixado de lado. As demais partidas não foram afetadas.
          </p>
          <div className="row">
            <Button variant="secondary" onClick={() => { clearInvalidPending(userId); refresh() }}>Limpar registros ilegíveis</Button>
          </div>
        </Notice>
      )}
    </div>
  )
}
