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

// ===== CONSOLE F12 EASTER EGG =====
// ===== CONSOLE F12 EASTER EGG =====
(function () {
  var styleTitle = 'color:#00d4ff;font-size:18px;font-weight:bold;font-family:monospace;line-height:1.2;';
  var styleText  = 'color:#56d364;font-size:13px;font-family:monospace;line-height:1.5;';
  var styleHint  = 'color:#f0a45f;font-size:12px;font-family:monospace;';

  var ascii = [
    '',
    '  ____               _    _                  _____ ',
    ' | __ )   __ _  ___ | |_ (_)  ___  _ __     |_   _|',
    " |  _ \\  / _` |/ __|| __|| | / _ \\| '_ \\      | |  ",
    ' | |_) || (_| |\\__ \\| |_ | ||  __/| | | |     | |  ',
    ' |____/  \\__,_||___/ \\__||_| \\___||_| |_|     |_|  ',
    ''
  ].join('\n');

  console.log('%c' + ascii, styleTitle);
  console.log('%c\n💡 Astuce : ↑↑↓↓←→←→BA', styleHint);
})();

// ===== KONAMI CODE -> MATRIX RAIN =====
(function () {
  var sequence = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
  var pos = 0;
  var active = false;

  document.addEventListener('keydown', function(e) {
    var key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (key === sequence[pos].toLowerCase() || key === sequence[pos]) {
      pos++;
      if (pos === sequence.length) {
        pos = 0;
        if (!active) startMatrix();
      }
    } else {
      pos = 0;
    }
  });

  function startMatrix() {
    active = true;
    var canvas = document.createElement('canvas');
    canvas.id = 'matrix-canvas';
    canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:9998;pointer-events:none;opacity:0;transition:opacity .8s ease;';
    document.body.appendChild(canvas);

    var msg = document.createElement('div');
    msg.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:9999;color:#00ff7f;font-family:"DM Mono",monospace;font-size:1.1rem;text-align:center;background:rgba(0,0,0,.85);padding:1.5rem 2rem;border:1px solid #00ff7f;border-radius:6px;box-shadow:0 0 30px rgba(0,255,127,.4);';
    msg.innerHTML = '<div style="font-size:.7rem;letter-spacing:.2em;opacity:.7;margin-bottom:.5rem;">[ CODE DETECTED ]</div>Bienvenue...<br>dans le système.<br><br><span style="font-size:.75rem;opacity:.6;">Appuie sur Échap pour sortir</span>';
    document.body.appendChild(msg);

    var ctx = canvas.getContext('2d');
    var W = canvas.width = window.innerWidth;
    var H = canvas.height = window.innerHeight;
    var chars = '01アイウエオカキクケコサシスセソタチツテトナニヌネノBASTIEN';
    var fontSize = 14;
    var cols = Math.floor(W / fontSize);
    var drops = Array(cols).fill(1);

    setTimeout(function(){ canvas.style.opacity = '1'; }, 50);

    var interval = setInterval(function() {
      ctx.fillStyle = 'rgba(0,0,0,.06)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#00ff7f';
      ctx.font = fontSize + 'px monospace';
      for (var i = 0; i < drops.length; i++) {
        var c = chars.charAt(Math.floor(Math.random() * chars.length));
        ctx.fillText(c, i * fontSize, drops[i] * fontSize);
        if (drops[i] * fontSize > H && Math.random() > .975) drops[i] = 0;
        drops[i]++;
      }
    }, 45);

    function stop() {
      clearInterval(interval);
      canvas.style.opacity = '0';
      msg.style.opacity = '0';
      msg.style.transition = 'opacity .4s ease';
      setTimeout(function(){
        canvas.remove();
        msg.remove();
        active = false;
      }, 800);
      document.removeEventListener('keydown', escHandler);
    }
    function escHandler(e) { if (e.key === 'Escape') stop(); }
    document.addEventListener('keydown', escHandler);
  }
})();

