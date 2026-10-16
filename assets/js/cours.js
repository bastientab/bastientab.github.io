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

  // Impression : tout déplier
  window.addEventListener('beforeprint', function () {
    $$('details.acc').forEach(function (d) { d.open = true; });
  });
})();
