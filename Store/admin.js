(() => {
  'use strict';

  const statusEl = document.getElementById('adminStatus');
  const usersEl = document.getElementById('adminUsers');
  const refreshBtn = document.getElementById('adminRefresh');
  const config = window.READINESS_SUPABASE_CONFIG;

  if (!statusEl || !usersEl || !refreshBtn) return;

  if (!config || !window.supabase?.createClient) {
    statusEl.textContent = 'Konfigurasi Supabase tidak ditemukan. Periksa urutan script.';
    refreshBtn.disabled = true;
    return;
  }

  const client = window.supabase.createClient(config.url, config.publishableKey);

  function setStatus(message) {
    statusEl.textContent = message;
  }

  function makeText(tag, className, value) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    node.textContent = value == null || value === '' ? '—' : String(value);
    return node;
  }

  function formatDate(value) {
    if (!value) return 'Belum pernah sinkron';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Waktu tidak valid';
    return date.toLocaleString('id-ID', {
      dateStyle: 'medium',
      timeStyle: 'short'
    });
  }

  function renderUsers(rows) {
    usersEl.replaceChildren();
    usersEl.appendChild(makeText('h2', '', 'Data sinkronisasi'));
    usersEl.appendChild(makeText('p', '', 'Jumlah akun dengan data tersimpan: ' + rows.length));

    if (!rows.length) {
      usersEl.appendChild(makeText('p', '', 'Belum ada data sinkronisasi pengguna.'));
      return;
    }

    rows.forEach((row, index) => {
      const card = document.createElement('article');
      card.className = 'card';
      card.appendChild(makeText('h3', '', row.email || 'Email tidak tersedia'));
      card.appendChild(makeText('p', '', 'User ID: ' + (row.user_id || '—')));
      card.appendChild(makeText('p', '', 'Pembaruan terakhir: ' + formatDate(row.updated_at)));

      const details = document.createElement('details');
      const summary = makeText('summary', '', 'Lihat data tersimpan');
      details.appendChild(summary);

      const pre = document.createElement('pre');
      pre.style.whiteSpace = 'pre-wrap';
      pre.style.overflowWrap = 'anywhere';
      pre.style.maxHeight = '24rem';
      pre.style.overflow = 'auto';
      pre.textContent = JSON.stringify(row.data ?? {}, null, 2);
      details.appendChild(pre);
      card.appendChild(details);
      usersEl.appendChild(card);
    });
  }

  async function loadUsers() {
    refreshBtn.disabled = true;
    setStatus('Memeriksa sesi dan izin admin…');
    usersEl.replaceChildren();

    try {
      const { data: sessionData, error: sessionError } = await client.auth.getSession();
      if (sessionError) throw sessionError;

      if (!sessionData.session) {
        setStatus('Belum login. Masuk melalui halaman utama, lalu buka kembali halaman admin.');
        return;
      }

      setStatus('Mengambil data melalui pemeriksaan izin server…');
      const { data, error } = await client.rpc('admin_list_users');
      if (error) {
        if (/akses admin ditolak/i.test(error.message || '')) {
          setStatus('Akses ditolak: akun ini belum terdaftar sebagai admin.');
        } else {
          setStatus('Gagal memuat data: ' + (error.message || 'Kesalahan tidak diketahui'));
        }
        return;
      }

      renderUsers(Array.isArray(data) ? data : []);
      setStatus('Berhasil memuat data. Hanya akun admin yang diizinkan server dapat melihat daftar ini.');
    } catch (error) {
      setStatus('Terjadi kesalahan: ' + (error?.message || String(error)));
    } finally {
      refreshBtn.disabled = false;
    }
  }

  refreshBtn.addEventListener('click', loadUsers);
  loadUsers();
})();