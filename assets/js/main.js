/* ==========================================================================
   Portfolio de Bastien Tabordet - script principal (refonte one-page 2026)
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

  /* ---------- Reseau anime du hero (graine fixe = meme dessin a chaque visite) ---------- */
  (function () {
    var svg = document.getElementById('hero-net');
    if (!svg) return;
    var NS = 'http://www.w3.org/2000/svg';
    var seed = 20260514;
    function rand() {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    }
    var W = 1200, H = 800, cols = 9, rows = 6;
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid slice');
    var pts = [];
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        pts.push({
          x: (c + 0.5) * W / cols + (rand() - 0.5) * 90,
          y: (r + 0.5) * H / rows + (rand() - 0.5) * 80
        });
      }
    }
    function delayFor(x, y, base) {
      var dx = x - W / 2, dy = y - H / 2;
      return (base + Math.sqrt(dx * dx + dy * dy) / (W / 2) * 1.4).toFixed(2) + 's';
    }
    var edges = [];
    pts.forEach(function (p, i) {
      var near = pts.map(function (q, j) {
        return { j: j, d: (p.x - q.x) * (p.x - q.x) + (p.y - q.y) * (p.y - q.y) };
      }).filter(function (o) { return o.j !== i; })
        .sort(function (a, b) { return a.d - b.d; });
      for (var k = 0; k < 2; k++) {
        var j = near[k].j;
        var key = i < j ? i + '-' + j : j + '-' + i;
        if (edges.indexOf(key) === -1) edges.push(key);
      }
    });
    var gLines = document.createElementNS(NS, 'g');
    var gNodes = document.createElementNS(NS, 'g');
    edges.forEach(function (key) {
      var ij = key.split('-');
      var a = pts[+ij[0]], b = pts[+ij[1]];
      var path = document.createElementNS(NS, 'path');
      path.setAttribute('d', 'M' + a.x.toFixed(1) + ' ' + a.y.toFixed(1) + 'L' + b.x.toFixed(1) + ' ' + b.y.toFixed(1));
      path.setAttribute('pathLength', '1');
      path.style.setProperty('--d', delayFor((a.x + b.x) / 2, (a.y + b.y) / 2, 0.2));
      gLines.appendChild(path);
    });
    pts.forEach(function (p) {
      var dot = document.createElementNS(NS, 'circle');
      var hub = rand() < 0.16;
      dot.setAttribute('cx', p.x.toFixed(1));
      dot.setAttribute('cy', p.y.toFixed(1));
      dot.setAttribute('r', hub ? '4.5' : '2.5');
      if (hub) dot.setAttribute('class', 'hub');
      dot.style.setProperty('--d', delayFor(p.x, p.y, 0.4));
      gNodes.appendChild(dot);
    });
    svg.appendChild(gLines);
    svg.appendChild(gNodes);
  })();

  /* ---------- Suivi de defilement generique (competences, projet vedette) ---------- */
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

  /* ---------- Projet vedette : visuel colle + etapes ---------- */
  (function () {
    var feature = document.getElementById('feature');
    if (!feature) return;
    var steps = feature.querySelectorAll('.f-step');
    var layers = feature.querySelectorAll('.fv-layer');
    var dots = feature.querySelectorAll('.fv-dots i');
    function setStep(i) {
      if (i < 0) return;
      Array.prototype.forEach.call(steps, function (s, k) { s.classList.toggle('is-active', k === i); });
      Array.prototype.forEach.call(layers, function (l, k) { l.classList.toggle('is-active', k === i); });
      Array.prototype.forEach.call(dots, function (d, k) { d.classList.toggle('is-active', k === i); });
    }
    function applyReady() { feature.classList.toggle('steps-ready', !!(mqDesktop && mqDesktop.matches)); }
    applyReady();
    onMQ(mqDesktop, applyReady);
    setStep(0);
    scrollSpy(steps, setStep);
  })();

  /* ---------- Onglets accessibles (terminal / dactylographie) ---------- */
  (function () {
    var tabs = Array.prototype.slice.call(document.querySelectorAll('[role="tab"]'));
    if (!tabs.length) return;
    function select(tab, focus) {
      tabs.forEach(function (t) {
        var on = t === tab;
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        t.setAttribute('tabindex', on ? '0' : '-1');
        var panel = document.getElementById(t.getAttribute('aria-controls'));
        if (panel) panel.hidden = !on;
      });
      if (focus) tab.focus();
      refreshST();
    }
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { select(t, false); });
      t.addEventListener('keydown', function (e) {
        var n = null;
        if (e.key === 'ArrowRight') n = tabs[(i + 1) % tabs.length];
        else if (e.key === 'ArrowLeft') n = tabs[(i - 1 + tabs.length) % tabs.length];
        else if (e.key === 'Home') n = tabs[0];
        else if (e.key === 'End') n = tabs[tabs.length - 1];
        if (n) { e.preventDefault(); select(n, true); }
      });
    });
  })();

  /* ---------- Details « En savoir plus » : recalcul des declencheurs ---------- */
  document.querySelectorAll('details').forEach(function (d) {
    d.addEventListener('toggle', refreshST);
  });

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

  /* ---------- Effets GSAP + ScrollTrigger (seulement si charges et mouvement autorise) ---------- */
  if (hasGSAP && !reduceMotion) {
    var gsap = window.gsap;
    gsap.registerPlugin(window.ScrollTrigger);

    // Hero : le contenu s'eloigne, le reseau derive
    if (document.querySelector('.hero')) {
      gsap.to('.hero-inner', {
        yPercent: -18, opacity: 0, scale: 0.96, ease: 'none',
        scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true }
      });
      gsap.to('#hero-net', {
        yPercent: 12, scale: 1.08, ease: 'none',
        scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true }
      });
    }

    // Manifeste : revelation mot a mot
    var split = document.querySelector('[data-split]');
    if (split) {
      var frag = document.createDocumentFragment();
      Array.prototype.slice.call(split.childNodes).forEach(function (node) {
        var hl = node.nodeType === 1;
        node.textContent.split(/(\s+)/).forEach(function (part) {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
          var s = document.createElement('span');
          s.className = hl ? 'w hl' : 'w';
          s.textContent = part;
          frag.appendChild(s);
        });
      });
      split.innerHTML = '';
      split.appendChild(frag);
      root.classList.add('split-ready');
      gsap.to(split.querySelectorAll('.w'), {
        opacity: 1, stagger: 0.1, ease: 'none',
        scrollTrigger: { trigger: split, start: 'top 80%', end: 'bottom 45%', scrub: true }
      });
    }

    // Divers : la bande sombre s'ouvre en plein ecran
    var band = document.querySelector('.dark-band');
    if (band) {
      gsap.fromTo(band,
        { clipPath: 'inset(4% 3% round 40px)' },
        { clipPath: 'inset(0% 0% round 0px)', ease: 'none',
          scrollTrigger: { trigger: band, start: 'top bottom', end: 'top 25%', scrub: true } });
    }

    // Parallaxe douce des images
    gsap.utils.toArray('[data-parallax]').forEach(function (img) {
      gsap.fromTo(img, { yPercent: -6 }, {
        yPercent: 6, ease: 'none',
        scrollTrigger: { trigger: img.parentElement, start: 'top bottom', end: 'bottom top', scrub: true }
      });
    });

    // CV : l'apercu se redresse
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

