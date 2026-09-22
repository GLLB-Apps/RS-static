import { motion } from 'motion/react'
import UserAvatar from '../UserAvatar'
import { thinking } from 'blobatar/expression'
import { formatDate } from '../../lib/utils'

// Visas i toppen av en redigerare när ett autosparat utkast hittas vid
// mount — den enda anledningen ett sådant finns kvar är att den senaste
// ändringen aldrig hann sparas på servern (kraschad flik, stängd webbläsare,
// avbruten uppkoppling). Figuren lånar samma "thinking"-pose som
// laddningsvyerna, för samma "något pågår fortfarande"-känsla.
export default function AutosaveBanner({ savedAt, onRestore, onDiscard }: {
  savedAt: string
  onRestore: () => void
  onDiscard: () => void
}) {
  return (
    <motion.div
      className="card autosave-banner"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <UserAvatar seed="valkommen-tillbaka" size={48} expression={thinking} title="Ett utkast väntar" />
      <div className="autosave-banner-text">
        <strong>Välkommen tillbaka!</strong>
        <p className="text-muted" style={{ margin: 0 }}>
          Du har ett utkast som autosparades i webbläsaren {formatDate(savedAt, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })},
          men som inte hann sparas på servern. Vill du fortsätta där du slutade?
        </p>
      </div>
      <div className="autosave-banner-actions">
        <button type="button" className="btn btn-primary btn-sm" onClick={onRestore}>Fortsätt där jag slutade</button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onDiscard}>Nej tack</button>
      </div>
    </motion.div>
  )
}
