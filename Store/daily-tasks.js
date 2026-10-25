/* Daily Task Tracker — additive localStorage module.
 * Data uses readiness:* keys so the existing Store snapshot can sync it without schema changes.
 */
(() => {
  'use strict';

  const KEYS = {
    categories: 'readiness:dailyTaskCategories',
    schedules: 'readiness:dailyTaskSchedules',
    subSchedules: 'readiness:dailyTaskSubSchedules',
    logs: 'readiness:dailyTaskLogs'
  };
  const DAYS = [
    { value: 1, label: 'Senin', short: 'Sen' },
    { value: 2, label: 'Selasa', short: 'Sel' },
    { value: 3, label: 'Rabu', short: 'Rab' },
    { value: 4, label: 'Kamis', short: 'Kam' },
    { value: 5, label: 'Jumat', short: 'Jum' },
    { value: 6, label: 'Sabtu', short: 'Sab' },
    { value: 7, label: 'Minggu', short: 'Min' }
  ];

  const read = (key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (error) {
      console.error('[DailyTasks] Gagal membaca data:', key, error);
      return fallback;
    }
  };
  const write = (key, value) => {
    // Do not silently pretend a write succeeded if localStorage is full/blocked.
    localStorage.setItem(key, JSON.stringify(value));
    window.ReadinessCloud?.queueSync?.();
  };
  const uid = prefix => prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  const today = (date = new Date()) => {
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  };
  const dayNumber = (date = new Date()) => ((date.getDay() + 6) % 7) + 1;
  const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
  const getCategories = () => read(KEYS.categories, []);
  const getSchedules = () => read(KEYS.schedules, []);
  const getSubSchedules = () => read(KEYS.subSchedules, []);
  const getLogs = () => read(KEYS.logs, {});

  function addCategory(name, color = '#67e8ad', icon = '✦') {
    const cleanName = String(name || '').trim();
    if (!cleanName) throw new Error('Nama kategori wajib diisi.');
    if (cleanName.length > 50) throw new Error('Nama kategori maksimal 50 karakter.');
    const categories = getCategories();
    if (categories.some(item => item.name.toLocaleLowerCase() === cleanName.toLocaleLowerCase())) {
      throw new Error('Kategori dengan nama itu sudah ada.');
    }
    const category = { id: uid('cat'), name: cleanName, color, icon, enabled: true, createdAt: new Date().toISOString() };
    write(KEYS.categories, [...categories, category]);
    return category;
  }

  function updateCategory(id, patch = {}) {
    const categories = getCategories();
    const current = categories.find(item => item.id === id);
    if (!current) throw new Error('Kategori tidak ditemukan.');
    const nextName = patch.name === undefined ? current.name : String(patch.name).trim();
    if (!nextName || nextName.length > 50) throw new Error('Nama kategori harus 1–50 karakter.');
    if (categories.some(item => item.id !== id && item.name.toLocaleLowerCase() === nextName.toLocaleLowerCase())) {
      throw new Error('Nama kategori sudah dipakai.');
    }
    const next = categories.map(item => item.id === id ? { ...item, ...patch, name: nextName } : item);
    write(KEYS.categories, next);
    return next.find(item => item.id === id);
  }

  function addSubSchedule(input = {}) {
    const name = String(input.name || '').trim();
    if (!name) throw new Error('Nama kelompok tugas wajib diisi.');
    if (name.length > 50) throw new Error('Nama kelompok tugas maksimal 50 karakter.');
    const items = getSubSchedules();
    if (items.some(item => item.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      throw new Error('Kelompok tugas dengan nama itu sudah ada.');
    }
    const item = { id: uid('sub'), name, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    write(KEYS.subSchedules, [...items, item]);
    return item;
  }

  function updateSubSchedule(id, patch = {}) {
    const items = getSubSchedules();
    const current = items.find(item => item.id === id);
    if (!current) throw new Error('Sub jadwal tidak ditemukan.');
    const name = patch.name === undefined ? current.name : String(patch.name).trim();
    if (!name || name.length > 50) throw new Error('Nama sub jadwal harus 1–50 karakter.');
    if (items.some(item => item.id !== id && item.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      throw new Error('Nama kelompok tugas sudah dipakai.');
    }
    const next = { ...current, ...patch, name, updatedAt: new Date().toISOString() };
    write(KEYS.subSchedules, items.map(item => item.id === id ? next : item));
    return next;
  }

  function deleteSubSchedule(id) {
    const items = getSubSchedules();
    if (!items.some(item => item.id === id)) return false;
    // Preserve activities by moving them back to the main schedule.
    write(KEYS.schedules, getSchedules().map(task => task.subScheduleId === id ? { ...task, subScheduleId: null, updatedAt: new Date().toISOString() } : task));
    write(KEYS.subSchedules, items.filter(item => item.id !== id));
    return true;
  }

  function addTask(input = {}) {
    const categories = getCategories();
    const category = categories.find(item => item.id === input.categoryId && item.enabled !== false);
    if (!category) throw new Error('Pilih kategori aktif.');
    const title = String(input.title || '').trim();
    if (!title) throw new Error('Nama tugas wajib diisi.');
    if (title.length > 90) throw new Error('Nama tugas maksimal 90 karakter.');
    const dayOfWeek = Number(input.dayOfWeek);
    if (!Number.isInteger(dayOfWeek) || dayOfWeek < 1 || dayOfWeek > 7) throw new Error('Pilih hari yang valid.');
    const startTime = String(input.startTime || '');
    const endTime = String(input.endTime || '');
    const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
    if (!timePattern.test(startTime) || !timePattern.test(endTime) || endTime <= startTime) {
      throw new Error('Jam selesai harus setelah jam mulai.');
    }
    const subScheduleId = String(input.subScheduleId || '').trim() || null;
    if (subScheduleId) {
      const subSchedule = getSubSchedules().find(item => item.id === subScheduleId);
      if (!subSchedule) throw new Error('Kelompok tugas tidak ditemukan.');
    }
    const schedules = getSchedules();
    const task = {
      id: uid('task'),
      categoryId: category.id,
      subScheduleId,
      title,
      dayOfWeek,
      startTime,
      endTime,
      note: String(input.note || '').trim().slice(0, 240),
      order: schedules.filter(item => item.dayOfWeek === dayOfWeek).length,
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    write(KEYS.schedules, [...schedules, task]);
    return task;
  }

  function updateTask(id, patch = {}) {
    const schedules = getSchedules();
    const current = schedules.find(item => item.id === id);
    if (!current) throw new Error('Tugas tidak ditemukan.');
    const next = { ...current, ...patch, updatedAt: new Date().toISOString() };
    next.title = String(next.title || '').trim();
    next.dayOfWeek = Number(next.dayOfWeek);
    if (!next.title || next.title.length > 90) throw new Error('Nama tugas harus 1–90 karakter.');
    if (!getCategories().some(item => item.id === next.categoryId)) throw new Error('Kategori tidak ditemukan.');
    next.subScheduleId = String(next.subScheduleId || '').trim() || null;
    if (next.subScheduleId) {
      const subSchedule = getSubSchedules().find(item => item.id === next.subScheduleId);
      if (!subSchedule) throw new Error('Kelompok tugas tidak ditemukan.');
    }
    if (!Number.isInteger(next.dayOfWeek) || next.dayOfWeek < 1 || next.dayOfWeek > 7) throw new Error('Hari tidak valid.');
    const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
    if (!timePattern.test(next.startTime) || !timePattern.test(next.endTime) || next.endTime <= next.startTime) {
      throw new Error('Rentang waktu tidak valid.');
    }
    write(KEYS.schedules, schedules.map(item => item.id === id ? next : item));
    return next;
  }

  function deleteTask(id) {
    const schedules = getSchedules();
    if (!schedules.some(item => item.id === id)) return false;
    write(KEYS.schedules, schedules.filter(item => item.id !== id));
    // Keep completion history for audit/history; deleted task IDs are not reused.
    return true;
  }

  function setCategoryEnabled(id, enabled) {
    return updateCategory(id, { enabled: Boolean(enabled) });
  }

  function getTasksForDay(day = dayNumber(), date = today()) {
    const dayNum = typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day) ? dayNumber(new Date(day + 'T12:00:00')) : Number(day);
    const dateStr = typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : date;
    const categories = new Map(getCategories().map(item => [item.id, item]));
    const dailyLog = getLogs()[dateStr] || {};
    const subSchedules = new Map(getSubSchedules().map(item => [item.id, item]));
    return getSchedules()
      .filter(item => item.enabled !== false && item.dayOfWeek === dayNum && categories.get(item.categoryId)?.enabled !== false)
      .sort((a, b) => a.startTime.localeCompare(b.startTime) || a.order - b.order)
      .map(item => ({ ...item, category: categories.get(item.categoryId) || null, subSchedule: subSchedules.get(item.subScheduleId) || null, completed: dailyLog[item.id]?.completed === true, completedAt: dailyLog[item.id]?.completedAt || null }));
  }

  function setCompleted(taskId, completed, date = today()) {
    if (!validDate(date)) throw new Error('Tanggal tidak valid.');
    if (!getSchedules().some(item => item.id === taskId)) throw new Error('Tugas tidak ditemukan.');
    const logs = getLogs();
    const dayLog = { ...(logs[date] || {}) };
    if (completed) dayLog[taskId] = { completed: true, completedAt: new Date().toISOString() };
    else delete dayLog[taskId];
    if (Object.keys(dayLog).length) logs[date] = dayLog;
    else delete logs[date];
    write(KEYS.logs, logs);
    return getProgress(dayNumber(new Date(date + 'T12:00:00')), date);
  }

  function getProgress(day = dayNumber(), date = today()) {
    const tasks = getTasksForDay(day, date);
    const completed = tasks.filter(task => task.completed).length;
    return { total: tasks.length, completed, percent: tasks.length ? Math.round(completed / tasks.length * 100) : 0 };
  }

  function getState() {
    return { categories: getCategories(), schedules: getSchedules(), logs: getLogs() };
  }

  // Safe one-time migration from per-day groups. Consolidates duplicate names and remaps tasks without deleting them.
  function migrateSubSchedulesToReusableGroups() {
    const original = getSubSchedules();
    if (!original.length) return;
    const canonicalByName = new Map(), idMap = new Map(), normalized = [];
    let changed = false;
    original.forEach(item => {
      const name = String(item.name || '').trim();
      const key = name.toLocaleLowerCase();
      const existing = canonicalByName.get(key);
      if (existing) { idMap.set(item.id, existing.id); changed = true; }
      else {
        const clean = { id: item.id, name, createdAt: item.createdAt || new Date().toISOString(), updatedAt: item.updatedAt || new Date().toISOString() };
        canonicalByName.set(key, clean); idMap.set(item.id, clean.id); normalized.push(clean);
        if (Object.prototype.hasOwnProperty.call(item, 'dayOfWeek')) changed = true;
      }
    });
    if (!changed) return;
    const schedules = getSchedules().map(task => {
      const mapped = task.subScheduleId ? idMap.get(task.subScheduleId) : null;
      return mapped && mapped !== task.subScheduleId ? { ...task, subScheduleId: mapped, updatedAt: new Date().toISOString() } : task;
    });
    write(KEYS.schedules, schedules);
    write(KEYS.subSchedules, normalized);
  }
  migrateSubSchedulesToReusableGroups();

  window.DailyTasks = Object.freeze({
    KEYS, DAYS, today, dayNumber, getCategories, getSchedules, getLogs, getState,
    addCategory, updateCategory, setCategoryEnabled, addSubSchedule, updateSubSchedule, deleteSubSchedule, getSubSchedules, addTask, updateTask, deleteTask,
    getTasksForDay, setCompleted, getProgress
  });
})();
