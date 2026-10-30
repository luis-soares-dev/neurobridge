// Preferências do jogador neste navegador (som, símbolos de apoio) e marcas por conta.
import { create } from 'zustand'

interface Preferences {
  /** null = ainda não perguntamos; o som só toca depois de a pessoa escolher ligar. */
  sound: boolean | null
  /** Mostra um símbolo em cada cor, para quem tem dificuldade em distinguir cores. */
  colorSymbols: boolean
}

const STORAGE_KEY = 'neurobridge:preferences'
const DEFAULTS: Preferences = { sound: null, colorSymbols: false }

function load(): Preferences {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    return {
      sound: typeof raw.sound === 'boolean' ? raw.sound : DEFAULTS.sound,
      colorSymbols: typeof raw.colorSymbols === 'boolean' ? raw.colorSymbols : DEFAULTS.colorSymbols,
    }
  } catch {
    return DEFAULTS
  }
}

interface PreferencesState extends Preferences {
  set: (patch: Partial<Preferences>) => void
}

export const usePreferences = create<PreferencesState>((set, get) => ({
  ...load(),
  set: (patch) => {
    set(patch)
    const { sound, colorSymbols } = get()
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ sound, colorSymbols })) }
    catch { /* Preferência vale só nesta aba. */ }
  },
}))

/** Marcas simples por conta neste aparelho (ex.: tutorial já visto). */
export function readFlag(userId: string | undefined, name: string): boolean {
  if (!userId) return false
  try { return localStorage.getItem(`neurobridge:${userId}:${name}`) === '1' } catch { return false }
}

export function writeFlag(userId: string | undefined, name: string): void {
  if (!userId) return
  try { localStorage.setItem(`neurobridge:${userId}:${name}`, '1') } catch { /* sem efeito */ }
}
