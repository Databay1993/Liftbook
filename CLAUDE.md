# Liftbook

React Native / Expo (SDK 54) workout tracker. TypeScript, expo-sqlite for local
persistence, React Navigation bottom tabs, i18n in DE/EN/ES.

## Deploying changes to the phone

The user runs Liftbook on an iPhone through Expo Go, loading **published EAS
Updates** — not a local dev server. There is no standalone build and no Apple
Developer account. Do not tell the user to start a dev server or scan a LAN QR
code; that only works while their PC is running and on the same WiFi.

After pushing code, the user runs this one command on their Windows PC
(`C:\Users\Dominik\Liftbook`):

```
git pull origin <branch> && eas update --branch preview --message "<summary>"
```

Then they force-close the app on the phone and reopen it twice — the first
launch downloads the update, the second shows it.

Constraints this implies:

- Keep `app.json` `version` at `1.0.0` — the installed runtime version is
  `1.0.0` and updates only reach the phone when they match.
- **JS-only changes.** Anything requiring new native code (a new native module,
  changed config plugins, custom notification sounds) will NOT arrive over the
  air. Only packages already present at build time work — `expo-av`,
  `expo-sqlite`, `expo-notifications`, `expo-haptics` are all in.
- Notification sounds don't fire in Expo Go. For audible feedback use
  `expo-av` (`Audio.Sound.createAsync`) directly — see `src/hooks/useTimer.ts`.

## Layout

- `src/storage/database.ts` — all SQLite access, no ORM. Schema changes go in
  `initDb()` as `ALTER TABLE` wrapped in try/catch so they run once and are
  backward-compatible.
- `src/screens/WorkoutScreen.tsx` — the main logging UI.
- `src/i18n/locales/{de,en,es}.ts` — add every new key to all three files.

## Data model notes

`sets.reps` and `sets.weight` are TEXT and their meaning depends on the
exercise's `tracking_type`:

| tracking_type   | reps            | weight |
|-----------------|-----------------|--------|
| `weight_reps`   | rep count       | kg     |
| `bodyweight`    | rep count       | —      |
| `time`          | duration in sec | —      |
| `distance_time` | duration in sec | km     |
| `percent`       | percent 0–100   | —      |

Exercises with `has_sides = 1` log each side separately; `sets.side` is
`'left'`, `'right'`, or NULL.
