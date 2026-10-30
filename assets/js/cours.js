/* =========================================================
   cours.js — Espace révisions
   - menu : recherche + filtres (Tout / Tronc commun / SAÉ)
   - fiches : sommaire actif, tout ouvrir / fermer, ancres dans les accordéons
   (le thème, le header, le burger… sont gérés par main.js)
   ========================================================= */
(function () {
  'use strict';

  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  /* ---------- Menu : recherche + filtres ---------- */
  var search = document.getElementById('c-search');
  var filters = $$('.c-filter');
  var cards = $$('.c-card');
  var groups = $$('.c-group');
  var noResult = document.getElementById('c-no-result');
  var resetBtn = document.getElementById('c-reset');
  var current = 'all';

  function norm(s) {
    return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function apply() {
    var words = norm(search ? search.value.trim() : '').split(/\s+/).filter(Boolean);
    var shown = 0;

    cards.forEach(function (card) {
      var okCat = current === 'all' || card.getAttribute('data-cat') === current;
      var hay = norm(card.textContent + ' ' + (card.getAttribute('data-tags') || ''));
      var okQ = words.every(function (w) { return hay.indexOf(w) !== -1; });
      card.hidden = !(okCat && okQ);
      if (!card.hidden) shown++;
    });

    groups.forEach(function (g) {
      $$('.c-subgroup', g).forEach(function (sg) {
        sg.hidden = sg.querySelectorAll('.c-card:not([hidden])').length === 0;
      });
      var n = g.querySelectorAll('.c-card:not([hidden])').length;
      g.hidden = n === 0;
      var count = g.querySelector('.c-count');
      if (count) count.textContent = n + ' ' + (n > 1 ? count.getAttribute('data-many') : count.getAttribute('data-one'));
    });

    if (noResult) noResult.hidden = shown !== 0;
  }

  function setFilter(value) {
    current = value;
    filters.forEach(function (b) {
      b.setAttribute('aria-pressed', b.getAttribute('data-filter') === value ? 'true' : 'false');
    });
    apply();
  }

  if (cards.length) {
    filters.forEach(function (btn) {
      btn.addEventListener('click', function () { setFilter(btn.getAttribute('data-filter')); });
    });

    if (search) {
      search.addEventListener('input', apply);
      search.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { search.value = ''; apply(); }
      });
      // touche "/" = focus sur la recherche
      document.addEventListener('keydown', function (e) {
        var t = document.activeElement;
        var typing = t && (/^(input|textarea|select)$/i.test(t.tagName) || t.isContentEditable);
        if (e.key === '/' && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          search.focus();
        }
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        if (search) search.value = '';
        setFilter('all');
        if (search) search.focus();
      });
    }

    apply();
  }

  /* ---------- Fiches : sommaire actif ---------- */
  var tocLinks = $$('.c-toc a[href^="#"]');
  if (tocLinks.length && 'IntersectionObserver' in window) {
    var visible = {};
    var targets = tocLinks.map(function (a) {
      return document.getElementById(decodeURIComponent(a.getAttribute('href').slice(1)));
    }).filter(Boolean);

    var setActive = function (id) {
      tocLinks.forEach(function (a) {
        var on = a.getAttribute('href') === '#' + id;
        a.classList.toggle('is-active', on);
        if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
      });
    };

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { visible[en.target.id] = en.isIntersecting; });
      for (var i = 0; i < targets.length; i++) {
        if (visible[targets[i].id]) { setActive(targets[i].id); break; }
      }
    }, { rootMargin: '-90px 0px -55% 0px', threshold: 0 });

    targets.forEach(function (t) { io.observe(t); });
  }

  /* ---------- Accordéons : tout ouvrir / tout fermer ---------- */
  $$('[data-acc-toggle]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var open = btn.getAttribute('data-acc-toggle') === 'open';
      var scope = btn.closest('[data-acc-scope]') || document;
      $$('details.acc', scope).forEach(function (d) { d.open = open; });
    });
  });

  // Lien direct vers un élément caché dans un accordéon fermé -> on l'ouvre
  function openHashTarget() {
    if (!location.hash) return;
    var el = null;
    try { el = document.getElementById(decodeURIComponent(location.hash.slice(1))); } catch (e) { return; }
    if (!el) return;
    var d = el.closest('details');
    if (d && !d.open) { d.open = true; el.scrollIntoView(); }
  }
  window.addEventListener('hashchange', openHashTarget);
  openHashTarget();

  /* =========================================================
     ONGLETS : [role=tablist] > .c-tab[aria-controls] -> .c-panel
     - lien direct : page.html#quiz (id du panneau ou d'un élément dedans)
     ========================================================= */
  var tabs = $$('.c-tabs [role="tab"]');
  function panelOf(tab) { return document.getElementById(tab.getAttribute('aria-controls')); }
  function showTab(tab, opts) {
    opts = opts || {};
    tabs.forEach(function (t) {
      var on = t === tab;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
      var p = panelOf(t);
      if (p) p.hidden = !on;
    });
    if (opts.focus) tab.focus();
    if (opts.push) {
      try { history.replaceState(null, '', '#' + tab.getAttribute('aria-controls')); } catch (e) {}
    }
    if (opts.scroll !== false) {
      var wrap = document.querySelector('.c-tabs-wrap');
      if (wrap && wrap.getBoundingClientRect().top < 0 || (wrap && window.scrollY > wrap.offsetTop)) {
 window.scrollTo(0, wrap.offsetTop - (parseInt(getComputedStyle(document.documentElement).getPropertyValue('--header-h'), 10) || 64));
      }
    }
    document.dispatchEvent(new CustomEvent('c-tab-change', { detail: tab.getAttribute('aria-controls') }));
  }
  function tabFromHash() {
    if (!location.hash || !tabs.length) return false;
    var el = null;
    try { el = document.getElementById(decodeURIComponent(location.hash.slice(1))); } catch (e) { return false; }
    if (!el) return false;
    var panel = el.classList.contains('c-panel') ? el : el.closest('.c-panel');
    if (!panel) return false;
    var tab = tabs.filter(function (t) { return t.getAttribute('aria-controls') === panel.id; })[0];
    if (!tab) return false;
    showTab(tab, { scroll: false });
    if (el !== panel) setTimeout(function () { el.scrollIntoView(); }, 30);
    return true;
  }
  if (tabs.length) {
    tabs.forEach(function (tab, i) {
      tab.addEventListener('click', function () { showTab(tab, { push: true }); });
      tab.addEventListener('keydown', function (e) {
 var n = null;
        if (e.key === 'ArrowRight') n = tabs[(i + 1) % tabs.length];
        else if (e.key === 'ArrowLeft') n = tabs[(i - 1 + tabs.length) % tabs.length];
        else if (e.key === 'Home') n = tabs[0];
        else if (e.key === 'End') n = tabs[tabs.length - 1];
        if (n) { e.preventDefault(); showTab(n, { focus: true, push: true }); }
      });
    });
    $$('[data-goto-tab]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        var t = tabs.filter(function (x) { return x.getAttribute('aria-controls') === a.getAttribute('data-goto-tab'); })[0];
        if (t) { e.preventDefault(); showTab(t, { push: true }); }
      });
    });
    if (!tabFromHash()) {
      var sel = tabs.filter(function (t) { return t.getAttribute('aria-selected') === 'true'; })[0] || tabs[0];
      showTab(sel, { scroll: false });
    }
    window.addEventListener('hashchange', tabFromHash);
  }

  /* =========================================================
     QUIZ : <div class="qz" data-quiz="id-du-json"> + <script type="application/json" id="…">
     Format : [{ "t":"Thème", "k":"theorie|cas", "q":"Question", "code":"(option)",
          "o":["A","B","C","D"], "a":indexBonneRéponse, "e":"Explication" }]
     ========================================================= */
  $$('.qz[data-quiz]').forEach(function (root) {
    var src = document.getElementById(root.getAttribute('data-quiz'));
    if (!src) return;
    var data;
    try { data = JSON.parse(src.textContent); } catch (e) { root.textContent = 'Erreur de chargement du quiz.'; return; }
    var LETTERS = 'ABCDEFGH';
    var list = root.querySelector('.qz-list');
    var filtersBox = root.querySelector('.qz-filters');
    var scoreEl = root.querySelector('.qz-score');
    var endEl = root.querySelector('.qz-end');
    var theme = 'all', kind = 'all', onlyWrong = false;
    var state = data.map(function () { return null; }); // null | true | false
    var cards = [];

    function el(tag, cls, txt) {
      var n = document.createElement(tag);
      if (cls) n.className = cls;
      if (txt != null) n.textContent = txt;
      return n;
    }
    function shuffle(a) {
      for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var x = a[i]; a[i] = a[j]; a[j] = x; }
      return a;
    }

    function build(order) {
      list.innerHTML = '';
      cards = [];
      order.forEach(function (qi, pos) {
        var q = data[qi];
        var card = el('article', 'qz-q');
        card.setAttribute('data-i', qi);
        var meta = el('div', 'qz-meta');
        meta.appendChild(el('span', null, 'Q' + (pos + 1)));
        meta.appendChild(el('span', 'qz-kind' + (q.k === 'cas' ? ' cas' : ''), q.k === 'cas' ? 'Cas pratique' : 'Théorie'));
        meta.appendChild(el('span', null, q.t));
        card.appendChild(meta);
        var text = el('div', 'qz-text', q.q);
 if (q.code) {
          var pre = el('pre', 'c-code'); var code = el('code', null, q.code); pre.appendChild(code); text.appendChild(pre);
 }
        card.appendChild(text);
        var ul = el('ul', 'qz-opts');
 var idx = q.o.map(function (_, i) { return i; });
        if (root.getAttribute('data-shuffle-opts') !== 'false') shuffle(idx);
        var expl = el('div', 'qz-expl'); expl.hidden = true;
        idx.forEach(function (oi, k) {
          var li = el('li');
          var b = el('button', 'qz-opt'); b.type = 'button';
          b.setAttribute('data-oi', oi);
          b.appendChild(el('span', 'k', LETTERS[k]));
          b.appendChild(el('span', null, q.o[oi]));
   b.addEventListener('click', function () { answer(qi, oi, ul, expl); });
   li.appendChild(b); ul.appendChild(li);
        });
        card.appendChild(ul);
 card.appendChild(expl);
        list.appendChild(card);
        cards.push(card);
        if (state[qi] !== null) markDone(qi, ul, expl, null);
      });
      filter();
    }

    function markDone(qi, ul, expl, chosen) {
      var q = data[qi];
      $$('.qz-opt', ul).forEach(function (b) {
        var oi = +b.getAttribute('data-oi');
        b.disabled = true;
        if (oi === q.a) b.classList.add('is-ok');
        else if (chosen !== null && oi === chosen) b.classList.add('is-ko');
      });
      expl.innerHTML = '';
      var v = el('span', state[qi] ? 'v-ok' : 'v-ko', state[qi] ? '✓ Bonne réponse. ' : '✗ Raté — la bonne réponse est « ' + q.o[q.a] + ' ». ');
      expl.appendChild(v);
      expl.appendChild(document.createTextNode(q.e || ''));
      expl.hidden = false;
    }

    function answer(qi, oi, ul, expl) {
      if (state[qi] !== null) return;
      state[qi] = oi === data[qi].a;
      markDone(qi, ul, expl, oi);
      score();
    }

    function visibleIdx() {
      return data.map(function (_, i) { return i; }).filter(function (i) {
        return (theme === 'all' || data[i].t === theme) && (kind === 'all' || data[i].k === kind);
      });
    }

    function filter() {
      cards.forEach(function (c) {
        var i = +c.getAttribute('data-i');
        var ok = (theme === 'all' || data[i].t === theme) && (kind === 'all' || data[i].k === kind);
        if (onlyWrong) ok = ok && state[i] === false;
        c.hidden = !ok;
      });
      score();
    }

    function score() {
      var vis = visibleIdx();
      var done = vis.filter(function (i) { return state[i] !== null; });
      var good = done.filter(function (i) { return state[i]; }).length;
      var pct = done.length ? Math.round(good / done.length * 100) : 0;
      if (scoreEl) {
        scoreEl.innerHTML = '';
 var a = el('span'); a.appendChild(document.createTextNode('Répondu ')); a.appendChild(el('b', null, done.length + '/' + vis.length)); scoreEl.appendChild(a);
 var b = el('span'); b.appendChild(document.createTextNode('Score ')); b.appendChild(el('b', null, good + ' (' + pct + ' %)')); scoreEl.appendChild(b);
        var bar = el('div', 'qz-bar'); var s = el('span'); s.style.width = (vis.length ? done.length / vis.length * 100 : 0) + '%'; bar.appendChild(s); scoreEl.appendChild(bar);
      }
      if (endEl) {
        var finished = vis.length && done.length === vis.length;
 endEl.hidden = !finished;
 if (finished) {
          var msg = pct >= 85 ? 'Excellent, la notion est maîtrisée.' : pct >= 65 ? 'Bon niveau : relis les explications des questions ratées.' : pct >= 40 ? 'Moyen : repasse par le cours détaillé sur les thèmes ratés.' : 'À retravailler : relis le cours puis refais le quiz.';
          endEl.querySelector('[data-qz-result]').textContent = 'Résultat : ' + good + '/' + vis.length + ' (' + pct + ' %). ' + msg;
        }
      }
    }

    // Filtres par thème
    if (filtersBox) {
      var themes = [];
      data.forEach(function (q) { if (themes.indexOf(q.t) === -1) themes.push(q.t); });
      ['all'].concat(themes).forEach(function (t) {
        var b = el('button', 'c-filter', t === 'all' ? 'Tous les thèmes' : t);
 b.type = 'button';
 b.setAttribute('aria-pressed', t === theme ? 'true' : 'false');
        b.addEventListener('click', function () {
   theme = t;
   $$('.c-filter', filtersBox).forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
   filter();
        });
        filtersBox.appendChild(b);
      });
    }
    $$('[data-qz-kind]', root).forEach(function (b) {
      b.addEventListener('click', function () {
        kind = b.getAttribute('data-qz-kind');
 $$('[data-qz-kind]', root).forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
        filter();
      });
    });
    $$('[data-qz-action]', root).forEach(function (b) {
      b.addEventListener('click', function () {
        var act = b.getAttribute('data-qz-action');
 if (act === 'shuffle') { build(shuffle(data.map(function (_, i) { return i; }))); }
        else if (act === 'reset') { state = data.map(function () { return null; }); onlyWrong = false; syncWrong(); build(data.map(function (_, i) { return i; })); }
 else if (act === 'wrong') { onlyWrong = !onlyWrong; syncWrong(); filter(); }
        else if (act === 'retry-wrong') {
          data.forEach(function (_, i) { if (state[i] === false) state[i] = null; });
   onlyWrong = false; syncWrong();
   build(data.map(function (_, i) { return i; }));
          root.scrollIntoView();
        }
      });
    });
    function syncWrong() { $$('[data-qz-action="wrong"]', root).forEach(function (x) { x.setAttribute('aria-pressed', onlyWrong ? 'true' : 'false'); }); }

    var countEl = root.querySelector('[data-qz-count]');
    if (countEl) countEl.textContent = data.length;
    build(data.map(function (_, i) { return i; }));
  });

  /* =========================================================
     DIAPORAMA COMMENTÉ : .sl > .sl-stage > .sl-slide[data-say="texte lu"]
     Voix = synthèse vocale du navigateur (Web Speech API), en français si dispo.
     ========================================================= */
  $$('.sl').forEach(function (sl) {
    var slides = $$('.sl-slide', sl);
    if (!slides.length) return;
    var cur = 0, playing = false, timer = null, token = 0;
    var synth = window.speechSynthesis || null;
    var caption = sl.querySelector('.sl-caption');
    var bar = sl.querySelector('.sl-progress span');
    var count = sl.querySelector('.sl-count');
    var playBtn = sl.querySelector('[data-sl="play"]');
    var voiceSel = sl.querySelector('[data-sl="voice"]');
    var rateSel = sl.querySelector('[data-sl="rate"]');
    var voices = [];

    function loadVoices() {
      if (!synth || !voiceSel) return;
      var all = synth.getVoices();
      voices = all.filter(function (v) { return /^fr/i.test(v.lang); });
      if (!voices.length) voices = all;
      var prev = voiceSel.value;
      voiceSel.innerHTML = '';
      voices.forEach(function (v, i) {
        var o = document.createElement('option');
 o.value = i; o.textContent = v.name.replace(/Microsoft |Google /, '') + ' (' + v.lang + ')';
        voiceSel.appendChild(o);
      });
      // Préférence : voix "naturelles"/"online" de meilleure qualité
      var best = voices.findIndex ? voices.findIndex(function (v) { return /natural|online|neural/i.test(v.name); }) : -1;
      voiceSel.value = prev && voices[prev] ? prev : (best > -1 ? best : 0);
    }
    if (synth) {
      loadVoices();
      if ('onvoiceschanged' in synth) synth.addEventListener('voiceschanged', loadVoices);
    } else if (voiceSel) {
      voiceSel.disabled = true;
      var o = document.createElement('option'); o.textContent = 'Voix indisponible'; voiceSel.appendChild(o);
    }

    function render() {
      slides.forEach(function (s, i) { s.classList.toggle('is-on', i === cur); s.setAttribute('aria-hidden', i === cur ? 'false' : 'true'); });
      if (bar) bar.style.width = ((cur + 1) / slides.length * 100) + '%';
      if (count) count.textContent = (cur + 1) + ' / ' + slides.length;
      if (caption) caption.textContent = slides[cur].getAttribute('data-say') || '';
    }

    function stopVoice() {
      token++;
      clearTimeout(timer);
      if (synth) synth.cancel();
    }

    function speak() {
      stopVoice();
      var my = token;
      var text = slides[cur].getAttribute('data-say') || '';
      var rate = rateSel ? parseFloat(rateSel.value) || 1 : 1;
      var next = function () {
        if (my !== token || !playing) return;
        if (cur < slides.length - 1) { cur++; render(); timer = setTimeout(speak, 600); }
        else { setPlaying(false); }
      };
      if (!synth) { timer = setTimeout(next, Math.max(4000, text.length * 65 / rate)); return; }
      // Découpage en phrases : évite la coupure des longs textes sous Chrome
      var parts = text.match(/[^.!?:;]+[.!?:;]*/g) || [text];
      var i = 0;
      var say = function () {
        if (my !== token) return;
        if (i >= parts.length) { next(); return; }
 var u = new SpeechSynthesisUtterance(parts[i++].trim());
        u.lang = 'fr-FR'; u.rate = rate;
        var v = voiceSel ? voices[voiceSel.value] : null;
        if (v) { u.voice = v; u.lang = v.lang; }
 u.onend = say;
        u.onerror = function (e) { if (e.error !== 'interrupted' && e.error !== 'canceled') say(); };
 synth.speak(u);
      };
      say();
    }

    function setPlaying(p) {
      playing = p;
      if (playBtn) {
        playBtn.textContent = p ? '❚❚ Pause' : '▶ Lecture';
        playBtn.setAttribute('aria-pressed', p ? 'true' : 'false');
      }
      if (p) speak(); else stopVoice();
    }
    function go(i) {
      cur = Math.max(0, Math.min(slides.length - 1, i));
      render();
      if (playing) speak();
    }

    $$('[data-sl]', sl).forEach(function (b) {
      var a = b.getAttribute('data-sl');
      if (a === 'prev') b.addEventListener('click', function () { go(cur - 1); });
      if (a === 'next') b.addEventListener('click', function () { go(cur + 1); });
      if (a === 'restart') b.addEventListener('click', function () { go(0); });
      if (a === 'play') b.addEventListener('click', function () { setPlaying(!playing); });
      if (a === 'full') b.addEventListener('click', function () {
 if (document.fullscreenElement) document.exitFullscreen();
        else if (sl.requestFullscreen) sl.requestFullscreen();
      });
      if (a === 'rate' || a === 'voice') b.addEventListener('change', function () { if (playing) speak(); });
    });
    sl.addEventListener('keydown', function (e) {
      if (/^(select|input)$/i.test(e.target.tagName)) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); go(cur + 1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(cur - 1); }
    });
    // Changement d'onglet ou de page : on coupe la voix
    document.addEventListener('c-tab-change', function () { if (playing) setPlaying(false); });
    window.addEventListener('pagehide', stopVoice);
    render();
  });

  /* ---------- PDF : .c-pdf[data-src] -> iframe si le fichier existe ---------- */
  $$('.c-pdf[data-src]').forEach(function (box) {
    var src = box.getAttribute('data-src');
    var scope = box.closest('.c-panel') || document;
    var missing = scope.querySelector('[data-pdf-missing]');
    var openLinks = $$('a[href="' + src + '"]', scope);
    function fail() {
      if (missing) missing.hidden = false;
      openLinks.forEach(function (a) { a.hidden = true; });
      box.hidden = true;
    }
    if (!window.fetch) { fail(); return; }
    fetch(src, { method: 'HEAD', cache: 'no-store' }).then(function (r) {
      if (!r.ok) { fail(); return; }
      var f = document.createElement('iframe');
      f.src = src;
      f.title = box.getAttribute('data-title') || 'Cours original (PDF)';
      f.loading = 'lazy';
      box.appendChild(f);
      if (missing) missing.hidden = true;
    }).catch(fail);
  });

  // Impression : tout déplier
  window.addEventListener('beforeprint', function () {
    $$('details.acc').forEach(function (d) { d.open = true; });
  });
})();
