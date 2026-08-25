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
