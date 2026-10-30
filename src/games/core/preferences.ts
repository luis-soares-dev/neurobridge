// Preferências do jogador neste navegador (som, símbolos de apoio).
import { create } from 'zustand'

interface Preferences {
  sound: boolean
  /** Mostra um símbolo em cada cor, para quem tem dificuldade em distinguir cores. */
  colorSymbols: boolean
}

const STORAGE_KEY = 'neurobridge:preferences'
const DEFAULTS: Preferences = { sound: true, colorSymbols: false }

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
