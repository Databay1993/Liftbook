export default {
  // General
  appName: 'Liftbook',
  save: 'Speichern',
  cancel: 'Abbrechen',
  delete: 'Löschen',
  add: 'Hinzufügen',
  confirm: 'Bestätigen',

  // Home
  heroSub: 'Tracke deine Lifts. Brich deine Rekorde.',
  readyToPush: 'BEREIT ZUM\nPUSHEN?',
  startWorkout: '+ WORKOUT STARTEN',
  workouts: 'Workouts',
  exercises: 'Übungen',
  sets: 'Sätze',
  restTimer: 'Pause Timer',
  restAfterSet: 'Pausenzeit nach jedem Satz',
  addCustomExercise: 'Eigene Übung',
  exerciseName: 'Übungsname...',
  backup: 'Backup',
  exportData: '⬇ Exportieren',
  importData: '⬆ Importieren',
  backupHint: 'JSON-Backup als zusätzliche Sicherung',
  workoutRunning: '⚡ Workout läuft',
  goBack: '→ Zurück',

  // Workout
  workout: 'Workout',
  addExercise: '+ Übung hinzufügen',
  saveWorkout: 'WORKOUT SPEICHERN 💪',
  addSet: '+ Satz hinzufügen',
  noExercises: 'Noch keine Übung.\nFüge eine hinzu 👇',
  noActiveWorkout: 'Kein aktives Workout',
  startFromHome: 'Starte ein Workout auf der Startseite',
  firstTime: 'Erstes Mal – leg los! 🔥',
  lastSession: '⏱ Letztes Mal',
  cancelWorkout: 'Workout wirklich abbrechen?',
  alreadyAdded: 'Bereits hinzugefügt',
  chooseExercise: 'Übung wählen',
  search: 'Suchen...',
  newExercise: 'NEUE ÜBUNG',
  noExercisesLogged: 'Keine Übungen erfasst',
  reps: 'Wdh.',
  kg: 'kg',
  custom: 'eigene',
  exerciseSaved: 'Übung gespeichert ✓',
  exerciseDoneHint: '✓ halten um Übung abzuschließen',
  // Tracking types
  trackWeightReps: 'Gewicht + Wdh.',
  trackBodyweight: 'Bodyweight',
  trackTime: 'Zeit',
  trackDistTime: 'Distanz + Zeit',
  trackPercent: 'Prozent',
  durationSec: 'Sek',
  distanceKm: 'km',
  percent: '%',

  collapseAll: 'Alle zuklappen',
  expandAll: 'Alle aufklappen',
  noSetsYet: 'noch nichts eingetragen',

  // Sides (L/R)
  sidesOff: 'L|R aus',
  sidesOn: 'L|R an',
  leftSide: 'L',
  rightSide: 'R',
  addPair: '+ Paar (L+R)',

  hintFresh: 'frisch · Ø{{count}} Trainings',
  hintAfter: 'nach {{list}} · Ø{{count}}',
  hintLastSession: 'letztes Training {{date}}',

  extraFieldsTitle: 'Zusatzwerte',
  extraFieldsHint: 'Zahlen, die diese Übung außer Gewicht und Wiederholungen liefert — etwa Peak Power an der Keiser. Gilt ab sofort für jedes Training dieser Übung.',
  extraFieldsNone: 'Noch keine Zusatzwerte für diese Übung.',
  extraFieldName: 'Bezeichnung, z.B. Peak Power',
  extraFieldUnit: 'Einheit',
  fieldExists: 'Gibt es schon',

  // Set timer
  timerStart: '▶',
  timerStop: '⏹',

  // History
  ofTotal: 'von {{total}}',
  history: 'Verlauf',
  noHistory: 'Noch kein Workout.\nStarte dein erstes Training!',

  // Stats
  stats: 'Statistiken',
  personalRecords: 'Persönliche Rekorde',
  totalVolume: 'Volumen Gesamt',
  weeklyFrequency: 'Letzte 8 Wochen',
  noData: 'Noch keine Daten',
  sessions: 'Sessions',
  maxWeight: 'Max Gewicht',
  maxReps: 'Max Wdh.',
  bestVol: 'Best Vol.',
  volume: 'Volumen',
  lastWorkout: 'Letztes Workout',
  progressCharts: 'Fortschritt',
  noLastWorkout: 'Noch kein Workout',

  // Recent sessions
  recentSessions: 'Letzte Trainings',
  sessionLatest: 'Zuletzt',
  sessionPrevious: 'Davor',

  // Charts
  chartE1RM: 'e1RM',
  chartByWeight: 'Wdh pro Gewicht',
  chartE1RMHint: 'Geschätztes 1RM — ein Satz je Training',
  scopeFresh: '↳ Trend nur aus Trainings, in denen die Übung frisch kam',
  scopeAfter: '↳ Trend nur aus Trainings nach {{list}}',
  chartByWeightHint: 'Wiederholungen pro Gewicht — jede Farbe = ein Gewicht',
  e1rmTapHint: 'Punkt antippen für Details',
  e1rmWeakPoint: 'offener Punkt = geschätzt zu hoch',
  e1rmOverestimated: 'Über {{limit}} Wdh. — Schätzung fällt zu hoch aus',

  chartExtras: 'Zusatzwerte',
  chartExtrasHint: 'Selbst erfasste Messwerte — höchster Wert je Training',
  metricNoData: 'Für „{{label}}" ist noch nichts eingetragen',
  metricBest: 'Bestwert {{value}}{{unit}} am {{date}} · Punkt antippen',

  // Trend metrics (tap to switch)
  trendPerMonthUnit: 'kg/Mon',
  trendLabelSlope: 'Trend robust',
  trendLabelSpan: 'in {{days}} Tagen',
  trendLabelBlocks: 'Ø3 vs Ø3',
  trendLabelSmoothed: 'geglättet',
  trendLabelNone: 'Trend',
  trendTooFew: 'zu wenig',
  trendRampNote: 'Wiedereinstieg ausgeklammert',

  // Chart overlays per metric
  overlaySlope: '— — Gestrichelt = der angezeigte Trend',
  overlayBlocks: '━━ Balken = die zwei Dreier-Mittelwerte',
  overlayEwma: '━━ Blaue Kurve = geglätteter Verlauf',
  overlayDimmed: 'blasse Punkte zählen nicht mit',

  // Context comparison
  positionTitle: 'Stelle im Training',
  positionUsual: 'Meistens als {{position}}. Übung ({{count}} von {{total}} Trainings)',
  chartContext: 'Vergleich',
  chartContextHint: 'Nur Trainings mit gleicher Vorermüdung vergleichen',
  contextIntro: 'Gruppiert nach dem, was vor dieser Übung dieselbe Muskelgruppe belastet hat. Nur Trainings derselben Gruppe sind fair vergleichbar.',
  contextFresh: 'Frisch (nichts davor)',
  contextAfter: 'Nach',
  contextVsBest: 'zur besten Gruppe',
  contextTrend: 'Im aktuellen Kontext ({{context}}): {{value}} kg/Monat',
  contextChange: 'Im aktuellen Kontext ({{context}}): {{value}} kg in {{days}} Tagen. Auf einen Monat hochgerechnet wären das {{monthly}} kg — so lange hast du aber nicht gemessen. Je kürzer der Zeitraum, desto stärker vergrößert die Hochrechnung jede einzelne Schwankung.',
  contextTooFew: 'Nur {{count}} vergleichbare Trainings in „{{context}}" — für einen Trend zu wenig. Fahre diese Reihenfolge öfter, dann wird es aussagekräftig.',
  contextNoGroup: 'Dieser Übung fehlt eine Muskelgruppe. Ordne sie in den Einstellungen unter „Übungen verwalten" zu, dann kann verglichen werden.',
  contextOrderInferred: 'Bei älteren Trainings wurde die Reihenfolge aus der Speicher-Reihenfolge abgeleitet — meist richtig, aber nicht garantiert.',

  // Delete exercise
  deleteExerciseTitle: '„{{name}}" löschen?',
  deleteExerciseUsage: 'Dabei werden {{sets}} Sätze aus {{workouts}} Trainings mitgelöscht. In {{templates}} Trainingsplänen wird die Übung entfernt. Das lässt sich nicht rückgängig machen.',
  deleteExerciseUnused: 'Für diese Übung ist nichts eingetragen — es geht nichts verloren.',
  deleteExerciseDone: 'Übung gelöscht ✓',

  // Statistics: which set counts
  setRuleSection: 'Statistik-Regel',
  setRuleHint: 'Welcher Satz eine Übung in der Statistik vertritt. Betrifft e1RM, Trend, Vergleich und „Wdh pro Gewicht" — nicht Volumen und Rekorde, die zählen immer alle Sätze.',
  setRuleFirst: 'Nur der erste Satz',
  setRuleFirstDesc: 'Gleiche Bedingungen bei jedem Training — der erste Satz ist der einzige, der nicht davon abhängt, wie hart der vorherige war. Setzt voraus, dass du keine Aufwärmsätze einträgst.',
  setRuleBest: 'Bester Satz ab Startgewicht',
  setRuleBestDesc: 'Der stärkste Satz, aber nur solche mit mindestens dem Gewicht des ersten Satzes. Damit zählen Aufwärmsätze und Hochtasten mit — dort ist der spätere Satz ja schwerer — während Abfallsätze mit weniger Gewicht draußen bleiben.',

  // Muscle groups
  muscle_chest: 'Brust',
  muscle_back: 'Oberer Rücken',
  muscle_lower_back: 'Unterer Rücken',
  muscle_shoulders: 'Schultern',
  muscle_biceps: 'Bizeps',
  muscle_triceps: 'Trizeps',
  muscle_quads: 'Quadrizeps',
  muscle_hamstrings: 'Beinbeuger',
  muscle_glutes: 'Gesäß',
  muscle_calves: 'Waden',
  muscle_adductors: 'Adduktoren',
  muscle_core: 'Rumpf',
  muscle_cardio: 'Ausdauer',
  muscle_other: 'Sonstiges',
  muscleGroupMulti: 'Mehrfachauswahl — wähle alles, was die Übung spürbar belastet.',
  'ex_Bench Press': 'Bankdrücken',
  ex_Squat: 'Kniebeuge',
  ex_Deadlift: 'Kreuzheben',
  'ex_Overhead Press': 'Schulterdrücken',
  'ex_Pull-Up': 'Klimmzug',
  'ex_Barbell Row': 'Langhantelrudern',
  'ex_Bicep Curl': 'Bizepscurl',
  'ex_Tricep Pushdown': 'Trizepsdrücken',
  'ex_Leg Press': 'Beinpresse',
  'ex_Lat Pulldown': 'Latzug',
  muscleGroupTitle: 'Muskelgruppe wählen',
  muscleGroupHint: 'Die Muskelgruppe steuert, welche Übungen sich gegenseitig ermüden — Grundlage für den Vergleich in der Statistik.',
  muscleGroupNone: 'keine',
  muscleGroupClear: 'Entfernen',

  // Legend
  legendButton: 'Legende',
  legendTitle: 'Wie die Statistik rechnet',
  legendIntro: 'Alle Werte entstehen aus deinen eingetragenen Sätzen. Hier steht, was jede Zahl genau misst — und wo sie an ihre Grenzen kommt.\n\nTipp: Tippe im Chart auf den Trendwert rechts, um zwischen den drei Kennzahlen zu wechseln. Der Chart zeichnet dann jeweils ein, worauf sich die Zahl stützt, und blendet die Punkte ab, die nicht mitzählen.',

  legendE1RMTitle: 'e1RM — geschätztes Maximalgewicht',
  legendE1RMBody: 'Was du theoretisch einmal schaffen würdest, hochgerechnet aus einem normalen Satz. Nach der Epley-Formel: 5 Wiederholungen mit 80 kg ergeben rund 93 kg. Der Vorteil gegenüber dem reinen Gewicht: Ein Satz mit 80 kg × 8 zählt mehr als 80 kg × 5, obwohl das Gewicht gleich ist.',

  legendBestSetTitle: 'Welcher Satz zählt',
  legendBestSetBody: 'Pro Training vertritt genau ein Satz die Übung. Welcher, stellst du unter Einstellungen → Statistik-Regel ein.\n\nNur der erste Satz (Voreinstellung): Er ist der einzige, der jedes Mal unter gleichen Bedingungen stattfindet. Ab Satz zwei hängt alles davon ab, wie hart der vorherige war und wie lange du Pause gemacht hast. Setzt voraus, dass du keine Aufwärmsätze einträgst — sonst misst die Statistik dein Aufwärmen.\n\nBester Satz ab Startgewicht: Der stärkste Satz, aber nur solche, die mindestens so schwer sind wie dein erster. Aufwärmen und Hochtasten funktionieren damit weiter, weil der spätere Satz dort schwerer ist. Ein Abfallsatz mit weniger Gewicht kann dagegen nicht gewinnen — sonst würde ein leichter Satz mit vielen Wiederholungen deinen schweren verdrängen, und die Linie spränge zwischen zwei verschiedenen Arten von Arbeit hin und her.\n\nVolumen und Rekorde zählen unabhängig davon immer alle Sätze.',

  legendRepLimitTitle: 'Warum manche Punkte hohl sind',
  legendRepLimitBody: 'Über {{limit}} Wiederholungen rechnet die Formel zu hoch — 20 leichte Wiederholungen ergeben rechnerisch mehr als eine echte schwere Dreierserie. Solche Sätze verlieren deshalb immer gegen einen normalen Satz. Trägt trotzdem einer ein Training, wird der Punkt hohl gezeichnet: Der Wert steht da, ist aber mit Vorsicht zu lesen.',

  legendBlocksTitle: 'Trainingsblöcke',
  legendBlocksBody: 'Liegen zwischen zwei Trainings mehr als {{gap}} Tage, beginnt ein neuer Block. Der Trend rechnet nur im aktuellen Block — Zahlen von vor einer langen Pause verfälschen nichts mehr.',

  legendRampTitle: 'Wiedereinstieg',
  legendRampBody: 'Nach einer Pause steigt man bewusst leicht wieder ein. Das sieht rechnerisch nach enormem Fortschritt aus, ist aber keiner. Deshalb bleiben die ersten {{ramp}} Trainings eines Blocks aus allen Kennzahlen heraus — im Chart sind sie ausgegraut noch zu sehen. Bleiben danach weniger als {{minPoints}} Trainings übrig, steht „zu wenig" statt einer Zahl.',

  legendSlopeTitle: 'Trend robust (kg/Monat)',
  legendSlopeBody: 'Die Steigung zwischen jedem möglichen Punktepaar wird berechnet, davon der mittlere Wert genommen (Theil-Sen). Ein einzelner schlechter Tag kann das Ergebnis dadurch kaum verschieben. Paare, die weniger als {{pair}} Tage auseinanderliegen, zählen nicht mit — zwei Trainings an Folgetagen ergeben sonst absurde Hochrechnungen.',

  legendBlockCompareTitle: 'Ø3 vs Ø3',
  legendBlockCompareBody: 'Durchschnitt der letzten drei Trainings gegen den Durchschnitt der drei davor. Einfach nachvollziehbar und unempfindlich gegen einzelne Ausreißer, betrachtet aber nur die jüngsten sechs Trainings.',

  legendEwmaTitle: 'Geglättet',
  legendEwmaBody: 'Ein gleitender Mittelwert, bei dem jüngere Trainings stärker zählen (Zeitkonstante {{tau}} Tage). Er gewichtet nach echten Tagesabständen: Ein Training nach drei Wochen Pause bewegt die Kurve deutlich stärker als eines am Folgetag. Die blaue Linie im Chart zeigt diesen Verlauf.',

  legendByWeightTitle: 'Wdh pro Gewicht',
  legendByWeightBody: 'Die andere Chart-Ansicht: eine Linie je Gewicht, die zeigt, wie viele Wiederholungen du damit über die Zeit schaffst. Nützlich, wenn du lange beim selben Gewicht bleibst und die Steigerung in den Wiederholungen steckt.',

  legendContextTitle: 'Vergleich — gleiche Vorermüdung',
  legendContextBody: 'Rudern nach Klimmzügen ist nicht dasselbe wie Rudern zu Beginn: Der Rücken ist schon müde. Diese Ansicht gruppiert deine Trainings danach, welche Übungen derselben Muskelgruppe vorher dran waren, und vergleicht nur innerhalb einer Gruppe. Übungen anderer Muskelgruppen zählen nicht — nach Beinpresse ist dein Rücken so frisch wie am Anfang. Die Reihenfolge untereinander wird ignoriert, sonst blieben zu wenige Trainings je Gruppe übrig. Voraussetzung ist, dass die Übung eine Muskelgruppe zugeordnet hat.',

  legendHintTitle: 'Der Wiederholungs-Hinweis',
  legendHintBody: 'Tippst du im Workout ein Gewicht ein, steht darunter blass, wie viele Wiederholungen dabei zu erwarten sind. Grundlage sind deine letzten drei Trainings dieser Übung — genauer: die drei, die unter derselben Vorermüdung stattfanden wie heute. Rudern nach Klimmzügen wird also mit Rudern nach Klimmzügen verglichen, nicht mit Rudern zu Beginn. Genommen wird der mittlere der drei Werte, damit ein einzelner Ausreißer die Erwartung nicht setzt.\n\nSteht ein * hinter der Zahl, gab es für die heutige Reihenfolge noch keine Trainings — dann stammt die Schätzung aus deinem häufigsten Kontext und ist entsprechend ungenauer.',

  legendRecentTitle: 'Letzte Trainings',
  legendRecentBody: 'Die zwei jüngsten Einheiten mit allen Übungen und Sätzen — gedacht als Blick zurück für die Frage, was heute dran ist.',

  legendPRTitle: 'Rekorde und Volumen',
  legendPRBody: 'Max Gewicht ist das schwerste je bewegte Gewicht, Max Wdh die höchste Wiederholungszahl, Best Vol der stärkste Einzelsatz (Gewicht × Wdh). Volumen ist alles zusammengerechnet: jeder Satz mit Gewicht × Wiederholungen.',

  legendFootnote: 'Der e1RM-Chart braucht Gewicht und Wiederholungen. Bei Übungen, die auf Zeit, Bodyweight oder Prozent laufen, bleibt er leer — dort hilft die Ansicht „Wdh pro Gewicht".',

  // Settings
  settings: 'Einstellungen',
  language: 'Sprache',
  selectLanguage: 'Sprache wählen',
  theme: 'Design',
  themeDark: 'Dark Gym',
  themeEnergy: 'Energy',
  themeChalk: 'Chalk',
  about: 'Über die App',
  build: 'Build',
  version: 'Version',

  // Navigation
  home: 'Home',
  historyTab: 'Verlauf',
  statsTab: 'Statistik',
  settingsTab: 'Einstellungen',

  // Templates
  templates: 'Meine Workouts',
  newTemplate: '+ Neuer Trainingsplan',
  templateName: 'Planname (z.B. Bein-Tag)...',
  createTemplate: 'Plan speichern',
  noTemplates: 'Noch keine Pläne.\nErstelle deinen ersten Trainingsplan!',
  startFromTemplate: 'Starten',
  deleteTemplate: 'Plan löschen?',
  templateExercises: 'Übungen',
  addExercisesToTemplate: 'Füge Übungen zu deinem Plan hinzu',
  editTemplate: 'Plan bearbeiten',
  newExercisePlaceholder: 'Neue Übung erstellen...',

  // Last trained
  lastTrained: 'Zuletzt trainiert',
  daysAgo: 'Tage her',
  today: 'heute',
  yesterday: 'gestern',
  neverTrained: 'Noch kein Training',

  // Workout summary
  workoutDone: 'Workout geschafft! 💪',
  summaryTotalSets: 'Sätze gesamt',
  summaryTotalVolume: 'Gesamtvolumen',
  summaryNewPR: '🏆 Neuer persönlicher Rekord',
  summaryClose: 'Super, danke!',

  // Onboarding
  chooseLanguage: 'Sprache wählen',
  continueBtn: 'Weiter',
  onboardingTitle: 'Willkommen bei\nLiftbook',
  onboardingSub: 'Dein persönliches Trainings-Tagebuch.',
  onboardingStep1: 'Jeden Satz mit Gewicht & Wdh. loggen',
  onboardingStep2: 'Persönliche Rekorde automatisch tracken',
  onboardingStep3: 'Trainingspläne für deine Trainingstage erstellen',
  onboardingStart: 'LOS GEHT\'S',

  // Exercise management
  exercisesSection: 'Übungen verwalten',
  renameExercise: 'Umbenennen',
  newExerciseNamePlaceholder: 'Neuer Name...',
  renameSuccess: 'Umbenannt ✓',
  renameError: 'Name bereits vergeben',

  // Validation
  errorNoName: 'Bitte zuerst einen Plannamen eingeben.',
  errorNoExercises: 'Füge mindestens eine Übung zum Plan hinzu.',
  errorSaveFailed: 'Speichern fehlgeschlagen. Bitte erneut versuchen.',

  // Toast
  saved: 'Gespeichert ✓',
  imported: 'Importiert ✓',
  invalidFile: 'Ungültige Datei ✗',
  exerciseAdded: 'Übung hinzugefügt ✓',
  exerciseExists: 'Übung existiert bereits',
  backupSaved: 'Backup gespeichert ✓',
};
