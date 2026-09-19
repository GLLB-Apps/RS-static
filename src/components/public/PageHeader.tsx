import type { ReactNode } from 'react'
import { usePage } from '../../lib/usePage'

// Renders a public page's editable title + intro (managed under Admin → Sidor).
// Meant to sit inside an existing `.page-header` container.
export default function PageHeader({ slug, titleExtra }: { slug: string; titleExtra?: ReactNode }) {
  const page = usePage(slug)
  return (
    <>
      {titleExtra ? (
        <div className="page-title-row">
          <h1>{page.title}</h1>
          {titleExtra}
        </div>
      ) : (
        <h1>{page.title}</h1>
      )}
      {page.intro && <p>{page.intro}</p>}
    </>
  )
}
