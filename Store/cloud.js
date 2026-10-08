(() => {
'use strict';

const CONFIG = window.READINESS_SUPABASE_CONFIG || {};
const configured = /^https:\/\/[^\s]+\.supabase\.co$/i.test(CONFIG.url || '') &&
  typeof CONFIG.publishableKey === 'string' &&
  CONFIG.publishableKey.length > 20 &&
  !CONFIG.publishableKey.includes('YOUR-');

let client = null;
let user = null;
let syncing = false;
let suppress = false;
let syncTimer = null;
let lastCloudUpdatedAt = null;
let authReady = false;

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const localBackupKey = 'readiness:preCloudBackup';

function localHasData() {
  const snap = Store.getSnapshot();
  return Object.keys(snap.data || {}).some(k => {
    const v = snap.data[k];
    return v !== null && v !== undefined && v !== '' &&
      !(Array.isArray(v) && v.length === 0) &&
      !(typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0);
  });
}

function backupLocal() {
  try {
    localStorage.setItem(localBackupKey, JSON.stringify({
      version: 1,
      createdAt: new Date().toISOString(),
      snapshot: Store.getSnapshot()
    }));
  } catch {}
}

function setStatus(message, kind='muted') {
  const node = $('cloudSyncStatus');
  if (!node) return;
  node.textContent = message;
  node.dataset.state = kind;
}

function injectStyles() {
  if ($('cloudSyncStyles')) return;
  const s = document.createElement('style');
  s.id = 'cloudSyncStyles';
  s.textContent = `
    .cloud-account{margin:12px 0;padding:14px;border:1px solid rgba(255,255,255,.09);border-radius:14px;background:rgba(255,255,255,.025)}
    .cloud-account-row{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}
    .cloud-account small{display:block;opacity:.7;margin-top:3px}
    .cloud-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
    .cloud-modal-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:10000;display:grid;place-items:center;padding:18px}
    .cloud-modal{width:min(520px,100%);padding:20px;border-radius:18px;background:#101722;border:1px solid rgba(255,255,255,.1);box-shadow:0 20px 60px rgba(0,0,0,.35)}
    .cloud-modal h2{margin:0 0 8px}.cloud-modal p{line-height:1.5;opacity:.82}
    .cloud-form{display:grid;gap:10px}.cloud-form input{width:100%;box-sizing:border-box;padding:11px;border-radius:10px;border:1px solid rgba(255,255,255,.12);background:#0b111b;color:inherit}
    .cloud-form label{display:grid;gap:5px;font-size:.9rem}
    .cloud-error{min-height:1.3em;color:#ff9d9d;font-size:.9rem}
    .cloud-choice{display:grid;gap:9px;margin-top:14px}.cloud-choice button{text-align:left;padding:13px;border-radius:12px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);color:inherit;cursor:pointer}
    .cloud-choice strong{display:block}.cloud-choice small{opacity:.7}
    [data-state="ok"]{color:#8ee0a7}[data-state="warn"]{color:#ffd27d}[data-state="error"]{color:#ff9d9d}
  `;
  document.head.appendChild(s);
}

function accountCard() {
  const host = document.querySelector('header.topnav');
  if (!host || $('cloudAccount')) return;
  const card = document.createElement('div');
  card.id='cloudAccount';
  card.className='cloud-account';
  card.innerHTML='<div class="cloud-account-row"><div><strong id="cloudAccountTitle">Data akun</strong><small id="cloudAccountSub">Memeriksa cloud…</small></div><div class="cloud-actions" id="cloudActions"></div></div><div id="cloudSyncStatus" class="muted" aria-live="polite"></div>';
  host.parentElement.insertBefore(card, host.nextSibling);
}

function openAuth(mode='login') {
  closeModal();
  const modal=document.createElement('div');
  modal.id='cloudModal'; modal.className='cloud-modal-backdrop';
  modal.innerHTML=`<section class="cloud-modal" role="dialog" aria-modal="true" aria-labelledby="cloudModalTitle">
    <h2 id="cloudModalTitle">${mode==='signup'?'Buat akun':'Masuk ke akun'}</h2>
    <p>${mode==='signup'?'Akun ini dipakai untuk menyimpan data Readiness di cloud dan memulihkannya di perangkat lain.':'Masuk untuk memulihkan data cloud dan melanjutkan sinkronisasi.'}</p>
    <form class="cloud-form" id="cloudAuthForm">
      <label>Email<input id="cloudEmail" type="email" autocomplete="email" required></label>
      <label>Password<input id="cloudPassword" type="password" autocomplete="${mode==='signup'?'new-password':'current-password'}" minlength="6" required></label>
      <div class="cloud-error" id="cloudAuthError"></div>
      <div class="cloud-actions"><button type="button" class="btn btn-secondary" id="cloudSwitch">${mode==='signup'?'Sudah punya akun':'Buat akun'}</button><button class="btn btn-primary" type="submit">${mode==='signup'?'Daftar':'Masuk'}</button></div>
      <button type="button" class="mini-action" id="cloudForgot">Lupa password</button>
      <button type="button" class="mini-action" id="cloudClose">Batal</button>
    </form>
  </section>`;
  document.body.appendChild(modal);
  $('cloudClose').onclick=closeModal;
  $('cloudSwitch').onclick=()=>openAuth(mode==='signup'?'login':'signup');
  $('cloudForgot').onclick=resetPassword;
  $('cloudAuthForm').onsubmit=e=>{e.preventDefault(); mode==='signup'?signUp():signIn();};
  $('cloudEmail').focus();
}

function closeModal(){ $('cloudModal')?.remove(); }

function openChoice(title, message, choices) {
  closeModal();
  const modal=document.createElement('div'); modal.id='cloudModal'; modal.className='cloud-modal-backdrop';
  modal.innerHTML=`<section class="cloud-modal" role="dialog" aria-modal="true"><h2>${esc(title)}</h2><p>${esc(message)}</p><div class="cloud-choice" id="cloudChoices"></div><button class="mini-action" id="cloudChoiceCancel">Batal</button></section>`;
  document.body.appendChild(modal);
  const box=$('cloudChoices');
  choices.forEach(c=>{const b=document.createElement('button');b.innerHTML='<strong>'+esc(c.title)+'</strong><small>'+esc(c.description)+'</small>';b.onclick=async()=>{b.disabled=true;await c.action();};box.appendChild(b);});
  $('cloudChoiceCancel').onclick=closeModal;
}

async function signUp(){
  const email=$('cloudEmail').value.trim(), password=$('cloudPassword').value;
  const error=$('cloudAuthError'); error.textContent='';
  const {data,error:err}=await client.auth.signUp({email,password});
  if(err){error.textContent=err.message;return;}
  if(!data.session){error.textContent='Akun dibuat. Periksa email untuk verifikasi, lalu masuk kembali.';return;}
  closeModal();
}

async function signIn(){
  const email=$('cloudEmail').value.trim(), password=$('cloudPassword').value, error=$('cloudAuthError'); error.textContent='';
  const {error:err}=await client.auth.signInWithPassword({email,password});
  if(err){error.textContent=err.message;return;}
  closeModal();
}

async function resetPassword(){
  const email=$('cloudEmail')?.value.trim();
  if(!email){$('cloudAuthError').textContent='Isi email terlebih dahulu.';return;}
  const {error}=await client.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});
  if(error){$('cloudAuthError').textContent=error.message;return;}
  $('cloudAuthError').textContent='Link reset password dikirim jika alamat dapat diproses. Periksa email.';
}

