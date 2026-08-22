export default {
  // General
  appName: 'Liftbook',
  save: 'Save',
  cancel: 'Cancel',
  delete: 'Delete',
  add: 'Add',
  confirm: 'Confirm',

  // Home
  heroSub: 'Track your lifts. Beat your records.',
  readyToPush: 'READY TO\nPUSH?',
  startWorkout: '+ START WORKOUT',
  workouts: 'Workouts',
  exercises: 'Exercises',
  sets: 'Sets',
  restTimer: 'Rest Timer',
  restAfterSet: 'Rest time after each set',
  addCustomExercise: 'Custom Exercise',
  exerciseName: 'Exercise name...',
  backup: 'Backup',
  exportData: '⬇ Export',
  importData: '⬆ Import',
  backupHint: 'JSON backup as extra safety',
  workoutRunning: '⚡ Workout running',
  goBack: '→ Resume',

  // Workout
  workout: 'Workout',
  addExercise: '+ Add Exercise',
  saveWorkout: 'SAVE WORKOUT 💪',
  addSet: '+ Add set',
  noExercises: 'No exercises yet.\nAdd one below 👇',
  noActiveWorkout: 'No active workout',
  startFromHome: 'Start a workout from the Home tab',
  firstTime: 'First time – let\'s go! 🔥',
  lastSession: '⏱ Last time',
  cancelWorkout: 'Cancel workout?',
  alreadyAdded: 'Already added',
  chooseExercise: 'Choose Exercise',
  search: 'Search...',
  newExercise: 'NEW EXERCISE',
  noExercisesLogged: 'No exercises logged',
  reps: 'Reps',
  kg: 'kg',
  custom: 'custom',
  exerciseSaved: 'Exercise saved ✓',
  exerciseDoneHint: 'Hold ✓ to mark exercise as done',
  // Tracking types
  trackWeightReps: 'Weight + Reps',
  trackBodyweight: 'Bodyweight',
  trackTime: 'Time',
  trackDistTime: 'Dist + Time',
  trackPercent: 'Percent',
  durationSec: 'sec',
  distanceKm: 'km',
  percent: '%',

  // Sides (L/R)
  sidesOff: 'L|R off',
  sidesOn: 'L|R on',
  leftSide: 'L',
  rightSide: 'R',
  addPair: '+ Pair (L+R)',

  // Set timer
  timerStart: '▶',
  timerStop: '⏹',

  // History
  history: 'History',
  noHistory: 'No workouts yet.\nStart your first session!',

  // Stats
  stats: 'Stats',
  personalRecords: 'Personal Records',
  totalVolume: 'Total Volume',
  weeklyFrequency: 'Last 8 Weeks',
  noData: 'No data yet',
  sessions: 'sessions',
  maxWeight: 'Max Weight',
  maxReps: 'Max Reps',
  bestVol: 'Best Vol.',
  volume: 'Volume',
  lastWorkout: 'Last Workout',
  progressCharts: 'Progress',
  noLastWorkout: 'No workouts yet',

  // Recent sessions
  recentSessions: 'Recent Sessions',
  sessionLatest: 'Latest',
  sessionPrevious: 'Before that',

  // Charts
  chartE1RM: 'e1RM',
  chartByWeight: 'Reps per weight',
  chartE1RMHint: 'Estimated 1RM — best set per session',
  chartByWeightHint: 'Reps per weight — one color per weight',
  e1rmTapHint: 'Tap a point for details',
  e1rmWeakPoint: 'hollow point = estimate runs high',
  e1rmOverestimated: 'Over {{limit}} reps — estimate runs high',

  // Trend metrics (tap to switch)
  trendPerMonthUnit: 'kg/mo',
  trendLabelSlope: 'robust trend',
  trendLabelBlocks: 'avg3 vs avg3',
  trendLabelSmoothed: 'smoothed',
  trendLabelNone: 'trend',
  trendTooFew: 'too few',
  trendRampNote: 'ramp-up excluded',

  // Chart overlays per metric
  overlaySlope: '— — Dashed = the trend shown',
  overlayBlocks: '━━ Bars = the two three-session averages',
  overlayEwma: '━━ Blue curve = smoothed course',
  overlayDimmed: 'faded points do not count',

  // Legend
  legendButton: 'Legend',
  legendTitle: 'How these stats work',
  legendIntro: 'Every number here comes from the sets you logged. This is what each one measures — and where it stops being reliable.\n\nTip: tap the trend value on the right of a chart to cycle through the three metrics. The chart then draws what that number rests on and fades the points that do not count.',

  legendE1RMTitle: 'e1RM — estimated max',
  legendE1RMBody: 'What you could theoretically lift once, extrapolated from a normal set using the Epley formula: 5 reps at 80 kg works out to about 93 kg. The advantage over raw weight: 80 kg × 8 counts for more than 80 kg × 5, even though the weight is identical.',

  legendBestSetTitle: 'One point per session',
  legendBestSetBody: 'Only the best set of each session counts — the one with the highest e1RM. Warm-up sets and easy finishers therefore never drag the line down.',

  legendRepLimitTitle: 'Why some points are hollow',
  legendRepLimitBody: 'Above {{limit}} reps the formula runs high — 20 light reps compute to more than a genuine heavy triple. Such sets therefore always lose to a normal set. If one still carries a session, its point is drawn hollow: the value is shown, but read it with care.',

  legendBlocksTitle: 'Training blocks',
  legendBlocksBody: 'A gap of more than {{gap}} days between sessions starts a new block, and the trend only ever uses the current one. Numbers from before a long break can no longer distort anything.',

  legendRampTitle: 'Coming back',
  legendRampBody: 'After a break you deliberately restart light. That computes as enormous progress without any being made, so the first {{ramp}} sessions of a block stay out of every metric — they remain visible in the chart, dimmed. If fewer than {{minPoints}} sessions are left afterwards, you get "too few" instead of a number.',

  legendSlopeTitle: 'Robust trend (kg/month)',
  legendSlopeBody: 'The slope between every possible pair of points is computed and the middle value taken (Theil–Sen), so a single bad day barely moves the result. Pairs less than {{pair}} days apart are ignored — two sessions on consecutive days would otherwise produce absurd projections.',

  legendBlockCompareTitle: 'avg3 vs avg3',
  legendBlockCompareBody: 'The average of your last three sessions against the average of the three before. Easy to follow and resistant to single outliers, but it only ever looks at the most recent six sessions.',

  legendEwmaTitle: 'Smoothed',
  legendEwmaBody: 'A rolling average weighted towards recent sessions (time constant {{tau}} days). It weighs by actual elapsed days: a session after three weeks off moves the curve far more than one the next day. The blue line in the chart shows it.',

  legendByWeightTitle: 'Reps per weight',
  legendByWeightBody: 'The other chart view: one line per weight, showing how many reps you manage with it over time. Useful when you stay on the same weight for a while and the progress lives in the rep count.',

  legendRecentTitle: 'Recent sessions',
  legendRecentBody: 'Your two most recent sessions with every exercise and set — meant as a look back when deciding what to train today.',

  legendPRTitle: 'Records and volume',
  legendPRBody: 'Max weight is the heaviest you ever moved, max reps the highest rep count, best vol the strongest single set (weight × reps). Volume is everything added up: each set as weight × reps.',

  legendFootnote: 'The e1RM chart needs both weight and reps. For exercises tracked by time, bodyweight or percent it stays empty — use the "reps per weight" view there.',

  // Settings
  settings: 'Settings',
  language: 'Language',
  selectLanguage: 'Select Language',
  theme: 'Theme',
  themeDark: 'Dark Gym',
  themeEnergy: 'Energy',
  themeChalk: 'Chalk',
  about: 'About',
  version: 'Version',

  // Navigation
  home: 'Home',
  historyTab: 'History',
  statsTab: 'Stats',
  settingsTab: 'Settings',

  // Templates
  templates: 'My Workouts',
  newTemplate: '+ New Workout Plan',
  templateName: 'Plan name (e.g. Leg Day)...',
  createTemplate: 'Save Plan',
  noTemplates: 'No plans yet.\nCreate your first workout plan!',
  startFromTemplate: 'Start',
  deleteTemplate: 'Delete plan?',
  templateExercises: 'Exercises',
  addExercisesToTemplate: 'Add exercises to your plan',
  editTemplate: 'Edit Plan',
  newExercisePlaceholder: 'Create new exercise...',

  // Last trained
  lastTrained: 'Last trained',
  daysAgo: 'days ago',
  today: 'today',
  yesterday: 'yesterday',
  neverTrained: 'No workouts yet',

  // Workout summary
  workoutDone: 'Workout done! 💪',
  summaryTotalSets: 'Total sets',
  summaryTotalVolume: 'Total volume',
  summaryNewPR: '🏆 New personal record',
  summaryClose: 'Great, thanks!',

  // Onboarding
  chooseLanguage: 'Choose your language',
  continueBtn: 'Continue',
  onboardingTitle: 'Welcome to\nLiftbook',
  onboardingSub: 'Your personal lifting journal.',
  onboardingStep1: 'Log every set with weight & reps',
  onboardingStep2: 'Track your personal records automatically',
  onboardingStep3: 'Create workout plans for your training days',
  onboardingStart: "LET'S GO",

  // Exercise management
  exercisesSection: 'Manage Exercises',
  renameExercise: 'Rename',
  newExerciseNamePlaceholder: 'New name...',
  renameSuccess: 'Renamed ✓',
  renameError: 'Name already taken',

  // Validation
  errorNoName: 'Please enter a plan name first.',
  errorNoExercises: 'Add at least one exercise to the plan.',
  errorSaveFailed: 'Could not save. Please try again.',

  // Toast
  saved: 'Saved ✓',
  imported: 'Imported ✓',
  invalidFile: 'Invalid file ✗',
  exerciseAdded: 'Exercise added ✓',
  exerciseExists: 'Exercise already exists',
  backupSaved: 'Backup saved ✓',
};
