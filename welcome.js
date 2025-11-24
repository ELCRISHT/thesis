function goDashboard() {
  window.location.href = "index.html";
}

if (!localStorage.getItem("activeUser")) {
  window.location.href = "login.html";
}

const particleContainer = document.querySelector('.particles');

for (let i = 0; i < 60; i++) {
  const particle = document.createElement('div');
  particle.classList.add('particle');

  const size = Math.random() * 6 + 2;       // 2–8px
  const left = Math.random() * 100;         // random horizontal position
  const delay = Math.random() * -20;        // random start times
  const duration = Math.random() * 10 + 10; // 10–20s

  particle.style.width = `${size}px`;
  particle.style.height = `${size}px`;
  particle.style.left = `${left}vw`;
  particle.style.animationDelay = `${delay}s`;
  particle.style.animationDuration = `${duration}s`;

  particleContainer.appendChild(particle);
}
function toggleMenu() {
    const menu = document.getElementById("sideMenu");
    menu.classList.toggle("open");
}

function scrollToSection(id) {
    const section = document.getElementById(id);
    if (section) {
        section.scrollIntoView({ behavior: "smooth" });
    }
    toggleMenu();
}
// ---------- Scroll reveal using IntersectionObserver ----------
(function () {
  const revealObserver = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('reveal');
        entry.target.classList.remove('reveal-hidden');
        // if you want the animation to run only once:
        obs.unobserve(entry.target);
      }
    });
  }, {
    root: null,
    rootMargin: '0px 0px -8% 0px', // trigger a bit before fully in view
    threshold: 0.08
  });

  // Observe all elements with reveal-hidden
  document.querySelectorAll('.reveal-hidden').forEach(el => revealObserver.observe(el));
})();

// ---------- Hamburger toggle ----------
function toggleMenu() {
  const menu = document.getElementById('sideMenu');
  if (!menu) return;
  menu.classList.toggle('open');
}

// ---------- Smooth scroll to section (and close menu) ----------
function scrollToSection(id) {
  const el = document.getElementById(id);
  if (!el) return;
  // Close menu if open
  const menu = document.getElementById('sideMenu');
  if (menu && menu.classList.contains('open')) menu.classList.remove('open');

  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ---------- CTA helper (go to dashboard) ----------
function goDashboard() {
  // adjust to your actual dashboard path
  window.location.href = 'index.html';
}