function openPasswordRecovery(){
  closeModal();
  const modal=document.createElement('div'); modal.id='cloudModal'; modal.className='cloud-modal-backdrop';
  modal.innerHTML=`<section class="cloud-modal" role="dialog" aria-modal="true">
    <h2>Buat password baru</h2>
    <p>Atur password baru untuk akun Readiness.</p>
    <form class="cloud-form" id="cloudRecoveryForm">
      <label>Password baru<input id="cloudNewPassword" type="password" minlength="6" autocomplete="new-password" required></label>
      <label>Ulangi password<input id="cloudNewPassword2" type="password" minlength="6" autocomplete="new-password" required></label>
      <div class="cloud-error" id="cloudRecoveryError"></div>
      <button class="btn btn-primary" type="submit">Simpan password</button>
    </form>
  </section>`;
  document.body.appendChild(modal);
  $('cloudRecoveryForm').onsubmit=async e=>{
    e.preventDefault();
    const a=$('cloudNewPassword').value,b=$('cloudNewPassword2').value;
    if(a!==b){$('cloudRecoveryError').textContent='Password tidak sama.';return;}
    const {error}=await client.auth.updateUser({password:a});
    if(error){$('cloudRecoveryError').textContent=error.message;return;}
    closeModal(); setStatus('Password berhasil diperbarui.','ok');
  };
}

