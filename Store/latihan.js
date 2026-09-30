(() => {
let parsed=null, activePlan=null, timer=null;
const $=id=>document.getElementById(id);
const DAYS=['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];

function parseLine(line){
 const m=line.match(/^(?:(Senin|Selasa|Rabu|Kamis|Jumat|Sabtu|Minggu)\s+([^:]+):\s*)?(.+)$/i); if(!m)return null;
 const day=m[1]||DAYS[new Date().getDay()], header=m[2]||'Workout', body=m[3];
 const setm=body.match(/(\d+)\s*[x×]\s*(\d+)/i), rpe=body.match(/\bRPE\s*([0-9]+(?:\.[0-9]+)?)/i), rest=body.match(/(?:rest|istirahat)\s*(\d+)\s*s?/i), load=body.match(/(?:^|\s)(\d+(?:\.\d+)?)\s*(?:kg|kgs?)\b/i);
 const name=body.replace(/\b\d+\s*[x×]\s*\d+\b/i,'').replace(/\bRPE\s*[0-9.]+/i,'').replace(/(?:rest|istirahat)\s*\d+\s*s?/i,'').replace(/\b\d+(?:\.\d+)?\s*kg\b/i,'').trim();
 if(!name)return null;
 return {day,name:header.trim(),exercise:name,sets:setm?Number(setm[1]):3,reps:setm?Number(setm[2]):10,load:load?Number(load[1]):0,rpe:rpe?Number(rpe[1]):null,rest:rest?Number(rest[1]):90};
}
function parseRaw(){
 const lines=$('rawWorkout').value.split(/\n+/).map(x=>x.trim()).filter(Boolean), rows=lines.map(parseLine).filter(Boolean);
 if(!rows.length){$('parseStatus').textContent='Belum menemukan pola latihan. Gunakan format: Senin Push Day: Bench Press 3x10 RPE 8 rest 90s';return;}
 const groups={};rows.forEach(x=>{const k=x.day+'|'+x.name;(groups[k]??=[]).push(x)});
 parsed=Object.values(groups).map(g=>({day:g[0].day,name:g[0].name,status:/rest day/i.test(g[0].name)?'Rest':/deload/i.test(g[0].name)?'Deload':'Normal',exercises:g.map(x=>({name:x.exercise,sets:x.sets,reps:x.reps,load:x.load,rpe:x.rpe,rest:x.rest}))}));
 $('parseStatus').textContent='Ditemukan '+parsed.length+' sesi dan '+rows.length+' gerakan.';
 $('previewCard').style.display='block';$('parsePreview').innerHTML=parsed.map(p=>'<div class="parser-session"><div><strong>'+esc(p.name)+'</strong><span>'+p.day+' · '+p.status+'</span></div><div class="preview-exercises">'+p.exercises.map(e=>'<span>'+esc(e.name)+' · '+e.sets+'×'+e.reps+(e.load?' · '+e.load+'kg':'')+(e.rpe?' · RPE '+e.rpe:'')+'</span>').join('')+'</div></div>').join('');
}
function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
function savePlans(){if(!parsed)return;parsed.forEach(p=>Store.addWorkoutPlan(p));parsed=null;$('previewCard').style.display='none';$('rawWorkout').value='';renderPlans();}
function renderPlans(){
 const plans=Store.getWorkoutPlans(), box=$('planList');$('planEmpty').style.display=plans.length?'none':'flex';box.innerHTML='';
 plans.forEach(p=>{const row=document.createElement('article');row.className='parser-session saved-plan';row.innerHTML='<div><strong>'+esc(p.name)+'</strong><span>'+esc(p.day)+' · '+p.exercises.length+' gerakan · '+p.status+'</span></div><div class="plan-actions"><button class="mini-action">Buka</button><button class="mini-action danger-action">×</button></div>';row.querySelector('.mini-action').onclick=()=>openSession(p);row.querySelector('.danger-action').onclick=()=>{if(confirm('Hapus jadwal ini?')){Store.deleteWorkoutPlan(p.id);if(activePlan?.id===p.id)closeSession();renderPlans();}};box.appendChild(row)});
}
function openSession(p){activePlan=p;$('sessionCard').style.display='block';$('sessionTitle').textContent=p.name;$('sessionStatus').textContent=p.status;$('sessionMeta').textContent=p.day+' · '+p.exercises.length+' gerakan';renderSession();$('sessionCard').scrollIntoView({behavior:'smooth',block:'start'})}
function renderSession(){
 const p=activePlan, logs=Store.getCustomWorkoutLog(Store.todayStr(),p.id), box=$('sessionExercises');let total=0;box.innerHTML='';
 p.exercises.forEach((e,ei)=>{const card=document.createElement('div');card.className='exercise-card';const prev=previousPerformance(p,ei);card.innerHTML='<div class="exercise-head"><div><strong>'+esc(e.name)+'</strong><span>'+e.sets+'×'+e.reps+(e.load?' · '+e.load+'kg':'')+(e.rpe?' · RPE '+e.rpe:'')+'</span></div><button class="rest-start" data-rest="'+e.rest+'">REST '+e.rest+'s</button></div><div class="set-grid">'+Array.from({length:e.sets},(_,si)=>{const done=logs[ei]?.[si]===true;if(done)total+=e.reps*e.load;return '<button class="set-check '+(done?'done':'')+'" data-e="'+ei+'" data-s="'+si+'">Set '+(si+1)+' '+(done?'✓':'□')+'</button>'}).join('')+'</div>'+(prev?'<div class="previous-note">Minggu sebelumnya: '+prev+'</div>':'');box.appendChild(card)});
 $('totalVolume').textContent=total?total.toLocaleString('id-ID')+' kg':'0 kg';
 box.querySelectorAll('.set-check').forEach(b=>b.onclick=()=>{const ei=Number(b.dataset.e),si=Number(b.dataset.s),logs=Store.getCustomWorkoutLog(Store.todayStr(),p.id),done=logs[ei]?.[si]===true;Store.setCustomWorkoutLog(Store.todayStr(),p.id,ei,si,!done);if(!done){const ex=p.exercises[ei];startRest(ex.rest)}renderSession()});
 box.querySelectorAll('.rest-start').forEach(b=>b.onclick=()=>startRest(Number(b.dataset.rest)));
}
function previousPerformance(p,ei){
 const d=new Date(Store.todayStr());d.setDate(d.getDate()-7);const l=Store.getCustomWorkoutLog(Store.todayStr(d),p.id),e=p.exercises[ei],sets=l[ei]?Object.values(l[ei]).filter(Boolean).length:0;return sets?sets+' set selesai':''}
function startRest(sec){clearInterval(timer);let n=sec; $('restTimer').hidden=false;$('restValue').textContent=n;timer=setInterval(()=>{n--; $('restValue').textContent=n;if(n<=0){clearInterval(timer);$('restTimer').hidden=true}},1000)}
$('parseBtn').onclick=parseRaw;$('savePlan').onclick=savePlans;$('stopRest').onclick=()=>{clearInterval(timer);$('restTimer').hidden=true};
function closeSession(){$('sessionCard').style.display='none';activePlan=null}
renderPlans();
})();