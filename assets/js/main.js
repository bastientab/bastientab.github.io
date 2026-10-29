/* ==========================================================================
   Portfolio de Bastien TABORDET - script principal (refonte one-page 2026)
   Utilise par index.html et 404.html. Chaque bloc verifie la presence de ses
   elements : le script peut donc etre charge sur n'importe quelle page.
   L'ancien /script.js reste utilise par la section « Cours » (menu/).
   ========================================================================== */
(function () {
  'use strict';

  var root = document.documentElement;
  var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var hasGSAP = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
  var mqDesktop = window.matchMedia ? window.matchMedia('(min-width: 901px)') : null;

  function onMQ(mq, fn) {
    if (!mq) return;
    if (mq.addEventListener) mq.addEventListener('change', fn);
    else if (mq.addListener) mq.addListener(fn);
  }
  function refreshST() {
    if (hasGSAP) window.ScrollTrigger.refresh();
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }

  /* ---------- Theme clair / sombre (meme cle localStorage que l'ancien site) ---------- */
  function applyTheme(t) {
    root.setAttribute('data-theme', t);
    var btn = document.getElementById('theme-toggle');
    if (btn) {
      btn.setAttribute('aria-pressed', t === 'dark' ? 'true' : 'false');
      btn.setAttribute('aria-label', t === 'dark' ? 'Activer le thème clair' : 'Activer le thème sombre');
    }
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', t === 'dark' ? '#000000' : '#f5f5f7');
  }
  window.toggleTheme = function () {
    var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    try { localStorage.setItem('theme', next); } catch (e) {}
  };
  applyTheme(root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');
  var themeBtn = document.getElementById('theme-toggle');
  if (themeBtn) themeBtn.addEventListener('click', window.toggleTheme);

  /* ---------- En-tete givre, barre de progression, frise de formation ---------- */
  var header = document.getElementById('site-header');
  var bar = document.getElementById('scroll-progress');
  var timeline = document.getElementById('timeline');
  var ticking = false;

  function onScroll() {
    ticking = false;
    var y = window.pageYOffset || document.documentElement.scrollTop;
    if (header) header.classList.toggle('is-scrolled', y > 10);
    var max = document.documentElement.scrollHeight - window.innerHeight;
    if (bar) bar.style.transform = 'scaleX(' + (max > 0 ? Math.min(1, y / max) : 0) + ')';
    if (timeline) {
      var r = timeline.getBoundingClientRect();
      var p = (window.innerHeight * 0.6 - r.top) / r.height;
      p = Math.max(0, Math.min(1, p));
      timeline.style.setProperty('--fill', reduceMotion ? 1 : p.toFixed(3));
    }
  }
  window.addEventListener('scroll', function () {
    if (!ticking) { ticking = true; window.requestAnimationFrame(onScroll); }
  }, { passive: true });
  window.addEventListener('resize', onScroll);
  onScroll();

  /* ---------- Menu mobile ---------- */
  var burger = document.getElementById('burger');
  var navList = document.getElementById('nav-list');
  function setMenu(open) {
    if (!burger || !header) return;
    header.classList.toggle('nav-open', open);
    burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    burger.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
  }
  if (burger) {
    burger.addEventListener('click', function () {
      setMenu(burger.getAttribute('aria-expanded') !== 'true');
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && burger.getAttribute('aria-expanded') === 'true') {
        setMenu(false);
        burger.focus();
      }
    });
    document.addEventListener('click', function (e) {
      if (header && !header.contains(e.target)) setMenu(false);
    });
    if (navList) navList.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('a')) setMenu(false);
    });
    onMQ(mqDesktop, function (e) { if (e.matches) setMenu(false); });
  }

  /* ---------- Lien de navigation actif ---------- */
  var navLinks = Array.prototype.slice.call(document.querySelectorAll('.nav-list a[href^="#"]'));
  if ('IntersectionObserver' in window && navLinks.length) {
    var navIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        navLinks.forEach(function (a) {
          var on = a.getAttribute('href') === '#' + en.target.id;
          a.classList.toggle('is-active', on);
          if (on) a.setAttribute('aria-current', 'true');
          else a.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    navLinks.forEach(function (a) {
      var target = document.getElementById(a.getAttribute('href').slice(1));
      if (target) navIO.observe(target);
    });
  }

  /* ---------- Apparitions au defilement ---------- */
  var revealEls = document.querySelectorAll('[data-reveal]');
  if ('IntersectionObserver' in window && revealEls.length && !reduceMotion) {
    root.classList.add('reveal-ready');
    var revIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var el = en.target;
        var d = parseInt(el.getAttribute('data-reveal-delay') || '0', 10);
        setTimeout(function () { el.classList.add('is-visible'); }, d * 90);
        revIO.unobserve(el);
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
    revealEls.forEach(function (el) { revIO.observe(el); });
  }

  /* ---------- Suivi de defilement (competences) ---------- */
  function scrollSpy(items, cb) {
    if (!('IntersectionObserver' in window) || !items.length) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) cb(Array.prototype.indexOf.call(items, en.target));
      });
    }, { rootMargin: '-45% 0px -45% 0px' });
    Array.prototype.forEach.call(items, function (it) { io.observe(it); });
  }

  /* ---------- Competences : orbite ---------- */
  (function () {
    var wrap = document.getElementById('skills');
    if (!wrap) return;
    var groups = wrap.querySelectorAll('.skill-group');
    var nodes = wrap.querySelectorAll('.orbit-node');
    var spokes = wrap.querySelectorAll('.orbit-spoke');
    var count = document.getElementById('orbit-count');
    var label = document.getElementById('orbit-label');
    var total = groups.length;
    if (!total) return;
    function setActive(i) {
      if (i < 0) return;
      Array.prototype.forEach.call(groups, function (g, k) { g.classList.toggle('is-active', k === i); });
      Array.prototype.forEach.call(nodes, function (n, k) { n.classList.toggle('is-active', k === i); });
      Array.prototype.forEach.call(spokes, function (s, k) { s.classList.toggle('is-active', k === i); });
      if (count) count.textContent = pad(i + 1) + ' / ' + pad(total);
      if (label) label.textContent = groups[i].getAttribute('data-label') || '';
    }
    function applyReady() { wrap.classList.toggle('skills-ready', !!(mqDesktop && mqDesktop.matches)); }
    applyReady();
    onMQ(mqDesktop, applyReady);
    setActive(0);
    scrollSpy(groups, setActive);
    Array.prototype.forEach.call(nodes, function (n, k) {
      n.style.cursor = 'pointer';
      n.addEventListener('click', function () {
        if (groups[k]) groups[k].scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
      });
    });
  })();

  /* ---------- Projets : un seul projet ouvert a la fois, la carte ouverte passe en pleine largeur ---------- */
  (function () {
    var cards = Array.prototype.slice.call(document.querySelectorAll('#project-cards .p-card'));
    cards.forEach(function (card) {
      var d = card.querySelector('details');
      if (!d) return;
      d.addEventListener('toggle', function () {
        card.classList.toggle('is-open', d.open);
        card.classList.toggle('card-hover', !d.open);
        if (d.open) {
          cards.forEach(function (o) {
            if (o === card) return;
            var od = o.querySelector('details');
            if (od && od.open) od.open = false;
          });
          setTimeout(function () {
            card.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
          }, 60);
        }
        refreshST();
      });
    });
    // Lien « Voir le projet : creation du portfolio » (section Competences) : ouvre la carte
    if (window.location.hash === '#portfolio') {
      var p = document.querySelector('#portfolio details');
      if (p) p.open = true;
    }
    document.querySelectorAll('a[href="#portfolio"]').forEach(function (a) {
      a.addEventListener('click', function () {
        var p = document.querySelector('#portfolio details');
        if (p) p.open = true;
      });
    });
  })();

  /* ---------- Divers (lecture, sports) : description affichee au clic ---------- */
  (function () {
    var groups = document.querySelectorAll('[data-picks]');
    Array.prototype.forEach.call(groups, function (group) {
      var btns = Array.prototype.slice.call(group.querySelectorAll('.pick'));
      btns.forEach(function (b) {
        b.addEventListener('click', function () {
          var open = b.getAttribute('aria-expanded') !== 'true';
          btns.forEach(function (o) {
            var on = open && o === b;
            o.setAttribute('aria-expanded', on ? 'true' : 'false');
            var panel = document.getElementById(o.getAttribute('aria-controls'));
            if (panel) panel.hidden = !on;
          });
          refreshST();
        });
      });
    });
  })();

  /* ---------- Copier l'adresse e-mail ---------- */
  (function () {
    var btn = document.getElementById('copy-email');
    if (!btn) return;
    var status = document.getElementById('copy-status');
    var email = btn.getAttribute('data-email');
    var initial = btn.textContent;
    function done(ok) {
      btn.textContent = ok ? 'Copié !' : initial;
      if (status) status.textContent = ok ? 'Adresse copiée dans le presse-papiers.' : 'Copie impossible, voici l\u2019adresse : ' + email;
      setTimeout(function () {
        btn.textContent = initial;
        if (status) status.textContent = '';
      }, 3000);
    }
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = email;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      done(ok);
    }
    btn.addEventListener('click', function () {
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(email).then(function () { done(true); }, fallback);
      } else {
        fallback();
      }
    });
  })();

  /* ---------- GSAP + ScrollTrigger : uniquement l'apercu du CV qui se redresse ---------- */
  if (hasGSAP && !reduceMotion) {
    var gsap = window.gsap;
    gsap.registerPlugin(window.ScrollTrigger);

    var cvImg = document.querySelector('#cv-preview img');
    if (cvImg) {
      gsap.fromTo(cvImg,
        { rotateX: 22, y: 60, scale: 0.92, opacity: 0.6 },
        { rotateX: 0, y: 0, scale: 1, opacity: 1, ease: 'none',
          scrollTrigger: { trigger: '#cv-preview', start: 'top 90%', end: 'center 55%', scrub: true } });
    }

    window.addEventListener('load', refreshST);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(refreshST);
  }

  /* ---------- Page 404 : chemin demande + compte a rebours annulable ---------- */
  (function () {
    var countEl = document.getElementById('nf-count');
    if (!countEl) return;
    var pathEl = document.getElementById('nf-path');
    if (pathEl) pathEl.textContent = window.location.pathname;
    var cancel = document.getElementById('nf-cancel');
    var box = document.getElementById('nf-redirect');
    var n = 5;
    var timer = setInterval(function () {
      n--;
      countEl.textContent = n;
      if (n <= 0) {
        clearInterval(timer);
        window.location.href = '/';
      }
    }, 1000);
    if (cancel) cancel.addEventListener('click', function () {
      clearInterval(timer);
      if (box) box.textContent = 'Redirection annulée. Prends ton temps !';
      cancel.hidden = true;
    });
  })();
})();

