import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase;

export async function getDb() {
  if (!db) {
    db = await SQLite.openDatabaseAsync('liftbook.db');
  }
  return db;
}

export async function initDb() {
  const db = await getDb();

  // Run each statement separately – more reliable across expo-sqlite versions
  await db.execAsync('PRAGMA journal_mode = WAL;');
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS exercises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      is_custom INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS workouts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL
    );
  `);
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS sets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workout_id INTEGER NOT NULL,
      exercise_name TEXT NOT NULL,
      set_number INTEGER NOT NULL,
      reps TEXT NOT NULL,
      weight TEXT NOT NULL,
      FOREIGN KEY (workout_id) REFERENCES workouts(id) ON DELETE CASCADE
    );
  `);

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS template_exercises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      template_id INTEGER NOT NULL,
      exercise_name TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE CASCADE
    );
  `);

  // Migration: add tracking_type column if missing
  try {
    await db.execAsync(`ALTER TABLE exercises ADD COLUMN tracking_type TEXT DEFAULT 'weight_reps';`);
  } catch { /* column already exists */ }

  // Migration: add per-exercise rest time (nullable = use global setting)
  try {
    await db.execAsync(`ALTER TABLE exercises ADD COLUMN rest_time INTEGER DEFAULT NULL;`);
  } catch { /* column already exists */ }

  // Migration: add left/right side tracking flag to exercises
  try {
    await db.execAsync(`ALTER TABLE exercises ADD COLUMN has_sides INTEGER DEFAULT 0;`);
  } catch { /* column already exists */ }

  // Migration: add side column to sets for L/R tracking
  try {
    await db.execAsync(`ALTER TABLE sets ADD COLUMN side TEXT DEFAULT NULL;`);
  } catch { /* column already exists */ }

  // Migration: add workout_id tracking to workouts (already exists)
  // Seed default exercises if empty
  const count = await db.getFirstAsync<{ c: number }>(
    'SELECT COUNT(*) as c FROM exercises'
  );
  if (count && count.c === 0) {
    const defaults = [
      'Bench Press', 'Squat', 'Deadlift', 'Overhead Press',
      'Pull-Up', 'Barbell Row', 'Bicep Curl', 'Tricep Pushdown',
      'Leg Press', 'Lat Pulldown',
    ];
    await db.runAsync(
      `INSERT OR IGNORE INTO exercises (name, is_custom) VALUES ${defaults.map(() => '(?, 0)').join(',')}`,
      ...defaults
    );
  }
}

// ── Exercises ──────────────────────────────────────────────────

export async function getAllExercises(): Promise<{ id: number; name: string; isCustom: boolean; trackingType: string; restTime: number | null; hasSides: boolean }[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ id: number; name: string; is_custom: number; tracking_type: string; rest_time: number | null; has_sides: number }>(
    'SELECT * FROM exercises ORDER BY is_custom ASC, name ASC'
  );
  return rows.map(r => ({
    id: r.id,
    name: r.name,
    isCustom: r.is_custom === 1,
    trackingType: r.tracking_type ?? 'weight_reps',
    restTime: r.rest_time ?? null,
    hasSides: r.has_sides === 1,
  }));
}

export async function updateExerciseHasSides(name: string, hasSides: boolean): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE exercises SET has_sides = ? WHERE name = ?', hasSides ? 1 : 0, name);
}

export async function updateExerciseRestTime(name: string, restTime: number | null): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE exercises SET rest_time = ? WHERE name = ?', restTime, name);
}

export async function updateExerciseTrackingType(name: string, trackingType: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE exercises SET tracking_type = ? WHERE name = ?', trackingType, name);
}

export async function addCustomExercise(name: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('INSERT INTO exercises (name, is_custom) VALUES (?, 1)', name.trim());
}

export async function deleteCustomExercise(name: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM exercises WHERE name = ? AND is_custom = 1', name);
}

export async function renameExercise(oldName: string, newName: string): Promise<void> {
  const db = await getDb();
  const trimmed = newName.trim();
  await db.runAsync('UPDATE exercises SET name = ? WHERE name = ?', trimmed, oldName);
  await db.runAsync('UPDATE sets SET exercise_name = ? WHERE exercise_name = ?', trimmed, oldName);
  await db.runAsync('UPDATE template_exercises SET exercise_name = ? WHERE exercise_name = ?', trimmed, oldName);
}

// ── Workouts / Sets ────────────────────────────────────────────

// Create workout record immediately on start → enables auto-save per exercise
export async function createWorkoutRecord(date: string): Promise<number> {
  const db = await getDb();
  const result = await db.runAsync('INSERT INTO workouts (date) VALUES (?)', date);
  return result.lastInsertRowId;
}

// Save (or overwrite) sets for one exercise in an existing workout
export async function saveExerciseSets(
  workoutId: number,
  exerciseName: string,
  sets: { reps: string; weight: string; side?: string }[],
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'DELETE FROM sets WHERE workout_id = ? AND exercise_name = ?',
    workoutId, exerciseName,
  );
  for (let i = 0; i < sets.length; i++) {
    const s = sets[i];
    await db.runAsync(
      'INSERT INTO sets (workout_id, exercise_name, set_number, reps, weight, side) VALUES (?, ?, ?, ?, ?, ?)',
      workoutId, exerciseName, i + 1, s.reps, s.weight, s.side ?? null,
    );
  }
}

export async function saveWorkout(
  date: string,
  exercises: { name: string; sets: { reps: string; weight: string }[] }[]
): Promise<void> {
  const db = await getDb();
  const result = await db.runAsync('INSERT INTO workouts (date) VALUES (?)', date);
  const workoutId = result.lastInsertRowId;

  for (const ex of exercises) {
    for (let i = 0; i < ex.sets.length; i++) {
      const s = ex.sets[i];
      await db.runAsync(
        'INSERT INTO sets (workout_id, exercise_name, set_number, reps, weight) VALUES (?, ?, ?, ?, ?)',
        workoutId, ex.name, i + 1, s.reps, s.weight
      );
    }
  }
}

export async function deleteWorkout(workoutId: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM workouts WHERE id = ?', workoutId);
}

// ── History ────────────────────────────────────────────────────

export type HistoryRow = {
  workoutId: number;
  date: string;
  exerciseName: string;
  setNumber: number;
  reps: string;
  weight: string;
};

export async function getHistory(): Promise<HistoryRow[]> {
  const db = await getDb();
  return db.getAllAsync<HistoryRow>(`
    SELECT
      w.id as workoutId,
      w.date,
      s.exercise_name as exerciseName,
      s.set_number as setNumber,
      s.reps,
      s.weight
    FROM workouts w
    JOIN sets s ON s.workout_id = w.id
    ORDER BY w.date DESC, s.exercise_name ASC, s.set_number ASC
  `);
}

export async function getLastSessionForExercise(
  name: string
): Promise<{ date: string; sets: { reps: string; weight: string; side?: string }[] } | null> {
  const db = await getDb();
  const latest = await db.getFirstAsync<{ workoutId: number; date: string }>(`
    SELECT w.id as workoutId, w.date
    FROM workouts w
    JOIN sets s ON s.workout_id = w.id
    WHERE s.exercise_name = ?
    ORDER BY w.date DESC
    LIMIT 1
  `, name);

  if (!latest) return null;

  const rawSets = await db.getAllAsync<{ reps: string; weight: string; side: string | null }>(
    'SELECT reps, weight, side FROM sets WHERE workout_id = ? AND exercise_name = ? ORDER BY set_number ASC',
    latest.workoutId, name
  );

  return {
    date: latest.date,
    sets: rawSets.map(s => ({ reps: s.reps, weight: s.weight, ...(s.side ? { side: s.side } : {}) })),
  };
}

// ── Last workout detail ────────────────────────────────────────

export type LastWorkoutExercise = {
  name: string;
  sets: { reps: string; weight: string }[];
};

export async function getLastWorkoutDetail(): Promise<{
  date: string;
  exercises: LastWorkoutExercise[];
} | null> {
  const db = await getDb();
  const latest = await db.getFirstAsync<{ id: number; date: string }>(
    'SELECT id, date FROM workouts ORDER BY date DESC LIMIT 1'
  );
  if (!latest) return null;

  const rows = await db.getAllAsync<{ exercise_name: string; reps: string; weight: string }>(
    `SELECT exercise_name, reps, weight FROM sets
     WHERE workout_id = ? ORDER BY exercise_name ASC, set_number ASC`,
    latest.id
  );

  const exMap: Record<string, LastWorkoutExercise> = {};
  for (const row of rows) {
    if (!exMap[row.exercise_name]) exMap[row.exercise_name] = { name: row.exercise_name, sets: [] };
    exMap[row.exercise_name].sets.push({ reps: row.reps, weight: row.weight });
  }

  return { date: latest.date, exercises: Object.values(exMap) };
}

// ── Progress per exercise ──────────────────────────────────────

export type ProgressPoint = {
  date: string;
  maxWeight: number;
  maxReps: number;
  totalVolume: number;
  best1RM: number;   // best estimated 1RM = weight × (1 + reps/30)
};

export async function getExerciseProgress(exerciseName: string): Promise<ProgressPoint[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    date: string;
    maxWeight: number;
    maxReps: number;
    totalVolume: number;
    best1RM: number;
  }>(`
    SELECT
      w.date,
      MAX(CAST(s.weight AS REAL)) as maxWeight,
      MAX(CAST(s.reps   AS REAL)) as maxReps,
      SUM(CAST(s.weight AS REAL) * CAST(s.reps AS REAL)) as totalVolume,
      MAX(CAST(s.weight AS REAL) * (1.0 + CAST(s.reps AS REAL) / 30.0)) as best1RM
    FROM workouts w
    JOIN sets s ON s.workout_id = w.id
    WHERE s.exercise_name = ?
    GROUP BY w.id
    ORDER BY w.date ASC
  `, exerciseName);

  return rows.map(r => ({
    date: r.date,
    maxWeight: r.maxWeight ?? 0,
    maxReps: r.maxReps ?? 0,
    totalVolume: r.totalVolume ?? 0,
    best1RM: r.best1RM ?? 0,
  }));
}

// ── Raw sets per exercise (for e1RM analysis) ─────────────────

export type ExerciseSetRow = {
  workoutId: number;
  date: string;
  reps: string;
  weight: string;
};

export async function getExerciseSets(exerciseName: string): Promise<ExerciseSetRow[]> {
  const db = await getDb();
  return db.getAllAsync<ExerciseSetRow>(`
    SELECT
      w.id   as workoutId,
      w.date as date,
      s.reps,
      s.weight
    FROM workouts w
    JOIN sets s ON s.workout_id = w.id
    WHERE s.exercise_name = ?
    ORDER BY w.date ASC, s.set_number ASC
  `, exerciseName);
}

// ── Recent sessions (last N workouts with full set detail) ────

export type SessionSet = { reps: string; weight: string; side: string | null };
export type SessionExercise = { name: string; trackingType: string; sets: SessionSet[] };
export type SessionDetail = { workoutId: number; date: string; exercises: SessionExercise[] };

export async function getRecentWorkouts(limit = 2): Promise<SessionDetail[]> {
  const db = await getDb();
  const workouts = await db.getAllAsync<{ id: number; date: string }>(`
    SELECT w.id, w.date
    FROM workouts w
    WHERE EXISTS (SELECT 1 FROM sets s WHERE s.workout_id = w.id)
    ORDER BY w.date DESC, w.id DESC
    LIMIT ?
  `, limit);

  const sessions: SessionDetail[] = [];
  for (const w of workouts) {
    const rows = await db.getAllAsync<{
      exercise_name: string;
      tracking_type: string | null;
      reps: string;
      weight: string;
      side: string | null;
    }>(`
      SELECT s.exercise_name, e.tracking_type, s.reps, s.weight, s.side
      FROM sets s
      LEFT JOIN exercises e ON e.name = s.exercise_name
      WHERE s.workout_id = ?
      ORDER BY s.set_number ASC
    `, w.id);

    const order: string[] = [];
    const exMap: Record<string, SessionExercise> = {};
    for (const r of rows) {
      if (!exMap[r.exercise_name]) {
        exMap[r.exercise_name] = {
          name: r.exercise_name,
          trackingType: r.tracking_type ?? 'weight_reps',
          sets: [],
        };
        order.push(r.exercise_name);
      }
      exMap[r.exercise_name].sets.push({ reps: r.reps, weight: r.weight, side: r.side });
    }

    sessions.push({ workoutId: w.id, date: w.date, exercises: order.map(n => exMap[n]) });
  }
  return sessions;
}

// ── Progress by weight (reps per weight per session) ──────────

export type ProgressByWeightRow = {
  date: string;
  weight: number;
  maxReps: number;
};

export async function getExerciseProgressByWeight(
  exerciseName: string,
): Promise<ProgressByWeightRow[]> {
  const db = await getDb();
  return db.getAllAsync<ProgressByWeightRow>(`
    SELECT
      w.date,
      ROUND(CAST(s.weight AS REAL), 1) as weight,
      MAX(CAST(s.reps AS REAL)) as maxReps
    FROM workouts w
    JOIN sets s ON s.workout_id = w.id
    WHERE s.exercise_name = ?
      AND CAST(s.weight AS REAL) > 0
      AND CAST(s.reps   AS REAL) > 0
    GROUP BY w.id, ROUND(CAST(s.weight AS REAL), 1)
    ORDER BY w.date ASC, weight ASC
  `, exerciseName);
}

// ── Import / Export ────────────────────────────────────────────

export async function exportAllData(): Promise<string> {
  const db = await getDb();
  const workouts = await db.getAllAsync<{ id: number; date: string }>('SELECT * FROM workouts ORDER BY date ASC');
  const sets = await db.getAllAsync<{ workout_id: number; exercise_name: string; set_number: number; reps: string; weight: string }>(
    'SELECT * FROM sets ORDER BY workout_id ASC, set_number ASC'
  );
  const customExercises = await db.getAllAsync<{ name: string }>(
    'SELECT name FROM exercises WHERE is_custom = 1'
  );

  return JSON.stringify({
    version: 1,
    exportedAt: new Date().toISOString(),
    workouts,
    sets,
    customExercises: customExercises.map(e => e.name),
  }, null, 2);
}

export async function importData(json: string): Promise<void> {
  const parsed = JSON.parse(json);
  if (!parsed.workouts || !parsed.sets) throw new Error('Invalid format');

  const db = await getDb();

  for (const w of parsed.workouts) {
    await db.runAsync('INSERT OR IGNORE INTO workouts (id, date) VALUES (?, ?)', w.id, w.date);
  }
  for (const s of parsed.sets) {
    await db.runAsync(
      'INSERT OR IGNORE INTO sets (workout_id, exercise_name, set_number, reps, weight) VALUES (?, ?, ?, ?, ?)',
      s.workout_id, s.exercise_name, s.set_number, s.reps, s.weight
    );
  }
  if (parsed.customExercises) {
    for (const name of parsed.customExercises) {
      await db.runAsync('INSERT OR IGNORE INTO exercises (name, is_custom) VALUES (?, 1)', name);
    }
  }
}

// ── Templates ──────────────────────────────────────────────────

export type Template = {
  id: number;
  name: string;
  exercises: string[];
};

export async function getTemplates(): Promise<Template[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ id: number; name: string }>(
    'SELECT * FROM templates ORDER BY created_at ASC'
  );
  const templates: Template[] = [];
  for (const row of rows) {
    const exRows = await db.getAllAsync<{ exercise_name: string }>(
      'SELECT exercise_name FROM template_exercises WHERE template_id = ? ORDER BY sort_order ASC',
      row.id
    );
    templates.push({ id: row.id, name: row.name, exercises: exRows.map(e => e.exercise_name) });
  }
  return templates;
}

export async function createTemplate(name: string, exercises: string[]): Promise<void> {
  const db = await getDb();
  const result = await db.runAsync('INSERT INTO templates (name) VALUES (?)', name.trim());
  const templateId = result.lastInsertRowId;
  for (let i = 0; i < exercises.length; i++) {
    await db.runAsync(
      'INSERT INTO template_exercises (template_id, exercise_name, sort_order) VALUES (?, ?, ?)',
      templateId, exercises[i], i
    );
  }
}

export async function updateTemplate(id: number, name: string, exercises: string[]): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE templates SET name = ? WHERE id = ?', name.trim(), id);
  await db.runAsync('DELETE FROM template_exercises WHERE template_id = ?', id);
  for (let i = 0; i < exercises.length; i++) {
    await db.runAsync(
      'INSERT INTO template_exercises (template_id, exercise_name, sort_order) VALUES (?, ?, ?)',
      id, exercises[i], i
    );
  }
}

export async function deleteTemplate(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM templates WHERE id = ?', id);
}

// ── Last workout date ──────────────────────────────────────────

export async function getLastWorkoutDate(): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ date: string }>(
    'SELECT date FROM workouts ORDER BY date DESC LIMIT 1'
  );
  return row?.date ?? null;
}