// ===== TERMINAL INTERACTIF (page projets) =====
(function () {
  var output = document.getElementById('term-output');
  var input  = document.getElementById('term-input');
  if (!output || !input) return;

  var history = [];
  var historyPos = -1;

  // Liste des commandes pour l'autocomplétion
  var cmdList = ['help','whoami','ping bastien','traceroute','nmap skills','cv','contact','clear','sudo apt install bastien','sudo hire-me','git activity','history'];

  var cmds = {
    'help': function() { return '<span class="term-info">Commandes disponibles :</span>\n  <span class="term-cmd">whoami</span>                   — Identité complète\n  <span class="term-cmd">ping bastien</span>             — Test de connexion\n  <span class="term-cmd">traceroute</span>               — Parcours de formation\n  <span class="term-cmd">nmap skills</span>              — Scan des compétences\n  <span class="term-cmd">git activity</span>             — Activité GitHub récente\n  <span class="term-cmd">sudo apt install bastien</span> — Installation (à essayer !)\n  <span class="term-cmd">history</span>                  — Historique des commandes\n  <span class="term-cmd">cv</span>                       — Accéder au CV\n  <span class="term-cmd">contact</span>                  — Coordonnées\n  <span class="term-cmd">clear</span>                    — Vider le terminal\n\n<span class="term-info">Astuces :</span> ↑/↓ pour rappeler les commandes · Tab pour l\'autocomplétion'; },
    'whoami': function() { return '<span class="term-success">bastien.tabordet</span>\n  Étudiant BUT Réseaux &amp; Télécommunications\n  IUT de Clermont-Ferrand | 20 ans | Loiret (45) & Puy-de-Dôme (63)\n  └─ Recherche alternance septembre 2026 — Réseaux &amp; Cybersécurité'; },
    'ping bastien': function() { return 'PING bastien.tabordet (portfolio.local) 56 bytes\n  icmp_seq=1 ttl=64 time=<span class="term-success">0.1 ms</span>\n  icmp_seq=2 ttl=64 time=<span class="term-success">0.1 ms</span>\n  icmp_seq=3 ttl=64 time=<span class="term-success">0.1 ms</span>\n  <span class="term-success">3 packets transmitted, 3 received, 0% packet loss</span>'; },
    'traceroute': function() { return 'traceroute to formation.bastien (127.0.0.1)\n   1.  <span class="term-cmd">Lycée Bernard Palissy</span>   Bac général mention AB (2024)\n  | 2.  <span class="term-cmd">ISIMA Clermont-Ferrand</span>  Prépa intégrée ingénieur (2024-2025)\n |  3.  <span class="term-cmd">IUT Clermont-Ferrand</span>    BUT R&amp;T (2025-2028 en cours)\n |  4  <span class="term-success">.  Alternance 2026 → recherche en cours...</span>'; },
    'nmap skills': function() { return 'Starting Nmap — bastientabordet.fr\n  PORT      STATE  SERVICE    VERSION\n  22/tcp    open   bash       Scripts Shell &amp; automatisation\n  80/tcp    open   html/css   Sites statiques &amp; responsive\n  443/tcp   open   réseaux    Cisco PT · VLAN · Wireshark\n  3306/tcp  open   sql        Bases de données relationnelles\n  5000/tcp  open   python     Automatisation &amp; scripts réseau\n  8443/tcp  open   cyber      ANSSI · hygiène informatique\n  <span class="term-success">Nmap done: 6 services scanned</span>'; },
    'git activity': function() {
      var bars = '';
      var levels = [' ','▁','▂','▃','▄','▅','▆','▇','█'];
      var data = [0,1,2,0,3,4,2,1,0,0,2,5,3,1,2,4,3,0,1,2,3,5,4,2,0,1,3,2,4,1];
      var total = data.reduce(function(a,b){return a+b;},0);
      for (var i = 0; i < data.length; i++) bars += '<span class="term-success">' + levels[data[i]] + '</span>';
      return '<span class="term-info">Activité GitHub — 30 derniers jours</span>\n  ' + bars + '\n  <span class="term-success">' + total + ' commits</span> · github.com/bastientabordet\n  <span style="opacity:.6">(données mises à jour manuellement)</span>';
    },
    'cv': function() { return '<span class="term-info">Redirection vers la page CV...</span>\n  <a href="cv.html" style="color:#58a6e8;text-decoration:none">→ bastientabordet.fr/cv.html</a>'; },
    'contact': function() { return '<span class="term-info">─── Contact ─────────────────────────────</span>\n  Email    : <a href="mailto:bastien.tabordet@etu.uca.fr" style="color:#58a6e8;text-decoration:none">bastien.tabordet@etu.uca.fr</a>\n  LinkedIn : <a href="https://www.linkedin.com/in/bastientabordet/" target="_blank" style="color:#58a6e8;text-decoration:none">linkedin.com/in/bastientabordet</a>'; },
    'history': function() {
      if (history.length === 0) return '<span style="opacity:.6">Aucune commande dans l\'historique.</span>';
      return history.map(function(h, i){ return '  ' + (i+1) + '  ' + h; }).join('\n');
    },
    'clear': function() { output.innerHTML = ''; return null; },
    'sudo hire-me': function() {
      return '<span class="term-success">[sudo] mot de passe pour recruteur : ********</span>\n  <span class="term-info">Vérification des privilèges...</span> <span class="term-success">OK</span>\n  <span class="term-info">Demande envoyée au candidat.</span>\n\n  ┌─────────────────────────────────────────┐\n  │  ✓ Bastien est prêt à rejoindre votre   │\n  │    équipe en alternance dès sept. 2026  │\n  │                                         │\n  │  → Contact direct : page Contact        │\n  └─────────────────────────────────────────┘';
    }
  };

  function addLine(html) {
    var d = document.createElement('div');
    d.className = 'term-line';
    d.innerHTML = html;
    output.appendChild(d);
    output.scrollTop = output.scrollHeight;
  }

  // sudo apt install bastien -> avec animation de barre de progression
  function runAptInstall() {
    addLine('<span class="term-info">Lecture des listes de paquets...</span> <span class="term-success">Fait</span>');
    addLine('<span class="term-info">Construction de l\'arbre des dépendances...</span> <span class="term-success">Fait</span>');
    addLine('Les NOUVEAUX paquets suivants seront installés :\n  <span class="term-cmd">bastien</span> bastien-skills bastien-motivation');
    addLine('Téléchargement de bastien (1.0.0-alternance2026)...');
    var line = document.createElement('div');
    line.className = 'term-line';
    output.appendChild(line);
    var pct = 0;
    var interval = setInterval(function() {
      pct += Math.floor(Math.random() * 8) + 3;
      if (pct >= 100) pct = 100;
      var filled = Math.floor(pct / 2.5);
      var bar = '█'.repeat(filled) + '░'.repeat(40 - filled);
      line.innerHTML = '<span class="term-success">[' + bar + ']</span> ' + pct + '%';
      output.scrollTop = output.scrollHeight;
      if (pct === 100) {
        clearInterval(interval);
        setTimeout(function() {
          addLine('<span class="term-success">✓ Installation terminée avec succès.</span>');
          addLine('<span class="term-info">Pour activer : contactez bastien.tabordet@etu.uca.fr</span>');
        }, 300);
      }
    }, 120);
  }

  function autocomplete(value) {
    var matches = cmdList.filter(function(c){ return c.indexOf(value.toLowerCase()) === 0; });
    if (matches.length === 1) {
      input.value = matches[0];
    } else if (matches.length > 1) {
      addLine('<span class="term-prompt">bastien@portfolio:~$&nbsp;</span>' + value);
      addLine(matches.join('   '));
    }
  }

  input.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      var raw = input.value.trim();
      var cmd = raw.toLowerCase();
      input.value = '';
      addLine('<span class="term-prompt">bastien@portfolio:~$&nbsp;</span><span class="term-cmd">' + raw.replace(/</g,'&lt;') + '</span>');
      if (!cmd) return;
      history.push(raw);
      historyPos = history.length;
      if (cmd === 'sudo apt install bastien') { runAptInstall(); return; }
      var fn = cmds[cmd];
      if (fn) { var r = fn(); if (r != null) addLine(r); }
      else addLine('<span class="term-error">bash: ' + raw.replace(/</g,'&lt;') + ': command not found</span> — tapez <span class="term-cmd">help</span>');
    }
    else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length === 0) return;
      historyPos = Math.max(0, historyPos - 1);
      input.value = history[historyPos] || '';
    }
    else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (history.length === 0) return;
      historyPos = Math.min(history.length, historyPos + 1);
      input.value = history[historyPos] || '';
    }
    else if (e.key === 'Tab') {
      e.preventDefault();
      if (input.value.trim()) autocomplete(input.value.trim());
    }
  });

  var termRoot = document.getElementById('terminal-root');
  if (termRoot) termRoot.addEventListener('click', function() { input.focus(); });
})();

