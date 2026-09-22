import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import type { SiteSettings, ContentBlock } from '../../lib/types'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../lib/toast'
import TapEditor from '../../components/admin/TapEditor'
import ContentStats from '../../components/admin/ContentStats'
import { useAutosave, useDraftRestore, clearDraft } from '../../lib/useAutosave'
import AutosaveBanner from '../../components/admin/AutosaveBanner'
import AutosaveStatus from '../../components/admin/AutosaveStatus'
import FocusModeToggle from '../../components/admin/FocusModeToggle'

const DRAFT_KEY = 'background'

export default function AdminBackground() {
  const [settings, setSettings] = useState<SiteSettings | null>(null)
  const [blocks, setBlocks] = useState<ContentBlock[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const { show } = useToast()
  const location = useLocation()

  const { draft, discard: discardDraft } = useDraftRestore<{ blocks: ContentBlock[] }>(DRAFT_KEY)
  const { dirty, savedAt } = useAutosave(DRAFT_KEY, { blocks }, { skip: loading })

  function restoreDraft() {
    if (!draft) return
    setBlocks(draft.value.blocks)
    discardDraft()
  }

  // Kom hit via DraftRecoveryDialog.tsx (den globala "Välkommen tillbaka"-
  // dialogen) — återställ automatiskt, men först när sidans egna data hunnit
  // laddas in (annars skriver den laddningen över återställningen).
  useEffect(() => {
    if (loading) return
    if (location.state?.autoRestoreDraft) restoreDraft()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading])

  useEffect(() => {
    supabase.from('site_settings').select('*').maybeSingle().then(({ data }) => {
      if (data) {
        const s = data as SiteSettings
        setSettings(s)
        setBlocks(Array.isArray(s.background_blocks) ? s.background_blocks : [])
      }
      setLoading(false)
    })
  }, [])

  async function save() {
    if (!settings) return
    setSaving(true)
    const { error } = await supabase
      .from('site_settings')
      .update({ background_blocks: blocks })
      .eq('id', settings.id)
    setSaving(false)
    if (error) show('Kunde inte spara: ' + error.message, 'error')
    else { clearDraft(DRAFT_KEY); show('Bakgrundssidan sparad', 'success') }
  }

  if (loading) return <div className="loading"><div className="spinner"></div></div>

  return (
    <div className="fade-in">
      <div className="admin-page-header">
        <h1>Bakgrund · innehåll</h1>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <FocusModeToggle />
          <Link to="/admin/sidor/bakgrund" className="btn btn-ghost btn-sm">← Sidan</Link>
          <a
            href="/bakgrund"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-ghost btn-sm"
          >
            Förhandsgranska →
          </a>
          <button className="btn btn-primary btn-sm" onClick={save} disabled={saving}>
            {saving ? 'Sparar…' : 'Spara'}
          </button>
        </div>
      </div>

      <AutosaveStatus dirty={dirty} savedAt={savedAt} />
      {draft && <AutosaveBanner savedAt={draft.savedAt} onRestore={restoreDraft} onDiscard={discardDraft} />}

      <div className="admin-form-card">
        <p className="text-muted" style={{ marginBottom: 'var(--space-5)', fontSize: '0.9rem' }}>
          Bygg innehållet på <strong>/bakgrund</strong> med block – text, rubriker, punktlistor, uppmaningar (CTA) m.m.
          Sidans rubrik och ingress redigeras under <Link to="/admin/sidor/bakgrund">Sidor → Bakgrund</Link>.
        </p>
        <div className="form-group">
          <label className="form-label">Innehåll</label>
          <TapEditor blocks={blocks} onChange={setBlocks} />
        </div>
        <div style={{ maxWidth: 320 }}>
          <ContentStats blocks={blocks} />
        </div>
        <div className="admin-form-actions">
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Sparar…' : 'Spara bakgrundssida'}
          </button>
        </div>
      </div>
    </div>
  )
}
