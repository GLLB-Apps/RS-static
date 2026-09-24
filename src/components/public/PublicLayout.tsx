import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Header from './Header'
import Footer from './Footer'
import VoteWidget from './VoteWidget'
import EditPageButton from './EditPageButton'
import type { SiteSettings } from '../../lib/types'
import { supabase } from '../../lib/supabase'
import { EditLinkProvider } from '../../lib/editLink'
import { useScrollReveal } from '../../lib/useScrollReveal'

export default function PublicLayout() {
  const [settings, setSettings] = useState<SiteSettings | null>(null)
  const isHome = useLocation().pathname === '/'
  useScrollReveal()

  useEffect(() => {
    supabase
      .from('site_settings')
      .select('*')
      .maybeSingle()
      .then(({ data }) => setSettings(data as SiteSettings | null))
  }, [])

  // Sidobredden (Admin → Inställningar) — samma :root-variabel som
  // .container-narrow läser, satt globalt så hela sajten följer den. Tas
  // bort vid unmount så adminpanelen (som inte använder variabeln) aldrig
  // ärver ett gammalt värde mellan navigeringar.
  useEffect(() => {
    if (settings?.content_width) {
      document.documentElement.style.setProperty('--content-width', `${settings.content_width}px`)
    }
    return () => { document.documentElement.style.removeProperty('--content-width') }
  }, [settings?.content_width])

  return (
    <EditLinkProvider>
      <div className="public-layout">
        <Header settings={settings} />
        {/* On the start page the widget lives inline beside the summary section instead */}
        {!isHome && <VoteWidget settings={settings} />}
        <main className="public-main">
          <Outlet context={{ settings }} />
        </main>
        <Footer settings={settings} />
        <EditPageButton />
      </div>
    </EditLinkProvider>
  )
}
