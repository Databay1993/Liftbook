import { useState, useRef, useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import * as Haptics from 'expo-haptics';

// Show notifications even when app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: false,
    shouldShowBanner: false,
    shouldShowList: false,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

const NOTIF_ID_KEY = 'rest_timer_notif';

export function useTimer() {
  const [seconds, setSeconds] = useState<number | null>(null);
  const [maxSeconds, setMaxSeconds] = useState(90);
  const endAtRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const notifIdRef = useRef<string | null>(null);

  async function scheduleWakeNotif(duration: number) {
    // Cancel any previous notification
    if (notifIdRef.current) {
      await Notifications.cancelScheduledNotificationAsync(notifIdRef.current).catch(() => {});
    }
    // Schedule a new one — fires even when screen is locked
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: '💪 Liftbook — Pause vorbei!',
        body: 'Nächster Satz 🔥',
        sound: true,                          // iOS: vibration + kurzer Ton (unterbricht Spotify NICHT)
        vibrate: [0, 200, 150, 200, 150, 200], // Android: 3× kurzes Buzz (düt düt düt)
      },
      trigger: { seconds: duration, type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL },
    });
    notifIdRef.current = id;
  }

  async function cancelWakeNotif() {
    if (notifIdRef.current) {
      await Notifications.cancelScheduledNotificationAsync(notifIdRef.current).catch(() => {});
      notifIdRef.current = null;
    }
  }

  function start(duration: number) {
    if (intervalRef.current) clearInterval(intervalRef.current);
    endAtRef.current = Date.now() + duration * 1000;
    setMaxSeconds(duration);
    setSeconds(duration);

    // Schedule OS-level notification → works with locked screen
    scheduleWakeNotif(duration);

    intervalRef.current = setInterval(() => {
      const remaining = Math.max(0, Math.round((endAtRef.current! - Date.now()) / 1000));
      setSeconds(remaining);
      if (remaining <= 0) {
        clearInterval(intervalRef.current!);
        intervalRef.current = null;
        cancelWakeNotif(); // cancel since we're in foreground anyway
        // Haptic when app is open
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
    cancelWakeNotif();
  }

  useEffect(() => () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, []);

  return { seconds, maxSeconds, start, cancel };
}
