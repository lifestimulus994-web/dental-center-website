// დენტალ ცენტრი — ადმინიდან მართული კონტენტის ჩატვირთვა საჯარო საიტზე.
// თუ Supabase არ არის კონფიგურირებული ან მოთხოვნა ჩავარდა, საიტი უცვლელად
// აჩვენებს ჩაშენებულ სტატიკურ ფოტოებს — არაფერი ტყდება.

(async () => {
  const db = window.DentalDB;
  if (!db || !db.isConfigured) return;

  const AUTO_ROTATE_MS = 2500;
  const prefersReducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ===== 1) ჰერო / ჩვენ შესახებ / სერვისების ფოტოები =====
  try {
    const { data: images } = await db.client.from('site_images').select('section_key,storage_path,alt_text');
    (images || []).forEach((row) => {
      if (!row.storage_path) return;
      const url = db.publicUrl(row.storage_path);
      if (!url) return;
      const target = document.querySelector(`[data-image-slot="${row.section_key}"]`);
      if (!target) return;
      if (target.tagName === 'IMG') {
        target.src = url;
        if (row.alt_text) target.alt = row.alt_text;
      } else {
        target.style.backgroundImage = `url("${url}")`;
      }
    });
  } catch (e) { /* fall back silently to bundled assets */ }

  // ===== 2) ექიმების ფოტო-გალერეები (სლაიდი) =====
  try {
    const { data: photos } = await db.client
      .from('doctor_photos')
      .select('doctor_id,storage_path,sort_order')
      .order('sort_order', { ascending: true });

    const byDoctor = new Map();
    (photos || []).forEach((p) => {
      if (!byDoctor.has(p.doctor_id)) byDoctor.set(p.doctor_id, []);
      byDoctor.get(p.doctor_id).push(p);
    });

    document.querySelectorAll('.doctor-carousel').forEach((carousel) => {
      const doctorId = carousel.dataset.doctor;
      const extra = byDoctor.get(doctorId) || [];
      if (!extra.length) return; // მხოლოდ ჩაშენებული ფოტო რჩება

      const slidesWrap = carousel.querySelector('.doctor-slides');
      extra.forEach((p) => {
        const url = db.publicUrl(p.storage_path);
        if (!url) return;
        const slide = document.createElement('div');
        slide.className = 'doctor-slide';
        slide.style.backgroundImage = `url("${url}")`;
        slidesWrap.appendChild(slide);
      });

      initCarousel(carousel);
    });
  } catch (e) { /* fall back silently */ }

  function initCarousel(carousel) {
    const slides = [...carousel.querySelectorAll('.doctor-slide')];
    if (slides.length < 2) return;
    // inline opacity, not a CSS class: CSS defaults every .doctor-slide to
    // visible so a doctor with only the one built-in photo renders exactly
    // as before with zero JS involvement. Only once a second photo exists
    // does this function run and take over via inline styles, which always
    // win over the CSS default regardless of class state.
    slides.forEach((s, idx) => { s.style.opacity = idx === 0 ? '1' : '0'; });
    let i = 0;
    let timer = null;

    const dots = document.createElement('div');
    dots.className = 'doctor-dots';
    slides.forEach((_, idx) => {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.setAttribute('aria-label', `ფოტო ${idx + 1}`);
      if (idx === 0) dot.classList.add('is-active');
      dot.addEventListener('click', (ev) => { ev.stopPropagation(); go(idx); restart(); });
      dots.appendChild(dot);
    });
    carousel.appendChild(dots);

    const prev = document.createElement('button');
    prev.type = 'button'; prev.className = 'doctor-nav-btn doctor-nav-prev';
    prev.setAttribute('aria-label', 'წინა ფოტო');
    prev.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>';
    prev.addEventListener('click', (ev) => { ev.stopPropagation(); go(i - 1); restart(); });

    const next = document.createElement('button');
    next.type = 'button'; next.className = 'doctor-nav-btn doctor-nav-next';
    next.setAttribute('aria-label', 'შემდეგი ფოტო');
    next.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>';
    next.addEventListener('click', (ev) => { ev.stopPropagation(); go(i + 1); restart(); });

    carousel.appendChild(prev);
    carousel.appendChild(next);

    function go(n) {
      slides[i].style.opacity = '0';
      dots.children[i].classList.remove('is-active');
      i = (n + slides.length) % slides.length;
      slides[i].style.opacity = '1';
      dots.children[i].classList.add('is-active');
    }
    function restart() {
      if (prefersReducedMotion) return;
      clearInterval(timer);
      timer = setInterval(() => go(i + 1), AUTO_ROTATE_MS);
    }
    restart();
  }

  // ===== 2b) სერვისების ფოტო-სლაიდები =====
  try {
    const { data: photos } = await db.client
      .from('service_photos')
      .select('service_key,storage_path,sort_order')
      .order('sort_order', { ascending: true });

    const byService = new Map();
    (photos || []).forEach((p) => {
      if (!byService.has(p.service_key)) byService.set(p.service_key, []);
      byService.get(p.service_key).push(p);
    });

    document.querySelectorAll('.service-media').forEach((media) => {
      const key = media.dataset.service;
      const extra = byService.get(key) || [];
      if (!extra.length) return; // მხოლოდ ჩაშენებული ფოტო რჩება

      const slidesWrap = media.querySelector('.service-slides');
      // a card with no bundled photo (e.g. ქირურგია) has an empty base
      // slide reserving the spot — once real photos exist, drop the blank
      // frame instead of rotating it in alongside them
      const baseSlide = slidesWrap.querySelector('.service-slide');
      if (baseSlide && getComputedStyle(baseSlide).backgroundImage === 'none') {
        baseSlide.remove();
      }
      extra.forEach((p) => {
        const url = db.publicUrl(p.storage_path);
        if (!url) return;
        const slide = document.createElement('div');
        slide.className = 'service-slide';
        slide.style.backgroundImage = `url("${url}")`;
        slidesWrap.appendChild(slide);
      });

      initServiceSlides(media);
    });
  } catch (e) { /* fall back silently */ }

  function initServiceSlides(media) {
    const slides = [...media.querySelectorAll('.service-slide')];
    if (slides.length < 2 || prefersReducedMotion) return;
    slides.forEach((s, idx) => { s.style.opacity = idx === 0 ? '1' : '0'; });
    let i = 0;
    setInterval(() => {
      slides[i].style.opacity = '0';
      i = (i + 1) % slides.length;
      slides[i].style.opacity = '1';
    }, AUTO_ROTATE_MS);
  }

  // ===== 3) შედეგები — მანამდე/შემდეგ ქეისები =====
  try {
    const [{ data: cases }, { data: photos }] = await Promise.all([
      db.client.from('result_cases').select('id,title,sort_order').order('sort_order', { ascending: true }),
      db.client.from('result_case_photos').select('case_id,side,storage_path,sort_order').order('sort_order', { ascending: true })
    ]);

    const section = document.getElementById('results');
    if (!section || !cases || !cases.length) return;

    const byCase = new Map();
    (photos || []).forEach((p) => {
      if (!byCase.has(p.case_id)) byCase.set(p.case_id, { before: [], after: [] });
      byCase.get(p.case_id)[p.side].push(p);
    });

    // ცარიელი ქეისი (ორივე მხარეს ჯერ არცერთი ფოტო) საერთოდ არ გამოჩნდეს
    const usableCases = cases.filter((c) => {
      const g = byCase.get(c.id);
      return g && (g.before.length || g.after.length);
    });
    if (!usableCases.length) return;

    const frameHtml = (side, label, items) => {
      const slides = items.map((p) => {
        const url = db.publicUrl(p.storage_path);
        return url ? `<div class="case-slide" style="background-image:url('${url}')"></div>` : '';
      }).join('');
      return `
        <div class="case-frame" data-side="${side}" role="img" aria-label="${label}">
          <span class="case-label">${label}</span>
          <div class="case-slides">${slides}</div>
        </div>`;
    };

    const wrap = section.querySelector('.results-content');
    wrap.innerHTML = '';
    usableCases.forEach((c) => {
      const g = byCase.get(c.id) || { before: [], after: [] };
      const card = document.createElement('article');
      card.className = 'case-card reveal';
      card.innerHTML = `
        ${c.title ? `<h3 class="case-title">${c.title}</h3>` : ''}
        <div class="case-compare">
          ${frameHtml('before', 'მანამდე', g.before)}
          ${frameHtml('after', 'შემდეგ', g.after)}
        </div>`;
      wrap.appendChild(card);
      card.querySelectorAll('.case-frame').forEach(initCaseFrame);
    });

    section.classList.add('has-results');
    document.querySelectorAll('.reveal').forEach((el) => {
      if (!window.__revealObserver) return;
      window.__revealObserver.observe(el);
    });
  } catch (e) { /* leave the empty-state message in place */ }

  function initCaseFrame(frame) {
    const slides = [...frame.querySelectorAll('.case-slide')];
    if (slides.length < 2 || prefersReducedMotion) return;
    slides.forEach((s, idx) => { s.style.opacity = idx === 0 ? '1' : '0'; });
    let i = 0;
    setInterval(() => {
      slides[i].style.opacity = '0';
      i = (i + 1) % slides.length;
      slides[i].style.opacity = '1';
    }, AUTO_ROTATE_MS);
  }
})();
