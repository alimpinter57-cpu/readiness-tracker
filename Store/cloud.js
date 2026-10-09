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
let initialSyncStarted = false;
const emailCooldownMs = 60000;
let emailCooldownUntil = 0;

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const localBackupKey = 'readiness:preCloudBackup';
const activeUserKey = 'readiness:activeCloudUserId';
const accountBackupPrefix = 'readiness:accountBackup:';

function localHasData() {
  const snap = Store.getSnapshot();
  return Object.keys(snap.data || {}).some(k => {
    const v = snap.data[k];
    return v !== null && v !== undefined && v !== '' &&
      !(Array.isArray(v) && v.length === 0) &&
      !(typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0);
  });
}

function backupLocal(ownerId = user?.id || 'anonymous') {
  try {
    const payload = {
      version: 1,
      createdAt: new Date().toISOString(),
      ownerId,
      snapshot: Store.getSnapshot()
    };
    const serialized = JSON.stringify(payload);
    localStorage.setItem(localBackupKey, serialized);
    localStorage.setItem(accountBackupPrefix + ownerId, serialized);
  } catch (error) {
    console.error('[Readiness local backup]', error);
  }
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
    .cloud-settings-button{flex:0 0 42px;margin-left:8px;width:42px;height:42px;border:1px solid rgba(255,255,255,.1);border-radius:12px;background:rgba(255,255,255,.04);color:inherit;display:grid;place-items:center;cursor:pointer}
    .cloud-menu-icon{width:22px;height:18px;display:block;flex:0 0 22px;background:linear-gradient(currentColor,currentColor) center 0/100% 2px no-repeat,linear-gradient(currentColor,currentColor) center 50%/100% 2px no-repeat,linear-gradient(currentColor,currentColor) center 100%/100% 2px no-repeat}
    .cloud-settings-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9998}
    .cloud-settings-drawer{position:fixed;top:0;right:0;width:min(390px,92vw);height:100%;box-sizing:border-box;padding:22px 18px 28px;background:#101722;border-left:1px solid rgba(255,255,255,.1);box-shadow:-18px 0 50px rgba(0,0,0,.3);z-index:9999;overflow:auto;display:none}
    .cloud-settings-drawer[hidden]{display:none!important}
    .cloud-settings-backdrop[hidden]{display:none!important}
    body.cloud-drawer-open{overflow:hidden}
    .cloud-settings-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:22px}
    .cloud-settings-head h2{margin:0}.cloud-settings-section{padding:15px 0;border-top:1px solid rgba(255,255,255,.08)}
    .cloud-settings-section:first-of-type{border-top:0}
    .cloud-settings-label{font-size:.75rem;letter-spacing:.08em;opacity:.55;margin-bottom:10px}
    .cloud-settings-account{padding:14px;border-radius:14px;background:rgba(255,255,255,.04)}
    .cloud-settings-account strong{display:block}.cloud-settings-account small{display:block;opacity:.7;margin-top:4px}
    .cloud-settings-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
    .cloud-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
    .cloud-modal-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:10000;display:grid;place-items:center;padding:18px}
    .cloud-modal{width:min(520px,100%);padding:20px;border-radius:18px;background:#101722;border:1px solid rgba(255,255,255,.1);box-shadow:0 20px 60px rgba(0,0,0,.35)}
    .cloud-modal h2{margin:0 0 8px}.cloud-modal p{line-height:1.5;opacity:.82}
    .cloud-form{display:grid;gap:10px}.cloud-form input{width:100%;box-sizing:border-box;padding:11px;border-radius:10px;border:1px solid rgba(255,255,255,.12);background:#0b111b;color:inherit}
    .cloud-form label{display:grid;gap:5px;font-size:.9rem}
    .cloud-divider{text-align:center;opacity:.55;font-size:.85rem;margin:2px 0}
    .cloud-error{min-height:1.3em;color:#ff9d9d;font-size:.9rem}
    .cloud-choice{display:grid;gap:9px;margin-top:14px}.cloud-choice button{text-align:left;padding:13px;border-radius:12px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);color:inherit;cursor:pointer}
    .cloud-choice strong{display:block}.cloud-choice small{opacity:.7}
    [data-state="ok"]{color:#8ee0a7}[data-state="warn"]{color:#ffd27d}[data-state="error"]{color:#ff9d9d}
  `;
  document.head.appendChild(s);
}

function accountCard() {
  const host=document.querySelector('header.topnav');
  if(!host)return;

  let button=$('cloudSettingsButton');
  if(!button){
    button=document.createElement('button');
    button.id='cloudSettingsButton';
    button.className='cloud-settings-button';
    button.type='button';
    button.setAttribute('aria-label','Buka pengaturan');
    button.setAttribute('aria-expanded','false');
    button.title='Pengaturan';
    button.innerHTML='<span class="cloud-menu-icon" aria-hidden="true"></span>';
    host.appendChild(button);
  }

  const drawer=$('cloudSettingsDrawer'),backdrop=$('cloudSettingsBackdrop'),closeButton=$('cloudSettingsClose');
  if(!drawer||!backdrop||!closeButton)return;
  if(button.dataset.bound==='1')return;
  const setDrawer=(open)=>{
    drawer.hidden=!open;
    backdrop.hidden=!open;
    drawer.style.display=open?'block':'none';
    backdrop.style.display=open?'block':'none';
    button.setAttribute('aria-expanded',String(open));
    document.body.classList.toggle('cloud-drawer-open',open);
  };
  const close=()=>setDrawer(false);
  const open=()=>setDrawer(true);
  setDrawer(false);
  button.addEventListener('click',open);
  backdrop.addEventListener('click',close);
  closeButton.addEventListener('click',close);
  document.addEventListener('keydown',e=>{if(e.key==='Escape')close();});
  button.dataset.bound='1';
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
      <button type="button" class="btn btn-primary" id="cloudGoogle">Lanjut dengan Google</button>
      <div class="cloud-divider">atau gunakan email</div>
      <div class="cloud-actions"><button type="button" class="btn btn-secondary" id="cloudSwitch">${mode==='signup'?'Sudah punya akun':'Buat akun'}</button><button class="btn btn-primary" type="submit">${mode==='signup'?'Daftar':'Masuk'}</button></div>
      <button type="button" class="mini-action" id="cloudForgot">Lupa password</button>
      <button type="button" class="mini-action" id="cloudClose">Batal</button>
    </form>
  </section>`;
  document.body.appendChild(modal);
  $('cloudClose').onclick=closeModal;
  $('cloudGoogle').onclick=signInWithGoogle;
  $('cloudSwitch').onclick=()=>openAuth(mode==='signup'?'login':'signup');
  $('cloudForgot').onclick=resetPassword;
  $('cloudAuthForm').onsubmit=e=>{e.preventDefault(); mode==='signup'?signUp():signIn();};
  $('cloudEmail').focus();
}

function closeModal(){ $('cloudModal')?.remove(); }

async function signInWithGoogle(){
  const button=$('cloudGoogle'), error=$('cloudAuthError');
  if(button) button.disabled=true;
  if(error) error.textContent='';
  const redirectTo=window.location.origin+window.location.pathname;
  const {error:err}=await client.auth.signInWithOAuth({
    provider:'google',
    options:{redirectTo}
  });
  if(err){
    if(error) error.textContent=authErrorMessage(err);
    if(button) button.disabled=false;
  }
}

function authErrorMessage(err) {
  const message = String(err?.message || '').toLowerCase();
  if (message.includes('provider is not enabled') || message.includes('unsupported provider')) {
    return 'Google Login belum diaktifkan di Supabase. Aktifkan Auth → Providers → Google, lalu isi Client ID dan Client Secret Google.';
  }
  if (err?.code === 'over_email_send_rate_limit') return 'Pengiriman email sedang dibatasi. Tunggu beberapa saat sebelum mencoba lagi.';
  if (err?.code === 'over_request_rate_limit') return 'Terlalu banyak percobaan. Tunggu beberapa menit sebelum mencoba lagi.';
  if (err?.code === 'email_not_confirmed') return 'Email belum dikonfirmasi. Periksa inbox lalu coba lagi.';
  if (err?.code === 'invalid_credentials') return 'Email atau password salah.';
  return err?.message || 'Terjadi kesalahan. Coba lagi.';
}

function startEmailCooldown(button) {
  if (!button) return;
  const original = button.textContent;
  emailCooldownUntil = Date.now() + emailCooldownMs;
  button.disabled = true;
  const tick = () => {
    const remaining = Math.ceil((emailCooldownUntil - Date.now()) / 1000);
    if (remaining <= 0) { button.disabled = false; button.textContent = original; return; }
    button.textContent = `Tunggu ${remaining}s…`;
    setTimeout(tick, 1000);
  };
  tick();
}

function openChoice(title, message, choices) {
  closeModal();
  const modal=document.createElement('div'); modal.id='cloudModal'; modal.className='cloud-modal-backdrop';
  modal.innerHTML=`<section class="cloud-modal" role="dialog" aria-modal="true"><h2>${esc(title)}</h2><p>${esc(message)}</p><div class="cloud-choice" id="cloudChoices"></div><button class="mini-action" id="cloudChoiceCancel">Batal</button></section>`;
  document.body.appendChild(modal);
  const box=$('cloudChoices');
  choices.forEach(c=>{
    const b=document.createElement('button');
    b.innerHTML='<strong>'+esc(c.title)+'</strong><small>'+esc(c.description)+'</small>';
    b.onclick=async()=>{
      b.disabled=true;
      try{
        await c.action();
      }catch(e){
        b.disabled=false;
        setStatus('Gagal sinkron: '+cloudErrorMessage(e),'error');
        console.error('[Readiness Cloud]',e);
      }
    };
    box.appendChild(b);
  });
  $('cloudChoiceCancel').onclick=closeModal;
}

async function signUp(){
  const email=$('cloudEmail').value.trim(), password=$('cloudPassword').value;
  const error=$('cloudAuthError'); error.textContent='';
  const submit=$('cloudAuthForm')?.querySelector('button[type="submit"]');
  if (Date.now() < emailCooldownUntil) { error.textContent='Tunggu sebentar sebelum mengirim email lagi.'; return; }
  if (submit) submit.disabled=true;
  const redirectTo = window.location.origin + window.location.pathname;
  const {data,error:err}=await client.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: redirectTo }
  });
  if(err){
    error.textContent=authErrorMessage(err);
    if (err.code === 'over_email_send_rate_limit' || err.code === 'over_request_rate_limit') startEmailCooldown(submit);
    else if (submit) submit.disabled=false;
    return;
  }
  if(!data.session){
    error.textContent='Akun dibuat. Periksa email untuk verifikasi, lalu masuk kembali.';
    startEmailCooldown(submit);
    return;
  }
  closeModal();
}

