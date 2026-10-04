/* store.js — shared data layer for Readiness + Latihan pages.
   Everything lives in localStorage on the visitor's device, so both
   pages (same origin on GitHub Pages) automatically share the data. */

const Store = (() => {
  const KEYS = {
    CHECKINS: 'readiness:checkins',
    EXPERIMENTS: 'readiness:experiments',
    CYCLE_START: 'readiness:cycleStart',
    WORKOUT_LOG: 'workout:log',
    WORKOUT_START: 'workout:start',
  };

  const todayStr = (d = new Date()) => {
    const tz = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return tz.toISOString().slice(0, 10);
  };

  const read = (key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  };
  const write = (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  };

  // ---- Readiness check-ins ----
  const getCheckins = () => read(KEYS.CHECKINS, []);
  const todayCheckin = () => getCheckins().find(c => c.date === todayStr());
  const saveCheckin = (data) => {
    const list = getCheckins().filter(c => c.date !== todayStr());
    list.push({ date: todayStr(), ...data });
    write(KEYS.CHECKINS, list);
    if (!read(KEYS.CYCLE_START, null)) write(KEYS.CYCLE_START, todayStr());
  };

  const getCycleStart = () => read(KEYS.CYCLE_START, null);
  const resetCycle = () => write(KEYS.CYCLE_START, todayStr());
  const cycleDayIndex = () => {
    const start = getCycleStart();
    if (!start) return 0;
    const diff = Math.floor((new Date(todayStr()) - new Date(start)) / 86400000);
    return Math.max(0, Math.min(6, diff));
  };
  const cycleCheckinCount = () => {
    const start = getCycleStart();
    if (!start) return 0;
    return getCheckins().filter(c => c.date >= start).length;
  };

  const getExperiments = () => read(KEYS.EXPERIMENTS, []);
  const addExperiment = (reason, note) => {
    const list = getExperiments();
    list.unshift({ date: todayStr(), reason, note: note || '' });
    write(KEYS.EXPERIMENTS, list);
  };

  // ---- Workout program (8-week plan) ----
  const PROGRAM = {
    Senin: { label: 'Upper Body A', type: 'strength', exercises: [
      { name: 'Pull-up / Chin-up', target: '3×5–10' },
      { name: 'Push-up', target: '3×8–15' },
      { name: 'One-arm Dumbbell Row', target: '3×10–15/sisi' },
      { name: 'Pike Push-up', target: '3×6–12' },
      { name: 'Dumbbell Curl', target: '2×10–15/sisi' },
      { name: 'Plank', target: '3×30–60 detik' },
    ]},
    Selasa: { label: 'Lower Body + Core', type: 'strength', exercises: [
      { name: 'Bulgarian Split Squat', target: '3×8–15/kaki' },
      { name: 'Goblet Squat 8kg', target: '3×10–20' },
      { name: 'Single-leg Romanian Deadlift', target: '3×8–15/kaki' },
      { name: 'Single-leg Calf Raise', target: '3×12–20/kaki' },
      { name: 'Hanging Knee Raise', target: '3×8–15' },
      { name: 'Side Plank', target: '2×30–60 detik/sisi' },
    ]},
    Rabu: { label: 'Recovery', type: 'rest', exercises: [
      { name: 'Mobilitas ringan', target: '5–10 menit' },
      { name: 'Fokus makan, belajar, tidur', target: '—' },
    ]},
    Kamis: { label: 'Upper Body B', type: 'strength', exercises: [
      { name: 'Chin-up / Pull-up', target: '3×5–10' },
      { name: 'Feet-elevated Push-up', target: '3×6–15' },
      { name: 'One-arm Dumbbell Row', target: '3×10–15/sisi' },
      { name: 'Dumbbell Shoulder Press', target: '3×8–15/sisi' },
      { name: 'Dumbbell Lateral Raise', target: '2×12–20/sisi' },
      { name: 'Hanging Knee Raise', target: '3×8–15' },
    ]},
    Jumat: { label: 'Full Body', type: 'strength', exercises: [
      { name: 'Pull-up / Chin-up', target: '3×5–10' },
      { name: 'Push-up', target: '3×10–20' },
      { name: 'Bulgarian Split Squat', target: '3×8–15/kaki' },
      { name: 'Dumbbell Romanian Deadlift', target: '3×10–15' },
      { name: 'Dumbbell Shoulder Press', target: '2×8–15/sisi' },
      { name: 'Plank', target: '3×30–60 detik' },
    ]},
    Sabtu: { label: 'Cardio dalam Rumah', type: 'cardio', exercises: [
      { name: 'Jumping Jack', target: '30 detik' },
      { name: 'High Knees', target: '30 detik' },
      { name: 'Mountain Climber', target: '30 detik' },
      { name: 'Istirahat', target: '30 detik' },
      { name: '— ulangi 4–6 ronde —', target: '20–25 menit total' },
    ]},
    Minggu: { label: 'Rest', type: 'rest', exercises: [
      { name: 'Tidak ada latihan wajib', target: '—' },
      { name: 'Fokus recovery dan tidur', target: '—' },
    ]},
  };
  const DAY_ORDER = ['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu','Minggu'];

  const WEEK_NOTES = {
    1: 'Gunakan batas bawah repetisi. Fokus teknik dan mencari level kesulitan yang tepat.',
    2: 'Tambahkan 1–2 repetisi/set jika teknik tetap bagus.',
    3: 'Tambahkan 1 repetisi lagi/set atau tambah 1 set pada latihan utama jika masih terlalu mudah.',
    4: 'Pertahankan atau turunkan volume ±20–30%. Fokus recovery dan teknik.',
    5: 'Kembali ke volume normal. Mulai gunakan variasi yang sedikit lebih sulit.',
    6: 'Tambahkan repetisi secara bertahap sampai batas atas range.',
    7: 'Jika sudah mencapai batas atas dengan mudah, naikkan kesulitan: Push-up → Feet-elevated Push-up, Squat → Bulgarian Split Squat, Pull-up → tempo lebih lambat, Plank → durasi lebih panjang.',
    8: 'Pertahankan teknik. Kurangi volume ±20–30% jika diperlukan. Catat perkembangan.',
  };

  const WARMUP = [
    'Arm circles — 30 detik',
    'Shoulder rotation — 30 detik',
    'Bodyweight squat — 10 repetisi',
    'Hip rotation — 30 detik',
    'Easy jumping jack — 30 detik',
    'Push-up ringan — 5–10 repetisi',
    'Pull-up ringan / scapular pull-up — 5 repetisi',
  ];

  const RULES = [
    'Pemanasan 5 menit sebelum latihan.',
    'Teknik > jumlah repetisi.',
    'Sisakan ±1–3 repetisi sebelum gagal pada sebagian besar set.',
    'Istirahat 60–120 detik antarset.',
    'Jangan memaksakan gerakan jika muncul nyeri tajam.',
    'Jika semua target repetisi tercapai dengan teknik bagus, naikkan tingkat kesulitan.',
    'Minggu ke-4 dan ke-8: kurangi volume ±20–30% jika tubuh terasa lelah.',
  ];

  const todayDayName = () => DAY_ORDER[(new Date().getDay() + 6) % 7]; // Mon-first

  const getWorkoutStart = () => read(KEYS.WORKOUT_START, null);
  const setWorkoutStart = (dateStr) => write(KEYS.WORKOUT_START, dateStr || todayStr());
  const currentWeek = () => {
    const start = getWorkoutStart();
    if (!start) return null;
    const diff = Math.floor((new Date(todayStr()) - new Date(start)) / 86400000);
    return Math.max(1, Math.min(8, Math.floor(diff / 7) + 1));
  };

  const getWorkoutLog = () => read(KEYS.WORKOUT_LOG, []);
  const getLogFor = (dateStr) => getWorkoutLog().find(w => w.date === dateStr);
  const todayLog = () => getLogFor(todayStr());
  const toggleExercise = (dateStr, dayName, exIndex) => {
    const log = getWorkoutLog();
    let entry = log.find(w => w.date === dateStr);
    if (!entry) {
      entry = { date: dateStr, hari: dayName, done: [] };
      log.push(entry);
    }
    const set = new Set(entry.done || []);
    if (set.has(exIndex)) set.delete(exIndex); else set.add(exIndex);
    entry.done = Array.from(set);
    write(KEYS.WORKOUT_LOG, log);
    return entry;
  };
  const weekCompletionCount = () => {
    const start7 = new Date();
    start7.setDate(start7.getDate() - 6);
    const startStr = todayStr(start7);
    return getWorkoutLog().filter(w => w.date >= startStr && (w.done || []).length > 0).length;
  };

  // ---- Custom habits (additive data layer; existing keys/data remain untouched) ----
  const HABIT_KEYS = {
    HABITS: 'readiness:habits',
    LOGS: 'readiness:habitLogs',
    WORKOUT_PLANS: 'readiness:workoutPlans',
    WORKOUT_CUSTOM_LOGS: 'readiness:workoutCustomLogs',
  };
  const getHabits = () => read(HABIT_KEYS.HABITS, []);
  const saveHabits = (list) => write(HABIT_KEYS.HABITS, list);
  const getHabitLogs = () => read(HABIT_KEYS.LOGS, {});
  const isHabitPaused = (h, ds=todayStr()) => (h.pauses||[]).some(p=>p.from<=ds&&(!p.to||ds<p.to));
  const pauseHabit = (id, reason) => { const h=getHabits().find(x=>x.id===id); if(!h||isHabitPaused(h))return; updateHabit(id,{pauses:[...(h.pauses||[]),{from:todayStr(),to:null,reason:String(reason||'Keperluan mendesak').trim()}]}); };
  const resumeHabit = id => { const h=getHabits().find(x=>x.id===id);if(!h)return;const pauses=[...(h.pauses||[])];for(let i=pauses.length-1;i>=0;i--){if(!pauses[i].to){pauses[i]={...pauses[i],to:todayStr()};break;}}updateHabit(id,{pauses});};
  const saveHabitLog = (dateStr, habitId, value) => {
    const logs = getHabitLogs();
    if (!logs[dateStr]) logs[dateStr] = {};
    logs[dateStr][habitId] = value;
    write(HABIT_KEYS.LOGS, logs);
  };
  const getHabitValue = (dateStr, habitId) => {
    const logs = getHabitLogs();
    return logs[dateStr] && logs[dateStr][habitId] !== undefined ? logs[dateStr][habitId] : null;
  };
  const addHabit = (habit) => {
    const list = getHabits();
    list.push({ id: 'h-' + Date.now() + '-' + Math.random().toString(36).slice(2,7), createdAt: todayStr(), ...habit });
    saveHabits(list);
  };
  const updateHabit = (id, patch) => {
    saveHabits(getHabits().map(h => h.id === id ? { ...h, ...patch } : h));
  };
  const deleteHabit = (id) => saveHabits(getHabits().filter(h => h.id !== id));
  const setHabitValue = (habitId, value) => saveHabitLog(todayStr(), habitId, value);
  const setHabitValueForDate = (dateStr, habitId, value) => { if (value === null || value === undefined || value === '') { const logs=getHabitLogs(); if(logs[dateStr]) { delete logs[dateStr][habitId]; if(!Object.keys(logs[dateStr]).length) delete logs[dateStr]; write(HABIT_KEYS.LOGS,logs); } } else saveHabitLog(dateStr,habitId,value); };
  const getWorkoutPlans = () => read(HABIT_KEYS.WORKOUT_PLANS, []);
  const saveWorkoutPlans = (list) => write(HABIT_KEYS.WORKOUT_PLANS, list);
  const addWorkoutPlan = (plan) => {
    const list = getWorkoutPlans();
    list.push({ id:'wp-' + Date.now() + '-' + Math.random().toString(36).slice(2,7), createdAt:todayStr(), ...plan });
    saveWorkoutPlans(list);
  };
  const updateWorkoutPlan = (id, patch) => saveWorkoutPlans(getWorkoutPlans().map(p=>p.id===id?{...p,...patch}:p));
  const deleteWorkoutPlan = (id) => saveWorkoutPlans(getWorkoutPlans().filter(p=>p.id!==id));
  const getCustomWorkoutLogs = () => read(HABIT_KEYS.WORKOUT_CUSTOM_LOGS, {});
  const setCustomWorkoutLog = (dateStr, planId, exerciseIndex, setIndex, done) => {
    const logs=getCustomWorkoutLogs();
    logs[dateStr] ||= {};
    logs[dateStr][planId] ||= {};
    logs[dateStr][planId][exerciseIndex] ||= {};
    logs[dateStr][planId][exerciseIndex][setIndex]=done;
    write(HABIT_KEYS.WORKOUT_CUSTOM_LOGS, logs);
  };
  const getCustomWorkoutLog = (dateStr, planId) => getCustomWorkoutLogs()[dateStr]?.[planId] || {};
  const getHabitWeekProgress = (habitId) => {
    const end=new Date(todayStr()), start=new Date(end); start.setDate(start.getDate()-6);
    const logs=getHabitLogs(), values=[];
    for(let i=0;i<7;i++){const d=new Date(start);d.setDate(start.getDate()+i);const ds=todayStr(d);values.push(logs[ds]?.[habitId] ?? null);}
    return values;
  };

  return {
    todayStr, todayDayName,
    getCheckins, todayCheckin, saveCheckin,
    getCycleStart, resetCycle, cycleDayIndex, cycleCheckinCount,
    getExperiments, addExperiment,
    PROGRAM, DAY_ORDER, WEEK_NOTES, WARMUP, RULES,
    getWorkoutStart, setWorkoutStart, currentWeek,
    getWorkoutLog, getLogFor, todayLog, toggleExercise, weekCompletionCount,
    getHabits, addHabit, updateHabit, deleteHabit, getHabitValue, setHabitValue, setHabitValueForDate, getHabitWeekProgress, isHabitPaused, pauseHabit, resumeHabit,
    getWorkoutPlans, addWorkoutPlan, updateWorkoutPlan, deleteWorkoutPlan, getCustomWorkoutLog, setCustomWorkoutLog,
  };
})();
