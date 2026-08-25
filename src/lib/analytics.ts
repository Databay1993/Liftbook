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
 * Which set of a session represents it in the statistics.
 *
 * `first` compares like with like: the opening set is the only one trained
 * under the same conditions every time, since everything after it depends on
 * how hard the previous set was and how long the rest lasted. It assumes the
 * first set is a working set, not a warm-up.
 *
 * `best` takes the strongest set at or above the opening weight instead,
 * which tolerates warm-ups and ramp-ups — there the later set is heavier —
 * while keeping back-off sets from winning on rep count alone.
 */
export type SetRule = 'first' | 'best';

/** The weight of each session's opening set, keyed by workout. */
function openingWeights(rows: ExerciseSetRow[]): Map<number, number> {
  const opening = new Map<number, number>();
  for (const row of rows) {
    if (row.setNumber === 1) opening.set(row.workoutId, parseFloat(row.weight) || 0);
  }
  return opening;
}

/**
 * Reduces every training session to one representative set and returns one
 * point per session, oldest first — the series behind the e1RM line.
 */
export function buildE1RMSeries(rows: ExerciseSetRow[], rule: SetRule = 'first'): E1RMPoint[] {
  const bySession = new Map<number, E1RMPoint>();
  const opening = rule === 'best' ? openingWeights(rows) : null;

  for (const row of rows) {
    if (rule === 'first' && row.setNumber !== 1) continue;

    // A back-off set is not a better set, it serves a different purpose. Only
    // sets at or above the opening weight compete, which still lets warm-ups
    // and ramp-ups work — there the later set is the heavier one.
    if (opening) {
      const start = opening.get(row.workoutId) ?? 0;
      if ((parseFloat(row.weight) || 0) < start) continue;
    }

    const weight = parseFloat(row.weight);
    const reps = parseFloat(row.reps);
    const e1rm = epleyE1RM(weight, reps);
    if (e1rm <= 0) continue;   // bodyweight and time sets have no weight to work with

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

/**
 * Below this span a per-month figure would be extrapolation, not measurement:
 * a week stretched to a month multiplies every wobble by four, so a single
 * tired session turns into a dramatic-looking rate. Shorter windows report
 * the change actually observed instead.
 */
export const MIN_TREND_SPAN_DAYS = 21;

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
  /** Days covered by the basis — a rate needs enough of them to mean anything. */
  spanDays: number;
  /** True when the basis is too short for a per-month rate to be honest. */
  spanTooShort: boolean;
  /** Change across the observed window, for when a monthly rate would mislead. */
  changeOverSpan: number | null;
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

  const spanDays = basis.length >= 2
    ? daysBetween(basis[0].date, basis[basis.length - 1].date)
    : 0;
  const spanTooShort = spanDays < MIN_TREND_SPAN_DAYS;
  const perDay = reliable ? theilSenSlopePerDay(basis) : null;

  return {
    basis,
    blockStart,
    basisStart: blockStart + rampSkipped,
    rampSkipped,
    afterBreak: blocks.length > 1,
    spanDays,
    spanTooShort,
    changeOverSpan: perDay !== null ? perDay * spanDays : null,
    slopePerMonth: reliable && !spanTooShort && perDay !== null ? perDay * 30 : null,
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
/** Splits the stored comma-separated groups into a set. */
export function parseGroups(value: string | null): Set<string> {
  if (!value) return new Set();
  return new Set(value.split(',').map(g => g.trim()).filter(Boolean));
}

/** Two exercises fatigue each other when they share at least one group. */
export function sharesMuscle(a: Set<string>, b: Set<string>): boolean {
  for (const group of a) if (b.has(group)) return true;
  return false;
}

export function contextKey(
  composition: WorkoutComposition,
  exerciseName: string,
  muscleGroup: string | null,
): string | null {
  const index = composition.exercises.findIndex(e => e.name === exerciseName);
  if (index < 0) return null;

  const own = parseGroups(muscleGroup);
  if (own.size === 0) return null;

  const preceding = composition.exercises
    .slice(0, index)
    .filter(e => sharesMuscle(own, parseGroups(e.muscleGroup)))
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

// ── Where an exercise sat in the workout ───────────────────────

export type PositionPoint = {
  workoutId: number;
  date: string;
  /** 1-based position among that workout's exercises. */
  position: number;
  total: number;
};

/** The position an exercise held in each session, oldest first. */
export function positionSeries(
  compositions: WorkoutComposition[],
  exerciseName: string,
): PositionPoint[] {
  return compositions
    .map(c => {
      const index = c.exercises.findIndex(e => e.name === exerciseName);
      if (index < 0) return null;
      return {
        workoutId: c.workoutId,
        date: c.date,
        position: index + 1,
        total: c.exercises.length,
      };
    })
    .filter((p): p is PositionPoint => p !== null)
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** How often each position occurred, most frequent first. */
export function positionCounts(points: PositionPoint[]): { position: number; count: number }[] {
  const counts = new Map<number, number>();
  for (const p of points) counts.set(p.position, (counts.get(p.position) ?? 0) + 1);
  return [...counts.entries()]
    .map(([position, count]) => ({ position, count }))
    .sort((a, b) => b.count - a.count || a.position - b.position);
}

// ── Predicting what a weight should be good for ────────────────

/**
 * The level to expect from a context right now: the median of its three most
 * recent sessions, so one outstanding or one miserable day does not set the
 * expectation on its own.
 */
export function contextReference(group: ContextGroup | undefined | null): number | null {
  if (!group || group.points.length === 0) return null;
  return median(group.points.slice(-3).map(p => p.e1rm));
}

export type RepsEstimate = {
  reps: number;
  /** Sessions the estimate is based on. */
  sessions: number;
  /** False when no session shared today's fatigue context. */
  contextMatched: boolean;
  /** The context the estimate came from, for labelling. */
  preceding: string[];
  /** Date of the session used, when the estimate rests on a single one. */
  sourceDate: string | null;
};

/**
 * How many reps a weight should be good for, given how the exercise went in
 * comparable sessions.
 *
 * Rowing after pull-ups and rowing done fresh are different situations, so
 * the estimate prefers sessions trained under today's fatigue context and
 * only falls back to the overall picture when there are none — saying so
 * rather than quietly mixing the two.
 */
export function estimateReps(
  analysis: ContextAnalysis,
  todayKey: string | null,
  weight: number,
): RepsEstimate | null {
  if (!(weight > 0)) return null;

  const matching = todayKey === null
    ? undefined
    : analysis.groups.find(g => g.key === todayKey);

  const toReps = (reference: number) => {
    const reps = Math.round((reference / weight - 1) * 30);
    return reps >= 1 && reps <= 50 ? reps : null;
  };

  if (matching) {
    const reference = contextReference(matching);
    const reps = reference === null ? null : toReps(reference);
    if (reps === null) return null;
    return {
      reps,
      sessions: matching.points.length,
      contextMatched: true,
      preceding: matching.preceding,
      sourceDate: null,   // a median of up to three sessions, not one date
    };
  }

  // No session was trained in today's order. Averaging a different context
  // would hide that, so the most recent session is used instead: it is one
  // concrete workout the number can be traced back to.
  const latest = analysis.groups
    .flatMap(g => g.points.map(p => ({ point: p, group: g })))
    .sort((a, b) => a.point.date.localeCompare(b.point.date))
    .pop();
  if (!latest) return null;

  const reps = toReps(latest.point.e1rm);
  if (reps === null) return null;

  return {
    reps,
    sessions: 1,
    contextMatched: false,
    preceding: latest.group.preceding,
    sourceDate: latest.point.date,
  };
}

// ── Extra measurements ─────────────────────────────────────────

export type MetricPoint = { workoutId: number; date: string; value: number };

/**
 * One point per session for a user-defined field.
 *
 * The session's highest value is taken rather than its first: these are
 * measurements, not planned loads, and a field called peak power means the
 * peak. A weak opening set should not represent the session.
 */
export function buildMetricSeries(
  rows: { workoutId: number; date: string; extras: Record<string, string> }[],
  fieldId: string,
): MetricPoint[] {
  const best = new Map<number, MetricPoint>();

  for (const row of rows) {
    const raw = row.extras?.[fieldId];
    const value = raw === undefined ? NaN : parseFloat(raw.replace(',', '.'));
    if (!isFinite(value)) continue;

    const current = best.get(row.workoutId);
    if (!current || value > current.value) {
      best.set(row.workoutId, { workoutId: row.workoutId, date: row.date, value });
    }
  }

  return [...best.values()].sort((a, b) => a.date.localeCompare(b.date));
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
      return `${prefix}${set.weight}% × ${set.reps}`;
    default:
      return `${prefix}${set.weight}kg × ${set.reps}`;
  }
}

/**
 * All sets of an exercise as a single line: `25kg × 13, 30kg × 7`.
 * Extra measurements are appended per set, labelled by their unit where one
 * was given, so a line stays readable without repeating field names.
 */
export function summarizeSets(
  sets: SessionSet[],
  trackingType: string,
  extraFields: { id: string; label: string; unit: string }[] = [],
): string {
  return sets
    .map(s => {
      const base = formatSet(s, trackingType);
      const extras = extraFields
        .map(f => {
          const value = s.extras?.[f.id];
          return value ? `${value}${f.unit ? f.unit : ''}` : null;
        })
        .filter(Boolean);
      return extras.length > 0 ? `${base} (${extras.join(', ')})` : base;
    })
    .join(', ');
}

/**
 * Total weight moved. Only exercises actually loaded in kilos count — a
 * percentage times reps, or kilometres times seconds, is not a volume and
 * would quietly inflate the total.
 */
export function sessionVolume(sets: SessionSet[], trackingType = 'weight_reps'): number {
  if (trackingType !== 'weight_reps') return 0;
  return sets.reduce((sum, s) => {
    const reps = parseFloat(s.reps) || 0;
    const weight = parseFloat(s.weight) || 0;
    return sum + reps * weight;
  }, 0);
}
