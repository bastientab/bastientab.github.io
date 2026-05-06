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

document.querySelectorAll('.timeline-item, .passion-card, .project-item, .skill-category, .veille-card').forEach(el => {
  el.style.opacity = '0';
  el.style.transform = 'translateY(16px)';
  el.style.transition = 'opacity .5s ease, transform .5s ease';
  observer.observe(el);
});

// ===== TERMINAL INTERACTIF =====
(function () {
  var output = document.getElementById('term-output');
  var input  = document.getElementById('term-input');
  if (!output || !input) return;

  var cmds = {
    'help': function() { return '<span class="term-info">Commandes disponibles :</span>\n  <span class="term-cmd">whoami</span>       — Identité complète\n  <span class="term-cmd">ping bastien</span> — Test de connexion\n  <span class="term-cmd">traceroute</span>   — Parcours de formation\n  <span class="term-cmd">nmap skills</span>  — Scan des compétences\n  <span class="term-cmd">cv</span>           — Accéder au CV\n  <span class="term-cmd">contact</span>      — Coordonnées\n  <span class="term-cmd">clear</span>        — Vider le terminal'; },
    'whoami': function() { return '<span class="term-success">bastien.tabordet</span>\n  Étudiant BUT Réseaux &amp; Télécommunications\n  IUT de Clermont-Ferrand | 20 ans | Loiret (45) & Puy-de-Dôme (63)\n  └─ Recherche alternance septembre 2026 — Réseaux &amp; Cybersécurité'; },
    'ping bastien': function() { return 'PING bastien.tabordet (portfolio.local) 56 bytes\n  icmp_seq=1 ttl=64 time=<span class="term-success">0.1 ms</span>\n  icmp_seq=2 ttl=64 time=<span class="term-success">0.1 ms</span>\n  icmp_seq=3 ttl=64 time=<span class="term-success">0.1 ms</span>\n  <span class="term-success">3 packets transmitted, 3 received, 0% packet loss</span>'; },
    'traceroute': function() { return 'traceroute to formation.bastien (127.0.0.1)\n   1.  <span class="term-cmd">Lycée Bernard Palissy</span>   Bac général mention AB (2024)\n  | 2.  <span class="term-cmd">ISIMA Clermont-Ferrand</span>  Prépa intégrée ingénieur (2024-2025)\n |  3.  <span class="term-cmd">IUT Clermont-Ferrand</span>    BUT R&amp;T (2025-2028 en cours)\n |  4  <span class="term-success">.  Alternance 2026 → recherche en cours...</span>'; },
    'nmap skills': function() { return 'Starting Nmap — bastientabordet.fr\n  PORT      STATE  SERVICE    VERSION\n  22/tcp    open   bash       Scripts Shell &amp; automatisation\n  80/tcp    open   html/css   Sites statiques &amp; responsive\n  443/tcp   open   réseaux    Cisco PT · VLAN · Wireshark\n  3306/tcp  open   sql        Bases de données relationnelles\n  5000/tcp  open   python     Automatisation &amp; scripts réseau\n  8443/tcp  open   cyber      ANSSI · hygiène informatique\n  <span class="term-success">Nmap done: 6 services scanned</span>'; },
    'cv': function() { return '<span class="term-info">Redirection vers la page CV...</span>\n  <a href="cv.html" style="color:#58a6e8;text-decoration:none">→ bastientabordet.fr/cv.html</a>'; },
    'contact': function() { return '<span class="term-info">─── Contact ─────────────────────────────</span>\n  Email    : <a href="mailto:bastien.tabordet@etu.uca.fr" style="color:#58a6e8;text-decoration:none">bastien.tabordet@etu.uca.fr</a>\n  LinkedIn : <a href="https://www.linkedin.com/in/bastientabordet/" target="_blank" style="color:#58a6e8;text-decoration:none">linkedin.com/in/bastientabordet</a>'; },
    'clear': function() { output.innerHTML = ''; return null; }
  };

  function addLine(html) {
    var d = document.createElement('div');
    d.className = 'term-line';
    d.innerHTML = html;
    output.appendChild(d);
    output.scrollTop = output.scrollHeight;
  }

  input.addEventListener('keydown', function(e) {
    if (e.key !== 'Enter') return;
    var raw = input.value.trim();
    var cmd = raw.toLowerCase();
    input.value = '';
    addLine('<span class="term-prompt">bastien@portfolio:~$&nbsp;</span><span class="term-cmd">' + raw.replace(/</g,'&lt;') + '</span>');
    if (!cmd) return;
    var fn = cmds[cmd];
    if (fn) { var r = fn(); if (r != null) addLine(r); }
    else addLine('<span class="term-error">bash: ' + raw.replace(/</g,'&lt;') + ': command not found</span> — tapez <span class="term-cmd">help</span>');
  });

  var termRoot = document.getElementById('terminal-root');
  if (termRoot) termRoot.addEventListener('click', function() { input.focus(); });
})();