// ===== TERMINAL INTERACTIF =====
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
    'whoami': function() { return '<span class="term-success">bastien.tabordet</span>\n  Étudiant en 2e année de BUT Réseaux &amp; Télécommunications\n  IUT de Clermont-Ferrand | 20 ans | Loiret (45) & Puy-de-Dôme (63)\n  └─ Recherche une alternance dès octobre 2026 — Réseaux &amp; Cybersécurité'; },
    'ping bastien': function() { return 'PING bastien.tabordet (portfolio.local) 56 bytes\n  icmp_seq=1 ttl=64 time=<span class="term-success">0.1 ms</span>\n  icmp_seq=2 ttl=64 time=<span class="term-success">0.1 ms</span>\n  icmp_seq=3 ttl=64 time=<span class="term-success">0.1 ms</span>\n  <span class="term-success">3 packets transmitted, 3 received, 0% packet loss</span>'; },
    'traceroute': function() { return 'traceroute to formation.bastien (127.0.0.1)\n  1.  <span class="term-cmd">Lycée Bernard Palissy</span>   Bac général mention AB (2024)\n  2.  <span class="term-cmd">ISIMA Clermont-Ferrand</span>  Prépa intégrée ingénieur (2024-2025)\n  3.  <span class="term-cmd">IUT Clermont-Ferrand</span>    BUT R&amp;T (2025-2028, en cours)\n  4.  <span class="term-success">Alternance oct. 2026 → recherche en cours...</span>'; },
    'nmap skills': function() { return 'Starting Nmap — bastientabordet.fr\n  PORT      STATE  SERVICE    VERSION\n  22/tcp    open   bash       Scripts Shell &amp; automatisation\n  80/tcp    open   html/css   Sites statiques &amp; responsive\n  443/tcp   open   réseaux    Cisco PT · VLAN · Wireshark\n  3306/tcp  open   sql        Bases de données relationnelles\n  5000/tcp  open   python     Automatisation &amp; scripts réseau\n  8443/tcp  open   cyber      ANSSI · hygiène informatique\n  <span class="term-success">Nmap done: 6 services scanned</span>'; },
    'git activity': function() {
      var bars = '';
      var levels = [' ','▁','▂','▃','▄','▅','▆','▇','█'];
      var data = [0,1,2,0,3,4,2,1,0,0,2,5,3,1,2,4,3,0,1,2,3,5,4,2,0,1,3,2,4,1];
      var total = data.reduce(function(a,b){return a+b;},0);
      for (var i = 0; i < data.length; i++) bars += '<span class="term-success">' + levels[data[i]] + '</span>';
      return '<span class="term-info">Activité GitHub — 30 derniers jours</span>\n  ' + bars + '\n  <span class="term-success">' + total + ' commits</span> · <a href="https://github.com/bastientab" target="_blank" rel="noopener" style="color:#58a6e8;text-decoration:none">github.com/bastientab</a>\n  <span style="opacity:.6">(données mises à jour manuellement)</span>';
    },
    'cv': function() { return '<span class="term-info">Accès au CV...</span>\n  <a href="#cv" style="color:#58a6e8;text-decoration:none">→ Section CV de cette page</a>\n  <a href="CV_Bastien_TABORDET.pdf" target="_blank" rel="noopener" style="color:#58a6e8;text-decoration:none">→ CV_Bastien_TABORDET.pdf</a>'; },
    'contact': function() { return '<span class="term-info">─── Contact ─────────────────────────────</span>\n  Email    : <a href="mailto:bastien.tabordet@etu.uca.fr" style="color:#58a6e8;text-decoration:none">bastien.tabordet@etu.uca.fr</a>\n  LinkedIn : <a href="https://www.linkedin.com/in/bastientabordet/" target="_blank" rel="noopener" style="color:#58a6e8;text-decoration:none">linkedin.com/in/bastientabordet</a>'; },
    'history': function() {
      if (history.length === 0) return '<span style="opacity:.6">Aucune commande dans l\'historique.</span>';
      return history.map(function(h, i){ return '  ' + (i+1) + '  ' + h.replace(/</g,'&lt;'); }).join('\n');
    },
    'clear': function() { output.innerHTML = ''; return null; },
    'sudo hire-me': function() {
      return '<span class="term-success">[sudo] mot de passe pour recruteur : ********</span>\n  <span class="term-info">Vérification des privilèges...</span> <span class="term-success">OK</span>\n  <span class="term-info">Demande envoyée au candidat.</span>\n\n  ┌─────────────────────────────────────────┐\n  │  ✓ Bastien est prêt à rejoindre votre   │\n  │    équipe en alternance dès oct. 2026   │\n  │                                         │\n  │  → Contact direct : section Contact     │\n  └─────────────────────────────────────────┘';
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
      addLine('<span class="term-prompt">bastien@portfolio:~$&nbsp;</span>' + value.replace(/</g,'&lt;'));
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
  if (termRoot) termRoot.addEventListener('click', function(e) {
    if (e.target.closest && e.target.closest('a')) return;
    input.focus({ preventScroll: true });
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
