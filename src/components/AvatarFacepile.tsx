import UserAvatar from './UserAvatar'

// Ett "facepile" à la blobatar.dev:s group-chat-komponent (den överlappande
// klungan uppe till höger i dess header) — en klunga blobbar bredvid en
// rubrik. Varje figur förankas till det id man skickar in (vittnesmål,
// konto), inte till namnet/e-posten, så identiteten aldrig läcker via seedet.
export default function AvatarFacepile({ seeds, max = 6, size = 48 }: {
  seeds: string[]
  max?: number
  size?: number
}) {
  if (seeds.length === 0) return null
  const shown = seeds.slice(0, max)
  const extra = seeds.length - shown.length
  // Överlappet skalar med storleken, annars ser stora figurer bara utspridda
  // ut i stället för att bilda en klunga.
  const overlap = -Math.round(size * 0.32)
  return (
    <div className="avatar-facepile" aria-hidden="true">
      {shown.map((seed, i) => (
        <UserAvatar
          key={seed}
          seed={seed}
          size={size}
          className="avatar-facepile-avatar"
          style={{ marginLeft: i === 0 ? 0 : overlap }}
        />
      ))}
      {extra > 0 && (
        <span
          className="avatar-facepile-extra"
          style={{ width: size, height: size, marginLeft: overlap, fontSize: Math.max(11, Math.round(size * 0.3)) }}
        >
          +{extra}
        </span>
      )}
    </div>
  )
}