async function signIn(){
  const email=$('cloudEmail').value.trim(), password=$('cloudPassword').value, error=$('cloudAuthError'); error.textContent='';
  const {error:err}=await client.auth.signInWithPassword({email,password});
  if(err){error.textContent=authErrorMessage(err);return;}
  closeModal();
}

async function resetPassword(){
  const email=$('cloudEmail')?.value.trim();
  const errorNode=$('cloudAuthError');
  if(!email){errorNode.textContent='Isi email terlebih dahulu.';return;}
  if (Date.now() < emailCooldownUntil) { errorNode.textContent='Tunggu sebentar sebelum mengirim email lagi.'; return; }
  const button=$('cloudForgot');
  button.disabled=true;
  const {error}=await client.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});
  if(error){
    errorNode.textContent=authErrorMessage(error);
    if (error.code === 'over_email_send_rate_limit' || error.code === 'over_request_rate_limit') startEmailCooldown(button);
    else button.disabled=false;
    return;
  }
  startEmailCooldown(button);
  errorNode.textContent='Link reset password dikirim jika alamat dapat diproses. Periksa email.';
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

function cloudErrorMessage(err) {
  const message = String(err?.message || err || 'Kesalahan cloud');
  const code = err?.code ? ' [' + err.code + ']' : '';
  const details = err?.details ? ' — ' + err.details : '';
  return message + code + details;
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
  if(error){
    const e=new Error(cloudErrorMessage(error));
    e.code=error.code;
    e.details=error.details;
    throw e;
  }
  lastCloudUpdatedAt=data.updated_at;
}

