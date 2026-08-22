/**
 * Pure data preparation for the stats screen.
 *
 * Nothing in here touches React, the database or i18n — everything is a plain
 * function over plain data, so it can be reasoned about (and tested) on its own.
 */

import type { ExerciseSetRow, SessionSet, WorkoutComposition } from '../storage/database';

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

// ── Trend analysis ─────────────────────────────────────────────

const DAY_MS = 86400000;

/** A pause this long ends a training block and starts a new one. */
export const BLOCK_GAP_DAYS = 21;

/**
 * Coming back after a break means deliberately starting light, which reads as
 * a steep improvement without any strength being gained. The opening sessions
 * of a block are therefore shown but kept out of every trend calculation.
 */
export const RAMP_SESSIONS = 2;

/** Fewer usable sessions than this and no trend is claimed at all. */
export const MIN_TREND_POINTS = 3;

/**
 * Two sessions a day apart produce wild slopes (a 2kg step over one day reads
 * as +60kg/month), so close pairs are left out of the slope estimate.
 */
export const MIN_PAIR_DAYS = 7;

/** Half-life-ish constant of the smoothed curve, in days. */
export const EWMA_TAU_DAYS = 21;

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((new Date(toIso).getTime() - new Date(fromIso).getTime()) / DAY_MS);
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Splits a series wherever training paused for longer than BLOCK_GAP_DAYS. */
export function splitBlocks(points: E1RMPoint[]): E1RMPoint[][] {
  if (points.length === 0) return [];
  const blocks: E1RMPoint[][] = [[points[0]]];
  for (let i = 1; i < points.length; i++) {
    const gap = daysBetween(points[i - 1].date, points[i].date);
    if (gap > BLOCK_GAP_DAYS) blocks.push([points[i]]);
    else blocks[blocks.length - 1].push(points[i]);
  }
  return blocks;
}

/**
 * Theil–Sen slope: the median of all pairwise slopes, scaled to kg per 30 days.
 * Taking the median instead of a least-squares fit means one terrible day
 * cannot drag the result — it shifts many pairs, but the middle one barely.
 */
function theilSenSlopePerDay(points: E1RMPoint[]): number | null {
  if (points.length < 2) return null;

  const slopes: number[] = [];
  const fallback: number[] = [];
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const days = daysBetween(points[i].date, points[j].date);
      if (days <= 0) continue;
      const slope = (points[j].e1rm - points[i].e1rm) / days;
      fallback.push(slope);
      if (days >= MIN_PAIR_DAYS) slopes.push(slope);
    }
  }

  const usable = slopes.length > 0 ? slopes : fallback;
  return usable.length > 0 ? median(usable) : null;
}

export function theilSenPerMonth(points: E1RMPoint[]): number | null {
  const perDay = theilSenSlopePerDay(points);
  return perDay === null ? null : perDay * 30;
}

export type TrendLine = {
  from: { date: string; value: number };
  to: { date: string; value: number };
};

/**
 * The Theil–Sen line as two endpoints, ready to draw. The offset is the median
 * residual, which keeps the line centred on the points instead of pinned to
 * whichever one happens to come first.
 */
export function theilSenLine(points: E1RMPoint[]): TrendLine | null {
  const slope = theilSenSlopePerDay(points);
  if (slope === null || points.length < 2) return null;

  const anchor = points[0].date;
  const offset = median(points.map(p => p.e1rm - slope * daysBetween(anchor, p.date)));
  const last = points[points.length - 1];

  return {
    from: { date: anchor, value: offset },
    to: { date: last.date, value: offset + slope * daysBetween(anchor, last.date) },
  };
}

export type CompareGroups = {
  previous: { points: E1RMPoint[]; avg: number };
  recent: { points: E1RMPoint[]; avg: number };
  delta: number;
};

/** The two groups behind the Ø3-vs-Ø3 figure, so the chart can show them. */
export function blockCompareGroups(points: E1RMPoint[], size = 3): CompareGroups | null {
  if (points.length < size * 2) return null;
  const avg = (arr: E1RMPoint[]) => arr.reduce((s, p) => s + p.e1rm, 0) / arr.length;

  const recent = points.slice(-size);
  const previous = points.slice(-size * 2, -size);

  return {
    previous: { points: previous, avg: avg(previous) },
    recent: { points: recent, avg: avg(recent) },
    delta: avg(recent) - avg(previous),
  };
}

/** Average of the last `size` sessions minus the average of the `size` before. */
export function blockCompare(points: E1RMPoint[], size = 3): number | null {
  return blockCompareGroups(points, size)?.delta ?? null;
}

/**
 * Time-aware exponential smoothing: the weight of a new session depends on how
 * long ago the previous one was, so a session after three weeks off moves the
 * curve more than one on the very next day.
 */
export function ewmaSeries(points: E1RMPoint[], tau = EWMA_TAU_DAYS): { date: string; value: number }[] {
  const out: { date: string; value: number }[] = [];
  let value: number | null = null;
  let prevDate: string | null = null;

  for (const p of points) {
    if (value === null || prevDate === null) {
      value = p.e1rm;
    } else {
      const dt = Math.max(daysBetween(prevDate, p.date), 0);
      const weight = 1 - Math.exp(-dt / tau);
      value = value + weight * (p.e1rm - value);
    }
    prevDate = p.date;
    out.push({ date: p.date, value });
  }
  return out;
}