async function signOut(){ await client.auth.signOut(); }

async function getCloudRow(){
  if(!user)return {data:null,error:new Error('Belum login')};
  return client.from('readiness_data').select('data,schema_version,updated_at').eq('user_id',user.id).maybeSingle();
}

async function uploadSnapshot(snapshot, expectedUpdatedAt=null){
  if(!user)throw new Error('Belum login.');
  if(expectedUpdatedAt){
    const current=await getCloudRow();
    if(current.error)throw current.error;
    if(current.data?.updated_at && current.data.updated_at!==expectedUpdatedAt){
      throw new Error('CONFLICT');
    }
  }
  const {data,error}=await client.from('readiness_data').upsert({
    user_id:user.id,
    data:snapshot.data,
    schema_version:snapshot.schemaVersion||1
  },{onConflict:'user_id'}).select('updated_at').single();
  if(error)throw error;
  lastCloudUpdatedAt=data.updated_at;
}

async function restoreSnapshot(snapshot){
  backupLocal();
  suppress=true;
  try { Store.replaceSnapshot(snapshot); }
  finally { suppress=false; }
}

async function initialSync(){
  if(!user)return;
  setStatus('Memeriksa data cloud…','warn');
  const local=Store.getSnapshot();
  const result=await getCloudRow();
  if(result.error)throw result.error;
  const cloud=result.data;
  if(!cloud){
    if(localHasData()){
      openChoice('Data lokal ditemukan','Belum ada data cloud untuk akun ini. Pilih apa yang ingin menjadi data akun.',[
        {title:'Simpan data lokal ke cloud',description:'Data yang sekarang ada di perangkat akan menjadi data akun.',action:async()=>{closeModal();await uploadSnapshot(local);setStatus('Data lokal berhasil disimpan ke cloud.','ok');}},
        {title:'Mulai dari cloud kosong',description:'Data lokal akan dicadangkan di perangkat lalu diganti dengan data kosong.',action:async()=>{closeModal();backupLocal();await restoreSnapshot({version:1,schemaVersion:1,data:{}});setStatus('Akun siap dengan data kosong.','ok');}}
      ]);
    } else {
      await uploadSnapshot(local);
      setStatus('Akun siap. Data cloud dibuat.','ok');
    }
    return;
  }
  lastCloudUpdatedAt=cloud.updated_at;
  if(!localHasData()){
    await restoreSnapshot({version:1,schemaVersion:cloud.schema_version||1,data:cloud.data||{}});
    setStatus('Data cloud dipulihkan ke perangkat.','ok');
    return;
  }
  const same=JSON.stringify(local.data)===JSON.stringify(cloud.data||{});
  if(same){setStatus('Sinkron.','ok');return;}
  openChoice('Data lokal dan cloud berbeda','Kami tidak akan menimpa salah satunya secara otomatis.',[
    {title:'Gunakan data cloud',description:'Cadangkan data lokal lalu pulihkan data dari akun.',action:async()=>{closeModal();await restoreSnapshot({version:1,schemaVersion:cloud.schema_version||1,data:cloud.data||{}});setStatus('Data cloud dipulihkan.','ok');}},
    {title:'Gunakan data perangkat',description:'Pertahankan data lokal dan unggah sebagai versi akun.',action:async()=>{closeModal();await uploadSnapshot(local,lastCloudUpdatedAt);setStatus('Data perangkat diunggah ke cloud.','ok');}}
  ]);
}

