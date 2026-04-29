function toggleTheme() {
  var html = document.documentElement;
  var next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
}

function toggleSkill(header) {
  const content = header.nextElementSibling;
  const icon = header.querySelector('.skill-icon');
  const isOpen = content.classList.contains('active');

  document.querySelectorAll('.skill-content.active').forEach(el => {
    el.classList.remove('active');
    el.previousElementSibling.querySelector('.skill-icon').style.transform = 'rotate(0deg)';
  });

  if (!isOpen) {
    content.classList.add('active');
    icon.style.transform = 'rotate(180deg)';
  }
}

function toggleProject(header) {
  const content = header.nextElementSibling;
  const icon = header.querySelector('.skill-icon');
  const isOpen = content.classList.contains('active');

  document.querySelectorAll('.project-content.active').forEach(el => {
    el.classList.remove('active');
    el.previousElementSibling.querySelector('.skill-icon').style.transform = 'rotate(0deg)';
  });

  if (!isOpen) {
    content.classList.add('active');
    icon.style.transform = 'rotate(180deg)';
  }
}

// ===== NAV : ÉTAT ACTIF =====
(function () {
  const page = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('nav a').forEach(a => {
    if (a.getAttribute('href') === page) a.classList.add('active');
  });
})();

// ===== HAMBURGER =====
(function () {
  const hamburger = document.getElementById('nav-hamburger');
  const navUl = document.querySelector('nav ul');
  if (!hamburger || !navUl) return;

  hamburger.addEventListener('click', () => {
    const open = navUl.classList.toggle('nav-open');
    hamburger.classList.toggle('is-open', open);
    hamburger.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
  });

  navUl.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
      navUl.classList.remove('nav-open');
      hamburger.classList.remove('is-open');
      hamburger.setAttribute('aria-label', 'Ouvrir le menu');
    });
  });
})();

// ===== SCROLL ANIMATION =====
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.style.opacity = '1';
      entry.target.style.transform = 'translateY(0)';
    }
  });
}, { threshold: 0.08 });

document.querySelectorAll('.timeline-item, .passion-card, .project-item, .skill-category').forEach(el => {
  el.style.opacity = '0';
  el.style.transform = 'translateY(16px)';
  el.style.transition = 'opacity .5s ease, transform .5s ease';
  observer.observe(el);
});