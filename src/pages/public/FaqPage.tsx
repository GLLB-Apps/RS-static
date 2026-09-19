import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, MessagesSquare } from 'lucide-react'
import PageHeader from '../../components/public/PageHeader'
import type { FaqCategory, FaqItem } from '../../lib/types'
import { supabase } from '../../lib/supabase'
import { usePage } from '../../lib/usePage'
import { useToast } from '../../lib/toast'
import UserAvatar from '../../components/UserAvatar'
import FaqQuestionForm from '../../components/public/FaqQuestionForm'

export default function FaqPage() {
  const page = usePage('fragor-och-svar')
  const [categories, setCategories] = useState<FaqCategory[]>([])
  const [items, setItems] = useState<FaqItem[]>([])
  const [loading, setLoading] = useState(true)
  const [openItems, setOpenItems] = useState<Set<string>>(new Set())
  const [tab, setTab] = useState<'browse' | 'ask'>('browse')
  const { show } = useToast()

  useEffect(() => {
    Promise.all([
      supabase.from('faq_categories').select('*').order('sort_order'),
      supabase.from('faq_items').select('*').eq('status', 'published').order('sort_order'),
    ]).then(([c, i]) => {
      setCategories(c.data as FaqCategory[] ?? [])
      setItems(i.data as FaqItem[] ?? [])
      setLoading(false)
    })
  }, [])

  async function handleAsk(data: { question: string; category_id: string | null; website: string }) {
    if (data.website) return // honeypot
    const { error } = await supabase.from('faq_items').insert({
      question: data.question,
      answer: '',
      category_id: data.category_id,
      sort_order: 0,
      status: 'draft',
    })
    if (error) { show('Något gick fel. Försök igen senare.', 'error'); return }
    show('Tack! Din fråga skickas till redaktionen och publiceras med svar.', 'success')
    setTab('browse')
  }

  function toggle(id: string) {
    setOpenItems(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function renderItem(item: FaqItem) {
    const open = openItems.has(item.id)
    return (
      <div key={item.id} className={open ? 'faq-item open' : 'faq-item'}>
        <button className="faq-question" onClick={() => toggle(item.id)} aria-expanded={open}>
          <UserAvatar seed={item.question} size={28} animate="always" className="faq-q-icon" title="Vem frågar?" />
          <span className="faq-q-text">{item.question}</span>
          <ChevronDown className="faq-chevron" size={20} aria-hidden="true" />
        </button>
        <div className="faq-answer-wrap">
          <div className="faq-answer">
            <div className="faq-answer-inner">{item.answer}</div>
          </div>
        </div>
      </div>
    )
  }

  if (loading) return <div className="loading"><div className="spinner"></div></div>

  const uncategorized = items.filter(i => !i.category_id)

  return (
    <div className="container container-narrow fade-in">
      <div className="page-header">
        <PageHeader slug="fragor-och-svar" />
      </div>

      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'browse'} className={tab === 'browse' ? 'tab active' : 'tab'} onClick={() => setTab('browse')}>
          Frågor och svar
        </button>
        <button role="tab" aria-selected={tab === 'ask'} className={tab === 'ask' ? 'tab active' : 'tab'} onClick={() => setTab('ask')}>
          Ställ en fråga
        </button>
      </div>

      {tab === 'ask' ? (
        <section className="fade-in" style={{ marginBottom: 'var(--space-9)' }}>
          <FaqQuestionForm categories={categories} onSubmit={handleAsk} />
        </section>
      ) : categories.length === 0 && items.length === 0 ? (
        <div className="empty-state">
          <p>Inga frågor har publicerats ännu.</p>
        </div>
      ) : (
        <div className="faq-wrap">
          {categories.map(cat => {
            const catItems = items.filter(i => i.category_id === cat.id)
            if (catItems.length === 0) return null
            return (
              <div key={cat.id} className="faq-category">
                <div className="faq-category-head">
                  <h3>{cat.name}</h3>
                  <span className="faq-count">{catItems.length}</span>
                </div>
                <div className="faq-category-items">{catItems.map(renderItem)}</div>
              </div>
            )
          })}

          {uncategorized.length > 0 && (
            <div className="faq-category">
              <div className="faq-category-head">
                <h3>{page.text('uncategorized_heading')}</h3>
                <span className="faq-count">{uncategorized.length}</span>
              </div>
              <div className="faq-category-items">{uncategorized.map(renderItem)}</div>
            </div>
          )}

          <div className="faq-cta">
            <MessagesSquare className="faq-cta-icon" size={32} aria-hidden="true" />
            <div className="faq-cta-text">
              <h3>Hittade du inte svaret?</h3>
              <p>Ställ frågan här så publicerar vi den med svar, eller hör av dig direkt.</p>
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-primary" onClick={() => setTab('ask')}>Ställ en fråga</button>
              <Link to="/kontakt" className="btn btn-secondary">Kontakta oss</Link>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
