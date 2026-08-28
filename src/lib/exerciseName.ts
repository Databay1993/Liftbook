/**
 * Display name for an exercise.
 *
 * The database keeps one canonical name per exercise — that is what sets,
 * plans and statistics are keyed by, so it must never change with the app
 * language. The built-in exercises additionally have a translation under
 * `ex_<name>`; everything the user typed themselves shows exactly as typed.
 */
export function exerciseLabel(name: string, t: (key: string, opts?: any) => string): string {
  return t(`ex_${name}`, { defaultValue: '' }) || name;
}

/** Written out rather than using normalize(), which Hermes does not carry. */
const FOLD: Record<string, string> = {
  ä: 'a', ö: 'o', ü: 'u', ß: 'ss',
  á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u', ñ: 'n',
};

/** Lowercase and stripped of accents, so "trizepsdrucken" finds "Trizepsdrücken". */
function fold(s: string): string {
  return s.toLowerCase().replace(/[äöüßáéíóúñ]/g, c => FOLD[c]);
}

/**
 * Whether an exercise matches what was typed into a search box.
 *
 * Matches the visible label as well as the stored name. The built-in
 * exercises are keyed in English, which the German UI never shows — searching
 * the key alone makes "Klimmzug" unfindable, while "Pu" silently returns
 * Latzug, Klimmzug and Trizepsdrücken with nothing visibly in common.
 */
export function matchesExercise(
  name: string,
  query: string,
  t: (key: string, opts?: any) => string,
): boolean {
  const q = fold(query.trim());
  if (!q) return true;
  return fold(exerciseLabel(name, t)).includes(q) || fold(name).includes(q);
}
