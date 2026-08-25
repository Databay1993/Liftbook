import { useState, useRef, useEffect } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';
import beepSound from '../../assets/sounds/liftbook_beep.wav';

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

/**
 * iOS silences app audio whenever the ring switch is flipped, which is
 * exactly how a phone sits in a gym — so the rest timer stayed mute there
 * while the lock-screen notification, which bypasses the switch, was
 * audible. Opting out of that behaviour is what makes the beep reliable.
 *
 * Configured once and reused, since the audio session is global.
 */
let audioSession: Promise<void> | null = null;
function prepareAudio(): Promise<void> {
  const existing = audioSession;
  if (existing) return existing;

  const created = Audio.setAudioModeAsync({
    playsInSilentModeIOS: true,
    staysActiveInBackground: false,
    shouldDuckAndroid: true,      // pause music briefly instead of talking over it
    playThroughEarpieceAndroid: false,
  }).catch(() => { /* keep going; the haptic still fires */ });

  audioSession = created;
  return created;
}

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
        // iOS: custom "düt düt düt" sound (bundled in native build)
        // Android: default sound + triple vibration
        sound: Platform.OS === 'ios' ? 'liftbook_beep.wav' : true,
        vibrate: [0, 200, 150, 200, 150, 200],
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
    prepareAudio();
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
        cancelWakeNotif();
        // Play beep sound directly — works in Expo Go
        prepareAudio()
          .then(() => Audio.Sound.createAsync(beepSound))
          .then(({ sound }) => {
            sound.playAsync();
            sound.setOnPlaybackStatusUpdate(status => {
              if (status.isLoaded && status.didJustFinish) sound.unloadAsync();
            });
          })
          .catch(() => {});
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
