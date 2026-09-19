// Bär med namnet och den slumpade titeln från startsidans teaser till
// vittnesmålsformuläret, utan att lägga dem synligt i URL:en. sessionStorage
// (inte localStorage) eftersom det bara är en engångsöverlämning för det här
// besöket — inget som ska dyka upp igen vid ett senare besök.
const KEY = 'ncc-rs:rogle-handoff'

export function setRogleHandoff(name: string, title: string) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ name, title }))
  } catch {
    // Privat läge m.m. — då hoppar formuläret bara över förifyllnaden.
  }
}

/** Läser och rensar direkt, så en vanlig direktnavigering till /vittnesmal senare inte återanvänder gammal data. */
export function takeRogleHandoff(): { name: string; title: string } | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    sessionStorage.removeItem(KEY)
    const parsed = JSON.parse(raw)
    return { name: String(parsed.name ?? ''), title: String(parsed.title ?? '') }
  } catch {
    return null
  }
}
