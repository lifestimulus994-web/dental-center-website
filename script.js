// ===== Sticky header shadow =====
const header = document.querySelector('.site-header');
const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 10);
onScroll();
window.addEventListener('scroll', onScroll, { passive: true });

// ===== Mobile burger =====
const burger = document.getElementById('burger');
const navLinks = document.getElementById('navLinks');
burger.addEventListener('click', () => {
  const open = navLinks.classList.toggle('open');
  burger.classList.toggle('open', open);
  burger.setAttribute('aria-expanded', open);
});
// close menu on link click
navLinks.querySelectorAll('a').forEach(a =>
  a.addEventListener('click', () => {
    navLinks.classList.remove('open');
    burger.classList.remove('open');
    burger.setAttribute('aria-expanded', 'false');
  })
);

// ===== Scroll reveal =====
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('visible');
      revealObserver.unobserve(e.target);
    }
  });
}, { threshold: 0.12 });
document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

// ===== Active nav link on scroll =====
const sections = [...document.querySelectorAll('section[id]')];
const navMap = new Map(
  [...navLinks.querySelectorAll('a')].map(a => [a.getAttribute('href').slice(1), a])
);
const navObserver = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      navMap.forEach(a => a.classList.remove('active'));
      const link = navMap.get(e.target.id);
      if (link) link.classList.add('active');
    }
  });
}, { rootMargin: '-45% 0px -50% 0px' });
sections.forEach(s => navObserver.observe(s));

// ===== Counter animation =====
const counters = document.querySelectorAll('[data-count]');
const counterObserver = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (!e.isIntersecting) return;
    const el = e.target;
    const target = +el.dataset.count;
    let cur = 0;
    const step = Math.max(1, Math.round(target / 40));
    const tick = () => {
      cur = Math.min(target, cur + step);
      el.textContent = cur;
      if (cur < target) requestAnimationFrame(tick);
    };
    tick();
    counterObserver.unobserve(el);
  });
}, { threshold: 0.5 });
counters.forEach(c => counterObserver.observe(c));

// ===== Booking form (fake success) =====
const form = document.getElementById('bookingForm');
const note = document.getElementById('formNote');
form.addEventListener('submit', (ev) => {
  ev.preventDefault();
  const required = form.querySelectorAll('[required]');
  let ok = true;
  required.forEach(f => {
    const bad = !f.value.trim();
    f.classList.toggle('invalid', bad);
    if (bad) ok = false;
  });
  if (!ok) {
    note.hidden = false;
    note.className = 'form-note';
    note.style.background = 'rgba(224,87,107,.1)';
    note.style.color = '#e0576b';
    note.textContent = 'გთხოვთ, შეავსოთ სავალდებულო ველები.';
    return;
  }
  const name = form.querySelector('#name').value.trim();
  form.reset();
  note.hidden = false;
  note.className = 'form-note ok';
  note.style.background = '';
  note.style.color = '';
  note.textContent = `მადლობა, ${name}! თქვენი მოთხოვნა მიღებულია — მალე დაგიკავშირდებით. ✓`;
});
// clear invalid state on input
form.querySelectorAll('[required]').forEach(f =>
  f.addEventListener('input', () => f.classList.remove('invalid'))
);
