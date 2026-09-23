import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'

export type Theme = 'light' | 'dark'

const THEME_KEY = 'ncc-rs:theme'

interface ThemeApi {
  theme: Theme
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeApi | null>(null)

/** Sparat val, annars systemets färgschema, annars ljust. */
function initialTheme(): Theme {
  try {
    const saved = window.localStorage.getItem(THEME_KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch { /* privat läge, blockerad lagring m.m. */ }
  try {
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark'
  } catch { /* okänd preferens */ }
  return 'light'
}

/**
 * Globalt mörkt/ljust läge för hela sajten — publika sidan, adminpanelen och
 * intranätet delar samma val och samma <html data-theme>. Variabelöverskrivningen
 * i admin.css (:root[data-theme="dark"]) är medvetet :root-scopad, inte bara
 * scopad till adminpanelen, så den slår igenom överallt som redan konsumerar
 * samma CSS-variabler (var(--bg), var(--text), osv.).
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(initialTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try { window.localStorage.setItem(THEME_KEY, theme) } catch { /* ignore */ }
  }, [theme])

  const toggleTheme = () => setTheme(t => (t === 'dark' ? 'light' : 'dark'))

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeApi {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme måste användas inuti ThemeProvider')
  return ctx
}
