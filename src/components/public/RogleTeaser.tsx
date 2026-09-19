import { useState } from 'react'
import { Link } from 'react-router-dom'
import UserAvatar from '../UserAvatar'
import { randomRogleTitle } from '../../lib/rogleTitles'
import { setRogleHandoff } from '../../lib/rogleHandoff'

// Interaktiv teaser på startsidan: skriv ditt namn, möt din Rögleblobb, och
// bli lockad vidare till vittnesmålsformuläret med en av de slumpade titlarna.
export default function RogleTeaser() {
  const [name, setName] = useState('')
  // En gång per sidladdning, inte per bokstav — annars byter CTA-texten
  // hela tiden medan man skriver, vilket är mer distraherande än roligt.
  const [title] = useState(randomRogleTitle)

  return (
    <div className="rogle-teaser">
      <UserAvatar seed={name || 'rögleskogen'} size={80} gaze title={`Din ${title}`} />
      <div className="rogle-teaser-body">
        <input
          id="rogle-teaser-name"
          className="form-input"
          type="text"
          placeholder="Ditt namn…"
          aria-label="Ditt namn"
          value={name}
          onChange={e => setName(e.target.value)}
        />
        <div className="rogle-teaser-actions">
          {/* Namn och titel bärs över via sessionStorage i stället för en
              synlig URL-parameter — se rogleHandoff.ts. */}
          <Link
            to="/vittnesmal"
            className="btn btn-primary"
            onClick={() => setRogleHandoff(name.trim(), title)}
          >
            Bli en {title} — lämna ett vittnesmål →
          </Link>
          <Link to="/kontakt" className="btn btn-secondary">Kontakta initiativet</Link>
        </div>
      </div>
    </div>
  )
}
