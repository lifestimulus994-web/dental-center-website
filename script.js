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
// exposed so site-content.js can observe elements it injects after this
// script runs (e.g. the results section, populated from Supabase)
window.__revealObserver = revealObserver;

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

// ===== Booking form -> WhatsApp =====
// There is no backend, so the form hands the visitor off to WhatsApp with
// the message already written. They still have to press send there.
const WHATSAPP_NUMBER = '995555717164';

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
    form.querySelector('.invalid')?.focus();
    return;
  }

  const name = form.querySelector('#name').value.trim();
  const phone = form.querySelector('#phone').value.trim();
  const service = form.querySelector('#service').value.trim();
  const msg = form.querySelector('#msg').value.trim();

  const lines = [
    'ვიზიტზე ჩაწერის მოთხოვნა — დენტალ ცენტრი',
    '',
    `სახელი: ${name}`,
    `ტელეფონი: ${phone}`,
    `სერვისი: ${service}`
  ];
  if (msg) lines.push(`შენიშვნა: ${msg}`);

  // opened synchronously inside the submit handler so it is not treated
  // as a pop-up and blocked
  window.open(
    `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(lines.join('\n'))}`,
    '_blank',
    'noopener'
  );

  // also logged to Supabase, so a request survives even if the WhatsApp
  // message gets missed or deleted. Fire-and-forget: never blocks or
  // fails the WhatsApp handoff, which is the flow that actually matters.
  if (window.DentalDB && window.DentalDB.isConfigured) {
    window.DentalDB.client.from('booking_requests').insert({
      name, phone, service, note: msg || null
    }).then(({ error }) => { if (error) console.error('booking log failed:', error); });
  }

  form.reset();
  note.hidden = false;
  note.className = 'form-note ok';
  note.style.background = '';
  note.style.color = '';
  note.textContent = `მადლობა, ${name}! გახსენით WhatsApp და დააჭირეთ გაგზავნას — შეტყობინება უკვე შევსებულია. ✓`;
});
// clear invalid state on input
form.querySelectorAll('[required]').forEach(f =>
  f.addEventListener('input', () => f.classList.remove('invalid'))
);