export type TrendSummary = {
  /** Points the trend was actually computed from. */
  basis: E1RMPoint[];
  /** Index into the full series where the current training block starts. */
  blockStart: number;
  /** Index into the full series where the trend basis starts. */
  basisStart: number;
  /** How many opening sessions were held back as ramp-up. */
  rampSkipped: number;
  /** True once a genuine pause split the series. */
  afterBreak: boolean;
  slopePerMonth: number | null;
  /** The same slope as two endpoints, for drawing. */
  slopeLine: TrendLine | null;
  blockDelta: number | null;
  /** The two averaged groups behind blockDelta. */
  groups: CompareGroups | null;
  ewma: { date: string; value: number }[];
  ewmaNow: number | null;
  /** False when there is too little to say anything honest. */
  reliable: boolean;
};

/**
 * Everything the UI needs to describe progress, with the ramp-up problem
 * already handled: only the current block counts, and its opening sessions
 * are excluded from the numbers while staying visible in the chart.
 */
export function summarizeTrend(points: E1RMPoint[]): TrendSummary {
  const blocks = splitBlocks(points);
  const current = blocks.length > 0 ? blocks[blocks.length - 1] : [];
  const blockStart = points.length - current.length;

  const canSkipRamp = current.length >= RAMP_SESSIONS + MIN_TREND_POINTS;
  const rampSkipped = canSkipRamp ? RAMP_SESSIONS : 0;
  const basis = current.slice(rampSkipped);

  const reliable = basis.length >= MIN_TREND_POINTS;
  const smoothed = ewmaSeries(current);
  const groups = reliable ? blockCompareGroups(basis) : null;

  return {
    basis,
    blockStart,
    basisStart: blockStart + rampSkipped,
    rampSkipped,
    afterBreak: blocks.length > 1,
    slopePerMonth: reliable ? theilSenPerMonth(basis) : null,
    slopeLine: reliable ? theilSenLine(basis) : null,
    blockDelta: groups?.delta ?? null,
    groups,
    ewma: smoothed,
    ewmaNow: smoothed.length > 0 ? smoothed[smoothed.length - 1].value : null,
    reliable,
  };
}

// ── Fatigue context ────────────────────────────────────────────

/**
 * Rowing done after pull-ups is not the same exercise as rowing done fresh —
 * the back is already tired. What matters is not the position in the workout
 * but which exercises for the *same muscle group* came before: three leg
 * exercises leave the back just as fresh as starting with rowing.
 *
 * Sessions are therefore grouped by that set of preceding same-group
 * exercises, and only sessions sharing a group get compared. Order among them
 * is ignored — pull-up→lat-pulldown→row counts the same as the reverse, which
 * keeps groups large enough to say anything.
 */
export function contextKey(
  composition: WorkoutComposition,
  exerciseName: string,
  muscleGroup: string | null,
): string | null {
  const index = composition.exercises.findIndex(e => e.name === exerciseName);
  if (index < 0) return null;

  const preceding = composition.exercises
    .slice(0, index)
    .filter(e => muscleGroup !== null && e.muscleGroup === muscleGroup)
    .map(e => e.name)
    .sort();

  return preceding.join(' + ');   // '' means nothing tired this muscle first
}

export type ContextGroup = {
  key: string;
  /** Exercises that preceded this one, for display. */
  preceding: string[];
  points: E1RMPoint[];
};

export type ContextAnalysis = {
  groups: ContextGroup[];
  /** The group the most recent session belongs to — the one to judge by. */
  currentKey: string | null;
  /** True when at least one workout's exercise order had to be inferred. */
  orderInferred: boolean;
};

/**
 * Splits an exercise's sessions into comparable groups by fatigue context,
 * largest group first, with the current context flagged.
 */
export function analyzeContexts(
  points: E1RMPoint[],
  compositions: WorkoutComposition[],
  exerciseName: string,
  muscleGroup: string | null,
): ContextAnalysis {
  const byWorkout = new Map(compositions.map(c => [c.workoutId, c]));
  const buckets = new Map<string, ContextGroup>();
  let currentKey: string | null = null;
  let orderInferred = false;

  for (const point of points) {
    const composition = byWorkout.get(point.workoutId);
    if (!composition) continue;
    if (composition.orderInferred) orderInferred = true;

    const key = contextKey(composition, exerciseName, muscleGroup);
    if (key === null) continue;

    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { key, preceding: key === '' ? [] : key.split(' + '), points: [] };
      buckets.set(key, bucket);
    }
    bucket.points.push(point);
    currentKey = key;   // points are ordered oldest first, so the last wins
  }

  const groups = [...buckets.values()].sort((a, b) => b.points.length - a.points.length);
  return { groups, currentKey, orderInferred };
}

/** Average e1RM of a group, for comparing contexts against each other. */
export function groupAverage(group: ContextGroup): number {
  if (group.points.length === 0) return 0;
  return group.points.reduce((s, p) => s + p.e1rm, 0) / group.points.length;
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
