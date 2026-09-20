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

// Samma begränsning för formen: Blobatar 2 har tio siluetter (round, organic,
// boxy, capsule, nub, cloud, droplet, hexagon, sun, triangle — se
// node_modules/blobatar/src/styles/{blob,shapes}.ts), men bara hälften av dem
// läses som "lekfull natur" snarare än en app-ikon — droppe, moln, sol,
// fri organisk form, rund (kotte/bär) och knopp. De hårt geometriska formerna
// (hexagon, triangel, kapsel, "boxig") utesluts, samma anda som Pixels mjuka,
// asymmetriska formspråk men jordnära i stället för regnbågsfärgat.
//
// Ett värde per vald form, mitt i dess band i blobatar/src/styles/blob.ts
// (BANDS), skickas som `traits: { shape: NATURE_SHAPES }` — biblioteket
// väljer sedan bland just dessa utifrån samma frö-hash som allt annat (se
// BlobatarOptions.traits, "any of these, whichever this name comes out as").
export const NATURE_SHAPES = [0.10, 0.35, 0.745, 0.825, 0.89, 0.965]
