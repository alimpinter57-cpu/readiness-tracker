/* Smart Schedule UI — one-off and recurring events, mobile-first. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const api = () => window.SmartSchedule;
  const today = api().today();
  let selectedDate = today;
  let editingId = null;
  const mondayOf = date => {
    const d = new Date(date + 'T12:00:00');
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return api().today(d);
  };
  const shiftDate = (date, days) => {
    const d = new Date(date + 'T12:00:00');
    d.setDate(d.getDate() + days);
    return api().today(d);
  };
  const dayLabel = date => new Date(date + 'T12:00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' });
  const currentWeek = () => {
    const monday = mondayOf(selectedDate);
    return Array.from({length:7}, (_, i) => shiftDate(monday, i));
  };
  function renderCategories(selected = $('ssCategory').value) {
    const categories = api().getCategories().filter(c => c.enabled !== false);
    $('ssCategory').innerHTML = categories.map(c => '<option value="' + esc(c.id) + '">' + esc(c.name) + '</option>').join('');
    if (categories.some(c => c.id === selected)) $('ssCategory').value = selected;
  }
  function renderWeek() {
    $('ssWeek').innerHTML = currentWeek().map(date => {
      const d = new Date(date + 'T12:00:00');
      const active = date === selectedDate;
      const isToday = date === today;
      return '<button class="ss-day ' + (active ? 'active' : '') + '" type="button" data-date="' + date + '" aria-pressed="' + active + '"><span>' + d.toLocaleDateString('id-ID',{weekday:'short'}) + '</span><strong>' + d.getDate() + '</strong>' + (isToday ? '<small>Hari ini</small>' : '<small>&nbsp;</small>') + '</button>';
    }).join('');
    $('ssDate').value = selectedDate;
    $('ssSelectedLabel').textContent = dayLabel(selectedDate);
  }
  function renderItems() {
    renderWeek();
    const items = api().getForDate(selectedDate);
    const done = items.filter(x => x.completed).length;
    const pct = items.length ? Math.round(done / items.length * 100) : 0;
    $('ssProgressText').textContent = done + ' dari ' + items.length + ' kegiatan selesai';
    $('ssProgressPct').textContent = pct + '%';
    $('ssProgressBar').style.width = pct + '%';
    $('ssProgressTrack').setAttribute('aria-valuenow', String(pct));
    $('ssItems').innerHTML = items.length ? items.map(item =>
      '<article class="ss-item ' + (item.completed ? 'is-complete' : '') + '">' +
        '<label class="ss-check"><input type="checkbox" data-done="' + esc(item.id) + '" ' + (item.completed ? 'checked' : '') + ' aria-label="Tandai ' + esc(item.title) + ' selesai"><span>✓</span></label>' +
        '<div class="ss-item-body"><div class="ss-item-title">' + esc(item.title) + '</div><div class="ss-meta"><span>' + esc(item.startTime) + '–' + esc(item.endTime) + '</span><span class="ss-category">' + esc(item.category.name) + '</span><span class="ss-kind">' + (item.scheduleType === 'once' ? 'Sekali' : 'Mingguan') + '</span></div>' + (item.note ? '<p>' + esc(item.note) + '</p>' : '') + '</div>' +
        '<div class="ss-item-side"><span class="ss-priority p-' + esc(item.priority) + '">' + ({high:'Prioritas tinggi',normal:'Normal',low:'Rendah'}[item.priority] || 'Normal') + '</span><div class="ss-actions"><button type="button" data-edit="' + esc(item.id) + '">Edit</button><button type="button" data-delete="' + esc(item.id) + '" aria-label="Hapus ' + esc(item.title) + '">Hapus</button></div></div>' +
      '</article>'
    ).join('') : '<div class="ss-empty"><span>✦</span><strong>Belum ada kegiatan</strong><p>Tambahkan jadwal baru, atau pilih tanggal lain untuk melihat agenda.</p></div>';
  }
  function setType(type) {
    const once = type === 'once';
    $('ssDateField').hidden = !once;
    $('ssDayField').hidden = once;
    $('ssDateInput').required = once;
    $('ssDay').required = !once;
    $('ssTypeHint').textContent = once ? 'Hanya muncul pada tanggal yang dipilih.' : 'Muncul setiap minggu pada hari yang dipilih.';
  }
  function resetForm() {
    editingId = null;
    $('ssFormTitle').textContent = 'Tambah kegiatan';
    $('ssSave').textContent = 'Simpan kegiatan';
    $('ssCancelEdit').hidden = true;
    $('ssForm').reset();
    $('ssType').value = 'weekly';
    $('ssDay').value = String(api().dayNumber(new Date(selectedDate + 'T12:00:00')));
    $('ssDateInput').value = selectedDate;
    $('ssStart').value = '16:00';
    $('ssEnd').value = '17:00';
    $('ssPriority').value = 'normal';
    renderCategories();
    setType('weekly');
  }
  function startEdit(id) {
    const item = api().getItems().find(x => x.id === id);
    if (!item) return;
    editingId = id;
    $('ssFormTitle').textContent = 'Edit kegiatan';
    $('ssSave').textContent = 'Simpan perubahan';
    $('ssCancelEdit').hidden = false;
    $('ssTitle').value = item.title;
    $('ssNote').value = item.note || '';
    $('ssType').value = item.scheduleType || 'weekly';
    $('ssDateInput').value = item.date || selectedDate;
    $('ssDay').value = String(item.dayOfWeek || 1);
    $('ssStart').value = item.startTime;
    $('ssEnd').value = item.endTime;
    $('ssPriority').value = item.priority || 'normal';
    renderCategories(item.categoryId);
    setType($('ssType').value);
    $('ssForm').scrollIntoView({behavior:'smooth', block:'start'});
    $('ssTitle').focus({preventScroll:true});
  }
  $('ssType').addEventListener('change', () => setType($('ssType').value));
  $('ssWeek').addEventListener('click', event => {
    const button = event.target.closest('[data-date]');
    if (!button) return;
    selectedDate = button.dataset.date;
    renderItems();
    resetForm();
  });
  $('ssDate').addEventListener('change', () => {
    if (!api().validDate($('ssDate').value)) return;
    selectedDate = $('ssDate').value;
    renderItems();
    resetForm();
  });
  $('ssToday').addEventListener('click', () => { selectedDate = today; renderItems(); resetForm(); });
  $('ssPrevWeek').addEventListener('click', () => { selectedDate = shiftDate(selectedDate, -7); renderItems(); resetForm(); });
  $('ssNextWeek').addEventListener('click', () => { selectedDate = shiftDate(selectedDate, 7); renderItems(); resetForm(); });
  $('ssAddCategory').addEventListener('click', () => {
    const name = prompt('Nama kategori baru:');
    if (name === null) return;
    try { const c = api().addCategory(name); renderCategories(c.id); $('ssMessage').textContent = 'Kategori "' + c.name + '" ditambahkan.'; }
    catch (error) { $('ssMessage').textContent = error.message || 'Kategori gagal ditambahkan.'; }
  });
  $('ssCancelEdit').addEventListener('click', resetForm);
  $('ssForm').addEventListener('submit', event => {
    event.preventDefault();
    const input = {
      title: $('ssTitle').value,
      note: $('ssNote').value,
      scheduleType: $('ssType').value,
      date: $('ssDateInput').value,
      dayOfWeek: Number($('ssDay').value),
      startTime: $('ssStart').value,
      endTime: $('ssEnd').value,
      categoryId: $('ssCategory').value,
      priority: $('ssPriority').value
    };
    try {
      if (editingId) api().update(editingId, input);
      else api().add(input);
      $('ssMessage').textContent = editingId ? 'Perubahan jadwal tersimpan.' : 'Kegiatan berhasil ditambahkan.';
      resetForm();
      renderItems();
    } catch (error) { $('ssMessage').textContent = error.message || 'Jadwal gagal disimpan.'; }
  });
  $('ssItems').addEventListener('change', event => {
    const input = event.target.closest('[data-done]');
    if (!input) return;
    try { api().setCompleted(input.dataset.done, input.checked, selectedDate); renderItems(); }
    catch (error) { input.checked = !input.checked; $('ssMessage').textContent = error.message || 'Status tidak dapat disimpan.'; }
  });
  $('ssItems').addEventListener('click', event => {
    const edit = event.target.closest('[data-edit]');
    const del = event.target.closest('[data-delete]');
    if (edit) startEdit(edit.dataset.edit);
    if (del) {
      const item = api().getItems().find(x => x.id === del.dataset.delete);
      if (item && confirm('Hapus "' + item.title + '" dari jadwal? Riwayat selesai yang lama tetap disimpan.')) {
        api().remove(item.id);
        if (editingId === item.id) resetForm();
        renderItems();
        $('ssMessage').textContent = 'Kegiatan dihapus.';
      }
    }
  });
  window.addEventListener('readiness:cloud-restored', () => { renderCategories(); renderItems(); });
  window.addEventListener('readiness:daily-tasks-updated', () => { renderCategories(); renderItems(); });
  resetForm();
  renderItems();
})();