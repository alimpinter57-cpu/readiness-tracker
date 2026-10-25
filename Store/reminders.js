/* Standard recurring reminders; notifications are best-effort while this page is open. */
(() => {
  'use strict';
  const KEY = 'readiness:reminders', LAST_KEY = 'readiness:reminderLastFired';
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const days = [{n:1,s:'Sen'},{n:2,s:'Sel'},{n:3,s:'Rab'},{n:4,s:'Kam'},{n:5,s:'Jum'},{n:6,s:'Sab'},{n:7,s:'Min'}];
  const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch (_) { return fallback; } };
  const write = (key, value) => { localStorage.setItem(key, JSON.stringify(value)); window.ReadinessCloud?.queueSync?.(); };
  const getAll = () => read(KEY, []);
  const todayKey = date => date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0');
  const dayNum = date => ((date.getDay()+6)%7)+1;
  const status = message => { $('reminderStatus').textContent = message; };
  const selectedDays = () => Array.from(document.querySelectorAll('input[name="reminderDay"]:checked')).map(el => Number(el.value));
  const resetForm = () => { $('reminderId').value=''; $('reminderTitle').value=''; $('reminderTime').value='04:00'; document.querySelectorAll('input[name="reminderDay"]').forEach(el=>el.checked=false); $('saveReminderButton').textContent='+ Simpan pengingat'; $('cancelReminderEdit').hidden=true; };
  const dayLabel = nums => days.filter(d=>nums.includes(d.n)).map(d=>d.s).join(', ');
  function render() {
    const items=getAll().sort((a,b)=>a.time.localeCompare(b.time)||a.title.localeCompare(b.title));
    $('reminderList').innerHTML=items.length?items.map(item=>'<article class="daily-task '+(item.enabled?'':'is-complete')+'"><div class="daily-task-main"><strong>'+esc(item.title)+'</strong><div class="daily-task-meta"><span>'+esc(item.time)+'</span><span>'+esc(dayLabel(item.days||[]))+'</span><span>'+(item.enabled?'Aktif':'Nonaktif')+'</span></div></div><div class="daily-task-actions"><button type="button" data-reminder-edit="'+esc(item.id)+'">Edit</button><button type="button" data-reminder-toggle="'+esc(item.id)+'">'+(item.enabled?'Matikan':'Aktifkan')+'</button><button type="button" data-reminder-delete="'+esc(item.id)+'">Hapus</button></div></article>').join(''):'<div class="daily-empty"><strong>Belum ada pengingat</strong><p>Buat pengingat di formulir ini.</p></div>';
  }
  $('reminderForm').addEventListener('submit',event=>{
    event.preventDefault(); const title=$('reminderTitle').value.trim(),time=$('reminderTime').value,selected=selectedDays(),id=$('reminderId').value;
    if(!title)return status('Isi nama pengingat.'); if(!time)return status('Pilih waktu pengingat.'); if(!selected.length)return status('Pilih minimal satu hari pengulangan.');
    const items=getAll();
    if(id){if(!items.some(item=>item.id===id)){resetForm();return status('Pengingat tidak ditemukan; formulir direset.');}write(KEY,items.map(item=>item.id===id?{...item,title,time,days:selected,updatedAt:new Date().toISOString()}:item));status('Pengingat berhasil diperbarui.');}
    else{items.push({id:'rem-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8),title,time,days:selected,enabled:true,createdAt:new Date().toISOString()});write(KEY,items);status('Pengingat tersimpan. Pastikan izin notifikasi aktif dan halaman tetap terbuka.');}
    resetForm();render();
  });
  $('cancelReminderEdit').addEventListener('click',resetForm);
  $('reminderList').addEventListener('click',event=>{
    const edit=event.target.closest('[data-reminder-edit]'),toggle=event.target.closest('[data-reminder-toggle]'),del=event.target.closest('[data-reminder-delete]');
    const id=edit?.dataset.reminderEdit||toggle?.dataset.reminderToggle||del?.dataset.reminderDelete;if(!id)return;
    const items=getAll(),item=items.find(entry=>entry.id===id);if(!item)return;
    if(edit){$('reminderId').value=item.id;$('reminderTitle').value=item.title;$('reminderTime').value=item.time;document.querySelectorAll('input[name="reminderDay"]').forEach(el=>el.checked=(item.days||[]).includes(Number(el.value)));$('saveReminderButton').textContent='Simpan perubahan';$('cancelReminderEdit').hidden=false;$('reminderTitle').focus();status('Mode edit: ubah detail lalu simpan.');}
    else if(toggle){write(KEY,items.map(entry=>entry.id===id?{...entry,enabled:!entry.enabled,updatedAt:new Date().toISOString()}:entry));status(item.enabled?'Pengingat dinonaktifkan.':'Pengingat diaktifkan.');render();}
    else if(del&&confirm('Hapus pengingat "'+item.title+'"?')){write(KEY,items.filter(entry=>entry.id!==id));if($('reminderId').value===id)resetForm();status('Pengingat dihapus.');render();}
  });
  $('enableReminderNotifications').addEventListener('click',async()=>{
    if(!('Notification'in window))return status('Browser ini tidak mendukung notifikasi web.');
    if(!window.isSecureContext)return status('Notifikasi memerlukan halaman HTTPS atau localhost.');
    try{const permission=await Notification.requestPermission();status(permission==='granted'?'Izin notifikasi aktif. Biarkan halaman ini terbuka agar pengingat dapat diperiksa.':'Izin notifikasi belum diberikan. Periksa izin situs di pengaturan browser.');}
    catch(_){status('Browser gagal meminta izin notifikasi.');}
  });
  function checkDue(){
    const now=new Date(),time=String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0'),day=dayNum(now),date=todayKey(now),last=read(LAST_KEY,{});
    const due=getAll().filter(item=>item.enabled&&item.time===time&&(item.days||[]).includes(day)&&last[item.id]!==date+' '+time);if(!due.length)return;
    due.forEach(item=>{last[item.id]=date+' '+time;if('Notification'in window&&Notification.permission==='granted'){try{const notice=new Notification(item.title,{body:'Waktunya sesuai jadwal pengingat Readiness.',tag:item.id});notice.onclick=()=>{window.focus();notice.close();};}catch(_){status('Pengingat "'+item.title+'" jatuh tempo, tetapi browser tidak menampilkan notifikasi.');}}else status('Pengingat "'+item.title+'" jatuh tempo. Aktifkan izin notifikasi untuk pemberitahuan browser.');});
    write(LAST_KEY,last);
  }
  render();checkDue();window.setInterval(checkDue,15000);window.addEventListener('focus',checkDue);window.addEventListener('readiness:cloud-restored',render);
})();
