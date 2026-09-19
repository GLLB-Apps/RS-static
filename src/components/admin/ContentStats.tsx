import type { ContentBlock } from '../../lib/types'
import { contentStats } from '../../lib/utils'
import { useAuth } from '../../lib/auth'
import UserAvatar from '../UserAvatar'

// Innehållsstatistik i redigerarens sidofält — ord, stycken, block och
// ungefärlig lästid, uträknat live ur blocken. Ersatte skrivhjälpen, som mest
// dubblade det editorns eget MD-läge redan gjorde. Figuren är skribentens
// egen (samma seed som i kontomenyn), inte en fast/anonym figur.
export default function ContentStats({ blocks }: { blocks: ContentBlock[] }) {
  const { user } = useAuth()
  const stats = contentStats(blocks)

  return (
    <div className="content-stats editor-panel">
      <div className="content-stats-head">
        <UserAvatar seed={user?.email ?? ''} size={72} gaze title="Innehållsstatistik" />
        <div className="content-stats-numbers">
          <div>
            <strong>{stats.words}</strong>
            <span>ord</span>
          </div>
          <div>
            <strong>{stats.paragraphs}</strong>
            <span>stycken</span>
          </div>
          <div>
            <strong>{stats.blocks}</strong>
            <span>block</span>
          </div>
        </div>
      </div>
      <p className="form-hint" style={{ margin: 0 }}>
        {stats.words === 0 ? 'Inget skrivet än.' : `Ungefär ${stats.readingMinutes} min lästid.`}
      </p>
    </div>
  )
}
