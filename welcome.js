import { attachAuthGuard, doSignOut } from './auth.js';

attachAuthGuard({
  onAuthVerified: (user) => {
    const uname = user.email ? user.email.split('@')[0] : 'USER';
    const title = document.querySelector('.welcome-title');
    if (title) title.textContent = `WELCOME, ${uname.toUpperCase()}`;

    const getStarted = document.getElementById('getStartedBtn');
    if (getStarted) getStarted.addEventListener('click', () => window.location.href = 'index.html');

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', async () => {
      await doSignOut();
      window.location.href = 'login.html';
    });
  },
  onNotAuth: () => {
    window.location.href = 'login.html';
  }
});

// UI helpers
window.toggleMenu = function() {
  const menu = document.getElementById('sideMenu');
  if (!menu) return;
  menu.classList.toggle('open');
};
window.scrollToSection = function(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const menu = document.getElementById('sideMenu');
  if (menu && menu.classList.contains('open')) menu.classList.remove('open');
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
};
