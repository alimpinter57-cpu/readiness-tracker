(() => {
'use strict';
const $ = id => document.getElementById(id);
const DAYS = ['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu','Minggu'];
let parsed = null, activePlan = null, timer = null, secondsLeft = 0, activeDay = DAYS[(new Date().getDay()+6)%7];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const plans = () => Store.getWorkoutPlans();
const today = () => Store.todayStr();
const getSet = (v) => typeof v === 'object' && v !== null ? v : {done: v === true, load: null, reps: null, rpe: null};
function parseLine(line, inheritedDay) {
 const clean=line.replace(/^\\s*(?:[-*•▪]+|\\d+[.)])\\s*/,'').replace(/\\s+/g,' ').trim();
 if(!clean||/^(?:warm.?up|cool.?down|notes?|catatan|week\\s*\\d+|minggu\\s*ke.?\\d+)\\b/i.test(clean))return null;
 const dayRx='(Senin|Selasa|Rabu|Kamis|Jumat|Sabtu|Minggu)';
 const head=new RegExp('^'+dayRx+'(?:\\s*[-–|:]\\s*|\\s+)([^:|–-]{1,45})?(?:\\s*[:|–-]\\s*)?(.+)?$','i').exec(clean);
 let day=inheritedDay||DAYS[(new Date().getDay()+6)%7], title='Workout', body=clean;
 if(head){day=DAYS.find(d=>d.toLowerCase()===head[1].toLowerCase())||day;const rest=(head[3]||'').trim();if(rest){body=rest;title=(head[2]||'Workout').trim()||'Workout';}else if(head[2]&&/^(?:push|pull|legs|upper|lower|full.?body|cardio|strength|workout)$/i.test(head[2].trim())){title=head[2].trim();body=head[2].trim();}}
 const colon=/^([^:]{2,45}):\\s*(.+)$/.exec(body);
 if(colon&&!/\\d+\\s*[x×]\\s*\\d+/i.test(colon[1])){title=colon[1].trim();body=colon[2].trim();}
 const sm=body.match(/(\\d+)\\s*[x×]\\s*(\\d+)/i), lm=body.match(/(?:^|\\s)(\\d+(?:\\.\\d+)?)\\s*kg\\b/i), rm=body.match(/(?:rest|istirahat)\\s*(\\d+)\\s*(?:s|sec|detik)?\\b/i), pm=body.match(/RPE\\s*(\\d+)/i);
 let exercise=body.replace(/(?:sets?|set)\\s*:?\\s*\\d+/ig,' ').replace(/(?:reps?|repetisi)\\s*:?\\s*\\d+/ig,' ').replace(/\\d+\\s*[x×]\\s*\\d+/i,' ').replace(/\\d+(?:\\.\\d+)?\\s*kg\\b/i,' ').replace(/(?:rest|istirahat)\\s*\\d+\\s*(?:s|sec|detik)?\\b/i,' ').replace(/RPE\\s*\\d+/i,' ').replace(/\\b(?:senin|selasa|rabu|kamis|jumat|sabtu|minggu)\\b/ig,' ').replace(/[|,:;]+/g,' ').replace(/\\s+/g,' ').trim();
 exercise=exercise.replace(/^(?:exercise|latihan|gerakan)\\s+/i,'').trim();
 if(!exercise||/^(?:\\d+\\s*)+$/.test(exercise))return null;
 return {day,title,exercise,sets:sm?Math.min(20,+sm[1]):3,reps:sm?Math.min(100,+sm[2]):10,load:lm?+lm[1]:0,rest:rm?Math.min(600,+rm[1]):90,rpe:pm?Math.min(10,+pm[1]):7};
}
function parseRaw(){
 let currentDay=null,currentTitle='Workout';
 const rows=[];
 $('rawWorkout').value.split(/\\n+/).forEach(raw=>{
  const line=raw.trim();if(!line)return;
  const dayOnly=/^(Senin|Selasa|Rabu|Kamis|Jumat|Sabtu|Minggu)(?:\\s*[:–-].*)?$/i.exec(line);
  if(dayOnly){currentDay=DAYS.find(d=>d.toLowerCase()===dayOnly[1].toLowerCase());const suffix=line.replace(new RegExp('^'+dayOnly[1]+'\\s*[:–-]?\\s*','i'),'').trim();if(suffix)currentTitle=suffix;return;}
  const row=parseLine(line,currentDay);if(row){if(currentDay&&!/^(Senin|Selasa|Rabu|Kamis|Jumat|Sabtu|Minggu)$/i.test(row.title))currentTitle=row.title;rows.push(row);}
 });
 if(!rows.length){$('parseStatus').textContent='Belum ada gerakan yang dikenali. Gunakan contoh: Senin Push: Push-up 3x10, atau tulis nama hari pada baris terpisah.';return;}
 const groups={};rows.forEach(x=>{const k=x.day+'|'+x.title;(groups[k]??=[]).push(x)});
 parsed=Object.values(groups).map(g=>({day:g[0].day,name:g[0].title,status:'Normal',exercises:g.map(x=>({name:x.exercise,sets:x.sets,reps:x.reps,load:x.load,rpe:x.rpe,rest:x.rest}))}));
 $('parseStatus').textContent=parsed.length+' sesi terdeteksi dari '+rows.length+' gerakan. Tinjau nama, hari, set, dan repetisi sebelum disimpan.';
 $('previewCard').hidden=false;
 $('parsePreview').innerHTML=parsed.map((p,i)=>'<article class="parser-session"><label class="review-session"><input type="checkbox" checked data-keep="'+i+'"><strong>'+esc(p.day+' · '+p.name)+'</strong></label>'+p.exercises.map((e,j)=>'<div class="review-exercise"><span>'+esc(e.name)+'</span><small>'+e.sets+' set × '+e.reps+' reps · rest '+e.rest+'s'+(e.load?' · '+e.load+' kg':'')+'</small><button type="button" class="mini-action" data-remove="'+i+'" data-ex="'+j+'">Buang baris</button></div>').join('')+'</article>').join('');
 $('parsePreview').querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{const p=parsed[+b.dataset.remove];p.exercises.splice(+b.dataset.ex,1);if(!p.exercises.length)parsed.splice(+b.dataset.remove,1);parseRawPreviewOnly();});
 $('parsePreview').querySelectorAll('[data-keep]').forEach(c=>c.onchange=()=>{c.closest('.parser-session').classList.toggle('excluded',!c.checked);});
}
function parseRawPreviewOnly(){
 const keep=[...$('parsePreview').querySelectorAll('[data-keep]')].map(c=>c.checked);
 parsed=parsed.filter((p,i)=>keep[i]!==false);
 $('parseStatus').textContent=parsed.length+' sesi siap ditinjau.';
 $('parsePreview').innerHTML=parsed.map((p,i)=>'<article class="parser-session"><strong>'+esc(p.day+' · '+p.name)+'</strong>'+p.exercises.map((e,j)=>'<div class="review-exercise"><span>'+esc(e.name)+'</span><small>'+e.sets+' set × '+e.reps+' reps · rest '+e.rest+'s</small><button type="button" class="mini-action" data-remove="'+i+'" data-ex="'+j+'">Buang</button></div>').join('')+'</article>').join('');
 $('parsePreview').querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{parsed[+b.dataset.remove].exercises.splice(+b.dataset.remove,1);parsed=parsed.filter(p=>p.exercises.length);parseRawPreviewOnly();});
}
function savePlans(){if(!parsed)return;parsed.forEach(p=>Store.addWorkoutPlan(p));parsed=null;$('previewCard').hidden=true;$('rawWorkout').value='';renderPlans();}
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
 const name=prompt('Nama sesi',p.name);if(name===null)return;
 const day=prompt('Hari: Senin, Selasa, Rabu, Kamis, Jumat, Sabtu, Minggu',p.day);if(day===null)return;
 const lines=p.exercises.map(e=>e.name+' | '+e.sets+' | '+e.reps+' | '+(e.load||0)+' | '+(e.rest||90)+' | '+(e.rpe||7)).join('\\n');
 const raw=prompt('Satu gerakan per baris: nama | set | reps | kg | istirahat (detik) | RPE. Contoh: Push-up | 3 | 12 | 0 | 60 | 7',lines);if(raw===null)return;
 const exercises=raw.split('\\n').map(line=>{const a=line.split('|').map(s=>s.trim());if(!a[0])return null;return {name:a[0],sets:Math.min(20,Math.max(1,parseInt(a[1],10)||3)),reps:Math.min(100,Math.max(1,parseInt(a[2],10)||10)),load:Math.max(0,parseFloat(a[3])||0),rest:Math.min(600,Math.max(15,parseInt(a[4],10)||90)),rpe:Math.min(10,Math.max(1,parseInt(a[5],10)||7))};}).filter(Boolean);
 if(!exercises.length){alert('Sesi perlu minimal satu gerakan.');return;}
 Store.updateWorkoutPlan(p.id,{name:name.trim()||p.name,day:DAYS.includes(day.trim())?day.trim():p.day,exercises});renderPlans();
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
$('parseBtn').onclick=parseRaw;$('savePlan').onclick=savePlans;
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