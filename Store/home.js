(() => {
  const DAY_LABELS = ['H1','H2','H3','H4','H5','H6','H7'];
  let picked = {};

  function renderCycle() {
    const start = Store.getCycleStart();
    const dayIdx = Store.cycleDayIndex();
    const count = Store.cycleCheckinCount();
    document.getElementById('cycleDayNum').textContent = start ? `Hari ${dayIdx + 1}` : 'Belum mulai';
    document.getElementById('cycleBadge').textContent = start ? `${count}/7 check-in` : 'Belum ada data';

    const tl = document.getElementById('timeline');
    tl.innerHTML = '';
    const checkins = Store.getCheckins();
    for (let i = 0; i < 7; i++) {
      const node = document.createElement('div');
      node.className = 'tl-node';
      const dot = document.createElement('div');
      dot.className = 'tl-dot';
      if (start) {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        const ds = Store.todayStr(d);
        if (checkins.some(c => c.date === ds)) dot.classList.add('done');
        if (i === dayIdx) dot.classList.add('today');
      }
      node.appendChild(dot);
      const lbl = document.createElement('div');
      lbl.textContent = DAY_LABELS[i];
      node.appendChild(lbl);
      tl.appendChild(node);
    }

    document.getElementById('progressCount').textContent = count;
    document.getElementById('progressSub').textContent = start
      ? (count >= 7 ? 'Siklus selesai — waktunya evaluasi' : `Konsisten ${count} dari 7 hari`)
      : 'Mulai setelah check-in pertama';

    // Offer root-cause tool if cycle finished but hasn't clearly improved
    document.getElementById('rootCauseCard').style.display = (start && count >= 7) ? 'block' : 'none';
  }

  function renderCheckinForm() {
    const existing = Store.todayCheckin();
    if (existing) {
      document.getElementById('checkinTitle').textContent = 'Check-in hari ini — tersimpan';
      ['tidur','energi','stres','motivasi'].forEach(k => {
        const seg = document.querySelector(`.seg[data-key="${k}"]`);
        seg.querySelectorAll('button').forEach(b => {
          b.classList.toggle('on', Number(b.dataset.v) === existing[k]);
        });
      });
      document.getElementById('catatan').value = existing.catatan || '';
      document.getElementById('saveBtn').textContent = 'Perbarui check-in';
    }
  }

  function renderExperiments() {
    const list = Store.getExperiments();
    document.getElementById('expCount').textContent = `${list.length} eksperimen`;
    const box = document.getElementById('expList');
    box.innerHTML = '';
    if (list.length === 0) {
      box.innerHTML = '<div class="empty">Eksperimen belum berjalan</div>';
      return;
    }
    list.slice(0, 5).forEach(e => {
      const row = document.createElement('div');
      row.style.padding = '10px 0';
      row.style.borderBottom = '1px solid var(--border)';
      row.innerHTML = `<div style="font-weight:600;font-size:13px;">${e.reason}</div>
        <div class="muted">${e.date}${e.note ? ' · ' + e.note : ''}</div>`;
      box.appendChild(row);
    });
  }

  function renderWorkoutPreview() {
    const dayName = Store.todayDayName();
    const day = Store.PROGRAM[dayName];
    const log = Store.todayLog();
    const doneCount = log ? (log.done || []).length : 0;
    const total = day.exercises.length;
    const week = Store.currentWeek();
    const box = document.getElementById('wpBody');
    box.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
        <span class="badge ${day.type === 'rest' ? 'badge-amber' : 'badge-blue'}">${dayName} · ${day.label}</span>
        ${week ? `<span class="muted">Minggu ${week}/8</span>` : ''}
      </div>
      <div class="muted">${doneCount}/${total} gerakan ditandai selesai hari ini</div>
    `;
  }

  // Segmented pickers
  document.querySelectorAll('.seg').forEach(seg => {
    const key = seg.dataset.key;
    seg.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        seg.querySelectorAll('button').forEach(b => b.classList.remove('on'));
        btn.classList.add('on');
        picked[key] = Number(btn.dataset.v);
      });
    });
  });

  document.getElementById('saveBtn').addEventListener('click', () => {
    const existing = Store.todayCheckin() || {};
    const data = {
      tidur: picked.tidur ?? existing.tidur ?? 3,
      energi: picked.energi ?? existing.energi ?? 3,
      stres: picked.stres ?? existing.stres ?? 3,
      motivasi: picked.motivasi ?? existing.motivasi ?? 3,
      catatan: document.getElementById('catatan').value.trim(),
    };
    Store.saveCheckin(data);
    renderCycle();
    renderCheckinForm();
    renderWorkoutPreview();
  });

  // Root-cause picker
  let chosenReason = null;
  document.querySelectorAll('#reasonGrid button').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#reasonGrid button').forEach(b => b.classList.remove('on'));
      btn.classList.add('on');
      chosenReason = btn.dataset.r;
    });
  });
  document.getElementById('saveReason').addEventListener('click', () => {
    if (!chosenReason) return;
    Store.addExperiment(chosenReason, document.getElementById('reasonNote').value.trim());
    Store.resetCycle();
    chosenReason = null;
    document.getElementById('reasonNote').value = '';
    document.querySelectorAll('#reasonGrid button').forEach(b => b.classList.remove('on'));
    renderCycle();
    renderExperiments();
  });
  document.getElementById('cancelReason').addEventListener('click', () => {
    document.getElementById('rootCauseCard').style.display = 'none';
  });

  renderCycle();
  renderCheckinForm();
  renderExperiments();
  renderWorkoutPreview();
})();
