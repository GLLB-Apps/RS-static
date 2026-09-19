// Rögleskogens jordnära färgfamilj i stället för hela regnbågen Blobatar
// annars väljer fritt: skogsgrönt, mossa, skiffergrått, bark, guldbrunt —
// samma toner som sajtens --primary/--secondary/--accent/--warning. En figur
// väljer en av dem deterministiskt utifrån sitt frö, så alla blobbar hör
// visuellt ihop med sajtens profil men fortfarande skiljer sig åt.
const EARTHY_HUES = [145, 95, 200, 35, 55]

export function hueForSeed(seed: string): number {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return EARTHY_HUES[h % EARTHY_HUES.length]
}
