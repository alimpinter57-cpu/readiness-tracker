/* Student Omnibar: quick school tasks, notes and deadlines. */
(() => {
  'use strict';
  const KEY = 'readiness:schoolTasks';
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const pad = n => String(n).padStart(2, '0');
  const dateString = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const read = () => { try { const v = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(v) ? v : []; } catch (_) { return []; } };
  const write = rows => { localStorage.setItem(KEY, JSON.stringify(rows)); window.ReadinessCloud?.queueSync?.(); };
  const days = { minggu: 0, senin: 1, selasa: 2, rabu: 3, kamis: 4, jumat: 5, sabtu: 6 };
  let chipType = '';
  let chipDate = '';
  let parsed = null;

  function parse(raw) {
    let text = String(raw || '').trim();
    if (!text) return null;
    const today = new Date(); today.setHours(0,0,0,0);
    let due = null;
    const tomorrow = /\bbesok\b/i.test(text);
    if (tomorrow) { due = new Date(today); due.setDate(due.getDate() + 1); text = text.replace(/\bbesok\b/ig, ' '); }
    const dayMatch = text.match(/\b(minggu|senin|selasa|rabu|kamis|jumat|sabtu)\b/i);
    if (!due && dayMatch) {
      due = new Date(today);
      let delta = (days[dayMatch[1].toLocaleLowerCase('id-ID')] - today.getDay() + 7) % 7;
      if (delta === 0) delta = 7;
      due.setDate(due.getDate() + delta);
      text = text.replace(dayMatch[0], ' ');
    }
    let time = '';
    const timeMatch = text.match(/\b(?:jam\s*)?([01]?\d|2[0-3])(?:[:.]([0-5]\d))?\b/i);
    if (timeMatch && /\bjam\b/i.test(text)) {
      time = pad(Number(timeMatch[1])) + ':' + (timeMatch[2] || '00');
      text = text.replace(timeMatch[0], ' ');
    }
    let type = chipType || (/\bujian|ulangan|kuis\b/i.test(raw) ? 'Ujian' : /\bpiket\b/i.test(raw) ? 'Piket' : /\bcatatan|ingat\b/i.test(raw) ? 'Catatan' : 'Tugas');
    if (/\bujian|ulangan|kuis\b/i.test(text)) type = 'Ujian';
    else if (/\bpiket\b/i.test(text)) type = 'Piket';
    text = text.replace(/\b(kumpul|dikumpulkan|deadline|tenggat|jam)\b/ig, ' ').replace(/\s+/g, ' ').trim();
    if (!text) text = type === 'Ujian' ? 'Persiapan ujian' : type === 'Piket' ? 'Piket sekolah' : 'Tugas sekolah';
    return { title: text.slice(0, 120), type, dueDate: chipDate || (due ? dateString(due) : ''), dueTime: time, completed: false };
  }

  function formatDate(value) {
    if (!value) return 'Tanggal belum ditentukan';
    return new Date(value + 'T12:00:00').toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' });
  }
  function setMessage(message, error = false) {
    const node = $('schoolOmniMessage');
    if (node) { node.textContent = message; node.dataset.state = error ? 'error' : 'ok'; }
  }
  function showPreview(item) {
    parsed = item;
    const preview = $('schoolOmniPreview');
    if (!preview) return;
    if (!item) { preview.hidden = true; return; }
    preview.hidden = false;
    $('schoolOmniTitlePreview').textContent = item.title;
    $('schoolOmniTypePreview').textContent = item.type;
    $('schoolOmniDatePreview').textContent = formatDate(item.dueDate) + (item.dueTime ? ' · ' + item.dueTime : '');
    $('schoolOmniDate').value = item.dueDate;
    $('schoolOmniTime').value = item.dueTime;
  }
  function renderItems() {
    const host = $('schoolTaskList');
    if (!host) return;
    const rows = read().sort((a,b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999') || (a.dueTime || '99:99').localeCompare(b.dueTime || '99:99'));
    if (!rows.length) { host.innerHTML = '<div class="school-omni-empty">Belum ada tugas atau tenggat. Tulis satu kalimat di atas untuk memulai.</div>'; return; }
    host.innerHTML = rows.map(item => '<article class="school-task '+(item.completed ? 'is-complete' : '')+'"><label class="school-task-check"><input type="checkbox" data-school-done="'+esc(item.id)+'" '+(item.completed ? 'checked' : '')+' aria-label="Tandai selesai"><span>✓</span></label><div class="school-task-main"><strong>'+esc(item.title)+'</strong><small><span>'+esc(item.type)+'</span><span>'+esc(formatDate(item.dueDate))+(item.dueTime ? ' · '+esc(item.dueTime) : '')+'</span></small></div><button type="button" class="school-task-delete" data-school-delete="'+esc(item.id)+'" aria-label="Hapus '+esc(item.title)+'">×</button></article>').join('');
  }
  function init() {
    const form = $('schoolOmniForm');
    if (!form) return;
    const input = $('schoolOmniInput');
    document.querySelectorAll('[data-school-chip]').forEach(button => button.addEventListener('click', () => {
      const value = button.dataset.schoolChip;
      if (value === 'Besok') {
        const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate()+1); chipDate = dateString(d);
        input.value = input.value.trim(); if (!input.value) input.value = 'Tugas sekolah';
      } else {
        chipType = value;
        if (!input.value.trim()) input.value = value === 'Ujian' ? 'Ujian' : value === 'Piket' ? 'Piket sekolah' : 'Tugas sekolah';
      }
      document.querySelectorAll('[data-school-chip]').forEach(b => b.classList.toggle('is-selected', b === button));
      input.focus();
      showPreview(parse(input.value));
    }));
    form.addEventListener('submit', event => {
      event.preventDefault();
      const item = parse(input.value);
      if (!item) { setMessage('Tulis nama tugas atau catatan terlebih dahulu.', true); return; }
      if (chipDate) item.dueDate = chipDate;
      showPreview(item);
      setMessage('Periksa hasilnya, lalu tekan Simpan.');
    });
    $('schoolOmniSave')?.addEventListener('click', () => {
      if (!parsed) return;
      parsed.dueDate = $('schoolOmniDate').value || '';
      parsed.dueTime = $('schoolOmniTime').value || '';
      const rows = read();
      rows.unshift({ ...parsed, id: 'school-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,7), createdAt: new Date().toISOString() });
      try { write(rows); } catch (_) { setMessage('Gagal menyimpan. Periksa ruang penyimpanan perangkat.', true); return; }
      input.value = ''; chipType = ''; chipDate = ''; parsed = null;
      $('schoolOmniPreview').hidden = true;
      document.querySelectorAll('[data-school-chip]').forEach(b => b.classList.remove('is-selected'));
      setMessage('Tersimpan di daftar tugas sekolah.');
      renderItems();
    });
    $('schoolOmniCancel')?.addEventListener('click', () => { parsed = null; $('schoolOmniPreview').hidden = true; });
    $('schoolTaskList')?.addEventListener('change', event => {
      const checkbox = event.target.closest('[data-school-done]');
      if (!checkbox) return;
      write(read().map(item => item.id === checkbox.dataset.schoolDone ? { ...item, completed: checkbox.checked, updatedAt: new Date().toISOString() } : item));
      renderItems();
    });
    $('schoolTaskList')?.addEventListener('click', event => {
      const button = event.target.closest('[data-school-delete]');
      if (!button) return;
      const item = read().find(row => row.id === button.dataset.schoolDelete);
      if (item && confirm('Hapus "' + item.title + '"?')) { write(read().filter(row => row.id !== item.id)); renderItems(); }
    });
    window.addEventListener('readiness:cloud-restored', renderItems);
    renderItems();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();