async function restoreSnapshot(snapshot, backupOwner = user?.id || 'anonymous'){
  backupLocal(backupOwner);
  suppress=true;
  try {
    Store.replaceSnapshot(snapshot);
    // Notify the page UI: localStorage restoration alone does not repaint rendered views.
    window.dispatchEvent(new CustomEvent('readiness:cloud-restored', { detail: { userId: user?.id || null } }));
  } finally { suppress=false; }
}

async function initialSync(){
  if(!user)return;
  setStatus('Memeriksa data cloud…','warn');

  const local = Store.getSnapshot();
  const previousUserId = localStorage.getItem(activeUserKey);
  const sameAccount = previousUserId === user.id;
  const result = await getCloudRow();
  if(result.error) throw result.error;

  const cloud = result.data;
  if(!cloud){
    // First login can claim anonymous local data. Never copy one signed-in
    // account's local data into a different account.
    if(previousUserId && !sameAccount){
      backupLocal(previousUserId);
      await restoreSnapshot({version:1,schemaVersion:1,data:{}}, previousUserId);
      await uploadSnapshot(Store.getSnapshot());
      localStorage.setItem(activeUserKey, user.id);
      setStatus('Akun ini belum memiliki data. Data akun lama dicadangkan terpisah; akun baru siap dengan data kosong.','ok');
      return;
    }

    await uploadSnapshot(local);
    localStorage.setItem(activeUserKey, user.id);
    setStatus(localHasData() ? 'Data perangkat berhasil disimpan ke akun cloud.' : 'Akun siap. Penyimpanan cloud dibuat.','ok');
    return;
  }

  // A saved cloud row is authoritative for the account being signed into.
  // Back up local state first, so switching accounts cannot silently destroy it.
  const same = JSON.stringify(local.data || {}) === JSON.stringify(cloud.data || {});
  if(!same){
    await restoreSnapshot(
      {version:1,schemaVersion:cloud.schema_version||1,data:cloud.data||{}},
      previousUserId || 'anonymous'
    );
  }
  lastCloudUpdatedAt = cloud.updated_at;
  localStorage.setItem(activeUserKey, user.id);
  setStatus(same ? 'Sinkron. Data akun sudah sama dengan perangkat.' : 'Data akun berhasil dipulihkan ke perangkat. Data lokal sebelumnya dicadangkan.','ok');
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
      setStatus('Belum tersinkron: '+cloudErrorMessage(e),'error');
      console.error('[Readiness Cloud sync]',e);
    }
  }finally{syncing=false;}
}

