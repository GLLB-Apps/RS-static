// Lekfulla titlar för den som engagerar sig — slumpas fram i copy runt om på
// sajten (startsidans teaser, tack-meddelandet efter ett vittnesmål) i stället
// för en enda fast fras, så att engagemanget känns firat på lite olika sätt.
export const ROGLE_TITLES = [
  'Röglehjälte',
  'Röglevän',
  'Röglehjälpare',
  'Röglebeskyddare',
  'Röglevärn',
  'Rögleambassadör',
  'Skogsvän',
  'Skogshjälte',
  'Röglekämpe',
  'Röglefixare',
]

export function randomRogleTitle(): string {
  return ROGLE_TITLES[Math.floor(Math.random() * ROGLE_TITLES.length)]
}
