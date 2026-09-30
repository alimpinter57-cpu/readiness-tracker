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

  // ---- Custom habits UI ----
  const HABIT_ICONS = [
    ['👟','Sepatu'],['💧','Air'],['🍽️','Makanan'],['🌙','Bulan'],['💊','Pil'],['🧘','Meditasi'],
    ['📖','Buku'],['✍️','Pena'],['🧠','Otak'],['❤️','Hati'],['⏰','Jam'],['💻','Laptop'],
    ['🎯','Target'],['🎒','Tas'],['👛','Dompet'],['☕','Cangkir'],['🧹','Sapu'],['🐾','Hewan'],['🎨','Seni'],['❌','Silang']
  ];
  const HABIT_COLORS = ['green','blue','purple','amber','red','cyan'];
  let editingHabitId = null;
  let habitIcon = HABIT_ICONS[0][0];
  let habitColor = HABIT_COLORS[0];

  function renderHabitBuilder(){
    const colors = document.getElementById('habitColors');
    const icons = document.getElementById('habitIcons');
    if (!colors || !icons) return;
    colors.innerHTML = HABIT_COLORS.map(c => `<button type="button" class="color-choice ${c} ${c===habitColor?'on':''}" data-color="${c}" aria-label="Warna ${c}"></button>`).join('');
    icons.innerHTML = HABIT_ICONS.map(([icon,label]) => `<button type="button" class="icon-choice ${icon===habitIcon?'on':''}" data-icon="${icon}" title="${label}" aria-label="${label}">${icon}</button>`).join('');
    colors.querySelectorAll('button').forEach(b=>b.onclick=()=>{habitColor=b.dataset.color;renderHabitBuilder();renderHabitPreview();});
    icons.querySelectorAll('button').forEach(b=>b.onclick=()=>{habitIcon=b.dataset.icon;renderHabitBuilder();renderHabitPreview();});
    renderHabitPreview();
  }
  function renderHabitPreview(){
    const p=document.getElementById('habitPreview'); if(!p)return;
    const name=document.getElementById('habitName').value.trim()||'Kebiasaan baru';
    p.innerHTML=`<span class="habit-icon ${habitColor}">${habitIcon}</span><div><strong>${name}</strong><small>Pratinjau kebiasaan</small></div>`;
  }
  function openHabitModal(habit=null){
    editingHabitId=habit?.id||null; habitIcon=habit?.icon||HABIT_ICONS[0][0]; habitColor=habit?.color||HABIT_COLORS[0];
    document.getElementById('habitModalTitle').textContent=habit?'Edit kebiasaan':'Buat kebiasaan';
    document.getElementById('habitName').value=habit?.name||'';
    document.getElementById('habitType').value=habit?.type||'binary';
    document.getElementById('habitTarget').value=habit?.target ?? '';
    document.getElementById('habitUnit').value=habit?.unit||'';
    document.getElementById('habitRule').value=habit?.rule||'';
    document.getElementById('habitModal').hidden=false;
    document.body.classList.add('modal-open');
    updateHabitTypeUI(); renderHabitBuilder(); document.getElementById('habitName').focus();
  }
  function closeHabitModal(){document.getElementById('habitModal').hidden=true;document.body.classList.remove('modal-open');editingHabitId=null;}
  function updateHabitTypeUI(){
    const type=document.getElementById('habitType').value, unit=document.getElementById('habitUnit'), target=document.getElementById('habitTarget');
    document.getElementById('habitTargetHint').textContent=type==='binary'?'(tidak diperlukan)':type==='duration'?'(menit)':'(jumlah)';
    unit.placeholder=type==='duration'?'menit':'contoh: ml, kali, halaman';
    target.disabled=type==='binary'; if(type==='binary')target.value='';
  }
  function renderHabits(){
    const habits=Store.getHabits(), list=document.getElementById('habitList'), empty=document.getElementById('habitEmpty'); if(!list)return;
    empty.style.display=habits.length?'none':'flex'; list.innerHTML='';
    habits.forEach(h=>{
      const value=Store.getHabitValue(Store.todayStr(),h.id);
      const row=document.createElement('article'); row.className=`habit-row ${h.color||'green'}`;
      const icon=document.createElement('div'); icon.className=`habit-icon ${h.color||'green'}`; icon.textContent=h.icon||'🎯';
      const info=document.createElement('div'); info.className='habit-info';
      info.innerHTML=`<strong>${escapeHtml(h.name)}</strong><small>${escapeHtml(h.rule||habitTypeLabel(h.type))}</small>`;
      const control=document.createElement('div'); control.className='habit-control';
      if(h.type==='binary'){
        const b=document.createElement('button'); b.className='habit-check '+(value===true?'done':''); b.textContent=value===true?'✓':'○'; b.onclick=()=>{Store.setHabitValue(h.id,value===true?false:true);renderHabits();}; control.appendChild(b);
      }else if(h.type==='duration'){
        control.innerHTML=`<div class="duration-input"><input type="number" min="0" placeholder="0" value="${value??''}" data-hid="${h.id}"><span>menit</span></div>`;
        const input=control.querySelector('input'); input.onchange=()=>{Store.setHabitValue(h.id,Math.max(0,Number(input.value)||0));renderHabits();};
      }else{
        control.innerHTML=`<div class="quantity-input"><input type="number" min="0" placeholder="0" value="${value??''}" data-hid="${h.id}"><span>${escapeHtml(h.unit||'kali')}</span></div>`;
        const input=control.querySelector('input'); input.onchange=()=>{Store.setHabitValue(h.id,Math.max(0,Number(input.value)||0));renderHabits();};
      }
      const actions=document.createElement('div'); actions.className='habit-actions';
      const edit=document.createElement('button'); edit.textContent='Edit'; edit.onclick=()=>openHabitModal(h);
      const del=document.createElement('button'); del.textContent='×'; del.title='Hapus'; del.onclick=()=>{if(confirm('Hapus kebiasaan ini? Riwayat data kebiasaan tidak ikut dihapus.')){Store.deleteHabit(h.id);renderHabits();}};
      actions.append(edit,del); row.append(icon,info,control,actions); list.appendChild(row);
    });
  }
  function habitTypeLabel(t){return t==='duration'?'Durasi':t==='quantity'?'Kuantitas':'Ya / Tidak';}
  function escapeHtml(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));}
  document.getElementById('addHabitBtn')?.addEventListener('click',()=>openHabitModal());
  document.getElementById('emptyAddHabit')?.addEventListener('click',()=>openHabitModal());
  document.getElementById('closeHabitModal')?.addEventListener('click',closeHabitModal);
  document.getElementById('cancelHabit')?.addEventListener('click',closeHabitModal);
  document.getElementById('habitName')?.addEventListener('input',renderHabitPreview);
  document.getElementById('habitType')?.addEventListener('change',updateHabitTypeUI);
  document.getElementById('habitModal')?.addEventListener('click',e=>{if(e.target.id==='habitModal')closeHabitModal();});
  document.getElementById('saveHabit')?.addEventListener('click',()=>{
    const name=document.getElementById('habitName').value.trim(), type=document.getElementById('habitType').value;
    if(!name){document.getElementById('habitName').focus();return;}
    const habit={name,type,target:type==='binary'?null:Math.max(0,Number(document.getElementById('habitTarget').value)||0),unit:document.getElementById('habitUnit').value.trim(),rule:document.getElementById('habitRule').value.trim(),color:habitColor,icon:habitIcon};
    if(editingHabitId) Store.updateHabit(editingHabitId,habit); else Store.addHabit(habit);
    closeHabitModal(); renderHabits();
  });
  renderHabits();

  renderCycle();
  renderCheckinForm();
  renderExperiments();
  renderWorkoutPreview();
})();
