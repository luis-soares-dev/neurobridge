// Componentes visuais básicos da plataforma (estilos em src/index.css).
import type { ButtonHTMLAttributes, ReactNode } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'round'

export function Button({ variant = 'primary', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return <button type="button" className={`btn btn-${variant} ${className}`.trim()} {...props} />
}

export function Screen({ children }: { children: ReactNode }) {
  return <main className="screen">{children}</main>
}

export function Card({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return <section className="card" style={wide ? { maxWidth: 520 } : undefined}>{children}</section>
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'warning' | 'error'; children: ReactNode }) {
  return <div role={tone === 'error' ? 'alert' : 'status'} className={`notice notice-${tone}`}>{children}</div>
}

export function ProgressBar({ percent, color = 'var(--primary)', label }: { percent: number; color?: string; label: string }) {
  const value = Math.min(100, Math.max(0, Math.round(percent)))
  return (
    <div className="progress" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}>
      <div style={{ width: `${value}%`, background: color }} />
    </div>
  )
}

export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="toggle">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
    </label>
  )
}

export function LoadingScreen({ message = 'Carregando…' }: { message?: string }) {
  return (
    <Screen>
      <div style={{ fontSize: '2rem' }} aria-hidden>🧠</div>
      <p role="status" style={{ color: 'var(--primary)' }}>{message}</p>
    </Screen>
  )
}
