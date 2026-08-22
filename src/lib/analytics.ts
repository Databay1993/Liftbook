/**
 * Pure data preparation for the stats screen.
 *
 * Nothing in here touches React, the database or i18n — everything is a plain
 * function over plain data, so it can be reasoned about (and tested) on its own.
 */

import type { ExerciseSetRow, SessionSet } from '../storage/database';

// ── e1RM (estimated one-rep max) ───────────────────────────────

/**
 * Above this rep count the Epley formula drifts upwards noticeably, so points
 * derived from such sets are flagged rather than silently trusted.
 */
export const EPLEY_REP_LIMIT = 12;

/** Epley: e1RM = weight × (1 + reps / 30). Returns 0 for unusable input. */
export function epleyE1RM(weight: number, reps: number): number {
  if (!(weight > 0) || !(reps > 0)) return 0;
  return weight * (1 + reps / 30);
}

export type E1RMPoint = {
  workoutId: number;
  date: string;
  weight: number;
  reps: number;
  e1rm: number;
  /** Set had more than EPLEY_REP_LIMIT reps → the estimate runs high. */
  overEstimated: boolean;
};

/**
 * A set beats another when it is a more trustworthy estimate; only among
 * equally trustworthy sets does the higher e1RM win. That keeps a 20-rep
 * light set from outranking a genuine heavy triple.
 */
function isBetter(a: E1RMPoint, b: E1RMPoint): boolean {
  if (a.overEstimated !== b.overEstimated) return !a.overEstimated;
  return a.e1rm > b.e1rm;
}

/**
 * Reduces every training session to its single best set and returns one point
 * per session, oldest first — the series behind the e1RM line.
 */
export function buildE1RMSeries(rows: ExerciseSetRow[]): E1RMPoint[] {
  const bySession = new Map<number, E1RMPoint>();

  for (const row of rows) {
    const weight = parseFloat(row.weight);
    const reps = parseFloat(row.reps);
    const e1rm = epleyE1RM(weight, reps);
    if (e1rm <= 0) continue;   // bodyweight, time and percent sets drop out here

    const candidate: E1RMPoint = {
      workoutId: row.workoutId,
      date: row.date,
      weight,
      reps,
      e1rm,
      overEstimated: reps > EPLEY_REP_LIMIT,
    };

    const current = bySession.get(row.workoutId);
    if (!current || isBetter(candidate, current)) {
      bySession.set(row.workoutId, candidate);
    }
  }

  return [...bySession.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** Difference between the newest and the oldest point, or null if too short. */
export function e1rmTrend(points: E1RMPoint[]): number | null {
  if (points.length < 2) return null;
  return points[points.length - 1].e1rm - points[0].e1rm;
}

// ── Set formatting ─────────────────────────────────────────────

const SIDE_PREFIX: Record<string, string> = { left: 'L ', right: 'R ' };

/** Seconds as m:ss, or plain seconds below a minute. */
export function formatDuration(seconds: string | number): string {
  const total = typeof seconds === 'number' ? seconds : parseInt(seconds) || 0;
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `${total}s`;
}

/**
 * One set as it should read in a summary line, e.g. `25kg × 13`.
 * The meaning of reps/weight depends on the exercise's tracking type.
 */
export function formatSet(set: SessionSet, trackingType: string): string {
  const prefix = set.side ? SIDE_PREFIX[set.side] ?? '' : '';

  switch (trackingType) {
    case 'bodyweight':
      return `${prefix}${set.reps}×`;
    case 'time':
      return `${prefix}${formatDuration(set.reps)}`;
    case 'distance_time':
      return `${prefix}${set.weight}km · ${formatDuration(set.reps)}`;
    case 'percent':
      return `${prefix}${set.reps}%`;
    default:
      return `${prefix}${set.weight}kg × ${set.reps}`;
  }
}

/** All sets of an exercise as a single line: `25kg × 13, 30kg × 7`. */
export function summarizeSets(sets: SessionSet[], trackingType: string): string {
  return sets.map(s => formatSet(s, trackingType)).join(', ');
}

/** Total moved weight of a set list; 0 for exercises without a weight. */
export function sessionVolume(sets: SessionSet[]): number {
  return sets.reduce((sum, s) => {
    const reps = parseFloat(s.reps) || 0;
    const weight = parseFloat(s.weight) || 0;
    return sum + reps * weight;
  }, 0);
}
