(() => {
  let selectedDay = Store.todayDayName();

  function renderWeekHeader() {
    const week = Store.currentWeek();
    const controls = document.getElementById('weekControls');
    const numEl = document.getElementById('weekNum');
    const badgeEl = document.getElementById('weekBadge');
    const noteEl = document.getElementById('weekNote');

    if (!week) {
      numEl.textContent = 'Belum mulai';
      badgeEl.textContent = 'Siklus 8 minggu';
      noteEl.textContent = '';
      controls.innerHTML = `<button class="btn btn-blue" id="startProgram">Mulai program dari hari ini</button>`;
      document.getElementById('startProgram').addEventListener('click', () => {
        Store.setWorkoutStart(Store.todayStr());
        renderAll();
      });
      return;
    }
    numEl.textContent = `Minggu ${week} / 8`;
    badgeEl.textContent = (week === 4 || week === 8) ? 'Minggu deload' : 'Minggu progresif';
    noteEl.textContent = Store.WEEK_NOTES[week];
    controls.innerHTML = `<button class="btn btn-ghost" id="resetProgram">Atur ulang tanggal mulai</button>`;
    document.getElementById('resetProgram').addEventListener('click', () => {
      if (confirm('Atur ulang tanggal mulai program ke hari ini?')) {
        Store.setWorkoutStart(Store.todayStr());
        renderAll();
      }
    });
  }

  function renderRecommendation() {
    const banner = document.getElementById('recoBanner');
    const checkin = Store.todayCheckin();
    const day = Store.PROGRAM[selectedDay];
    const week = Store.currentWeek();

    if (!checkin) {
      banner.style.display = 'block';
      banner.className = 'banner banner-blue';
      banner.textContent = 'Belum ada check-in hari ini — isi di halaman Check-in supaya rekomendasi sesi lebih akurat.';
      return;
    }
    if (day.type === 'rest') { banner.style.display = 'none'; return; }

    let msg = null, tone = 'blue';
    if (checkin.energi <= 2 || checkin.tidur <= 2) {
      msg = `Energi/tidur rendah hari ini (${checkin.energi}/5, tidur ${checkin.tidur}/5). Kurangi 1–2 repetisi dari batas atas target, dan jangan paksakan sampai gagal.`;
      tone = 'amber';
    } else if (week === 4 || week === 8) {
      msg = `Minggu deload — turunkan volume ±20–30% dari biasanya walau energi bagus, ini bagian dari rencana pemulihan.`;
      tone = 'amber';
    } else if (checkin.energi >= 4 && checkin.motivasi >= 4) {
      msg = `Energi dan motivasi bagus (${checkin.energi}/5, ${checkin.motivasi}/5) — waktu yang tepat untuk menambah repetisi ke batas atas target minggu ini.`;
      tone = 'green';
    }
    if (msg) {
      banner.style.display = 'block';
      banner.className = `banner banner-${tone}`;
      banner.textContent = msg;
    } else {
      banner.style.display = 'none';
    }
  }

  function renderDayStrip() {
    const strip = document.getElementById('dayStrip');
    strip.innerHTML = '';
    Store.DAY_ORDER.forEach(name => {
      const btn = document.createElement('button');
      const day = Store.PROGRAM[name];
      btn.textContent = name.slice(0, 3);
      if (day.type === 'rest') btn.classList.add('rest');
      if (name === selectedDay) btn.classList.add('active');
      btn.addEventListener('click', () => { selectedDay = name; renderAll(); });
      strip.appendChild(btn);
    });
  }

  function renderExercises() {
    const day = Store.PROGRAM[selectedDay];
    const wrap = document.getElementById('dayBadgeWrap');
    wrap.innerHTML = `<div style="margin:10px 0;">
      <span class="badge ${day.type === 'rest' ? 'badge-amber' : (day.type === 'cardio' ? 'badge-green' : 'badge-blue')}">${selectedDay} · ${day.label}</span>
    </div>`;

    const listEl = document.getElementById('exerciseList');
    const restNote = document.getElementById('restNote');

    if (day.type === 'rest') {
      listEl.innerHTML = '';
      restNote.style.display = 'block';
      return;
    }
    restNote.style.display = 'none';

    const todayStr = Store.todayStr();
    const isToday = selectedDay === Store.todayDayName();
    const log = isToday ? Store.todayLog() : Store.getLogFor(todayStr);
    const done = new Set((isToday && log && log.done) || []);

    listEl.innerHTML = '';
    day.exercises.forEach((ex, i) => {
      const row = document.createElement('div');
      row.className = 'ex-row';
      const check = document.createElement('div');
      check.className = 'ex-check' + (done.has(i) ? ' checked' : '');
      const info = document.createElement('div');
      info.innerHTML = `<div class="ex-name">${ex.name}</div><div class="ex-target">${ex.target}</div>`;
      row.appendChild(check);
      row.appendChild(info);
      if (isToday) {
        row.style.cursor = 'pointer';
        row.addEventListener('click', () => {
          Store.toggleExercise(todayStr, selectedDay, i);
          renderExercises();
        });
      } else {
        row.style.opacity = '0.55';
      }
      listEl.appendChild(row);
    });
  }

  function renderStaticLists() {
    document.getElementById('warmupList').textContent = Store.WARMUP.join(' · ');
    const rulesEl = document.getElementById('rulesList');
    rulesEl.innerHTML = '';
    Store.RULES.forEach(r => {
      const row = document.createElement('div');
      row.style.padding = '7px 0';
      row.style.borderBottom = '1px solid var(--border)';
      row.style.fontSize = '13px';
      row.textContent = r;
      rulesEl.appendChild(row);
    });
    rulesEl.lastChild.style.borderBottom = 'none';
  }

  function renderAll() {
    renderWeekHeader();
    renderDayStrip();
    renderExercises();
    renderRecommendation();
  }

  renderAll();
  renderStaticLists();
})();
