/** Kort, odramatisk toning — för element som helt monteras ur/i (rubrik,
 * "Tillbaka"-länk m.m.) när fokusläget växlar. Se FocusModeToggle.tsx. */
export const FADE = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.15 },
}
