import { useLayoutEffect } from 'react'
import { useLocation } from 'react-router-dom'

// Tasteful scroll-reveal: fades + lifts content blocks into view as they enter
// the viewport, with a small per-row stagger. Runs site-wide from PublicLayout,
// picks up async-loaded content via a MutationObserver, and is fully disabled
// under prefers-reduced-motion. No per-element markup needed.
const SELECTOR = [
  '.section-header',
  '.card',
  '.topic-card',
  '.press-card',
  '.faq-item',
  '.principle-card',
  '.status-card',
  '.cta-section',
  '.block-list',
  '.content-blocks > *',
  '.hero-content',
  '.grid > *',
  '.timeline-item',
  '.intdoc-item',
  '.media-gallery > *',
].join(', ')

export function useScrollReveal() {
  const location = useLocation()

  useLayoutEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const root = document.querySelector('.public-main')
    if (!root) return

    const io = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible')
            io.unobserve(entry.target)
          }
        }
      },
      { threshold: 0.08, rootMargin: '0px 0px -40px 0px' },
    )

    const prepare = (el: Element) => {
      if (!(el instanceof HTMLElement) || el.classList.contains('reveal')) return
      const parent = el.parentElement
      const idx = parent ? Array.prototype.indexOf.call(parent.children, el) : 0
      el.style.transitionDelay = `${Math.min(idx, 8) * 55}ms`
      el.classList.add('reveal')
      io.observe(el)
    }

    root.querySelectorAll(SELECTOR).forEach(prepare)

    // Reveal content that renders after async fetches (cards, lists, …).
    const mo = new MutationObserver(mutations => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (!(node instanceof Element)) continue
          if (node.matches?.(SELECTOR)) prepare(node)
          node.querySelectorAll?.(SELECTOR).forEach(prepare)
        }
      }
    })
    mo.observe(root, { childList: true, subtree: true })

    return () => {
      io.disconnect()
      mo.disconnect()
    }
  }, [location.pathname])
}
