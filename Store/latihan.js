(() => {
'use strict';
const $ = id => document.getElementById(id);
const DAYS = ['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu','Minggu'];
let parsed = null, activePlan = null, timer = null, secondsLeft = 0, activeDay = DAYS[(new Date().getDay()+6)%7];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const plans = () => Store.getWorkoutPlans();
const today = () => Store.todayStr();
const getSet = (v) => typeof v === 'object' && v !== null ? v : {done: v === true, load: null, reps: null, rpe: null};
function normalizeDay(value){
 const v=String(value||'').trim().toLowerCase();
 const aliases={monday:'Senin',tuesday:'Selasa',wednesday:'Rabu',thursday:'Kamis',friday:'Jumat',saturday:'Sabtu',sunday:'Minggu'};
 return DAYS.find(d=>d.toLowerCase()===v)||aliases[v]||null;
}
function parseLine(raw, inheritedDay){
 let line=String(raw||'').replace(/^\\s*(?:[-*•▪]+|\\d+[.)])\\s*/,'').replace(/\\s+/g,' ').trim();
 if(!line)return null;
 const dayMatch=/^(Senin|Selasa|Rabu|Kamis|Jumat|Sabtu|Minggu|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\\b\\s*[:|–—-]?\\s*/i.exec(line);
 if(dayMatch)line=line.slice(dayMatch[0].length).trim();
 if(!line||/^(?:warm.?up|cool.?down|notes?|catatan|week\\s*\\d+|minggu\\s*ke.?\\d+|jadwal|workout plan|istirahat|recovery|pendinginan|pemanasan)\\b/i.test(line))return null;
 const prescription=/(\\d{1,2})\\s*[x×]\\s*(\\d{1,3})(?:\\s*[-–]\\s*(\\d{1,3}))?/i.exec(line);
 const explicitSets=/\\bsets?\\s*[:=]?\\s*(\\d{1,2})\\b/i.exec(line), explicitReps=/\\b(?:reps?|repetisi)\\s*[:=]?\\s*(\\d{1,3})\\b/i.exec(line);
 const hasDose=!!(prescription||(explicitSets&&explicitReps));
 let body=line;
 if(!hasDose){
  const known=/\\b(pull.?up|chin.?up|push.?up|squat|lunge|glute bridge|dead bug|side plank|plank|bird dog|calf raise|jalan cepat|bersepeda|mobilitas|pike push.?up|assisted pull.?up|scapular pull.?up)\\b/i.test(line);
  if(!known)return null;
 }
 const colon=/^([^:]{2,70})\\s*:\\s*(.+)$/.exec(body);
 if(colon && (prescription||/\\d+\\s*[x×]/i.test(colon[2])))body=colon[1]+' '+colon[2];
 const sets=prescription?+prescription[1]:(explicitSets?+explicitSets[1]:null), reps=prescription?+(prescription[3]||prescription[2]):(explicitReps?+explicitReps[1]:null);
 const load=/(\\d+(?:[.,]\\d+)?)\\s*kg\\b/i.exec(body), rest=/\\b(?:rest|istirahat)\\s*[:=]?\\s*(\\d{1,3})\\s*(?:s|sec|secs|detik)?\\b/i.exec(body), rpe=/\\bRPE\\s*[:=]?\\s*(10|[1-9])\\b/i.exec(body);
 let name=body.replace(/\\b\\d{1,2}\\s*[x×]\\s*\\d{1,3}(?:\\s*[-–]\\s*\\d{1,3})?/i,' ').replace(/\\b(?:sets?|reps?|repetisi)\\s*[:=]?\\s*\\d+\\b/ig,' ').replace(/\\b\\d+(?:[.,]\\d+)?\\s*kg\\b/i,' ').replace(/\\b(?:rest|istirahat)\\s*[:=]?\\s*\\d{1,3}\\s*(?:s|sec|secs|detik)?\\b/i,' ').replace(/\\bRPE\\s*[:=]?\\s*(?:10|[1-9])\\b/i,' ').replace(/[|,:;]+/g,' ').replace(/\\s+/g,' ').trim().replace(/^(?:exercise|latihan|gerakan)\\s+/i,'');
 if(!name||/^(?:contoh|example|target|jadwal|program|catatan|evaluasi|prinsip|aturan|strategi|tujuan|fokus|minggu|hari)\\b/i.test(name))return null;
 return {day:normalizeDay(dayMatch?.[1])||inheritedDay||DAYS[(new Date().getDay()+6)%7],exercise:name,sets:sets===null?null:Math.min(20,Math.max(1,sets)),reps:reps===null?null:Math.min(100,Math.max(1,reps)),load:Math.max(0,parseFloat((load?.[1]||'0').replace(',','.'))),rest:Math.min(600,Math.max(15,+(rest?.[1]||90))),rpe:Math.min(10,Math.max(1,+(rpe?.[1]||7)))};
}
function renderParsePreview(){
 const root=$('parsePreview');
 root.innerHTML=parsed.map((p,i)=>`
  <article class="parser-session" data-session="${i}">
   <label class="review-session"><input type="checkbox" data-session-keep checked><strong>Pakai sesi ini</strong></label>
   <div class="editor-top">
    <label>Hari<select data-day>${DAYS.map(d=>`<option ${p.day===d?'selected':''}>${d}</option>`).join('')}</select></label>
    <label>Nama sesi<input data-title maxlength="60" value="${esc(p.name)}"></label>
   </div>
   <div class="parser-exercises">${p.exercises.map((e,j)=>`
    <div class="editor-exercise" data-exercise="${j}">
     <label class="review-session"><input type="checkbox" data-ex-keep checked><strong>Ambil gerakan</strong></label>
     <label>Nama gerakan<input data-name maxlength="70" value="${esc(e.name)}"></label>
     <div class="editor-fields">
      <label>Set<input data-sets type="number" min="1" max="20" value="${e.sets??''}"></label>
      <label>Repetisi<input data-reps type="number" min="1" max="100" value="${e.reps??''}"></label>
      <label>Istirahat (detik)<input data-rest type="number" min="15" max="600" value="${e.rest}"></label>
      <label>Beban (kg)<input data-load type="number" min="0" step="0.5" value="${e.load}"></label>
      <label>RPE<input data-rpe type="number" min="1" max="10" value="${e.rpe}"></label>
     </div>
     <button type="button" class="mini-action danger-action" data-delete-ex>Buang gerakan</button>
    </div>`).join('')}</div>
   <button type="button" class="mini-action" data-add-ex>＋ Tambah gerakan</button>
  </article>`).join('');
 root.querySelectorAll('[data-session-keep]').forEach(c=>c.onchange=()=>c.closest('[data-session]').classList.toggle('excluded',!c.checked));
 root.querySelectorAll('[data-ex-keep]').forEach(c=>c.onchange=()=>c.closest('[data-exercise]').classList.toggle('excluded',!c.checked));
 root.querySelectorAll('[data-delete-ex]').forEach(b=>b.onclick=()=>{const card=b.closest('[data-session]'),si=+card.dataset.session,ei=+b.closest('[data-exercise]').dataset.exercise;parsed[si].exercises.splice(ei,1);renderParsePreview();});
 root.querySelectorAll('[data-add-ex]').forEach(b=>b.onclick=()=>{const si=+b.closest('[data-session]').dataset.session;parsed[si].exercises.push({name:'',sets:3,reps:10,rest:90,load:0,rpe:7,selected:true});renderParsePreview();});
}
function parseRaw(){
 const lines=$('rawWorkout').value.split(/\\r?\\n/);let currentDay=null;const grouped=new Map();
 for(const raw of lines){const line=raw.trim();if(!line)continue;
  const head=/^(Senin|Selasa|Rabu|Kamis|Jumat|Sabtu|Minggu|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)(?:\\s+([^:–—-]+))?\\s*[:–—-]?$/i.exec(line);
  if(head){currentDay=normalizeDay(head[1]);continue;}
  const row=parseLine(line,currentDay);if(!row)continue;
  const key=row.day;if(!grouped.has(key))grouped.set(key,{day:row.day,name:'Workout',status:'Normal',exercises:[]});
  grouped.get(key).exercises.push({name:row.exercise,sets:row.sets,reps:row.reps,load:row.load,rpe:row.rpe,rest:row.rest,selected:true});
 }
 parsed=[...grouped.values()];
 if(!parsed.length){$('previewCard').hidden=true;$('parseStatus').textContent='Tidak ada baris gerakan yang terbaca. Tulis nama hari, lalu satu gerakan per baris; set dan repetisi boleh dikosongkan.';return;}
 $('parseStatus').textContent=parsed.reduce((n,p)=>n+p.exercises.length,0)+' gerakan ditemukan dalam '+parsed.length+' hari. Hanya gerakan yang ditampilkan untuk diperiksa.';
 $('previewCard').hidden=false;renderParsePreview();
}
function savePlans(){
 if(!parsed?.length)return;
 const cards=[...$('parsePreview').querySelectorAll('[data-session]')], selected=[];
 cards.forEach(card=>{
  if(!card.querySelector('[data-session-keep]')?.checked)return;
  const exercises=[...card.querySelectorAll('[data-exercise]')].filter(row=>row.querySelector('[data-ex-keep]')?.checked).map(row=>({
   name:row.querySelector('[data-name]').value.trim(),
   sets:row.querySelector('[data-sets]').value===''?null:Math.min(20,Math.max(1,+row.querySelector('[data-sets]').value)),
   reps:row.querySelector('[data-reps]').value===''?null:Math.min(100,Math.max(1,+row.querySelector('[data-reps]').value)),
   rest:Math.min(600,Math.max(15,+row.querySelector('[data-rest]').value||90)),
   load:Math.max(0,+row.querySelector('[data-load]').value||0),
   rpe:Math.min(10,Math.max(1,+row.querySelector('[data-rpe]').value||7))
  })).filter(e=>e.name);
  if(exercises.length)selected.push({day:card.querySelector('[data-day]').value,name:card.querySelector('[data-title]').value.trim()||'Workout',status:'Normal',exercises});
 });
 if(!selected.length){$('parseStatus').textContent='Tidak ada sesi valid. Centang sesi dan minimal satu gerakan bernama untuk disimpan.';return;}
 const before=Store.getWorkoutPlans().length;
 try{
  selected.forEach(p=>Store.addWorkoutPlan(p));
  const after=Store.getWorkoutPlans().length;
  if(after<before+selected.length)throw Error('Penyimpanan lokal tidak bertambah');
  parsed=null;$('previewCard').hidden=true;$('rawWorkout').value='';$('parseStatus').textContent=selected.length+' sesi berhasil disimpan.';renderPlans();
 }catch(err){$('parseStatus').textContent='Gagal menyimpan. Coba ekspor backup dahulu lalu muat ulang halaman. Detail: '+(err?.message||'penyimpanan tidak terkonfirmasi');}
}
function ensureDayNav(){
 let nav=$('dayNav'); if(!nav){nav=document.createElement('div');nav.id='dayNav';nav.className='day-nav';$('planList').before(nav);}
 const values=['Semua',...DAYS];nav.innerHTML=values.map(d=>'<button class="day-chip '+(activeDay===d?'on':'')+'" data-day="'+d+'">'+d+'</button>').join('');
 nav.querySelectorAll('button').forEach(b=>b.onclick=()=>{activeDay=b.dataset.day;renderPlans();});
}
function renderPlans(){
 const all=plans(), shown=activeDay==='Semua'?all:all.filter(p=>p.day===activeDay), box=$('planList');
 $('planEmpty').style.display=all.length?'none':'flex';ensureDayNav();box.innerHTML='';
 if(!shown.length&&all.length){box.innerHTML='<p class="muted">Belum ada sesi pada hari ini. Kamu bisa menambah atau mengubah jadwal lewat builder.</p>';return;}
 shown.forEach(p=>{
  const row=document.createElement('article');row.className='parser-session saved-plan';
  row.innerHTML='<div><strong>'+esc(p.day+' · '+p.name)+'</strong><span>'+p.exercises.length+' gerakan · '+esc(p.status||'Normal')+'</span></div><div class="plan-actions"><button class="mini-action open-plan">Mulai</button><button class="mini-action edit-plan">Edit</button><button class="mini-action danger-action">Hapus</button></div>';
  row.querySelector('.open-plan').onclick=()=>openSession(p);
  row.querySelector('.edit-plan').onclick=()=>editPlan(p);
  row.querySelector('.danger-action').onclick=()=>{if(confirm('Hapus sesi ini?')){Store.deleteWorkoutPlan(p.id);renderPlans();}};
  box.appendChild(row);
 });
}
function editPlan(p){
 const overlay=document.createElement('div');overlay.className='workout-edit-overlay';
 const dayOptions=DAYS.map(d=>'<option '+(p.day===d?'selected':'')+'>'+d+'</option>').join('');
 overlay.innerHTML='<section class="workout-editor" role="dialog" aria-modal="true"><header class="editor-head"><div><span class="section-kicker">ROUTINE EDITOR</span><h2>Edit jadwal latihan</h2><p class="muted">Atur parameter tiap gerakan secara terpisah.</p></div><button type="button" class="icon-close editor-close">×</button></header><div class="editor-top"><label>Nama sesi<input class="editor-name" maxlength="60"></label><label>Hari<select class="editor-day">'+dayOptions+'</select></label></div><div class="editor-exercises"></div><button type="button" class="mini-action editor-add">＋ Tambah gerakan</button><footer class="editor-actions"><button type="button" class="btn btn-secondary editor-cancel">Batal</button><button type="button" class="btn btn-primary editor-save">Simpan perubahan</button></footer></section>';
 document.body.appendChild(overlay);const form=overlay.querySelector('.editor-exercises');overlay.querySelector('.editor-name').value=p.name;
 const addRow=e=>{const item=e||{name:'',sets:3,reps:10,load:0,rest:90,rpe:7};const card=document.createElement('div');card.className='editor-exercise';card.innerHTML='<div class="editor-exercise-title"><strong>Gerakan</strong><button type="button" class="mini-action danger-action editor-remove">Hapus</button></div><label>Nama gerakan<input class="ex-name" maxlength="70" placeholder="Contoh: Push-up"></label><div class="editor-fields"><label>Set<input class="ex-sets" type="number" min="1" max="20" value="'+item.sets+'"><small>Jumlah ronde</small></label><label>Repetisi<input class="ex-reps" type="number" min="1" max="100" value="'+item.reps+'"><small>Per set</small></label><label>Istirahat<input class="ex-rest" type="number" min="15" max="600" step="5" value="'+(item.rest||90)+'"><small>Detik</small></label><label>Beban<input class="ex-load" type="number" min="0" step="0.5" value="'+(item.load||0)+'"><small>Kg; 0 = tanpa beban</small></label><label>RPE<select class="ex-rpe">'+Array.from({length:10},(_,i)=>'<option value="'+(i+1)+'" '+((item.rpe||7)===i+1?'selected':'')+'>'+(i+1)+'</option>').join('')+'</select><small>Skala usaha 1–10</small></label></div>';
 card.querySelector('.ex-name').value=item.name||'';card.querySelector('.editor-remove').onclick=()=>card.remove();form.appendChild(card);};
 p.exercises.forEach(addRow);overlay.querySelector('.editor-add').onclick=()=>addRow();const close=()=>overlay.remove();overlay.querySelectorAll('.editor-close,.editor-cancel').forEach(b=>b.onclick=close);
 overlay.querySelector('.editor-save').onclick=()=>{const exercises=[...form.querySelectorAll('.editor-exercise')].map(card=>({name:card.querySelector('.ex-name').value.trim(),sets:Math.min(20,Math.max(1,+card.querySelector('.ex-sets').value||3)),reps:Math.min(100,Math.max(1,+card.querySelector('.ex-reps').value||10)),rest:Math.min(600,Math.max(15,+card.querySelector('.ex-rest').value||90)),load:Math.max(0,+card.querySelector('.ex-load').value||0),rpe:+card.querySelector('.ex-rpe').value||7})).filter(e=>e.name);
 if(!exercises.length){alert('Tambahkan minimal satu gerakan dengan nama yang valid.');return;}
 Store.updateWorkoutPlan(p.id,{name:overlay.querySelector('.editor-name').value.trim()||p.name,day:overlay.querySelector('.editor-day').value,exercises});close();renderPlans();if(activePlan?.id===p.id){activePlan=plans().find(x=>x.id===p.id);renderSession();}
 };
}
function openSession(p){activePlan=p;$('sessionCard').hidden=false;$('sessionTitle').textContent=p.name;$('sessionStatus').textContent=p.status||'Normal';$('sessionMeta').textContent=p.day+' · '+p.exercises.length+' gerakan';renderSession();$('sessionCard').scrollIntoView({behavior:'smooth',block:'start'});}
function priorLog(p, offset=7){const d=new Date(today());d.setDate(d.getDate()-offset);return Store.getCustomWorkoutLog(Store.todayStr(d),p.id);}
function renderSession(){
 if(!activePlan)return;const p=activePlan, logs=Store.getCustomWorkoutLog(today(),p.id), box=$('sessionExercises');let total=0;box.innerHTML='';
 p.exercises.forEach((e,ei)=>{
  const prev=priorLog(p), prevRows=prev[ei]||{}, prevDone=Object.values(prevRows).map(getSet).filter(x=>x.done);
  const suggestion=prevDone.length?(()=>{const maxReps=Math.max(...prevDone.map(x=>x.reps||e.reps));const maxLoad=Math.max(...prevDone.map(x=>x.load||e.load||0));return maxReps>=e.reps&&maxLoad>=e.load?'Saran: tambah 1 repetisi per set dulu, atau beban kecil jika teknik tetap rapi.':'Saran: ulangi target terakhir dengan teknik stabil.';})():'Mulai dari target dasar; naikkan bertahap setelah semua set terasa terkontrol.';
  const card=document.createElement('article');card.className='exercise-card';
  const setMarkup=Array.from({length:e.sets},(_,si)=>{const v=getSet(logs[ei]?.[si]);if(v.done)total+=(v.reps||e.reps)*(v.load??e.load??0);return '<div class="set-row"><label>Set '+(si+1)+'</label><input type="number" min="0" step="0.5" aria-label="Beban set '+(si+1)+'" data-field="load" data-e="'+ei+'" data-s="'+si+'" value="'+(v.load??e.load??0)+'"><input type="number" min="1" step="1" aria-label="Repetisi set '+(si+1)+'" data-field="reps" data-e="'+ei+'" data-s="'+si+'" value="'+(v.reps??e.reps)+'"><button class="set-check '+(v.done?'done':'')+'" data-e="'+ei+'" data-s="'+si+'">'+(v.done?'Selesai ✓':'Selesai?')+'</button></div>';}).join('');
  card.innerHTML='<div class="exercise-head"><div><strong>'+esc(e.name)+'</strong><span>Target '+e.sets+' set × '+e.reps+' reps · '+(e.load||'Bodyweight')+(e.load?' kg':'')+'</span></div><button class="rest-start" data-rest="'+(e.rest||90)+'">Istirahat '+(e.rest||90)+'s</button></div><div class="smart-hint">'+esc(suggestion)+'</div><div class="set-grid set-grid-edit">'+setMarkup+'</div><label class="rpe-label">RPE sesi <select data-rpe="'+ei+'">'+Array.from({length:10},(_,i)=>'<option value="'+(i+1)+'" '+((e.rpe||7)===i+1?'selected':'')+'>'+(i+1)+'</option>').join('')+'</select></label>';
  box.appendChild(card);
 });
 $('totalVolume').textContent=Math.round(total).toLocaleString('id-ID')+' kg';
 box.querySelectorAll('.set-check').forEach(b=>b.onclick=()=>{const ei=+b.dataset.e,si=+b.dataset.s;const all=Store.getCustomWorkoutLog(today(),p.id);const old=getSet(all[ei]?.[si]);old.done=!old.done;Store.setCustomWorkoutLog(today(),p.id,ei,si,old);if(old.done)startRest(p.exercises[ei].rest||90);renderSession();renderAnalytics();});
 box.querySelectorAll('input[data-field]').forEach(inp=>inp.onchange=()=>{const ei=+inp.dataset.e,si=+inp.dataset.s,all=Store.getCustomWorkoutLog(today(),p.id),v=getSet(all[ei]?.[si]);v[inp.dataset.field]=Math.max(0,+inp.value||0);Store.setCustomWorkoutLog(today(),p.id,ei,si,v);renderSession();});
 box.querySelectorAll('[data-rpe]').forEach(sel=>sel.onchange=()=>Store.updateWorkoutPlan(p.id,{exercises:p.exercises.map((e,i)=>i===+sel.dataset.rpe?{...e,rpe:+sel.value}:e)}));
 box.querySelectorAll('.rest-start').forEach(b=>b.onclick=()=>startRest(+b.dataset.rest));
}
function startRest(n){clearInterval(timer);secondsLeft=n;showTimer();timer=setInterval(()=>{secondsLeft--;showTimer();if(secondsLeft<=0){clearInterval(timer);toast('Waktu istirahat selesai. Lanjut saat siap.');$('restSheet').hidden=true;}},1000);}
function showTimer(){$('restSheet').hidden=false;$('restValue').textContent=String(Math.floor(secondsLeft/60)).padStart(2,'0')+':'+String(secondsLeft%60).padStart(2,'0');}
function toast(s){const t=$('toast');t.textContent=s;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2200);}
function renderAnalytics(){
 const now=new Date(), start=new Date(now);start.setDate(now.getDate()-6);let total=0;const bars=[];
 for(let i=0;i<7;i++){const d=new Date(start);d.setDate(start.getDate()+i);const ds=Store.todayStr(d);let v=0;plans().forEach(p=>{const l=Store.getCustomWorkoutLog(ds,p.id);p.exercises.forEach((e,ei)=>Object.values(l[ei]||{}).map(getSet).filter(x=>x.done).forEach(x=>v+=(x.reps||e.reps)*(x.load??e.load??0)));});total+=v;bars.push({label:['Min','Sen','Sel','Rab','Kam','Jum','Sab'][d.getDay()],v});}
 $('weekVolume').textContent=Math.round(total).toLocaleString('id-ID')+' kg';
 $('volumeChart').innerHTML=bars.map(b=>'<div class="volume-bar-wrap"><div class="volume-bar" style="height:'+Math.max(4,total?b.v/Math.max(...bars.map(x=>x.v),1)*70:4)+'px"></div><small>'+b.label+'</small></div>').join('');
}
function exportBackup(){const payload={version:1,plans:plans(),logs:JSON.parse(localStorage.getItem('readiness:workoutCustomLogs')||'{}')};const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='readiness-workout-backup.json';a.click();URL.revokeObjectURL(a.href);}
function importBackup(file){const reader=new FileReader();reader.onload=()=>{try{const d=JSON.parse(reader.result);if(!Array.isArray(d.plans)||!d.logs||typeof d.logs!=='object')throw Error();localStorage.setItem('readiness:workoutPlans',JSON.stringify(d.plans));localStorage.setItem('readiness:workoutCustomLogs',JSON.stringify(d.logs));renderPlans();renderAnalytics();toast('Backup berhasil diimpor.');}catch(e){alert('File backup tidak valid. Data lama tidak diubah.');}};reader.readAsText(file);}
$('parseBtn').onclick=()=>{try{parseRaw();}catch(err){$('parseStatus').textContent='Parser error: '+(err?.message||'periksa format rutinitas');}};$('savePlan').onclick=savePlans;$('parseStatus').textContent='Parser siap. Tulis rutinitas lalu tekan Parse routine.';
$('closeSheet').onclick=()=>{$('restSheet').hidden=true;clearInterval(timer);};
$('finishRest').onclick=()=>{$('restSheet').hidden=true;clearInterval(timer);};
$('addRest').onclick=()=>{secondsLeft+=15;showTimer();};
document.querySelectorAll('[data-seconds]').forEach(b=>b.onclick=()=>startRest(+b.dataset.seconds));
$('exportData').onclick=exportBackup;$('importData').onchange=e=>{if(e.target.files[0])importBackup(e.target.files[0]);e.target.value='';};
$('shareRoutine').onclick=()=>{const data=JSON.stringify(plans(),null,2);if(navigator.share)navigator.share({title:'Workout routine',text:data}).catch(()=>{});else{navigator.clipboard?.writeText(data);toast('Data rutinitas disalin.');}};
$('shareCurrent').onclick=()=>{if(!activePlan)return;const text=JSON.stringify(activePlan,null,2);navigator.clipboard?.writeText(text);toast('Sesi disalin.');};
$('copyLast').onclick=()=>{if(!activePlan)return;const d=new Date(today());d.setDate(d.getDate()-7);const prev=Store.getCustomWorkoutLog(Store.todayStr(d),activePlan.id);activePlan.exercises.forEach((e,ei)=>Object.entries(prev[ei]||{}).forEach(([si,val])=>{const v=getSet(val);Store.setCustomWorkoutLog(today(),activePlan.id,ei,+si,{...v,done:false});}));renderSession();toast('Angka sesi sebelumnya disalin; set belum ditandai selesai.');};
document.querySelectorAll('[data-shift]').forEach(b=>b.onclick=()=>{$('scheduleFeedback').textContent='Pilih sesi dari daftar lalu gunakan Edit untuk mengubah hari ke '+DAYS[(Math.max(0,DAYS.indexOf(activePlan?.day||DAYS[0]))+(+b.dataset.shift))%7]+'.';});
$('markRest').onclick=()=>$('scheduleFeedback').textContent='Hari istirahat dicatat sebagai pilihan. Tidak ada latihan yang dipindahkan.';
$('mergeTarget').onclick=()=>$('scheduleFeedback').textContent='Untuk menjaga pemulihan, gabungkan hanya gerakan ringan; edit sesi dan kurangi volume bila perlu.';
renderPlans();renderAnalytics();
})();
