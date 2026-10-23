# Liftbook

React Native / Expo (SDK 58) workout tracker. TypeScript, expo-sqlite for local
persistence, React Navigation bottom tabs, i18n in DE/EN/ES.

## Deploying changes to the phone

The user runs Liftbook on **two devices at once**: an iPhone through Expo Go,
and an Android phone with an installed APK from `eas build --profile preview`.
Both sit on the same `preview` branch/channel, so a single `eas update` reaches
both — always publish for both, never one platform only.

**Runtime version is `3.0.0` since the SDK 58 upgrade.** Expo Go on iOS ships
only the newest SDK and updates itself, so every Expo SDK release locks the
iPhone out of the project until it is upgraded to match — SDK 54 → 57 in
September, 57 → 58 in October. Expect this roughly quarterly; it is not a
regression to investigate. Each upgrade is a native change, so bump
`app.json` `version` with it: that is what stops an already-installed APK
downloading a bundle whose native side it does not have.

The APK the user still has installed is SDK 54 at runtime `1.0.0` and has
been cut off since September; a new one has not been built because the build
workflow is not dispatchable (see below). Only Expo Go on the iPhone is
current.

The lasting fixes are a standalone iOS build (needs a paid Apple Developer
account, which the user does not have) or turning off automatic app updates
on the iPhone so Expo Go stops jumping ahead of the project.

Updates are loaded from the published EAS Update, not from a local dev server.
There is no iOS standalone build and no Apple Developer account. Do not tell
the user to start a dev server or scan a LAN QR code; that only works while
their PC is running and on the same WiFi.

After pushing code, the user runs this one command on their Windows PC
(`C:\Users\Dominik\Liftbook`):

```
git pull origin <branch> && eas update --branch preview --message "<summary>"
```

Then they force-close the app on the phone and reopen it twice — the first
launch downloads the update, the second shows it.

**After every push, tell the user the build number that push produced.** It
is the commit count (`git rev-list --count HEAD`), stamped into the bundle by
`scripts/generate-version.js` at publish time and shown in Settings → About
as "Version 3.0.0 · Build 64". Naming it lets them check on the phone whether
the update actually arrived.

Alternatively `.github/workflows/eas-update.yml` publishes the same update
automatically on every push to the feature branch (and can be triggered by
hand from the GitHub app). It needs the `EXPO_TOKEN` repository secret,
which is set — CI is the normal path now, the PC command is the fallback.

`.github/workflows/eas-build-android.yml` starts an Android APK build on
manual dispatch. Builds count against the free quota, so never trigger it on
push.

**It cannot currently be dispatched.** GitHub only registers a
`workflow_dispatch` workflow whose file is on the default branch, and this
one exists only on the feature branch — so it has never appeared in the
Actions list and an API dispatch returns 404. `eas-update.yml` is on `master`
and therefore works. Fixing this means putting the file on `master`, which
needs the user's explicit permission to push there; they have been asked and
have not answered. Until then the only route to an APK is
`eas build --platform android --profile preview` from their PC.

Constraints this implies:

- Change `app.json` `version` only when the native side changes. It drives the
  runtime version, and an update only reaches a build whose runtime version
  matches — so a bump deliberately cuts off every already-installed build.
- **JS-only changes.** Anything requiring new native code (a new native module,
  changed config plugins, custom notification sounds) will NOT arrive over the
  air. Only packages already present at build time work — `expo-audio`,
  `expo-sqlite`, `expo-notifications`, `expo-haptics` are all in.
- Notification sounds don't fire in Expo Go. For audible feedback use
  `expo-audio` (`createAudioPlayer`) directly — see `src/hooks/useTimer.ts`.
  `expo-av` is gone from SDK 55 onwards; do not reach for it.

## Layout

- `src/storage/database.ts` — all SQLite access, no ORM. Schema changes go in
  `initDb()` as `ALTER TABLE` wrapped in try/catch so they run once and are
  backward-compatible.
- `src/screens/WorkoutScreen.tsx` — the main logging UI.
- `src/i18n/locales/{de,en,es}.ts` — add every new key to all three files.

## Data model notes

`sets.reps` and `sets.weight` are TEXT and their meaning depends on the
exercise's `tracking_type`:

| tracking_type   | reps            | weight       |
|-----------------|-----------------|--------------|
| `weight_reps`   | rep count       | kg           |
| `bodyweight`    | rep count       | —            |
| `time`          | duration in sec | —            |
| `distance_time` | duration in sec | km           |
| `percent`       | rep count       | percent      |

`weight` is the load axis whatever its unit, so `percent` behaves like
`weight_reps` and keeps working in e1RM, trends and comparison. Volume is
only summed for `weight_reps` — a percentage times reps is not kilos.

Exercises with `has_sides = 1` log each side separately; `sets.side` is
`'left'`, `'right'`, or NULL.
