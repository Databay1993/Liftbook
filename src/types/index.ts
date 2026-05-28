export type TrackingType = 'weight_reps' | 'bodyweight' | 'time' | 'distance_time';

export interface Set {
  reps: string;      // reps (weight_reps/bodyweight) or duration in sec (time/distance_time)
  weight: string;    // kg (weight_reps) or km (distance_time) – empty for others
  isDone: boolean;
}

export interface ExerciseEntry {
  name: string;
  trackingType: TrackingType;
  sets: Set[];
  isCompleted: boolean;
}

export interface Workout {
  id?: number;
  date: string;
  exercises: ExerciseEntry[];
}

export interface HistorySession {
  id: number;
  date: string;
  sets: { reps: string; weight: string }[];
}

export interface ExerciseHistory {
  name: string;
  sessions: HistorySession[];
}

export type SyncStatus = 'idle' | 'syncing' | 'error';
