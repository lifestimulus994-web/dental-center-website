// დენტალ ცენტრი — ადმინ პანელის ლოგიკა
(() => {
  const db = window.DentalDB;
  const loginView = document.getElementById('loginView');
  const dashboard = document.getElementById('dashboard');
  const logoutBtn = document.getElementById('logoutBtn');
  const loginForm = document.getElementById('loginForm');
  const loginError = document.getElementById('loginError');
  const toastEl = document.getElementById('toast');

  if (!db || !db.isConfigured) {
    loginView.innerHTML = `<div class="card login-card">
      <h1>Supabase არ არის მიერთებული</h1>
      <p style="color:var(--on-surface-muted);font-size:14px">
        assets/js/supabase-client.js ფაილში ჯერ არ არის ჩასმული პროექტის URL და anon key.
      </p>
    </div>`;
    return;
  }

  const DEFAULT_ASSET = {
    hero: 'assets/hero-clinic.jpg',
    about: 'assets/clinic-room.jpg'
  };
  const SERVICES = [
    { id: 'therapy', label: 'თერაპია' },
    { id: 'kids', label: 'ბავშვთა თერაპია' },
    { id: 'orthopedics', label: 'ორთოპედია' },
    { id: 'orthodontics', label: 'ორთოდონტია' },
    { id: 'surgery', label: 'ქირურგია' },
    { id: 'implant', label: 'იმპლანტაცია' },
    { id: 'aesthetic', label: 'ესთეტიკური სტომატოლოგია' },
    { id: 'lab', label: 'სატექნიკო ლაბორატორია' }
  ];
  const DOCTORS = [
    { id: 'galaktion', name: 'გალაქტიონ (გიგა) ღვინჯილია' },
    { id: 'beka', name: 'ბექა მიროტაძე' },
    { id: 'lika', name: 'ლიკა გოგია' }
  ];

  let activeDoctor = 'galaktion';
  let activeSubtab = 'gallery';
  let activeService = 'therapy';

  // booking_requests accepts public inserts (anyone can POST to it, not
  // just the site's own form), so its contents are untrusted input and
  // must never go into innerHTML unescaped
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => toastEl.classList.remove('show'), 2600);
  }

  // ===== AUTH =====
  async function checkSession() {
    const { data } = await db.client.auth.getSession();
    if (data.session) {
      loginView.hidden = true;
      dashboard.hidden = false;
      logoutBtn.hidden = false;
      boot();
    } else {
      loginView.hidden = false;
      dashboard.hidden = true;
      logoutBtn.hidden = true;
    }
  }

  loginForm.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    loginError.style.display = 'none';
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const { error } = await db.client.auth.signInWithPassword({ email, password });
    if (error) {
      loginError.textContent = 'შესვლა ვერ მოხერხდა — გადაამოწმეთ ელფოსტა და პაროლი.';
      loginError.style.display = 'block';
      return;
    }
    checkSession();
  });

  logoutBtn.addEventListener('click', async () => {
    await db.client.auth.signOut();
    checkSession();
  });

  // ===== STORAGE UPLOAD HELPER =====
  const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5MB — a phone photo straight off
  // the camera can be 15-20MB and would slow the site down for every visitor

  async function uploadFile(file, folder) {
    if (!file.type.startsWith('image/')) {
      throw new Error('მხოლოდ ფოტოს ატვირთვაა შესაძლებელი.');
    }
    if (file.size > MAX_FILE_BYTES) {
      const mb = (file.size / (1024 * 1024)).toFixed(1);
      throw new Error(`ფოტო ძალიან დიდია (${mb}MB). მაქსიმუმ 5MB დაშვებულია — შეამცირეთ ზომა და სცადეთ თავიდან.`);
    }
    const ext = file.name.split('.').pop();
    const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await db.client.storage.from(db.bucket).upload(path, file, { upsert: false });
    if (error) throw error;
    return path;
  }

  // ===== HERO / ABOUT (single-image slots) =====
  async function loadSlots() {
    const { data: rows } = await db.client.from('site_images').select('section_key,storage_path');
    const byKey = new Map((rows || []).map((r) => [r.section_key, r.storage_path]));
    document.querySelectorAll('[data-slot]').forEach((card) => {
      const key = card.dataset.slot;
      const stored = byKey.get(key);
      const url = stored ? db.publicUrl(stored) : DEFAULT_ASSET[key];
      card.querySelector('.thumb').src = url || DEFAULT_ASSET[key];
      card.querySelector('.status').textContent = stored ? 'ატვირთულია' : 'ნაგულისხმევი ფოტო';
    });
  }

  document.addEventListener('change', async (ev) => {
    const input = ev.target.closest('[data-slot] input[type="file"]');
    if (!input) return;
    const card = input.closest('[data-slot]');
    const key = card.dataset.slot;
    const file = input.files[0];
    if (!file) return;
    card.querySelector('.status').textContent = 'იტვირთება...';
    try {
      const path = await uploadFile(file, `site/${key}`);
      const { error } = await db.client.from('site_images')
        .update({ storage_path: path, updated_at: new Date().toISOString() })
        .eq('section_key', key);
      if (error) throw error;
      await loadSlots();
      toast('ფოტო განახლდა');
    } catch (e) {
      card.querySelector('.status').textContent = 'შეცდომა ატვირთვისას';
      toast('შეცდომა: ' + (e.message || e));
    }
    input.value = '';
  });

  document.addEventListener('click', async (ev) => {
    const btn = ev.target.closest('[data-slot] [data-action="reset"]');
    if (!btn) return;
    const key = btn.closest('[data-slot]').dataset.slot;
    const { error } = await db.client.from('site_images')
      .update({ storage_path: null, updated_at: new Date().toISOString() })
      .eq('section_key', key);
    if (error) { toast('შეცდომა: ' + error.message); return; }
    await loadSlots();
    toast('ნაგულისხმევ ფოტოს დაუბრუნდა');
  });

  // ===== SERVICES: photo slides =====
  function renderServiceTabs() {
    const tabs = document.getElementById('serviceTabs');
    tabs.innerHTML = SERVICES.map((s) =>
      `<button type="button" class="doctor-tab${s.id === activeService ? ' is-active' : ''}" data-service-tab="${s.id}">${s.label}</button>`
    ).join('');
  }

  document.getElementById('serviceTabs').addEventListener('click', (ev) => {
    const btn = ev.target.closest('[data-service-tab]');
    if (!btn) return;
    activeService = btn.dataset.serviceTab;
    renderServiceTabs();
    loadServiceGrid();
  });

  async function loadServiceGrid() {
    const grid = document.getElementById('serviceGrid');
    grid.innerHTML = '<p class="hint">იტვირთება...</p>';

    const { data: fetched, error } = await db.client
      .from('service_photos')
      .select('*')
      .eq('service_key', activeService)
      .order('sort_order', { ascending: true });

    if (error) { grid.innerHTML = `<p class="hint">შეცდომა: ${error.message}</p>`; return; }
    const rows = fetched || [];

    const items = rows.map((row, idx) => `
      <div class="card gallery-item" data-id="${row.id}">
        <img src="${db.publicUrl(row.storage_path)}" alt="" />
        <div class="order-row">
          <button type="button" class="btn btn-ghost" data-action="up" ${idx === 0 ? 'disabled' : ''}>↑</button>
          <button type="button" class="btn btn-ghost" data-action="down" ${idx === rows.length - 1 ? 'disabled' : ''}>↓</button>
        </div>
        <button type="button" class="btn btn-danger btn-sm" style="width:100%" data-action="delete">წაშლა</button>
      </div>`).join('');

    grid.innerHTML = items + `
      <label class="add-card">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 5v14M5 12h14"/>
        </svg>
        + ფოტოს დამატება სლაიდში
        <input type="file" accept="image/*" id="addServicePhotoInput" />
      </label>
    `;

    document.getElementById('addServicePhotoInput').addEventListener('change', async (ev) => {
      const file = ev.target.files[0];
      if (!file) return;
      try {
        const folder = `services/${activeService}`;
        const path = await uploadFile(file, folder);
        const nextOrder = rows.length;
        const { error: insErr } = await db.client.from('service_photos').insert({
          service_key: activeService, storage_path: path, sort_order: nextOrder
        });
        if (insErr) throw insErr;
        toast('ფოტო დაემატა');
        loadServiceGrid();
      } catch (e) {
        toast('შეცდომა: ' + (e.message || e));
      }
    });

    grid.querySelectorAll('[data-action="delete"]').forEach((b) => {
      b.addEventListener('click', async () => {
        const id = b.closest('[data-id]').dataset.id;
        if (!confirm('წავშალო ეს ფოტო?')) return;
        await db.client.from('service_photos').delete().eq('id', id);
        toast('წაშლილია');
        loadServiceGrid();
      });
    });

    grid.querySelectorAll('[data-action="up"],[data-action="down"]').forEach((b) => {
      b.addEventListener('click', async () => {
        const id = b.closest('[data-id]').dataset.id;
        const dir = b.dataset.action === 'up' ? -1 : 1;
        const idx = rows.findIndex((r) => r.id === id);
        const swapWith = rows[idx + dir];
        if (!swapWith) return;
        const a = rows[idx], bRow = swapWith;
        await Promise.all([
          db.client.from('service_photos').update({ sort_order: bRow.sort_order }).eq('id', a.id),
          db.client.from('service_photos').update({ sort_order: a.sort_order }).eq('id', bRow.id)
        ]);
        loadServiceGrid();
      });
    });
  }

  // ===== DOCTORS: gallery + results =====
  function renderDoctorTabs() {
    const tabs = document.getElementById('doctorTabs');
    tabs.innerHTML = DOCTORS.map((d) =>
      `<button type="button" class="doctor-tab${d.id === activeDoctor ? ' is-active' : ''}" data-doctor="${d.id}">${d.name}</button>`
    ).join('');
  }

  document.getElementById('doctorTabs').addEventListener('click', (ev) => {
    const btn = ev.target.closest('[data-doctor]');
    if (!btn) return;
    activeDoctor = btn.dataset.doctor;
    renderDoctorTabs();
    loadDoctorGrid();
  });

  document.querySelectorAll('.subtab').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeSubtab = btn.dataset.subtab;
      document.querySelectorAll('.subtab').forEach((b) => b.classList.toggle('is-active', b === btn));
      loadDoctorGrid();
    });
  });

  async function loadDoctorGrid() {
    const table = activeSubtab === 'gallery' ? 'doctor_photos' : 'doctor_results';
    const grid = document.getElementById('doctorGrid');
    grid.innerHTML = '<p class="hint">იტვირთება...</p>';

    const { data: fetched, error } = await db.client
      .from(table)
      .select('*')
      .eq('doctor_id', activeDoctor)
      .order('sort_order', { ascending: true });

    if (error) { grid.innerHTML = `<p class="hint">შეცდომა: ${error.message}</p>`; return; }
    const rows = fetched || [];

    const items = rows.map((row, idx) => {
      const url = db.publicUrl(row.storage_path);
      const caption = table === 'doctor_results'
        ? `<textarea placeholder="წარწერა (არასავალდებულო)" data-id="${row.id}">${row.caption || ''}</textarea>`
        : '';
      return `
        <div class="card gallery-item" data-id="${row.id}">
          <img src="${url}" alt="" />
          ${caption}
          <div class="order-row">
            <button type="button" class="btn btn-ghost" data-action="up" ${idx === 0 ? 'disabled' : ''}>↑</button>
            <button type="button" class="btn btn-ghost" data-action="down" ${idx === rows.length - 1 ? 'disabled' : ''}>↓</button>
          </div>
          <button type="button" class="btn btn-danger btn-sm" style="width:100%" data-action="delete">წაშლა</button>
        </div>`;
    }).join('');

    const addLabel = table === 'doctor_photos' ? '+ ფოტოს დამატება გალერეაში' : '+ შედეგის ფოტოს დამატება';
    grid.innerHTML = items + `
      <label class="add-card">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 5v14M5 12h14"/>
        </svg>
        ${addLabel}
        <input type="file" accept="image/*" id="addPhotoInput" />
      </label>
    `;

    document.getElementById('addPhotoInput').addEventListener('change', async (ev) => {
      const file = ev.target.files[0];
      if (!file) return;
      try {
        const folder = `doctors/${activeDoctor}/${table === 'doctor_photos' ? 'gallery' : 'results'}`;
        const path = await uploadFile(file, folder);
        const nextOrder = rows.length;
        const { error: insErr } = await db.client.from(table).insert({
          doctor_id: activeDoctor, storage_path: path, sort_order: nextOrder
        });
        if (insErr) throw insErr;
        toast('ფოტო დაემატა');
        loadDoctorGrid();
      } catch (e) {
        toast('შეცდომა: ' + (e.message || e));
      }
    });

    grid.querySelectorAll('textarea').forEach((ta) => {
      ta.addEventListener('change', async () => {
        await db.client.from('doctor_results').update({ caption: ta.value }).eq('id', ta.dataset.id);
        toast('წარწერა შენახულია');
      });
    });

    grid.querySelectorAll('[data-action="delete"]').forEach((b) => {
      b.addEventListener('click', async () => {
        const id = b.closest('[data-id]').dataset.id;
        if (!confirm('წავშალო ეს ფოტო?')) return;
        await db.client.from(table).delete().eq('id', id);
        toast('წაშლილია');
        loadDoctorGrid();
      });
    });

    grid.querySelectorAll('[data-action="up"],[data-action="down"]').forEach((b) => {
      b.addEventListener('click', async () => {
        const id = b.closest('[data-id]').dataset.id;
        const dir = b.dataset.action === 'up' ? -1 : 1;
        const idx = rows.findIndex((r) => r.id === id);
        const swapWith = rows[idx + dir];
        if (!swapWith) return;
        const a = rows[idx], bRow = swapWith;
        await Promise.all([
          db.client.from(table).update({ sort_order: bRow.sort_order }).eq('id', a.id),
          db.client.from(table).update({ sort_order: a.sort_order }).eq('id', bRow.id)
        ]);
        loadDoctorGrid();
      });
    });
  }

  // ===== BOOKING REQUESTS =====
  async function loadRequests() {
    const list = document.getElementById('requestsList');
    list.innerHTML = '<p class="hint">იტვირთება...</p>';

    const { data, error } = await db.client
      .from('booking_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) { list.innerHTML = `<p class="hint">შეცდომა: ${error.message}</p>`; return; }
    const rows = data || [];
    if (!rows.length) {
      list.innerHTML = '<p class="requests-empty">ჯერ არცერთი განაცხადი არ შემოსულა.</p>';
      return;
    }

    list.innerHTML = rows.map((r) => {
      const when = new Date(r.created_at).toLocaleString('ka-GE', {
        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
      });
      return `
        <div class="card request-card" data-id="${r.id}">
          <div class="info">
            <div class="name">${escapeHtml(r.name)} · <a href="tel:${escapeHtml(r.phone)}">${escapeHtml(r.phone)}</a></div>
            <div class="meta">${escapeHtml(r.service || '—')}</div>
            ${r.note ? `<div class="note">${escapeHtml(r.note)}</div>` : ''}
          </div>
          <div class="time">${escapeHtml(when)}</div>
          <button type="button" class="btn btn-danger btn-sm" data-action="handled">დამუშავებულია</button>
        </div>`;
    }).join('');

    list.querySelectorAll('[data-action="handled"]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.closest('[data-id]').dataset.id;
        await db.client.from('booking_requests').delete().eq('id', id);
        loadRequests();
      });
    });
  }

  function boot() {
    loadRequests();
    loadSlots();
    renderServiceTabs();
    loadServiceGrid();
    renderDoctorTabs();
    loadDoctorGrid();
  }

  checkSession();
})();
