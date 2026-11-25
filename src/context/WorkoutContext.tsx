import React, { createContext, useContext, useState } from 'react';
import { ExerciseEntry } from '../types';
import { createWorkoutRecord, deleteWorkout } from '../storage/database';

/** `note` is the plan's note, carried along so it is readable while training. */
type ActiveWorkout = {
  date: string;
  workoutId: number;
  exercises: ExerciseEntry[];
  note: string;
};

interface WorkoutContextType {
  activeWorkout: ActiveWorkout | null;
  startWorkout: (templateExercises?: string[], note?: string) => Promise<void>;
  cancelWorkout: () => Promise<void>;
  setActiveWorkout: React.Dispatch<React.SetStateAction<ActiveWorkout | null>>;
}

const WorkoutContext = createContext<WorkoutContextType>({
  activeWorkout: null,
  startWorkout: async () => {},
  cancelWorkout: async () => {},
  setActiveWorkout: () => {},
});

export function WorkoutProvider({ children }: { children: React.ReactNode }) {
  const [activeWorkout, setActiveWorkout] = useState<ActiveWorkout | null>(null);

  async function startWorkout(templateExercises?: string[], note = '') {
    const date = new Date().toISOString();
    const workoutId = await createWorkoutRecord(date);
    const exercises: ExerciseEntry[] = (templateExercises ?? []).map(name => ({
      name,
      trackingType: 'weight_reps' as const,
      sets: [],
      isCompleted: false,
    }));
    setActiveWorkout({ date, workoutId, exercises, note });
  }

  async function cancelWorkout() {
    if (activeWorkout?.workoutId) {
      try { await deleteWorkout(activeWorkout.workoutId); } catch { /* ignore */ }
    }
    setActiveWorkout(null);
  }

  return (
    <WorkoutContext.Provider value={{ activeWorkout, startWorkout, cancelWorkout, setActiveWorkout }}>
      {children}
    </WorkoutContext.Provider>
  );
}

export function useWorkout() {
  return useContext(WorkoutContext);
}
