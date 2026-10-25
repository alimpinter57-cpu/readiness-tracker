/* Quick bulk schedule entry: category, day, task[, HH:MM-HH:MM] */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const DAY_MAP = new Map([
    ['senin',1],['sen',1],['monday',1],
    ['selasa',2],['sel',2],['tuesday',2],
    ['rabu',3],['rab',3],['wednesday',3],
    ['kamis',4],['kam',4],['thursday',4],
    ['jumat',5],['jumat',5],['jum',5],['friday',5],
    ['sabtu',6],['sab',6],['saturday',6],
    ['minggu',7],['min',7],['sunday',7]
  ]);
  const dayName = n => window.DailyTasks.DAYS.find(d => d.value === n)?.label || '';
  const parseLines = raw => String(raw || '').split(/\r?\n/).map((line, i) => ({line:line.trim(),lineNo:i+1})).filter(x => x.line && !x.line.startsWith('#')).map(({line,lineNo}) => {
    const fields = line.includes('|') ? line.split('|').map(s=>s.trim()) : line.split(',').map(s=>s.trim());
    if (fields.length < 3 || fields.length > 4 || fields.some(s=>!s)) return {lineNo,raw:line,error:'Gunakan: kategori, hari, pelajaran/tugas[, jam mulai-jam selesai]'};
    const [category, dayText, title] = fields;
    const day = DAY_MAP.get(dayText.toLocaleLowerCase('id-ID'));
    if (!day) return {lineNo,raw:line,error:'Hari tidak dikenali. Gunakan Senin sampai Minggu.'};
    let startTime = '04:00', endTime = '04:30';
    if (fields[3]) {
      const match = fields[3].match(/^(\d{2}:\d{2})\s*[-–]\s*(\d{2}:\d{2})$/);
      if (!match) return {lineNo,raw:line,error:'Format jam harus HH:MM-HH:MM.'};
      startTime = match[1]; endTime = match[2];
    }
    const validTime = t => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(t);
    if (!validTime(startTime) || !validTime(endTime) || endTime <= startTime) return {lineNo,raw:line,error:'Jam selesai harus setelah jam mulai.'};
    if (category.length > 50 || title.length > 90) return {lineNo,raw:line,error:'Kategori maksimal 50 karakter dan tugas maksimal 90 karakter.'};
    return {lineNo,raw:line,category,day,title,startTime,endTime};
  });
  const preview = () => {
    const result = parseLines($('dailyBulkInput').value);
    const root = $('dailyBulkPreview');
    const button = $('dailyBulkAddBtn');
    if (!result.length) {
      root.innerHTML = '<p class="daily-bulk-error">Masukkan setidaknya satu baris jadwal.</p>';
      button.disabled = true;
      return;
    }
    const errors = result.filter(r=>r.error);
    root.innerHTML = result.map(r => r.error
      ? '<div class="daily-bulk-row is-invalid"><span>!</span><div><strong>Baris '+r.lineNo+'</strong><small>'+r.error+'</small><code>'+r.raw.replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))+'</code></div></div>'
      : '<div class="daily-bulk-row"><span>✓</span><div><strong>'+r.category.replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))+' · '+dayName(r.day)+'</strong><small>'+r.startTime+'–'+r.endTime+'</small><code>'+r.title.replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))+'</code></div></div>'
    ).join('');
    button.disabled = errors.length > 0 || result.length === 0;
    $('dailyBulkStatus').textContent = errors.length ? errors.length+' baris perlu diperbaiki.' : result.length+' jadwal siap ditambahkan.';
  };
  $('dailyBulkPreviewBtn').addEventListener('click', preview);
  $('dailyBulkInput').addEventListener('input', () => { $('dailyBulkAddBtn').disabled = true; $('dailyBulkPreview').innerHTML=''; $('dailyBulkStatus').textContent='Periksa format sebelum menambahkan.'; });
  $('dailyBulkAddBtn').addEventListener('click', () => {
    const result = parseLines($('dailyBulkInput').value);
    if (!result.length || result.some(r=>r.error)) { preview(); return; }
    const api = window.DailyTasks;
    try {
      const categories = api.getCategories();
      const categoryIds = new Map(categories.map(c=>[c.name.toLocaleLowerCase('id-ID'),c.id]));
      // Resolve/create all categories before adding schedules.
      for (const row of result) {
        const key = row.category.toLocaleLowerCase('id-ID');
        if (!categoryIds.has(key)) {
          const created = api.addCategory(row.category, '#b58cff', '✦');
          categoryIds.set(key, created.id);
        }
      }
      for (const row of result) api.addTask({
        categoryId: categoryIds.get(row.category.toLocaleLowerCase('id-ID')),
        title: row.title, dayOfWeek: row.day,
        startTime: row.startTime, endTime: row.endTime, note: ''
      });
      $('dailyBulkStatus').textContent = 'Berhasil menambahkan '+result.length+' jadwal.';
      $('dailyBulkInput').value = '';
      $('dailyBulkPreview').innerHTML = '';
      $('dailyBulkAddBtn').disabled = true;
      window.dispatchEvent(new CustomEvent('readiness:daily-tasks-updated'));
    } catch (error) {
      $('dailyBulkStatus').textContent = 'Jadwal belum selesai ditambahkan: '+(error.message || 'terjadi kesalahan.');
      $('dailyBulkAddBtn').disabled = true;
    }
  });
})();