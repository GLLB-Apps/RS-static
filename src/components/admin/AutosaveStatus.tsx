import { Save } from 'lucide-react'

// Litet statusmärke bredvid Spara-knapparna. Skilt från den faktiska
// Spara-knappen — det här sparar bara lokalt i webbläsaren, inte till
// servern, så en enkel ikon räcker (ingen egen blob behövs för det).
export default function AutosaveStatus({ dirty, savedAt }: { dirty: boolean; savedAt: string | null }) {
  if (!dirty && !savedAt) return null
  return (
    <span className="autosave-status" title={dirty ? 'Sparar utkast i webbläsaren…' : 'Utkastet är autosparat i webbläsaren'}>
      <Save size={14} aria-hidden="true" className={dirty ? 'autosave-status-icon is-saving' : 'autosave-status-icon'} />
      <span className="autosave-status-label">{dirty ? 'Sparar utkast…' : 'Utkast sparat'}</span>
    </span>
  )
}