function queueSync(){
  if(suppress||!user)return;
  clearTimeout(syncTimer);
  setStatus('Perubahan lokal menunggu sinkronisasi…','warn');
  syncTimer=setTimeout(syncNow,1200);
}

function bindSyncButton(){
  const sync=$('cloudSyncNowSettings');
  if(!sync || sync.dataset.cloudBound==='1') return;
  sync.dataset.cloudBound='1';
  sync.disabled=false;
  sync.onclick=async()=>{
    if(!user){
      setStatus('Belum login. Hubungkan akun Google terlebih dahulu.','warn');
      openAuth('login');
      return;
    }
    await syncNow();
  };
}

function renderAccount(){
  accountCard();
  bindSyncButton();
  const title=$('cloudAccountTitle'), sub=$('cloudAccountSub'), actions=$('cloudActions');
  if(!title||!sub||!actions)return;
  if(!configured){
    title.textContent='Cloud belum dikonfigurasi'; sub.textContent='Isi Store/supabase-config.js setelah proyek Supabase siap.'; actions.innerHTML=''; setStatus('Mode lokal tetap aktif.','warn'); return;
  }
  if(!authReady){title.textContent='Akun';sub.textContent='Memuat…';actions.innerHTML='';return;}
  if(user){
    title.textContent=user.email||'Akun terhubung'; sub.textContent='Akun aktif • data dan sinkronisasi khusus akun ini'; actions.innerHTML='<button class="mini-action" id="cloudLogout">Keluar dari akun ini</button>';
    $('cloudLogout').onclick=signOut;
  }else{
    title.textContent='Belum ada akun aktif';sub.textContent='Data lokal perangkat ini belum terhubung ke akun cloud.';actions.innerHTML='<button class="btn btn-primary" id="cloudGoogleMain">Lanjut dengan Google</button><button class="btn btn-secondary" id="cloudLogin">Masuk</button><button class="mini-action" id="cloudSignup">Daftar</button>'; $('cloudGoogleMain').onclick=signInWithGoogle;$('cloudLogin').onclick=()=>openAuth('login');$('cloudSignup').onclick=()=>openAuth('signup');
    setStatus('Mode lokal aktif sampai akun dihubungkan.','warn');
  }
}

async function init(){
  injectStyles(); accountCard();
  if(!configured){authReady=true;renderAccount();return;}
  if(!window.supabase?.createClient){authReady=true;renderAccount();setStatus('Library Supabase belum termuat.','error');return;}
  client=window.supabase.createClient(CONFIG.url,CONFIG.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  client.auth.onAuthStateChange((event,session)=>{
    user=session?.user||null;
    if(event==='PASSWORD_RECOVERY'){openPasswordRecovery();return;}
    authReady=true;
    renderAccount();
    if(event==='SIGNED_IN') scheduleInitialSync();
    if(event==='SIGNED_OUT'){lastCloudUpdatedAt=null;initialSyncStarted=false;setStatus('Keluar. Data lokal tetap ada.','warn');}
  });
  const {data, error:sessionError}=await client.auth.getSession();
  if(sessionError){
    console.error('[Readiness Cloud session]',sessionError);
    setStatus('Gagal membaca sesi akun: '+cloudErrorMessage(sessionError),'error');
  }
  user=data.session?.user||null;authReady=true;renderAccount();
  if(user) scheduleInitialSync();
}

function scheduleInitialSync(){
  if(!user || initialSyncStarted) return;
  initialSyncStarted=true;
  setTimeout(async()=>{
    try{await initialSync();}
    catch(e){
      initialSyncStarted=false;
      setStatus('Gagal memuat cloud: '+(e.message||'error'),'error');
    }
  },0);
}

window.ReadinessCloud={queueSync,syncNow,getStatus:()=>({configured,userId:user?.id||null,syncing})};

// cloud.js is loaded at the end of each page, but handle both normal loads
// and cases where this script executes after DOMContentLoaded (cache/navigation).
if(document.readyState==='loading') {
  document.addEventListener('DOMContentLoaded',init,{once:true});
} else {
  init();
}
})();