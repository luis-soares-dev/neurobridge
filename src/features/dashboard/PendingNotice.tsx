// Aviso de partidas guardadas neste aparelho que ainda não chegaram ao servidor.
import { useCallback, useState } from 'react'
import { listPending, removePending, type PendingResult } from '../../games/core/pendingResults'
import { formatPoints } from '../../games/core/difficulty'
import { sendPending } from '../../games/vigia/persistSession'
import { classifySaveError, SAVE_ERROR_MESSAGES, type SaveErrorKind } from '../../services/errors'
import type { SaveVigiaPayload } from '../../services/sessions'
import { Button, Notice } from '../../ui/components'

const dateFmt = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

export function PendingNotice({ userId, onSent }: { userId: string; onSent: () => void }) {
  const [items, setItems] = useState<PendingResult[]>(() => listPending(userId))
  const [sending, setSending] = useState(false)
  const [errors, setErrors] = useState<Record<string, SaveErrorKind>>({})

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
    setItems(listPending(userId))
    setSending(false)
    if (anySent) onSent()
  }, [userId, onSent])

  const discard = (sessionId: string) => {
    removePending(userId, sessionId)
    setItems(listPending(userId))
  }

  if (items.length === 0) return null
  return (
    <Notice tone="warning">
      <p>
        {items.length === 1 ? 'Há 1 partida guardada' : `Há ${items.length} partidas guardadas`} neste aparelho que ainda
        não {items.length === 1 ? 'foi enviada' : 'foram enviadas'} para a sua conta.
      </p>
      <ul style={{ margin: '0.5rem 0 0 1.1rem' }}>
        {items.map(item => (
          <li key={item.sessionId} style={{ marginTop: '0.3rem' }}>
            {dateFmt.format(item.createdAt)} · nível {item.summary.difficulty} · {formatPoints(item.summary.score)} pontos (estimativa)
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
  )
}
