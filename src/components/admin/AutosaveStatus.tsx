import UserAvatar from '../UserAvatar'
import { thinking } from 'blobatar/expression'

// Litet statusmärke bredvid Spara-knapparna: figuren "tänker" (samma pose
// som laddningsvyerna) medan autosparningens debounce väntar på att skriva,
// och vilar annars. Skilt från den faktiska Spara-knappen — det här sparar
// bara lokalt i webbläsaren, inte till servern.
export default function AutosaveStatus({ dirty, savedAt }: { dirty: boolean; savedAt: string | null }) {
  if (!dirty && !savedAt) return null
  return (
    <span className="autosave-status" title={dirty ? 'Sparar utkast i webbläsaren…' : 'Utkastet är autosparat i webbläsaren'}>
      <UserAvatar seed="autosave" size={20} expression={dirty ? thinking : undefined} />
      <span className="autosave-status-label">{dirty ? 'Sparar utkast…' : 'Utkast sparat'}</span>
    </span>
  )
}
