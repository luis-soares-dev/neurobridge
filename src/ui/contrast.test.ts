// Verifica, a partir dos tokens reais de src/index.css, o contraste das combinações usadas.
// Texto normal ≥ 4,5:1 (WCAG 1.4.3); bordas de controle, foco e gráficos ≥ 3:1 (WCAG 1.4.11).
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { COLORS } from '../games/vigia/config'

const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8')
const token = (name: string) => {
  const m = css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`))
  if (!m) throw new Error(`token --${name} não encontrado`)
  return m[1]
}
const lum = (hex: string) => {
  const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}
export const contrast = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

const TEXT: [string, string, string][] = [
  ['texto do botão primário', '#ffffff', token('primary-strong')],
  ['texto do botão Responder', '#ffffff', token('respond')],
  ...(['bg', 'surface', 'surface-sunken'] as const).flatMap(bg => [
    [`--text-2 sobre --${bg}`, token('text-2'), token(bg)],
    [`--muted sobre --${bg}`, token('muted'), token(bg)],
    [`--subtle sobre --${bg}`, token('subtle'), token(bg)],
    [`--primary sobre --${bg}`, token('primary'), token(bg)],
    [`--warning sobre --${bg}`, token('warning'), token(bg)],
    [`--success sobre --${bg}`, token('success'), token(bg)],
    [`--danger sobre --${bg}`, token('danger'), token(bg)],
  ] as [string, string, string][]),
]

const GRAPHICS: [string, string, string][] = [
  ...(['bg', 'surface'] as const).flatMap(bg => [
    [`borda de controle sobre --${bg}`, token('control-border'), token(bg)],
    [`contorno de foco sobre --${bg}`, token('primary'), token(bg)],
  ] as [string, string, string][]),
  ['ponto de fixação na arena', token('muted'), token('surface')],
  ...Object.entries(COLORS).map(([n, c]) => [`círculo ${n} sobre a arena`, c.hex, token('surface')] as [string, string, string]),
  ...Object.entries(COLORS).map(([n, c]) => [`símbolo sobre o círculo ${n}`, c.symbolColor, c.hex] as [string, string, string]),
]

describe('contraste das cores da interface', () => {
  it.each(TEXT)('%s ≥ 4,5:1', (_, fg, bg) => expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5))
  it.each(GRAPHICS)('%s ≥ 3:1', (_, fg, bg) => expect(contrast(fg, bg)).toBeGreaterThanOrEqual(3))
})
