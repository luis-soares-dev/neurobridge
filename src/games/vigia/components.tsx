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
 * sem pointerdown. Um mesmo toque não conta duas vezes.
 */
export function RespondButton({ onRespond, autoFocus = false }: { onRespond: () => void; autoFocus?: boolean }) {
  const lastPointer = useRef(-Infinity)
  const ref = useRef<HTMLButtonElement>(null)
  useEffect(() => { if (autoFocus) ref.current?.focus({ preventScroll: true }) }, [autoFocus])
  return (
    <button
      ref={ref}
      type="button"
      className="btn respond-btn"
      onPointerDown={e => {
        if (!e.isPrimary || e.button !== 0) return
        e.preventDefault()
        lastPointer.current = performance.now()
        onRespond()
      }}
      onClick={() => {
        if (performance.now() - lastPointer.current < 1000) return
        onRespond()
      }}
    >
      RESPONDER <span className="tiny key-hint" style={{ fontWeight: 600 }}>(Espaço)</span>
    </button>
  )
}
