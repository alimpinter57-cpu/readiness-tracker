/* Smart Schedule MVP — additive, local-first data model.
 * Migrates existing weekly DailyTasks into the new unified schedule without deleting legacy keys.
 */
(() => {
  'use strict';
  const KEY = 'readiness:smartScheduleItems';
  const CATEGORY_KEY = 'readiness:dailyTaskCategories';
  const LOG_KEY = 'readiness:dailyTaskLogs';
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
      console.error('[SmartSchedule] Gagal membaca', key, error);
      return fallback;
    }
  };
  const write = (key, value) => {
    localStorage.setItem(key, JSON.stringify(value));
    window.ReadinessCloud?.queueSync?.();
  };
  const uid = () => 'schedule-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);
  const today = (date = new Date()) => {
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  };
  const dayNumber = (date = new Date()) => ((date.getDay() + 6) % 7) + 1;
  const validDate = value => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false;
    const d = new Date(value + 'T12:00:00');
    return !Number.isNaN(d.getTime()) && today(d) === value;
  };
  const getCategories = () => read(CATEGORY_KEY, []);
  const getLogs = () => read(LOG_KEY, {});
  const getItems = () => {
    let items = read(KEY, null);
    if (Array.isArray(items)) return items;
    // One-time migration: preserve existing task IDs, category IDs and completion logs.
    const legacy = read('readiness:dailyTaskSchedules', []);
    items = legacy.map(task => ({
      id: task.id,
      title: task.title,
      note: task.note || '',
      scheduleType: 'weekly',
      dayOfWeek: Number(task.dayOfWeek),
      date: null,
      startTime: task.startTime || '16:00',
      endTime: task.endTime || '17:00',
      categoryId: task.categoryId,
      priority: 'normal',
      enabled: task.enabled !== false,
      createdAt: task.createdAt || new Date().toISOString(),
      updatedAt: task.updatedAt || new Date().toISOString()
    }));
    write(KEY, items);
    return items;
  };
  function ensureCategory() {
    const categories = getCategories();
    if (!categories.length) {
      const category = { id: 'cat-general', name: 'Umum', color: '#67e8ad', icon: '✦', enabled: true, createdAt: new Date().toISOString() };
      write(CATEGORY_KEY, [category]);
      return category;
    }
    return categories.find(item => item.enabled !== false) || categories[0];
  }
  function addCategory(name) {
    const clean = String(name || '').trim();
    if (!clean || clean.length > 50) throw new Error('Nama kategori harus 1–50 karakter.');
    const categories = getCategories();
    if (categories.some(item => item.name.toLocaleLowerCase() === clean.toLocaleLowerCase())) throw new Error('Kategori itu sudah ada.');
    const item = { id: uid(), name: clean, color: '#67e8ad', icon: '✦', enabled: true, createdAt: new Date().toISOString() };
    write(CATEGORY_KEY, [...categories, item]);
    return item;
  }
  function validate(input, existingId = null) {
    const title = String(input.title || '').trim();
    if (!title || title.length > 90) throw new Error('Nama kegiatan harus 1–90 karakter.');
    const categoryId = String(input.categoryId || '');
    if (!getCategories().some(c => c.id === categoryId && c.enabled !== false)) throw new Error('Pilih kategori aktif.');
    const scheduleType = input.scheduleType === 'once' ? 'once' : input.scheduleType === 'weekly' ? 'weekly' : '';
    if (!scheduleType) throw new Error('Pilih tipe jadwal.');
    if (scheduleType === 'once' && !validDate(input.date)) throw new Error('Pilih tanggal yang valid.');
    const dayOfWeek = Number(input.dayOfWeek);
    if (scheduleType === 'weekly' && (!Number.isInteger(dayOfWeek) || dayOfWeek < 1 || dayOfWeek > 7)) throw new Error('Pilih hari yang valid.');
    const time = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
    const startTime = String(input.startTime || '');
    const endTime = String(input.endTime || '');
    if (!time.test(startTime) || !time.test(endTime) || endTime <= startTime) throw new Error('Jam selesai harus setelah jam mulai.');
    const priority = ['low', 'normal', 'high'].includes(input.priority) ? input.priority : 'normal';
    return { title, note: String(input.note || '').trim().slice(0, 240), scheduleType, dayOfWeek: scheduleType === 'weekly' ? dayOfWeek : null, date: scheduleType === 'once' ? input.date : null, startTime, endTime, categoryId, priority, enabled: true };
  }
  function add(input) {
    const item = { id: uid(), ...validate(input), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    write(KEY, [...getItems(), item]);
    return item;
  }
  function update(id, patch) {
    const items = getItems();
    const current = items.find(item => item.id === id);
    if (!current) throw new Error('Kegiatan tidak ditemukan.');
    const next = { ...current, ...validate({ ...current, ...patch }), updatedAt: new Date().toISOString() };
    write(KEY, items.map(item => item.id === id ? next : item));
    return next;
  }
  function remove(id) {
    const items = getItems();
    if (!items.some(item => item.id === id)) return false;
    write(KEY, items.filter(item => item.id !== id));
    return true;
  }
  function getForDate(date = today()) {
    if (!validDate(date)) throw new Error('Tanggal tidak valid.');
    const day = dayNumber(new Date(date + 'T12:00:00'));
    const categories = new Map(getCategories().map(c => [c.id, c]));
    const log = getLogs()[date] || {};
    return getItems()
      .filter(item => item.enabled !== false &&
        (item.scheduleType === 'once' ? item.date === date : Number(item.dayOfWeek) === day) &&
        categories.get(item.categoryId)?.enabled !== false)
      .sort((a, b) => a.startTime.localeCompare(b.startTime))
      .map(item => ({ ...item, category: categories.get(item.categoryId) || { name: 'Umum', color: '#67e8ad' }, completed: log[item.id]?.completed === true }));
  }
  function setCompleted(id, completed, date = today()) {
    if (!validDate(date)) throw new Error('Tanggal tidak valid.');
    if (!getItems().some(item => item.id === id)) throw new Error('Kegiatan tidak ditemukan.');
    const logs = getLogs();
    const dayLog = { ...(logs[date] || {}) };
    if (completed) dayLog[id] = { completed: true, completedAt: new Date().toISOString() };
    else delete dayLog[id];
    if (Object.keys(dayLog).length) logs[date] = dayLog;
    else delete logs[date];
    write(LOG_KEY, logs);
    return getForDate(date);
  }
  ensureCategory();
  getItems(); // perform migration early, before rendering
  window.SmartSchedule = Object.freeze({ KEY, DAYS, today, dayNumber, validDate, getCategories, getItems, getForDate, addCategory, add, update, remove, setCompleted });
})();