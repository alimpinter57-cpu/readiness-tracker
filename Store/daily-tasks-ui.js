/* Daily Task Tracker UI — simple user-entered schedule */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const api = () => window.DailyTasks;
  const selectedDayStorageKey = 'readiness:dailyTaskSelectedDay';
  const readSelectedDay = () => {
    try {
      const saved = Number(sessionStorage.getItem(selectedDayStorageKey));
      return Number.isInteger(saved) && saved >= 1 && saved <= 7 ? saved : api().dayNumber();
    } catch (_) { return api().dayNumber(); }
  };
  let selectedDay = readSelectedDay();
  const currentWeekDate = day => {
    const now = new Date();
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7) + day - 1);
    return api().today(monday);
  };
  let selectedDate = currentWeekDate(selectedDay);

  function ensureDefaultCategory() {
    if (!api().getCategories().length) api().addCategory('Kegiatan', '#67e8ad', '✦');
  }
  function activeCategory() {
    let category = api().getCategories().find(item => item.enabled !== false);
    if (!category) {
      category = api().getCategories()[0];
      if (category) api().setCategoryEnabled(category.id, true);
    }
    if (!category) category = api().addCategory('Kegiatan', '#67e8ad', '✦');
    return category;
  }
  function renderDayTabs() {
    $('dailyDayTabs').innerHTML = api().DAYS.map(day =>
      '<button type="button" class="daily-day-tab '+(day.value === selectedDay ? 'active' : '')+'" data-day="'+day.value+'" aria-pressed="'+(day.value === selectedDay)+'"><span>'+day.short+'</span><small>'+currentWeekDate(day.value).slice(8,10)+'</small></button>'
    ).join('');
  }
  function renderSchedule() {
    const day = api().DAYS.find(item => item.value === selectedDay);
    $('dailySelectedDate').textContent = day.label+' · '+new Date(selectedDate+'T12:00:00').toLocaleDateString('id-ID',{day:'numeric',month:'long'});
    $('dailyTaskDayHint').textContent = day.label;
    $('dailySubScheduleDayHint').textContent = day.label;
    renderSubScheduleOptions();
    const tasks = api().getTasksForDay(selectedDay, selectedDate);
    const progress = api().getProgress(selectedDay, selectedDate);
    $('dailyProgressText').textContent = progress.completed+' dari '+progress.total+' kegiatan selesai';
    $('dailyProgressPercent').textContent = progress.percent+'%';
    $('dailyProgressBar').style.width = progress.percent+'%';
    $('dailyProgressBar').parentElement.setAttribute('aria-valuenow', String(progress.percent));
    if (!tasks.length) {
      $('dailySchedule').innerHTML = '<div class="daily-empty"><span>✦</span><strong>Belum ada jadwal untuk '+esc(day.label)+'</strong><p>Isi nama kegiatan dan jamnya pada formulir di atas.</p></div>';
      return;
    }
    const taskMarkup = task => '<article class="daily-task '+(task.completed?'is-complete':'')+'"><label class="daily-task-check"><input type="checkbox" data-complete="'+esc(task.id)+'" '+(task.completed?'checked':'')+' aria-label="Tandai '+esc(task.title)+' selesai"><span aria-hidden="true">'+(task.completed?'✓':'')+'</span></label><div class="daily-task-main"><strong>'+esc(task.title)+'</strong><div class="daily-task-meta"><span>'+esc(task.startTime)+'–'+esc(task.endTime)+'</span>'+(task.note?'<span>'+esc(task.note)+'</span>':'')+'</div></div><div class="daily-task-actions"><button type="button" data-edit-task="'+esc(task.id)+'" aria-label="Edit '+esc(task.title)+'">Edit</button><button type="button" data-delete-task="'+esc(task.id)+'" aria-label="Hapus '+esc(task.title)+'">×</button></div></article>';
    const subSchedules = api().getSubSchedules().filter(item => item.dayOfWeek === selectedDay);
    const mainTasks = tasks.filter(task => !task.subScheduleId);
    let html = '';
    if (mainTasks.length) html += '<section class="daily-task-group"><div class="daily-group-title"><span class="daily-category-icon">✦</span><strong>Jadwal utama</strong><span>'+mainTasks.length+' kegiatan</span></div>'+mainTasks.map(taskMarkup).join('')+'</section>';
    subSchedules.forEach(sub => {
      const subTasks = tasks.filter(task => task.subScheduleId === sub.id);
      html += '<section class="daily-task-group daily-sub-schedule"><div class="daily-group-title"><span class="daily-category-icon">◈</span><strong>'+esc(sub.name)+'</strong><span>'+subTasks.length+' kegiatan</span><div class="daily-task-actions"><button type="button" data-rename-sub="'+esc(sub.id)+'">Ubah nama</button><button type="button" data-delete-sub="'+esc(sub.id)+'">Hapus sub jadwal</button></div></div>'+(subTasks.length ? subTasks.map(taskMarkup).join('') : '<p class="muted">Belum ada kegiatan di sub jadwal ini.</p>')+'</section>';
    });
    $('dailySchedule').innerHTML = html || '<div class="daily-empty"><span>✦</span><strong>Belum ada jadwal untuk '+esc(day.label)+'</strong><p>Tambahkan sub jadwal atau isi kegiatan pada formulir di atas.</p></div>';
  }
  function renderSubScheduleOptions() {
    const select = $('dailyTaskSubSchedule');
    if (!select) return;
    const previous = select.value;
    const options = api().getSubSchedules().filter(item => item.dayOfWeek === selectedDay);
    select.innerHTML = '<option value="">Jadwal utama (tanpa sub jadwal)</option>' + options.map(item => '<option value="'+esc(item.id)+'">'+esc(item.name)+'</option>').join('');
    if (options.some(item => item.id === previous)) select.value = previous;
  }
  function renderAll() { renderDayTabs(); renderSchedule(); }

  $('dailyDayTabs').addEventListener('click', event => {
    const button = event.target.closest('[data-day]');
    if (!button) return;
    selectedDay = Number(button.dataset.day);
    selectedDate = currentWeekDate(selectedDay);
    try { sessionStorage.setItem(selectedDayStorageKey, String(selectedDay)); } catch (_) {}
    renderAll();
  });
  $('dailySubScheduleForm').addEventListener('submit', event => {
    event.preventDefault();
    try {
      const sub = api().addSubSchedule({ name: $('dailySubScheduleName').value, dayOfWeek: selectedDay });
      $('dailySubScheduleName').value = '';
      $('dailyFormMessage').textContent = 'Sub jadwal "'+sub.name+'" dibuat untuk '+api().DAYS.find(d => d.value === selectedDay).label+'. Pilih sub jadwal saat menambahkan kegiatan.';
      renderAll();
    } catch (error) {
      $('dailyFormMessage').textContent = error.message || 'Sub jadwal gagal dibuat.';
    }
  });
  $('dailyTaskForm').addEventListener('submit', event => {
    event.preventDefault();
    try {
      api().addTask({
        categoryId: activeCategory().id,
        title: $('dailyTaskTitle').value,
        dayOfWeek: selectedDay,
        subScheduleId: $('dailyTaskSubSchedule').value,
        startTime: $('dailyStartTime').value,
        endTime: $('dailyEndTime').value,
        note: $('dailyTaskNote').value
      });
      $('dailyTaskTitle').value = '';
      $('dailyTaskNote').value = '';
      $('dailyFormMessage').textContent = 'Kegiatan tersimpan untuk hari '+api().DAYS.find(d => d.value === selectedDay).label+'.';
      renderAll();
    } catch (error) {
      $('dailyFormMessage').textContent = error.message || 'Kegiatan gagal disimpan.';
    }
  });
  $('dailySchedule').addEventListener('change', event => {
    const checkbox = event.target.closest('[data-complete]');
    if (!checkbox) return;
    try { api().setCompleted(checkbox.dataset.complete, checkbox.checked, selectedDate); renderSchedule(); }
    catch (error) {
      checkbox.checked = !checkbox.checked;
      $('dailyFormMessage').textContent = error.message || 'Status kegiatan gagal disimpan.';
    }
  });
  $('dailySchedule').addEventListener('click', event => {
    const editButton = event.target.closest('[data-edit-task]');
    const deleteButton = event.target.closest('[data-delete-task]');
    const renameSubButton = event.target.closest('[data-rename-sub]');
    const deleteSubButton = event.target.closest('[data-delete-sub]');
    if (renameSubButton) {
      const sub = api().getSubSchedules().find(item => item.id === renameSubButton.dataset.renameSub);
      if (sub) {
        const name = prompt('Nama sub jadwal:', sub.name);
        if (name !== null) {
          try { api().updateSubSchedule(sub.id, { name }); renderAll(); }
          catch (error) { $('dailyFormMessage').textContent = error.message || 'Sub jadwal gagal diubah.'; }
        }
      }
      return;
    }
    if (deleteSubButton) {
      const sub = api().getSubSchedules().find(item => item.id === deleteSubButton.dataset.deleteSub);
      if (sub && confirm('Hapus sub jadwal "'+sub.name+'"? Kegiatannya akan dipindahkan ke Jadwal utama, bukan dihapus.')) {
        try { api().deleteSubSchedule(sub.id); renderAll(); }
        catch (error) { $('dailyFormMessage').textContent = error.message || 'Sub jadwal gagal dihapus.'; }
      }
      return;
    }
    if (deleteButton) {
      const task = api().getSchedules().find(item => item.id === deleteButton.dataset.deleteTask);
      if (task && confirm('Hapus kegiatan "'+task.title+'" dari jadwal? Riwayat penyelesaian lama tetap disimpan.')) {
        try { api().deleteTask(task.id); renderAll(); }
        catch (error) { $('dailyFormMessage').textContent = error.message || 'Kegiatan gagal dihapus.'; }
      }
    }
    if (editButton) {
      const task = api().getSchedules().find(item => item.id === editButton.dataset.editTask);
      if (!task) return;
      const title = prompt('Nama kegiatan:', task.title);
      if (title === null) return;
      const startTime = prompt('Jam mulai (HH:MM):', task.startTime);
      if (startTime === null) return;
      const endTime = prompt('Jam selesai (HH:MM):', task.endTime);
      if (endTime === null) return;
      const note = prompt('Catatan (boleh kosong):', task.note || '');
      if (note === null) return;
      try { api().updateTask(task.id, { title, startTime, endTime, note }); renderAll(); }
      catch (error) { $('dailyFormMessage').textContent = error.message || 'Kegiatan gagal diperbarui.'; }
    }
  });
  window.addEventListener('readiness:daily-tasks-updated', renderAll);
  window.addEventListener('readiness:cloud-restored', renderAll);
  ensureDefaultCategory();
  renderAll();
})();