// ===== CONSOLE F12 EASTER EGG =====
(function () {
  var styleTitle = 'color:#00d4ff;font-size:18px;font-weight:bold;font-family:monospace;line-height:1.2;';
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

// ===== TERMINAL INTERACTIF =====
// Commandes d'origine conservees : help, whoami, traceroute, git activity, contact, clear.
// Retirees a ta demande : history, ping bastien, cv, sudo apt install bastien, nmap skills, sudo hire-me.
(function () {
  var output = document.getElementById('term-output');
  var input  = document.getElementById('term-input');
  if (!output || !input) return;

  // Rappel des commandes deja tapees (fleches haut / bas)
  var recall = [];
  var recallPos = -1;

  // Liste des commandes pour l'autocompletion (Tab)
  var cmdList = ['help','whoami','traceroute','git activity','contact','clear'];

  var cmds = {
    'help': function() { return '<span class="term-info">Commandes disponibles :</span>\n  <span class="term-cmd">whoami</span>        — Identité complète\n  <span class="term-cmd">traceroute</span>    — Parcours de formation\n  <span class="term-cmd">git activity</span>  — Activité GitHub récente\n  <span class="term-cmd">contact</span>       — Coordonnées\n  <span class="term-cmd">clear</span>         — Vider le terminal\n\n<span class="term-info">Astuces :</span> ↑/↓ pour rappeler les commandes · Tab pour l\'autocomplétion'; },
    'whoami': function() { return '<span class="term-success">bastien.tabordet</span>\n  Étudiant BUT Réseaux &amp; Télécommunications\n  IUT de Clermont-Ferrand | 20 ans | Loiret (45) &amp; Puy-de-Dôme (63)\n  └─ Recherche alternance novembre 2026 — Réseaux &amp; Cybersécurité'; },
    'traceroute': function() { return 'traceroute to formation.bastien (127.0.0.1)\n  1.  <span class="term-cmd">Lycée Bernard Palissy</span>   Bac général mention AB (2024)\n  2.  <span class="term-cmd">ISIMA Clermont-Ferrand</span>  Prépa intégrée ingénieur (2024-2025)\n  3.  <span class="term-cmd">IUT Clermont-Ferrand</span>    BUT R&amp;T (2025-2028 en cours)\n  4.  <span class="term-success">Alternance 2026 → recherche en cours...</span>'; },
    'git activity': function() {
      var bars = '';
      var levels = [' ','▁','▂','▃','▄','▅','▆','▇','█'];
      var data = [0,1,2,0,3,4,2,1,0,0,2,5,3,1,2,4,3,0,1,2,3,5,4,2,0,1,3,2,4,1];
      var total = data.reduce(function(a,b){return a+b;},0);
      for (var i = 0; i < data.length; i++) bars += '<span class="term-success">' + levels[data[i]] + '</span>';
      return '<span class="term-info">Activité GitHub — 30 derniers jours</span>\n  ' + bars + '\n  <span class="term-success">' + total + ' commits</span> · <a href="https://github.com/bastientab" target="_blank" rel="noopener" style="color:#58a6e8;text-decoration:none">github.com/bastientab</a>\n  <span style="opacity:.6">(données mises à jour manuellement)</span>';
    },
    'contact': function() { return '<span class="term-info">─── Contact ─────────────────────────────</span>\n  Email    : <a href="mailto:bastien.tabordet@etu.uca.fr" style="color:#58a6e8;text-decoration:none">bastien.tabordet@etu.uca.fr</a>\n  LinkedIn : <a href="https://www.linkedin.com/in/bastientabordet/" target="_blank" rel="noopener" style="color:#58a6e8;text-decoration:none">linkedin.com/in/bastientabordet</a>'; },
    'clear': function() { output.innerHTML = ''; return null; }
  };

  function esc(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  function addLine(html) {
    var d = document.createElement('div');
    d.className = 'term-line';
    d.innerHTML = html;
    output.appendChild(d);
    output.scrollTop = output.scrollHeight;
  }

  function autocomplete(value) {
    var matches = cmdList.filter(function(c){ return c.indexOf(value.toLowerCase()) === 0; });
    if (matches.length === 1) {
      input.value = matches[0];
    } else if (matches.length > 1) {
      addLine('<span class="term-prompt">bastien@portfolio:~$&nbsp;</span>' + esc(value));
      addLine(matches.join('   '));
    }
  }

  input.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      var raw = input.value.trim();
      var cmd = raw.toLowerCase();
      input.value = '';
      addLine('<span class="term-prompt">bastien@portfolio:~$&nbsp;</span><span class="term-cmd">' + esc(raw) + '</span>');
      if (!cmd) return;
      recall.push(raw);
      recallPos = recall.length;
      var fn = cmds[cmd];
      if (fn) { var r = fn(); if (r != null) addLine(r); }
      else addLine('<span class="term-error">bash: ' + esc(raw) + ': command not found</span> — tapez <span class="term-cmd">help</span>');
    }
    else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (recall.length === 0) return;
      recallPos = Math.max(0, recallPos - 1);
      input.value = recall[recallPos] || '';
    }
    else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (recall.length === 0) return;
      recallPos = Math.min(recall.length, recallPos + 1);
      input.value = recall[recallPos] || '';
    }
    else if (e.key === 'Tab') {
      e.preventDefault();
      if (input.value.trim()) autocomplete(input.value.trim());
    }
  });

  var termRoot = document.getElementById('terminal-root');
  if (termRoot) termRoot.addEventListener('click', function(e) {
    if (e.target.closest && e.target.closest('a')) return;
    input.focus({ preventScroll: true });
  });
})();

