// Kommer ihåg vilket konto man senast loggade in med i den här webbläsaren,
// över sessioner (localStorage, inte sessionStorage) — så att inloggnings-
// sidans rubrik kan hälsa med namnet redan innan man loggat in igen, så
// fort adressfältet matchar. Rör bara den här webbläsaren: en annan person
// som skriver samma adress på en annan dator ser ingenting av det här.
const KEY = 'ncc-rs:last-account'

export interface RememberedAccount {
  email: string
  displayName: string | null
}

export function rememberAccount(email: string, displayName: string | null) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ email, displayName }))
  } catch { /* privat läge, blockerad lagring m.m. */ }
}

export function getRememberedAccount(): RememberedAccount | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as RememberedAccount) : null
  } catch {
    return null
  }
}
