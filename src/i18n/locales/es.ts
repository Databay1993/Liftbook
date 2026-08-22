export default {
  // General
  appName: 'Liftbook',
  save: 'Guardar',
  cancel: 'Cancelar',
  delete: 'Eliminar',
  add: 'Agregar',
  confirm: 'Confirmar',

  // Home
  heroSub: 'Registra tus lifts. Rompe tus récords.',
  readyToPush: '¿LISTO PARA\nEMPUJAR?',
  startWorkout: '+ INICIAR ENTRENAMIENTO',
  workouts: 'Entrenamientos',
  exercises: 'Ejercicios',
  sets: 'Series',
  restTimer: 'Temporizador',
  restAfterSet: 'Descanso después de cada serie',
  addCustomExercise: 'Ejercicio propio',
  exerciseName: 'Nombre del ejercicio...',
  backup: 'Copia de seguridad',
  exportData: '⬇ Exportar',
  importData: '⬆ Importar',
  backupHint: 'Copia JSON como seguridad adicional',
  workoutRunning: '⚡ Entrenamiento en curso',
  goBack: '→ Volver',

  // Workout
  noActiveWorkout: 'Sin entrenamiento activo',
  startFromHome: 'Inicia un entrenamiento desde el inicio',
  exerciseSaved: 'Ejercicio guardado ✓',
  exerciseDoneHint: 'Mantén ✓ para completar el ejercicio',
  trackWeightReps: 'Peso + Reps',
  trackBodyweight: 'Peso corporal',
  trackTime: 'Tiempo',
  trackDistTime: 'Dist + Tiempo',
  trackPercent: 'Porcentaje',
  durationSec: 'seg',
  distanceKm: 'km',
  percent: '%',

  // Sides (L/R)
  sidesOff: 'L|R apagado',
  sidesOn: 'L|R activo',
  leftSide: 'L',
  rightSide: 'R',
  addPair: '+ Par (L+D)',

  // Set timer
  timerStart: '▶',
  timerStop: '⏹',
  workout: 'Entrenamiento',
  addExercise: '+ Agregar ejercicio',
  saveWorkout: 'GUARDAR ENTRENAMIENTO 💪',
  addSet: '+ Agregar serie',
  noExercises: 'Sin ejercicios aún.\n¡Agrega uno abajo 👇',
  firstTime: '¡Primera vez – vamos! 🔥',
  lastSession: '⏱ Última vez',
  cancelWorkout: '¿Cancelar entrenamiento?',
  alreadyAdded: 'Ya agregado',
  chooseExercise: 'Elige ejercicio',
  search: 'Buscar...',
  newExercise: 'NUEVO EJERCICIO',
  noExercisesLogged: 'Sin ejercicios registrados',
  reps: 'Reps',
  kg: 'kg',
  custom: 'propio',

  // History
  history: 'Historial',
  noHistory: 'Sin entrenamientos aún.\n¡Comienza tu primera sesión!',

  // Stats
  stats: 'Estadísticas',
  personalRecords: 'Récords Personales',
  totalVolume: 'Volumen Total',
  weeklyFrequency: 'Últimas 8 Semanas',
  noData: 'Sin datos aún',
  sessions: 'sesiones',
  maxWeight: 'Peso Máx.',
  maxReps: 'Reps Máx.',
  bestVol: 'Mejor Vol.',
  volume: 'Volumen',
  lastWorkout: 'Último Entrenamiento',
  progressCharts: 'Progreso',
  noLastWorkout: 'Sin entrenamientos aún',

  // Recent sessions
  recentSessions: 'Últimas sesiones',
  sessionLatest: 'La última',
  sessionPrevious: 'La anterior',

  // Charts
  chartE1RM: 'e1RM',
  chartByWeight: 'Reps por peso',
  chartE1RMHint: '1RM estimado — mejor serie por sesión',
  chartByWeightHint: 'Reps por peso — un color por peso',
  e1rmTapHint: 'Toca un punto para ver detalles',
  e1rmWeakPoint: 'punto hueco = estimación alta',
  e1rmOverestimated: 'Más de {{limit}} reps — la estimación sale alta',

  // Trend metrics (tap to switch)
  trendPerMonthUnit: 'kg/mes',
  trendLabelSlope: 'tendencia robusta',
  trendLabelBlocks: 'Ø3 vs Ø3',
  trendLabelSmoothed: 'suavizado',
  trendLabelNone: 'tendencia',
  trendTooFew: 'pocos datos',
  trendRampNote: 'reinicio excluido',

  // Chart overlays per metric
  overlaySlope: '— — Discontinua = la tendencia mostrada',
  overlayBlocks: '━━ Barras = las dos medias de tres sesiones',
  overlayEwma: '━━ Curva azul = evolución suavizada',
  overlayDimmed: 'los puntos atenuados no cuentan',

  // Legend
  legendButton: 'Leyenda',
  legendTitle: 'Cómo se calculan las estadísticas',
  legendIntro: 'Todos los valores salen de las series que registras. Aquí se explica qué mide cada número y dónde deja de ser fiable.\n\nConsejo: toca el valor de tendencia a la derecha del gráfico para alternar entre las tres métricas. El gráfico dibuja entonces en qué se apoya ese número y atenúa los puntos que no cuentan.',

  legendE1RMTitle: 'e1RM — máximo estimado',
  legendE1RMBody: 'Lo que teóricamente levantarías una sola vez, extrapolado desde una serie normal con la fórmula de Epley: 5 reps con 80 kg dan unos 93 kg. La ventaja frente al peso puro: 80 kg × 8 vale más que 80 kg × 5, aunque el peso sea el mismo.',

  legendBestSetTitle: 'Un punto por sesión',
  legendBestSetBody: 'De cada sesión solo cuenta la mejor serie, la de mayor e1RM. Así las series de calentamiento y las suaves del final no arrastran la línea hacia abajo.',

  legendRepLimitTitle: 'Por qué algunos puntos son huecos',
  legendRepLimitBody: 'Por encima de {{limit}} repeticiones la fórmula se dispara: 20 reps ligeras calculan más que una triple pesada de verdad. Por eso esas series siempre pierden frente a una normal. Si aun así una sostiene la sesión, su punto se dibuja hueco: el valor está, pero léelo con cuidado.',

  legendBlocksTitle: 'Bloques de entrenamiento',
  legendBlocksBody: 'Más de {{gap}} días entre sesiones inicia un bloque nuevo, y la tendencia solo usa el actual. Los datos anteriores a una pausa larga ya no distorsionan nada.',

  legendRampTitle: 'Vuelta tras una pausa',
  legendRampBody: 'Tras un parón se vuelve a empezar ligero a propósito. Eso calcula como un progreso enorme sin serlo, así que las primeras {{ramp}} sesiones de un bloque quedan fuera de todas las métricas — en el gráfico siguen visibles, atenuadas. Si después quedan menos de {{minPoints}} sesiones, verás «pocos datos» en lugar de un número.',

  legendSlopeTitle: 'Tendencia robusta (kg/mes)',
  legendSlopeBody: 'Se calcula la pendiente entre cada par de puntos posible y se toma el valor central (Theil–Sen), de modo que un solo mal día apenas mueve el resultado. Los pares separados por menos de {{pair}} días no cuentan: dos sesiones en días seguidos darían proyecciones absurdas.',

  legendBlockCompareTitle: 'Ø3 vs Ø3',
  legendBlockCompareBody: 'La media de las tres últimas sesiones frente a la media de las tres anteriores. Fácil de seguir y resistente a valores sueltos, pero solo mira las seis sesiones más recientes.',

  legendEwmaTitle: 'Suavizado',
  legendEwmaBody: 'Una media móvil que pondera más las sesiones recientes (constante de tiempo {{tau}} días). Pesa según los días transcurridos reales: una sesión tras tres semanas de pausa mueve la curva mucho más que una del día siguiente. La línea azul del gráfico la muestra.',

  legendByWeightTitle: 'Reps por peso',
  legendByWeightBody: 'La otra vista del gráfico: una línea por peso, que muestra cuántas repeticiones logras con él a lo largo del tiempo. Útil cuando te mantienes en el mismo peso y el progreso está en las repeticiones.',

  legendRecentTitle: 'Últimas sesiones',
  legendRecentBody: 'Tus dos sesiones más recientes con todos los ejercicios y series — pensado para mirar atrás al decidir qué toca hoy.',

  legendPRTitle: 'Récords y volumen',
  legendPRBody: 'Peso máx. es lo más pesado que has movido, reps máx. el mayor número de repeticiones, mejor vol. la serie individual más fuerte (peso × reps). El volumen es todo sumado: cada serie como peso × reps.',

  legendFootnote: 'El gráfico e1RM necesita peso y repeticiones. En ejercicios por tiempo, peso corporal o porcentaje queda vacío — ahí sirve la vista «reps por peso».',

  // Settings
  settings: 'Ajustes',
  language: 'Idioma',
  selectLanguage: 'Seleccionar idioma',
  theme: 'Tema',
  themeDark: 'Dark Gym',
  themeEnergy: 'Energy',
  themeChalk: 'Chalk',
  about: 'Acerca de',
  version: 'Versión',

  // Navigation
  home: 'Inicio',
  historyTab: 'Historial',
  statsTab: 'Estadísticas',
  settingsTab: 'Ajustes',

  // Templates
  templates: 'Mis Entrenamientos',
  newTemplate: '+ Nuevo Plan',
  templateName: 'Nombre del plan (ej. Día de piernas)...',
  createTemplate: 'Guardar plan',
  noTemplates: 'Sin planes aún.\n¡Crea tu primer plan de entrenamiento!',
  startFromTemplate: 'Iniciar',
  deleteTemplate: '¿Eliminar plan?',
  templateExercises: 'Ejercicios',
  addExercisesToTemplate: 'Agrega ejercicios a tu plan',
  editTemplate: 'Editar plan',
  newExercisePlaceholder: 'Crear nuevo ejercicio...',

  // Last trained
  lastTrained: 'Último entrenamiento',
  daysAgo: 'días',
  today: 'hoy',
  yesterday: 'ayer',
  neverTrained: 'Sin entrenamientos aún',

  // Workout summary
  workoutDone: '¡Entrenamiento listo! 💪',
  summaryTotalSets: 'Series totales',
  summaryTotalVolume: 'Volumen total',
  summaryNewPR: '🏆 Nuevo récord personal',
  summaryClose: '¡Genial, gracias!',

  // Onboarding
  chooseLanguage: 'Elige tu idioma',
  continueBtn: 'Continuar',
  onboardingTitle: 'Bienvenido a\nLiftbook',
  onboardingSub: 'Tu diario personal de levantamiento.',
  onboardingStep1: 'Registra cada serie con peso y reps',
  onboardingStep2: 'Sigue tus récords personales automáticamente',
  onboardingStep3: 'Crea planes para cada día de entrenamiento',
  onboardingStart: 'VAMOS',

  // Exercise management
  exercisesSection: 'Gestionar ejercicios',
  renameExercise: 'Renombrar',
  newExerciseNamePlaceholder: 'Nuevo nombre...',
  renameSuccess: 'Renombrado ✓',
  renameError: 'Nombre ya existe',

  // Validation
  errorNoName: 'Por favor, ingresa un nombre para el plan.',
  errorNoExercises: 'Agrega al menos un ejercicio al plan.',
  errorSaveFailed: 'No se pudo guardar. Inténtalo de nuevo.',

  // Toast
  saved: 'Guardado ✓',
  imported: 'Importado ✓',
  invalidFile: 'Archivo inválido ✗',
  exerciseAdded: 'Ejercicio agregado ✓',
  exerciseExists: 'El ejercicio ya existe',
  backupSaved: 'Copia guardada ✓',
};
