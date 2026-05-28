import React, { createContext, useContext, useState } from 'react';
import { ExerciseEntry } from '../types';
import { createWorkoutRecord, deleteWorkout } from '../storage/database';

interface WorkoutContextType {
  activeWorkout: { date: string; workoutId: number; exercises: ExerciseEntry[] } | null;
  startWorkout: (templateExercises?: string[]) => Promise<void>;
  cancelWorkout: () => Promise<void>;
  setActiveWorkout: React.Dispatch<React.SetStateAction<{ date: string; workoutId: number; exercises: ExerciseEntry[] } | null>>;
}

const WorkoutContext = createContext<WorkoutContextType>({
  activeWorkout: null,
  startWorkout: async () => {},
  cancelWorkout: async () => {},
  setActiveWorkout: () => {},
});

export function WorkoutProvider({ children }: { children: React.ReactNode }) {
  const [activeWorkout, setActiveWorkout] = useState<{
    date: string;
    workoutId: number;
    exercises: ExerciseEntry[];
  } | null>(null);

  async function startWorkout(templateExercises?: string[]) {
    const date = new Date().toISOString();
    const workoutId = await createWorkoutRecord(date);
    const exercises: ExerciseEntry[] = (templateExercises ?? []).map(name => ({
      name,
      trackingType: 'weight_reps' as const,
      sets: [],
      isCompleted: false,
    }));
    setActiveWorkout({ date, workoutId, exercises });
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