// ===== TEST DE DACTYLOGRAPHIE (un seul mode) =====
(function () {
  var box = document.getElementById('typing-test');
  if (!box) return;

  // Un texte est tire au hasard dans cette liste (jamais deux fois de suite le meme)
  var texts = [
    "La rigueur et la curiosité sont les deux qualités essentielles d'un bon administrateur réseau.",
    "Un bon mot de passe doit contenir au moins douze caractères, des chiffres et des symboles.",
    "L'apprentissage continu est la clé pour rester à jour dans le domaine de la cybersécurité.",
    "Le protocole TCP garantit la livraison des paquets grâce à un mécanisme d'accusé de réception.",
    "Un VLAN permet de segmenter un réseau local en plusieurs sous-réseaux logiques indépendants.",
    "Le DNS traduit un nom de domaine en adresse IP via une hiérarchie de serveurs distribués.",
    "Le serveur DHCP attribue automatiquement une adresse IP, un masque et une passerelle à chaque machine du réseau.",
    "Un pare-feu filtre le trafic entrant et sortant selon des règles définies par l'administrateur.",
    "La fibre optique transporte les données sous forme de lumière, ce qui permet des débits très élevés sur de longues distances.",
    "Le modèle OSI découpe la communication réseau en sept couches, de la couche physique jusqu'à la couche application.",
    "Wireshark permet de capturer les trames qui circulent sur une interface et d'analyser chaque protocole en détail.",
    "Une sauvegarde régulière et stockée hors ligne reste la meilleure protection contre les rançongiciels.",
    "Le Wi-Fi utilise surtout les bandes de 2,4 GHz et de 5 GHz : la seconde offre plus de débit mais une portée plus courte.",
    "Un switch apprend les adresses MAC des appareils connectés et les enregistre dans sa table de commutation.",
    "Selon le théorème de Shannon, la fréquence d'échantillonnage doit être supérieure au double de la fréquence maximale du signal.",
    "En téléphonie sur IP, le protocole SIP gère l'établissement des appels tandis que RTP transporte la voix."
  ];

  var elText   = box.querySelector('.tt-text');
  var elInput  = box.querySelector('.tt-input');
  var elWpm    = box.querySelector('.tt-wpm');
  var elAcc    = box.querySelector('.tt-acc');
  var elTime   = box.querySelector('.tt-time');
  var elReset  = box.querySelector('.tt-reset');
  var elResult = box.querySelector('.tt-result');
  if (!elText || !elInput) return;

  var current = '';
  var last = -1;
  var startTime = null;
  var timerInterval = null;
  var finished = false;

  function pickText() {
    var i;
    do { i = Math.floor(Math.random() * texts.length); } while (texts.length > 1 && i === last);
    last = i;
    return texts[i];
  }

  function esc(c) { return c.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  function render(typed) {
    var html = '';
    for (var i = 0; i < current.length; i++) {
      var c = current[i];
      var displayChar = c === ' ' ? '&nbsp;' : esc(c);
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
    if (stats && typed === current) {
      finished = true;
      clearInterval(timerInterval);
      timerInterval = null;
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

  if (elReset) elReset.addEventListener('click', reset);

  reset();
})();
