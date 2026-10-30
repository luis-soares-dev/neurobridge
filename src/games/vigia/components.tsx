// Peças visuais do Vigia usadas no jogo e no tutorial.
import { useEffect, useRef } from 'react'
import { usePreferences } from '../core/preferences'
import { COLORS, type StimulusColor } from './config'

export function Stimulus({ color, size }: { color: StimulusColor; size: number | string }) {
  const showSymbol = usePreferences(s => s.colorSymbols)
  const c = COLORS[color]
  const px = typeof size === 'number' ? `${size}px` : size
  return (
    <div
      className="stimulus"
      role="img"
      aria-label={`Círculo ${c.label}`}
      style={{ width: px, height: px, background: c.hex, color: c.symbolColor, fontSize: `calc(${px} * 0.45)` }}
    >
      {showSymbol && <span aria-hidden>{c.symbol}</span>}
    </div>
  )
}

/**
 * Botão de resposta. Toque e mouse respondem no pointerdown (sem esperar soltar), só com o
 * botão principal; o clique cobre teclado (Enter) e tecnologias assistivas, que geram clique
 * sem pointerdown. O clique que encerra um gesto de ponteiro já contado é sempre ignorado,
 * por mais tempo que o botão fique pressionado: um mesmo gesto nunca conta duas vezes.
 */
export function RespondButton({ onRespond, autoFocus = false }: { onRespond: () => void; autoFocus?: boolean }) {
  const pointerGesture = useRef(false)
  const ref = useRef<HTMLButtonElement>(null)
  useEffect(() => { if (autoFocus) ref.current?.focus({ preventScroll: true }) }, [autoFocus])

  // Se o ponteiro for solto fora do botão, não há clique para consumir o gesto: limpa depois
  // do pointerup (o clique, quando existe, chega antes deste temporizador).
  useEffect(() => {
    const onUp = () => { window.setTimeout(() => { pointerGesture.current = false }, 0) }
    window.addEventListener('pointerup', onUp, true)
    window.addEventListener('pointercancel', onUp, true)
    return () => {
      window.removeEventListener('pointerup', onUp, true)
      window.removeEventListener('pointercancel', onUp, true)
    }
  }, [])

  return (
    <button
      ref={ref}
      type="button"
      className="btn respond-btn"
      onPointerDown={e => {
        if (!e.isPrimary || e.button !== 0) return
        e.preventDefault()
        pointerGesture.current = true
        onRespond()
      }}
      onClick={() => {
        if (pointerGesture.current) { pointerGesture.current = false; return }
        onRespond()
      }}
    >
      RESPONDER <span className="tiny key-hint" style={{ fontWeight: 600 }}>(Espaço)</span>
    </button>
  )
}
