(() => {
const ICONS=[['👟','Sepatu'],['💧','Air'],['🍽️','Makanan'],['🌙','Bulan'],['💊','Pil'],['🧘','Meditasi'],['📖','Buku'],['✍️','Pena'],['🧠','Otak'],['❤️','Hati'],['⏰','Jam'],['💻','Laptop'],['🎯','Target'],['🎒','Tas'],['👛','Dompet'],['☕','Cangkir'],['🧹','Sapu'],['🐾','Hewan'],['🎨','Seni'],['❌','Silang']];
const COLORS=['green','blue','purple','amber','red','cyan'];
const DAYS=[['Sen','1'],['Sel','2'],['Rab','3'],['Kam','4'],['Jum','5'],['Sab','6'],['Min','0']];
let editing=null, icon=ICONS[0][0], color=COLORS[0], schedule=['1','2','3','4','5','6','0'], timers={};

const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
function date(){return Store.todayStr();}
function jsDay(){return String(new Date().getDay());}
function todayHabits(){return Store.getHabits().filter(h=>!h.schedule||h.schedule.includes(jsDay()));}
function typeLabel(t){return t==='duration'?'Durasi':t==='quantity'?'Kuantitas':'Ya / Tidak';}

function renderHeader(){
 const now=new Date(), names=['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
 $('dayName').textContent=names[now.getDay()];
 $('todayLabel').textContent=now.toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'}).toUpperCase();
 const strip=$('weekStrip');strip.innerHTML='';
 for(let i=6;i>=0;i--){const d=new Date(now);d.setDate(now.getDate()-i);const done=Store.getHabits().filter(h=>(!h.schedule||h.schedule.includes(String(d.getDay())))).filter(h=>Store.getHabitValue(Store.todayStr(d),h.id)!==null).length;const total=Store.getHabits().filter(h=>!h.schedule||h.schedule.includes(String(d.getDay()))).length;const b=document.createElement('div');b.className='week-day '+(i===0?'current':'');b.innerHTML='<b>'+['Min','Sen','Sel','Rab','Kam','Jum','Sab'][d.getDay()]+'</b><span>'+ (total?Math.round(done/total*100):0)+'%</span>';strip.appendChild(b);}
}

function renderHabits(){
 const habits=todayHabits(), list=$('habitList'), empty=$('habitEmpty');list.innerHTML='';empty.style.display=habits.length?'none':'flex';
 let completed=0;
 habits.forEach(h=>{
  const v=Store.getHabitValue(date(),h.id), target=Number(h.target)||0;
  const done=h.type==='binary'?v===true:(target>0&&Number(v)>=target);
  if(done)completed++;
  const row=document.createElement('article');row.className='habit-row '+(h.color||'green');
  const iconEl=document.createElement('div');iconEl.className='habit-icon '+(h.color||'green');iconEl.textContent=h.icon||'🎯';
  const info=document.createElement('div');info.className='habit-info';
  const meta=h.rule||typeLabel(h.type)+(target?' · target '+target+' '+(h.unit||''):'');
  info.innerHTML='<strong>'+esc(h.name)+'</strong><small>'+esc(meta)+'</small>';
  const control=document.createElement('div');control.className='habit-control';
  if(h.type==='binary'){
   const b=document.createElement('button');b.className='habit-check '+(done?'done':'');b.textContent=done?'✓':'○';b.title=done?'Selesai':'Belum selesai';b.onclick=()=>{Store.setHabitValue(h.id,!done);renderAll();};control.appendChild(b);
  } else if(h.type==='duration'){
   const mins=Number(v)||0,hh=Math.floor(mins/60),mm=mins%60,running=timers[h.id];
   control.innerHTML='<div class="duration-control"><div class="duration-input"><input value="'+hh+'" min="0" type="number"><span>j</span><input value="'+mm+'" min="0" max="59" type="number"><span>m</span></div><button class="timer-btn '+(running?'running':'')+'">'+(running?'Berhenti':'Timer')+'</button></div>';
   const inputs=control.querySelectorAll('input');inputs.forEach(x=>x.onchange=()=>{Store.setHabitValue(h.id,Math.max(0,Number(inputs[0].value)||0)*60+Math.min(59,Math.max(0,Number(inputs[1].value)||0)));renderAll();});
   control.querySelector('.timer-btn').onclick=()=>{if(running){const elapsed=Math.max(1,Math.round((Date.now()-running)/60000));delete timers[h.id];Store.setHabitValue(h.id,(Number(v)||0)+elapsed);}else timers[h.id]=Date.now();renderAll();};
  } else {
   control.innerHTML='<div class="quantity-control"><button>−</button><strong>'+Number(v||0)+'</strong><button>+</button><span>' + esc(h.unit||'kali')+'</span></div>';
   const [minus,plus]=control.querySelectorAll('button');minus.onclick=()=>{Store.setHabitValue(h.id,Math.max(0,Number(v||0)-1));renderAll()};plus.onclick=()=>{Store.setHabitValue(h.id,Number(v||0)+1);renderAll()};
  }
  const actions=document.createElement('div');actions.className='habit-actions';const e=document.createElement('button');e.textContent='Edit';e.onclick=()=>openModal(h);const del=document.createElement('button');del.textContent='×';del.onclick=()=>{if(confirm('Hapus kebiasaan ini?')){Store.deleteHabit(h.id);renderAll()}};actions.append(e,del);
  row.append(iconEl,info,control,actions);list.appendChild(row);
 });
 $('habitSummary').textContent=habits.length?completed+' / '+habits.length+' selesai':'0 kebiasaan';
 $('dailyPercent').textContent=(habits.length?Math.round(completed/habits.length*100):0)+'%';
 $('progressRing').style.setProperty('--progress',(habits.length?completed/habits.length:0)*360+'deg');
 renderWorkoutToday();
}
function renderWorkoutToday(){
 const plans=Store.getWorkoutPlans(), today=['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'][new Date().getDay()], p=plans.find(x=>x.day===today);
 $('workoutToday').innerHTML=p?'<strong>'+esc(p.name)+'</strong><br><span class="muted">'+p.exercises.length+' gerakan · '+esc(p.status||'Normal')+'</span>':'Belum ada sesi custom untuk '+today+'. <a href="latihan/latihan.html">Buat jadwal →</a>';
}
function renderBuilder(){
 $('habitColors').innerHTML=COLORS.map(c=>'<button class="color-choice '+c+' '+(c===color?'on':'')+'" data-c="'+c+'"></button>').join('');
 $('habitIcons').innerHTML=ICONS.map(x=>'<button class="icon-choice '+(x[0]===icon?'on':'')+'" data-i="'+x[0]+'" title="'+x[1]+'">'+x[0]+'</button>').join('');
 $('habitSchedule').innerHTML=DAYS.map(x=>'<button class="schedule-choice '+(schedule.includes(x[1])?'on':'')+'" data-d="'+x[1]+'">'+x[0]+'</button>').join('');
 document.querySelectorAll('.color-choice').forEach(b=>b.onclick=()=>{color=b.dataset.c;renderBuilder()});
 document.querySelectorAll('.icon-choice').forEach(b=>b.onclick=()=>{icon=b.dataset.i;renderBuilder()});
 document.querySelectorAll('.schedule-choice').forEach(b=>b.onclick=()=>{schedule=schedule.includes(b.dataset.d)?schedule.filter(x=>x!==b.dataset.d):[...schedule,b.dataset.d];renderBuilder()});
}
function updateType(){const t=$('habitType').value;$('habitTarget').disabled=t==='binary';$('habitUnit').placeholder=t==='duration'?'menit':'ml / kali / halaman';$('habitTargetHint').textContent=t==='binary'?'':'target';}
function openModal(h=null){editing=h?.id||null;icon=h?.icon||ICONS[0][0];color=h?.color||COLORS[0];schedule=h?.schedule||['1','2','3','4','5','6','0'];$('habitModalTitle').textContent=h?'Edit kebiasaan':'Buat kebiasaan';$('habitName').value=h?.name||'';$('habitType').value=h?.type||'binary';$('habitTarget').value=h?.target??'';$('habitUnit').value=h?.unit||'';$('habitRule').value=h?.rule||'';$('habitModal').hidden=false;document.body.classList.add('modal-open');updateType();renderBuilder();$('habitName').focus()}
function closeModal(){$('habitModal').hidden=true;document.body.classList.remove('modal-open');editing=null}
function renderAll(){renderHeader();renderHabits()}
document.querySelectorAll('.dummy').forEach(x=>x.remove());
$('addHabitBtn').onclick=()=>openModal();$('emptyAddHabit').onclick=()=>openModal();$('closeHabitModal').onclick=closeModal;$('cancelHabit').onclick=closeModal;$('habitType').onchange=updateType;
$('saveHabit').onclick=()=>{const name=$('habitName').value.trim();if(!name)return;const h={name,type:$('habitType').value,target:$('habitType').value==='binary'?null:Number($('habitTarget').value)||0,unit:$('habitUnit').value.trim(),rule:$('habitRule').value.trim(),color,icon,schedule};if(editing)Store.updateHabit(editing,h);else Store.addHabit(h);closeModal();renderAll()};
renderAll();
})();