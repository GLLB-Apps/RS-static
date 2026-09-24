import { Sun, Moon } from 'lucide-react'
import { useTheme } from '../lib/theme'

/** Måne/sol-knapp för det globala mörka/ljusa läget — delas av publika
 * sidan, adminpanelen och intranätet (alla läser samma useTheme()). */
export default function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme } = useTheme()
  return (
    <button
      type="button"
      className={className}
      onClick={toggleTheme}
      aria-label={theme === 'dark' ? 'Byt till ljust läge' : 'Byt till mörkt läge'}
      data-tooltip={theme === 'dark' ? 'Byt till ljust läge' : 'Byt till mörkt läge'}
    >
      {theme === 'dark' ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
    </button>
  )
}
