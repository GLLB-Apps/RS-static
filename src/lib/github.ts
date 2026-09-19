// Läser commits från projektets GitHub-repo, direkt från webbläsaren.
//
// Repot är publikt, och GitHubs API svarar med `Access-Control-Allow-Origin: *`
// på publika repon — därför behövs varken en serverlös funktion eller ett token,
// och importen fungerar även i utvecklingsläge. Priset är taket på 60 anrop per
// timme och IP-adress, vilket räcker gott för en knapp som gör ett anrop per
// import. Blir repot privat igen slutar det här att fungera (404) och då krävs
// en server-side-hämtning med GITHUB_TOKEN i stället.

export const GITHUB_REPO = 'GLLB-Apps/NCC-Draft-RS'
export const GITHUB_BRANCH = 'main'

export interface GitHubCommit {
  sha: string
  shortSha: string
  /** Författardatum som YYYY-MM-DD i lokal tid — samma format som entry_date. */
  date: string
  /** Commit-meddelandets första rad. */
  subject: string
  /** Resten av meddelandet. Tom sträng när det bara var en rad. */
  body: string
  author: string
  url: string
}

/** ISO-tidsstämpel → YYYY-MM-DD i lokal tid. */
function isoDay(timestamp: string): string {
  const d = new Date(timestamp)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

interface RawCommit {
  sha: string
  html_url: string
  parents: unknown[]
  commit: { message: string; author: { name: string; date: string } | null }
  author: { login: string } | null
}

/**
 * Hämtar de senaste commitsen på huvudgrenen, nyast först. Sammanslagningar
 * ("Merge pull request …") filtreras bort — de beskriver ingen ändring.
 * Kastar med ett meddelande som går att visa för användaren.
 */
export async function fetchCommits(limit = 60): Promise<GitHubCommit[]> {
  const url = `https://api.github.com/repos/${GITHUB_REPO}/commits`
    + `?sha=${encodeURIComponent(GITHUB_BRANCH)}&per_page=${Math.min(limit, 100)}`

  let res: Response
  try {
    res = await fetch(url, { headers: { Accept: 'application/vnd.github+json' } })
  } catch {
    throw new Error('Kunde inte nå GitHub. Kontrollera internetanslutningen.')
  }

  if (res.status === 404) {
    throw new Error(`Hittade inte ${GITHUB_REPO}. Är repot privat igen? Då krävs en hämtning server-side.`)
  }
  if (res.status === 403 && res.headers.get('x-ratelimit-remaining') === '0') {
    const reset = Number(res.headers.get('x-ratelimit-reset') ?? 0) * 1000
    const när = reset ? new Date(reset).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }) : 'om en stund'
    throw new Error(`GitHubs timgräns är nådd (60 anrop per timme). Försök igen efter ${när}.`)
  }
  if (!res.ok) throw new Error(`GitHub svarade ${res.status}.`)

  const raw = (await res.json()) as RawCommit[]
  return raw
    .filter(c => (c.parents?.length ?? 0) <= 1)
    .map(c => {
      const [subject, ...rest] = c.commit.message.split('\n')
      return {
        sha: c.sha,
        shortSha: c.sha.slice(0, 7),
        date: isoDay(c.commit.author?.date ?? new Date().toISOString()),
        subject: subject.trim(),
        body: rest.join('\n').trim(),
        author: c.author?.login ?? c.commit.author?.name ?? '',
        url: c.html_url,
      }
    })
}