// ===== MODE CLI GLOBAL (overlay terminal de navigation) =====
(function () {
  var btn = document.createElement('button');
  btn.id = 'cli-mode-btn';
  btn.className = 'cli-mode-btn';
  btn.setAttribute('aria-label', 'Activer le mode CLI');
  btn.innerHTML = '<span>[ CLI ]</span>';
  document.body.appendChild(btn);

  var overlay = document.createElement('div');
  overlay.id = 'cli-overlay';
  overlay.className = 'cli-overlay';
  overlay.innerHTML =
    '<div class="cli-window">' +
      '<div class="cli-bar">' +
        '<span class="terminal-dot t-red"></span>' +
        '<span class="terminal-dot t-yellow"></span>' +
        '<span class="terminal-dot t-green"></span>' +
        '<span class="terminal-title">bastien@portfolio — navigation CLI</span>' +
        '<button class="cli-close" aria-label="Fermer">×</button>' +
      '</div>' +
      '<div class="cli-output" id="cli-output">' +
        '<div class="term-line"><span class="term-success">═══ Mode CLI activé ═══</span></div>' +
        '<div class="term-line">Navigue dans le portfolio avec des commandes Unix.</div>' +
        '<div class="term-line">Tape <span class="term-cmd">help</span> pour la liste, <span class="term-cmd">exit</span> ou Échap pour quitter.</div>' +
        '<div class="term-line">&nbsp;</div>' +
      '</div>' +
      '<div class="cli-input-line">' +
        '<span class="term-prompt">bastien@portfolio:~$&nbsp;</span>' +
        '<input type="text" id="cli-input" autocomplete="off" spellcheck="false">' +
      '</div>' +
    '</div>';
  document.body.appendChild(overlay);

  var output = overlay.querySelector('#cli-output');
  var input  = overlay.querySelector('#cli-input');
  var closeBtn = overlay.querySelector('.cli-close');

  var pages = {
    'home':       'index.html',
    'index':      'index.html',
    'about':      'a-propos.html',
    'a-propos':   'a-propos.html',
    'formation':  'formation.html',
    'skills':     'competences.html',
    'competences':'competences.html',
    'projects':   'projets.html',
    'projets':    'projets.html',
    'divers':     'divers.html',
    'hobbies':    'divers.html',
    'cv':         'cv.html',
    'contact':    'contact.html'
  };

  var pageList = Object.keys(pages).filter(function(k){ return ['home','about','formation','skills','projects','divers','cv','contact'].indexOf(k) !== -1; });

  var history = [];
  var historyPos = -1;

  function addLine(html) {
    var d = document.createElement('div');
    d.className = 'term-line';
    d.innerHTML = html;
    output.appendChild(d);
    output.scrollTop = output.scrollHeight;
  }

  function open() {
    overlay.classList.add('active');
    setTimeout(function(){ input.focus(); }, 50);
  }
  function close() {
    overlay.classList.remove('active');
  }

  btn.addEventListener('click', open);
  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', function(e){ if (e.target === overlay) close(); });

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && overlay.classList.contains('active')) close();
  });

  function handle(raw) {
    var cmd = raw.trim().toLowerCase();
    if (!cmd) return;
    history.push(raw);
    historyPos = history.length;

    if (cmd === 'help') {
      addLine('<span class="term-info">Commandes disponibles :</span>\n  <span class="term-cmd">ls</span>             — Liste les pages\n  <span class="term-cmd">cd &lt;page&gt;</span>      — Aller sur une page (ex: cd projets)\n  <span class="term-cmd">open &lt;page&gt;</span>    — Idem que cd\n  <span class="term-cmd">cat &lt;page&gt;</span>     — Aperçu d\'une page\n  <span class="term-cmd">whoami</span>         — Qui suis-je\n  <span class="term-cmd">pwd</span>            — Page actuelle\n  <span class="term-cmd">clear</span>          — Vider l\'écran\n  <span class="term-cmd">exit</span>           — Quitter le mode CLI');
    }
    else if (cmd === 'ls') {
      addLine(pageList.map(function(p){ return '<span class="term-cmd">' + p + '/</span>'; }).join('   '));
    }
    else if (cmd === 'pwd') {
      var current = window.location.pathname.split('/').pop() || 'index.html';
      addLine('/' + current);
    }
    else if (cmd === 'whoami') {
      addLine('<span class="term-success">bastien.tabordet</span> — étudiant BUT R&amp;T, recherche alternance 2026');
    }
    else if (cmd === 'clear') {
      output.innerHTML = '';
    }
    else if (cmd === 'exit') {
      addLine('<span class="term-success">Bye !</span>');
      setTimeout(close, 300);
    }
    else if (cmd.indexOf('cd ') === 0 || cmd.indexOf('open ') === 0) {
      var target = cmd.split(' ')[1].replace(/\/$/, '');
      if (pages[target]) {
        addLine('<span class="term-info">→ Redirection vers ' + pages[target] + '</span>');
        setTimeout(function(){ window.location.href = pages[target]; }, 400);
      } else {
        addLine('<span class="term-error">cd: ' + target + ': page introuvable</span> — tape <span class="term-cmd">ls</span>');
      }
    }
    else if (cmd.indexOf('cat ') === 0) {
      var t = cmd.split(' ')[1].replace(/\/$/, '');
      var previews = {
        'home':       'Page d\'accueil — présentation rapide.',
        'about':      'Bastien, 20 ans, BUT R&T, recherche alternance 2026.',
        'formation':  'Bac général → Prépa ISIMA → BUT R&T (2025-2028).',
        'skills':     'Réseaux · Système · Dev · Langues · Soft skills.',
        'projects':   'Cybersécurité, CodinGame, Portfolio, Terminal, Matlab...',
        'divers':     'Sport auto, droit, DJ, lecture, natation, tennis, vélo.',
        'cv':         'CV téléchargeable au format PDF.',
        'contact':    'Email + LinkedIn — disponible pour alternance 2026.'
      };
      if (previews[t]) addLine(previews[t]);
      else addLine('<span class="term-error">cat: ' + t + ': fichier introuvable</span>');
    }
    else {
      addLine('<span class="term-error">bash: ' + raw + ': command not found</span> — tape <span class="term-cmd">help</span>');
    }
  }

  input.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      var raw = input.value;
      input.value = '';
      addLine('<span class="term-prompt">bastien@portfolio:~$&nbsp;</span><span class="term-cmd">' + raw.replace(/</g,'&lt;') + '</span>');
      handle(raw);
    }
    else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length === 0) return;
      historyPos = Math.max(0, historyPos - 1);
      input.value = history[historyPos] || '';
    }
    else if (e.key === 'ArrowDown') {
      e.preventDefault();
      historyPos = Math.min(history.length, historyPos + 1);
      input.value = history[historyPos] || '';
    }
  });
})();

