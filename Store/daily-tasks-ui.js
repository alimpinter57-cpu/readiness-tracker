/* Daily Task Tracker UI */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const api = () => window.DailyTasks;
  let selectedDay = api().dayNumber();
  const currentWeekDate = day => {
    const now = new Date();
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7) + day - 1);
    return api().today(monday);
  };
  let selectedDate = currentWeekDate(selectedDay);

  function ensureDefaultCategory() {
    if (!api().getCategories().length) api().addCategory('Platinum Time', '#b58cff', '✦');
  }

  function renderDayTabs() {
    $('dailyDayTabs').innerHTML = api().DAYS.map(day =>
      '<button type="button" class="daily-day-tab '+(day.value === selectedDay ? 'active' : '')+'" data-day="'+day.value+'" aria-pressed="'+(day.value === selectedDay)+'"><span>'+day.short+'</span><small>'+currentWeekDate(day.value).slice(8,10)+'</small></button>'
    ).join('');
  }

  function renderCategoryOptions() {
    const categories = api().getCategories().filter(category => category.enabled !== false);
    const select = $('dailyCategory');
    const previous = select.value;
    select.innerHTML = categories.map(category => '<option value="'+esc(category.id)+'">'+esc(category.icon || '✦')+' '+esc(category.name)+'</option>').join('');
    if (categories.some(category => category.id === previous)) select.value = previous;
    $('dailyCategoryEmpty').hidden = categories.length > 0;
    $('dailyTaskSubmit').disabled = categories.length === 0;
    $('dailyCategoryList').innerHTML = api().getCategories().map(category =>
      '<div class="daily-category-chip"><span class="daily-category-icon" style="background:'+esc(category.color || '#263247')+'">'+esc(category.icon || '✦')+'</span><span>'+esc(category.name)+'</span><button type="button" data-toggle-category="'+esc(category.id)+'" aria-label="'+(category.enabled === false ? 'Aktifkan ' : 'Nonaktifkan ')+esc(category.name)+'">'+(category.enabled === false ? 'Aktifkan' : 'Jeda')+'</button></div>'
    ).join('') || '<p class="muted">Belum ada kategori.</p>';
  }

  function renderSchedule() {
    const day = api().DAYS.find(item => item.value === selectedDay);
    $('dailySelectedDate').textContent = day.label+' · '+new Date(selectedDate+'T12:00:00').toLocaleDateString('id-ID',{day:'numeric',month:'long'});
    const tasks = api().getTasksForDay(selectedDay, selectedDate);
    const progress = api().getProgress(selectedDay, selectedDate);
    $('dailyProgressText').textContent = progress.completed+' dari '+progress.total+' tugas selesai';
    $('dailyProgressPercent').textContent = progress.percent+'%';
    $('dailyProgressBar').style.width = progress.percent+'%';
    $('dailyProgressBar').parentElement.setAttribute('aria-valuenow', String(progress.percent));
    if (!tasks.length) {
      $('dailySchedule').innerHTML = '<div class="daily-empty"><span>✦</span><strong>Belum ada jadwal untuk '+esc(day.label)+'</strong><p>Tambahkan tugas menggunakan formulir di bawah.</p></div>';
      return;
    }
    const groups = new Map();
    tasks.forEach(task => {
      const key = task.category?.id || 'uncategorized';
      if (!groups.has(key)) groups.set(key, { category: task.category, tasks: [] });
      groups.get(key).tasks.push(task);
    });
    $('dailySchedule').innerHTML = Array.from(groups.values()).map(group =>
      '<section class="daily-task-group"><div class="daily-group-title"><span class="daily-category-icon" style="background:'+esc(group.category?.color || '#263247')+'">'+esc(group.category?.icon || '✦')+'</span><strong>'+esc(group.category?.name || 'Kategori tidak tersedia')+'</strong><span>'+group.tasks.length+' tugas</span></div>'+
      group.tasks.map(task => '<article class="daily-task '+(task.completed?'is-complete':'')+'"><label class="daily-task-check"><input type="checkbox" data-complete="'+esc(task.id)+'" '+(task.completed?'checked':'')+' aria-label="Tandai '+esc(task.title)+' selesai"><span aria-hidden="true">'+(task.completed?'✓':'')+'</span></label><div class="daily-task-main"><strong>'+esc(task.title)+'</strong><div class="daily-task-meta"><span>'+esc(task.startTime)+'–'+esc(task.endTime)+'</span>'+(task.note?'<span>'+esc(task.note)+'</span>':'')+'</div></div><div class="daily-task-actions"><button type="button" data-edit-task="'+esc(task.id)+'" aria-label="Edit '+esc(task.title)+'">Edit</button><button type="button" data-delete-task="'+esc(task.id)+'" aria-label="Hapus '+esc(task.title)+'">×</button></div></article>'
    ).join('')+'</section>'
    ).join('');
  }

  function renderAll() {
    renderDayTabs();
    renderCategoryOptions();
    renderSchedule();
  }

  $('dailyDayTabs').addEventListener('click', event => {
    const button = event.target.closest('[data-day]');
    if (!button) return;
    selectedDay = Number(button.dataset.day);
    selectedDate = currentWeekDate(selectedDay);
    renderAll();
  });

  $('dailyCategoryForm').addEventListener('submit', event => {
    event.preventDefault();
    const name = $('dailyNewCategory').value;
    try {
      api().addCategory(name, $('dailyCategoryColor').value, $('dailyCategoryIcon').value);
      $('dailyNewCategory').value = '';
      $('dailyFormMessage').textContent = 'Kategori berhasil ditambahkan.';
      renderAll();
    } catch (error) {
      $('dailyFormMessage').textContent = error.message || 'Kategori gagal disimpan.';
    }
  });

  $('dailyTaskForm').addEventListener('submit', event => {
    event.preventDefault();
    try {
      api().addTask({
        categoryId: $('dailyCategory').value,
        title: $('dailyTaskTitle').value,
        dayOfWeek: selectedDay,
        startTime: $('dailyStartTime').value,
        endTime: $('dailyEndTime').value,
        note: $('dailyTaskNote').value
      });
      $('dailyTaskTitle').value = '';
      $('dailyTaskNote').value = '';
      $('dailyFormMessage').textContent = 'Tugas berhasil ditambahkan ke '+api().DAYS.find(d=>d.value===selectedDay).label+'.';
      renderAll();
    } catch (error) {
      $('dailyFormMessage').textContent = error.message || 'Tugas gagal disimpan.';
    }
  });

  $('dailyCategoryList').addEventListener('click', event => {
    const button = event.target.closest('[data-toggle-category]');
    if (!button) return;
    const category = api().getCategories().find(item => item.id === button.dataset.toggleCategory);
    if (!category) return;
    try {
      api().setCategoryEnabled(category.id, category.enabled === false);
      renderAll();
    } catch (error) {
      $('dailyFormMessage').textContent = error.message || 'Kategori gagal diperbarui.';
    }
  });

  $('dailySchedule').addEventListener('change', event => {
    const checkbox = event.target.closest('[data-complete]');
    if (!checkbox) return;
    try {
      api().setCompleted(checkbox.dataset.complete, checkbox.checked, selectedDate);
      renderSchedule();
    } catch (error) {
      checkbox.checked = !checkbox.checked;
      $('dailyFormMessage').textContent = error.message || 'Status tugas gagal disimpan.';
    }
  });

  $('dailySchedule').addEventListener('click', event => {
    const editButton = event.target.closest('[data-edit-task]');
    const deleteButton = event.target.closest('[data-delete-task]');
    if (deleteButton) {
      const task = api().getSchedules().find(item => item.id === deleteButton.dataset.deleteTask);
      if (task && confirm('Hapus tugas "'+task.title+'" dari jadwal? Riwayat penyelesaian lama tetap disimpan.')) {
        try { api().deleteTask(task.id); renderAll(); }
        catch (error) { $('dailyFormMessage').textContent = error.message || 'Tugas gagal dihapus.'; }
      }
    }
    if (editButton) {
      const task = api().getSchedules().find(item => item.id === editButton.dataset.editTask);
      if (!task) return;
      const title = prompt('Nama tugas:', task.title);
      if (title === null) return;
      const startTime = prompt('Jam mulai (HH:MM):', task.startTime);
      if (startTime === null) return;
      const endTime = prompt('Jam selesai (HH:MM):', task.endTime);
      if (endTime === null) return;
      const note = prompt('Catatan (boleh kosong):', task.note || '');
      if (note === null) return;
      try { api().updateTask(task.id, { title, startTime, endTime, note }); renderAll(); }
      catch (error) { $('dailyFormMessage').textContent = error.message || 'Tugas gagal diperbarui.'; }
    }
  });

  // Cloud restoration replaces localStorage after authentication. Repaint from the restored snapshot.
  window.addEventListener('readiness:cloud-restored', () => renderAll());

  ensureDefaultCategory();
  renderAll();
})();
