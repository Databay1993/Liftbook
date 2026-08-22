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
  chartE1RMHint: 'Estimated 1RM — one set per session',
  chartByWeightHint: 'Reps per weight — one color per weight',
  e1rmTapHint: 'Tap a point for details',
  e1rmWeakPoint: 'hollow point = estimate runs high',
  e1rmOverestimated: 'Over {{limit}} reps — estimate runs high',

  // Trend metrics (tap to switch)
  trendPerMonthUnit: 'kg/mo',
  trendLabelSlope: 'robust trend',
  trendLabelSpan: 'over {{days}} days',
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

  // Context comparison
  chartContext: 'Compare',
  chartContextHint: 'Only compare sessions with the same pre-fatigue',
  contextIntro: 'Grouped by what worked the same muscle group before this exercise. Only sessions in the same group compare fairly.',
  contextFresh: 'Fresh (nothing before)',
  contextAfter: 'After',
  contextVsBest: 'vs best group',
  contextTrend: 'In the current context ({{context}}): {{value}} kg/month',
  contextChange: 'In the current context ({{context}}): {{value}} kg over {{days}} days. Too short for a monthly figure — that would multiply every wobble.',
  contextTooFew: 'Only {{count}} comparable sessions in "{{context}}" — too few for a trend. Train this order more often and it becomes meaningful.',
  contextNoGroup: 'This exercise has no muscle group yet. Assign one under Settings → Manage Exercises to enable the comparison.',
  contextOrderInferred: 'For older sessions the order was inferred from save order — usually right, but not guaranteed.',

  // Delete exercise
  deleteExerciseTitle: 'Delete "{{name}}"?',
  deleteExerciseUsage: 'This also deletes {{sets}} sets from {{workouts}} workouts, and removes the exercise from {{templates}} plans. It cannot be undone.',
  deleteExerciseUnused: 'Nothing is logged for this exercise — nothing will be lost.',
  deleteExerciseDone: 'Exercise deleted ✓',

  // Statistics: which set counts
  setRuleSection: 'Statistics rule',
  setRuleHint: 'Which set represents an exercise in the statistics. Affects e1RM, trend, comparison and "reps per weight" — not volume and records, which always count every set.',
  setRuleFirst: 'First set only',
  setRuleFirstDesc: 'Same conditions every session — the first set is the only one that does not depend on how hard the previous one was. Assumes you do not log warm-up sets.',
  setRuleBest: 'Best set',
  setRuleBestDesc: 'The set with the highest e1RM. Tolerates warm-ups and ramp-ups, but a light high-rep set can outrank a heavy one.',

  // Muscle groups
  muscle_chest: 'Chest',
  muscle_back: 'Upper Back',
  muscle_lower_back: 'Lower Back',
  muscle_shoulders: 'Shoulders',
  muscle_biceps: 'Biceps',
  muscle_triceps: 'Triceps',
  muscle_quads: 'Quads',
  muscle_hamstrings: 'Hamstrings',
  muscle_glutes: 'Glutes',
  muscle_calves: 'Calves',
  muscle_adductors: 'Adductors',
  muscle_core: 'Core',
  muscle_cardio: 'Cardio',
  muscle_other: 'Other',
  muscleGroupMulti: 'Multi-select — pick everything the exercise noticeably works.',
  'ex_Bench Press': 'Bench Press',
  ex_Squat: 'Squat',
  ex_Deadlift: 'Deadlift',
  'ex_Overhead Press': 'Overhead Press',
  'ex_Pull-Up': 'Pull-Up',
  'ex_Barbell Row': 'Barbell Row',
  'ex_Bicep Curl': 'Bicep Curl',
  'ex_Tricep Pushdown': 'Tricep Pushdown',
  'ex_Leg Press': 'Leg Press',
  'ex_Lat Pulldown': 'Lat Pulldown',
  muscleGroupTitle: 'Choose muscle group',
  muscleGroupHint: 'The muscle group decides which exercises fatigue each other — the basis for the comparison view in stats.',
  muscleGroupNone: 'none',
  muscleGroupClear: 'Clear',

  // Legend
  legendButton: 'Legend',
  legendTitle: 'How these stats work',
  legendIntro: 'Every number here comes from the sets you logged. This is what each one measures — and where it stops being reliable.\n\nTip: tap the trend value on the right of a chart to cycle through the three metrics. The chart then draws what that number rests on and fades the points that do not count.',

  legendE1RMTitle: 'e1RM — estimated max',
  legendE1RMBody: 'What you could theoretically lift once, extrapolated from a normal set using the Epley formula: 5 reps at 80 kg works out to about 93 kg. The advantage over raw weight: 80 kg × 8 counts for more than 80 kg × 5, even though the weight is identical.',

  legendBestSetTitle: 'Which set counts',
  legendBestSetBody: 'Exactly one set represents the exercise per session. The first set is the default: it is the only one performed under the same conditions every time — from the second set on, everything depends on how hard the previous one was and how long the rest lasted. Switchable to "best set" in Settings if you log warm-ups or ramp up. Volume and records always count every set regardless.',

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

  legendContextTitle: 'Compare — same pre-fatigue',
  legendContextBody: 'Rowing after pull-ups is not the same as rowing done first: the back is already tired. This view groups your sessions by which exercises for the same muscle group came before, and only compares within a group. Other muscle groups do not count — after leg press your back is as fresh as at the start. Order among the preceding exercises is ignored, otherwise too few sessions would be left per group. The exercise needs an assigned muscle group for this to work.',

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
  build: 'Build',
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