// ===== TEST DE DACTYLOGRAPHIE =====
(function () {
  var root = document.getElementById('typing-test');
  if (!root) return;

  var texts = {
    fr: [
      "La rigueur et la curiosité sont les deux qualités essentielles d'un bon administrateur réseau.",
      "Un bon mot de passe doit contenir au moins douze caractères, des chiffres et des symboles.",
      "L'apprentissage continu est la clé pour rester à jour dans le domaine de la cybersécurité."
    ],
    network: [
      "Le protocole TCP garantit la livraison des paquets grâce à un mécanisme d'accusé de réception.",
      "Un VLAN permet de segmenter un réseau local en plusieurs sous-réseaux logiques indépendants.",
      "Le DNS traduit un nom de domaine en adresse IP via une hiérarchie de serveurs distribués."
    ],
    code: [
      "sudo apt update && sudo apt upgrade -y",
      "ssh -i ~/.ssh/id_rsa user@192.168.1.10 -p 2222",
      "for ip in $(seq 1 254); do ping -c1 192.168.1.$ip; done"
    ]
  };

  var elText     = root.querySelector('.tt-text');
  var elInput    = root.querySelector('.tt-input');
  var elWpm      = root.querySelector('.tt-wpm');
  var elAcc      = root.querySelector('.tt-acc');
  var elTime     = root.querySelector('.tt-time');
  var elReset    = root.querySelector('.tt-reset');
  var elModeBtns = root.querySelectorAll('.tt-mode-btn');
  var elResult   = root.querySelector('.tt-result');

  var current = '';
  var mode = 'fr';
  var startTime = null;
  var timerInterval = null;
  var finished = false;

  function pickText() {
    var pool = texts[mode];
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function render(typed) {
    var html = '';
    for (var i = 0; i < current.length; i++) {
      var c = current[i];
      var displayChar = c === ' ' ? '&nbsp;' : c.replace(/</g,'&lt;').replace(/>/g,'&gt;');
      if (i < typed.length) {
        if (typed[i] === c) html += '<span class="tt-ok">' + displayChar + '</span>';
        else html += '<span class="tt-ko">' + (c === ' ' ? '_' : displayChar) + '</span>';
      } else if (i === typed.length) {
        html += '<span class="tt-cur">' + displayChar + '</span>';
      } else {
        html += '<span class="tt-pend">' + displayChar + '</span>';
      }
    }
    elText.innerHTML = html;
  }

  function updateStats(typed) {
    var elapsed = (Date.now() - startTime) / 1000;
    elTime.textContent = elapsed.toFixed(1) + 's';
    var correct = 0;
    for (var i = 0; i < typed.length; i++) if (typed[i] === current[i]) correct++;
    var acc = typed.length === 0 ? 100 : Math.round((correct / typed.length) * 100);
    elAcc.textContent = acc + '%';
    var minutes = elapsed / 60;
    var words = correct / 5;
    var wpm = minutes > 0 ? Math.round(words / minutes) : 0;
    elWpm.textContent = wpm;
    return { wpm: wpm, acc: acc, time: elapsed };
  }

  function reset() {
    current = pickText();
    finished = false;
    startTime = null;
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    elInput.value = '';
    elInput.disabled = false;
    elWpm.textContent = '0';
    elAcc.textContent = '100%';
    elTime.textContent = '0.0s';
    elResult.classList.remove('active');
    elResult.innerHTML = '';
    render('');
  }

  elInput.addEventListener('input', function() {
    if (finished) return;
    var typed = elInput.value;
    if (typed.length > current.length) {
      elInput.value = typed.slice(0, current.length);
      typed = elInput.value;
    }
    if (!startTime && typed.length > 0) {
      startTime = Date.now();
      timerInterval = setInterval(function(){ updateStats(elInput.value); }, 100);
    }
    render(typed);
    var stats = startTime ? updateStats(typed) : null;
    if (typed === current) {
      finished = true;
      clearInterval(timerInterval);
      elInput.disabled = true;
      var rating = stats.wpm >= 60 ? 'Excellent !' : stats.wpm >= 40 ? 'Bien !' : stats.wpm >= 25 ? 'Pas mal' : 'Continue à t\'entraîner !';
      elResult.innerHTML =
        '<div class="tt-result-title">✓ Test terminé — ' + rating + '</div>' +
        '<div class="tt-result-stats">' +
          '<div><span class="tt-r-label">Vitesse</span><span class="tt-r-val">' + stats.wpm + ' MPM</span></div>' +
          '<div><span class="tt-r-label">Précision</span><span class="tt-r-val">' + stats.acc + '%</span></div>' +
          '<div><span class="tt-r-label">Temps</span><span class="tt-r-val">' + stats.time.toFixed(1) + 's</span></div>' +
        '</div>';
      elResult.classList.add('active');
    }
  });

  elReset.addEventListener('click', reset);

  elModeBtns.forEach(function(b) {
    b.addEventListener('click', function() {
      elModeBtns.forEach(function(x){ x.classList.remove('active'); });
      b.classList.add('active');
      mode = b.dataset.mode;
      reset();
    });
  });

  reset();
})();