async function syncNow(){
  if(!user||suppress||syncing)return;
  syncing=true;setStatus('Menyinkronkan…','warn');
  try{
    const snap=Store.getSnapshot();
    await uploadSnapshot(snap,lastCloudUpdatedAt);
    setStatus('Tersinkron • '+new Date().toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'}),'ok');
  }catch(e){
    if(e.message==='CONFLICT'){
      setStatus('Konflik: cloud berubah di perangkat lain. Tidak ada data yang ditimpa.','error');
    }else{
      setStatus('Belum tersinkron • tetap aman di perangkat.','warn');
    }
  }finally{syncing=false;}
}

function queueSync(){
  if(suppress||!user)return;
  clearTimeout(syncTimer);
  setStatus('Perubahan lokal menunggu sinkronisasi…','warn');
  syncTimer=setTimeout(syncNow,1200);
}

function renderAccount(){
  accountCard();
  const title=$('cloudAccountTitle'), sub=$('cloudAccountSub'), actions=$('cloudActions');
  if(!title||!sub||!actions)return;
  if(!configured){
    title.textContent='Cloud belum dikonfigurasi'; sub.textContent='Isi Store/supabase-config.js setelah proyek Supabase siap.'; actions.innerHTML=''; setStatus('Mode lokal tetap aktif.','warn'); return;
  }
  if(!authReady){title.textContent='Akun';sub.textContent='Memuat…';actions.innerHTML='';return;}
  if(user){
    title.textContent='Akun terhubung'; sub.textContent=user.email||'Pengguna'; actions.innerHTML='<button class="mini-action" id="cloudSyncNow">Sync sekarang</button><button class="mini-action" id="cloudLogout">Keluar</button>';
    $('cloudSyncNow').onclick=syncNow;$('cloudLogout').onclick=signOut;
  }else{
    title.textContent='Data cloud';sub.textContent='Login untuk melindungi data dari hilangnya site data.';actions.innerHTML='<button class="btn btn-primary" id="cloudLogin">Masuk</button><button class="mini-action" id="cloudSignup">Buat akun</button>'; $('cloudLogin').onclick=()=>openAuth('login');$('cloudSignup').onclick=()=>openAuth('signup');
    setStatus('Mode lokal aktif sampai akun dihubungkan.','warn');
  }
}

async function init(){
  injectStyles(); accountCard();
  if(!configured){authReady=true;renderAccount();return;}
  if(!window.supabase?.createClient){authReady=true;renderAccount();setStatus('Library Supabase belum termuat.','error');return;}
  client=window.supabase.createClient(CONFIG.url,CONFIG.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  client.auth.onAuthStateChange(async(event,session)=>{
    user=session?.user||null;
    if(event==='PASSWORD_RECOVERY'){openPasswordRecovery();return;}authReady=true;renderAccount();
    if(event==='SIGNED_IN') {
      try{await initialSync();}catch(e){setStatus('Gagal memuat cloud: '+(e.message||'error'),'error');}
    }
    if(event==='SIGNED_OUT'){lastCloudUpdatedAt=null;setStatus('Keluar. Data lokal tetap ada.','warn');}
  });
  const {data}=await client.auth.getSession();
  user=data.session?.user||null;authReady=true;renderAccount();
  if(user){try{await initialSync();}catch(e){setStatus('Gagal memuat cloud: '+(e.message||'error'),'error');}}
}

window.ReadinessCloud={queueSync,syncNow,getStatus:()=>({configured,userId:user?.id||null,syncing})};
document.addEventListener('DOMContentLoaded',init);
})();