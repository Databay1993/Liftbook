import { useState, useRef, useEffect } from 'react';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';

export function useTimer() {
  const [seconds, setSeconds] = useState<number | null>(null);
  const [maxSeconds, setMaxSeconds] = useState(90);
  const endAtRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function start(duration: number) {
    if (intervalRef.current) clearInterval(intervalRef.current);
    endAtRef.current = Date.now() + duration * 1000;
    setMaxSeconds(duration);
    setSeconds(duration);

    intervalRef.current = setInterval(() => {
      const remaining = Math.max(0, Math.round((endAtRef.current! - Date.now()) / 1000));
      setSeconds(remaining);
      if (remaining <= 0) {
        clearInterval(intervalRef.current!);
        intervalRef.current = null;
        playBeep();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        setTimeout(() => setSeconds(null), 1500);
      }
    }, 500);
  }

  function cancel() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    endAtRef.current = null;
    setSeconds(null);
  }

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

  return { seconds, maxSeconds, start, cancel };
}

async function playBeep() {
  try {
    await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
  } catch {}
}
