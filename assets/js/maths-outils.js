/* =========================================================
   maths-outils.js — outils interactifs de la fiche Maths
   TVI, dérivée/tangente, asymptotes, DL, complexes,
   fractions rationnelles, intégrales.
   Couleurs lues dans les variables CSS (suit le thème).
   ========================================================= */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const val = (id) => ($(id) ? $(id).value : '');

  /* ---------- Noyau maths ---------- */
  const ALLOWED = new Set(['x', 'e', 'pi', 'exp', 'ln', 'log', 'sin', 'cos', 'tan', 'arcsin', 'arccos', 'arctan',
    'sqrt', 'abs', 'Math', 'PI', 'E', 'pow', 'asin', 'acos', 'atan', 'sinh', 'cosh', 'tanh', 'cbrt', 'log10',
    'log2', 'floor', 'ceil', 'round', 'min', 'max', 'sign', 'Infinity']);

  const MathCore = {
    // Transforme une expression en fonction x -> nombre (liste blanche de noms, pas d'eval)
    parseFunc(expr) {
      const src = String(expr == null ? '' : expr).trim().replace(/\^/g, '**');
      if (!src) throw new Error('expression vide.');
      if (/[^\w\s+\-*/%().,]/.test(src)) throw new Error('caractère non autorisé dans « ' + src + ' ».');
      const tokens = src.match(/[A-Za-z_]\w*|\d*\.?\d+(?:e[+-]?\d+)?/gi) || [];
      for (const t of tokens) {
        if (/^[A-Za-z_]/.test(t) && !ALLOWED.has(t)) throw new Error('nom inconnu « ' + t + ' ».');
      }
      const fn = new Function('x', 'e', 'pi', 'exp', 'ln', 'log', 'sin', 'cos', 'tan', 'arcsin', 'arccos', 'arctan',
        'sqrt', 'abs', '"use strict"; return (' + src + ');');
      const M = Math;
      return function (x) {
        const v = fn(x, M.E, M.PI, M.exp, M.log, M.log10, M.sin, M.cos, M.tan, M.asin, M.acos, M.atan, M.sqrt, M.abs);
        return typeof v === 'number' ? v : NaN;
      };
    },
    // Nombre saisi (accepte pi/2, Math.E, sqrt(2), inf...)
    num(str) {
      const s = String(str).trim();
      if (/^\+?(inf|infinity|∞)$/i.test(s)) return Infinity;
      if (/^-(inf|infinity|∞)$/i.test(s)) return -Infinity;
      const v = MathCore.parseFunc(s)(0);
      if (!isFinite(v)) throw new Error('valeur invalide : « ' + s + ' ».');
      return v;
    },
    derivative(f, x, h) {
      h = h || 1e-5;
      return (f(x + h) - f(x - h)) / (2 * h);
    },
    // Dérivée n-ième par différences centrées (pas adapté à l'ordre)
    nthDerivative(f, x, n) {
      if (n === 0) return f(x);
      const h = Math.max(1e-4, Math.pow(n * Math.pow(2, n) * 2.2e-16, 1 / (n + 2)));
      let s = 0, binom = 1;
      for (let i = 0; i <= n; i++) {
        s += (i % 2 ? -1 : 1) * binom * f(x + (n / 2 - i) * h);
        binom = binom * (n - i) / (i + 1);
      }
      return s / Math.pow(h, n);
    },
    // Méthode du point milieu
    integral(f, a, b, n) {
      n = n || 5000;
      const h = (b - a) / n;
      let s = 0;
      for (let i = 0; i < n; i++) s += f(a + (i + 0.5) * h);
      return s * h;
    },
    bisection(g, a, b, it) {
      let ga = g(a);
      for (let i = 0; i < (it || 100); i++) {
        const m = (a + b) / 2, gm = g(m);
        if (gm === 0) return m;
        if (ga * gm < 0) b = m; else { a = m; ga = gm; }
      }
      return (a + b) / 2;
    },
    findRoots(f, a, b, steps) {
      steps = steps || 4000;
      const roots = [], dx = (b - a) / steps;
      let x0 = a, y0 = f(x0);
      for (let i = 1; i <= steps; i++) {
        const x1 = a + i * dx, y1 = f(x1);
        if (y0 === 0) roots.push(x0);
        else if (isFinite(y0) && isFinite(y1) && y0 * y1 < 0) roots.push(MathCore.bisection(f, x0, x1, 80));
        x0 = x1; y0 = y1;
      }
      if (y0 === 0) roots.push(x0);
      return roots;
    }
  };

  class Complex {
    constructor(re, im) { this.re = re; this.im = im || 0; }
    add(z) { return new Complex(this.re + z.re, this.im + z.im); }
    sub(z) { return new Complex(this.re - z.re, this.im - z.im); }
    mul(z) { return new Complex(this.re * z.re - this.im * z.im, this.re * z.im + this.im * z.re); }
    div(z) {
      const d = z.re * z.re + z.im * z.im;
      return new Complex((this.re * z.re + this.im * z.im) / d, (this.im * z.re - this.re * z.im) / d);
    }
    conj() { return new Complex(this.re, -this.im); }
    abs() { return Math.hypot(this.re, this.im); }
    arg() { return Math.atan2(this.im, this.re); }
    inv() { return new Complex(1, 0).div(this); }
  }

  /* ---------- Formatage ---------- */
  function fmt(v, d) {
    if (v === Infinity) return '+∞';
    if (v === -Infinity) return '−∞';
    if (!isFinite(v)) return 'indéfini';
    let s = String(+v.toFixed(d == null ? 4 : d));
    if (s === '-0') s = '0';
    return s.replace('-', '−');
  }
  function fmtTeX(v, d) {
    let s = String(+v.toFixed(d == null ? 4 : d));
    return s === '-0' ? '0' : s;
  }
  function fmtC(z, d) {
    d = d == null ? 2 : d;
    const a = +z.re.toFixed(d) || 0, b = +z.im.toFixed(d) || 0;
    if (!isFinite(a) || !isFinite(b)) return 'indéfini';
    if (b === 0) return fmt(a, d);
    const bi = (Math.abs(b) === 1 ? '' : fmt(Math.abs(b), d)) + 'i';
    if (a === 0) return (b < 0 ? '−' : '') + bi;
    return (fmt(a, d) + ' + ' + (b < 0 ? '-' : '') + bi).replace(/\+ -/g, '− ');
  }
  function lineEq(m, p) {
    const ms = m === 0 ? '' : (m === 1 ? '' : m === -1 ? '−' : fmt(m, 4)) + 'x';
    if (!ms) return fmt(p, 4);
    if (p === 0) return ms;
    return ms + (p > 0 ? ' + ' : ' − ') + fmt(Math.abs(p), 4);
  }
  function round(v, d) { const k = Math.pow(10, d); return (Math.round(v * k) / k) || 0; }
  function cleanNum(v) {
    const r = Math.round(v);
    if (Math.abs(v - r) < 1e-6) return r || 0;
    return Math.abs(v) < 1e-9 ? 0 : v;
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  /* ---------- Couleurs (variables CSS) ---------- */
  const C = {};
  function readColors() {
    const cs = getComputedStyle(document.documentElement);
    const g = (n, fb) => (cs.getPropertyValue(n) || '').trim() || fb;
    C.accent = g('--accent', '#0071e3');
    C.alt = g('--c-alt', '#e8590c');
    C.ok = g('--c-ok', '#1f9d55');
    C.ink = g('--ink', '#1d1d1f');
    C.ink3 = g('--ink-3', '#86868b');
    C.line = g('--line', 'rgba(0,0,0,.1)');
    C.mono = g('--mono', 'monospace');
  }

  /* ---------- Tracé ---------- */
  function niceStep(range) {
    const raw = range / 8, mag = Math.pow(10, Math.floor(Math.log10(raw))), n = raw / mag;
    return (n < 1.5 ? 1 : n < 3.5 ? 2 : n < 7.5 ? 5 : 10) * mag;
  }
  function autoY(fns, x0, x1, extra) {
    const vals = (extra || []).filter((v) => isFinite(v));
    const n = 400;
    fns.forEach((f) => {
      for (let i = 0; i <= n; i++) {
        let y;
        try { y = f(x0 + (x1 - x0) * i / n); } catch (e) { y = NaN; }
        if (isFinite(y)) vals.push(y);
      }
    });
    if (!vals.length) return [-5, 5];
    vals.sort((a, b) => a - b);
    let lo = vals[Math.floor(vals.length * 0.03)], hi = vals[Math.max(0, Math.ceil(vals.length * 0.97) - 1)];
    const span = hi - lo;
    if (lo > 0 && lo < 2 * span) lo = 0;
    if (hi < 0 && -hi < 2 * span) hi = 0;
    if (hi - lo < 1e-9) { lo -= 1; hi += 1; }
    const pad = (hi - lo) * 0.12;
    return [lo - pad, hi + pad];
  }

  class CanvasPlotter {
    constructor(canvas) {
      this.c = canvas;
      this.ctx = canvas.getContext('2d');
      this.view(-5, 5, -5, 5);
      this.resize();
    }
    resize() {
      const dpr = window.devicePixelRatio || 1, r = this.c.getBoundingClientRect();
      this.w = Math.max(1, r.width);
      this.h = Math.max(1, r.height);
      this.c.width = Math.round(this.w * dpr);
      this.c.height = Math.round(this.h * dpr);
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    view(x0, x1, y0, y1) { this.x0 = x0; this.x1 = x1; this.y0 = y0; this.y1 = y1; }
    X(x) { return (x - this.x0) / (this.x1 - this.x0) * this.w; }
    Y(y) { return this.h - (y - this.y0) / (this.y1 - this.y0) * this.h; }
    clear() { this.ctx.clearRect(0, 0, this.w, this.h); }
    drawAxes() {
      const ctx = this.ctx, sx = niceStep(this.x1 - this.x0), sy = niceStep(this.y1 - this.y0);
      ctx.save();
      ctx.lineWidth = 1;
      ctx.strokeStyle = C.line;
      ctx.beginPath();
      for (let k = Math.ceil(this.x0 / sx); k * sx <= this.x1; k++) { const px = Math.round(this.X(k * sx)) + 0.5; ctx.moveTo(px, 0); ctx.lineTo(px, this.h); }
      for (let k = Math.ceil(this.y0 / sy); k * sy <= this.y1; k++) { const py = Math.round(this.Y(k * sy)) + 0.5; ctx.moveTo(0, py); ctx.lineTo(this.w, py); }
      ctx.stroke();
      ctx.strokeStyle = C.ink3;
      ctx.beginPath();
      if (this.y0 <= 0 && this.y1 >= 0) { const py = Math.round(this.Y(0)) + 0.5; ctx.moveTo(0, py); ctx.lineTo(this.w, py); }
      if (this.x0 <= 0 && this.x1 >= 0) { const px = Math.round(this.X(0)) + 0.5; ctx.moveTo(px, 0); ctx.lineTo(px, this.h); }
      ctx.stroke();
      ctx.fillStyle = C.ink3;
      ctx.font = '11px ' + C.mono;
      const ty = Math.min(Math.max(this.Y(0) + 14, 14), this.h - 4), tx = Math.min(Math.max(this.X(0) + 4, 4), this.w - 44);
      ctx.textAlign = 'center';
      for (let k = Math.ceil(this.x0 / sx); k * sx <= this.x1; k++) { if (k !== 0) ctx.fillText(fmt(k * sx, 3), this.X(k * sx), ty); }
      ctx.textAlign = 'left';
      for (let k = Math.ceil(this.y0 / sy); k * sy <= this.y1; k++) { if (k !== 0) ctx.fillText(fmt(k * sy, 3), tx, this.Y(k * sy) - 3); }
      ctx.restore();
    }
    plot(f, color, width) {
      const ctx = this.ctx, n = Math.ceil(this.w * 2), lim = Math.max(1e4, 10 * (Math.abs(this.y0) + Math.abs(this.y1)));
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = width || 2;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      let pen = false, prev = 0;
      for (let i = 0; i <= n; i++) {
        const x = this.x0 + (this.x1 - this.x0) * i / n;
        let y;
        try { y = f(x); } catch (e) { y = NaN; }
        if (!isFinite(y) || Math.abs(y) > lim) { pen = false; continue; }
        const px = this.X(x), py = this.Y(y);
        if (pen && Math.abs(py - prev) > this.h) pen = false;
        if (pen) ctx.lineTo(px, py); else ctx.moveTo(px, py);
        pen = true;
        prev = py;
      }
      ctx.stroke();
      ctx.restore();
    }
    fillArea(f, a, b, color, alpha) {
      const ctx = this.ctx, n = Math.max(2, Math.ceil(Math.abs(this.X(b) - this.X(a)))), span = this.y1 - this.y0;
      ctx.save();
      ctx.globalAlpha = alpha || 0.2;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(this.X(a), this.Y(0));
      for (let i = 0; i <= n; i++) {
        const x = a + (b - a) * i / n;
        let y;
        try { y = f(x); } catch (e) { y = 0; }
        if (!isFinite(y)) y = 0;
        y = Math.min(Math.max(y, this.y0 - span), this.y1 + span);
        ctx.lineTo(this.X(x), this.Y(y));
      }
      ctx.lineTo(this.X(b), this.Y(0));
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    drawLine(x1, y1, x2, y2, color, dashed, width) {
      const ctx = this.ctx;
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = width || 1.5;
      if (dashed) ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.moveTo(this.X(x1), this.Y(y1));
      ctx.lineTo(this.X(x2), this.Y(y2));
      ctx.stroke();
      ctx.restore();
    }
    vline(x, color, dashed) { this.drawLine(x, this.y0, x, this.y1, color, dashed !== false); }
    hline(y, color, dashed) { this.drawLine(this.x0, y, this.x1, y, color, dashed !== false); }
    drawPoint(x, y, color, r) {
      const ctx = this.ctx;
      ctx.save();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(this.X(x), this.Y(y), r || 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    label(x, y, text, color) {
      const ctx = this.ctx;
      ctx.save();
      ctx.fillStyle = color;
      ctx.font = '12px ' + C.mono;
      ctx.fillText(text, this.X(x) + 7, this.Y(y) - 7);
      ctx.restore();
    }
    reset() { this.clear(); this.view(-5, 5, -5, 5); this.drawAxes(); }
  }

  /* ---------- Résultats + MathJax ---------- */
  function typeset(el) {
    const MJ = window.MathJax;
    if (!MJ || !MJ.startup || !MJ.startup.promise) return;
    MJ.startup.promise = MJ.startup.promise
      .then(() => (MJ.typesetPromise ? MJ.typesetPromise([el]) : null))
      .catch(() => {});
  }
  function setRes(el, html, math) {
    const MJ = window.MathJax;
    if (MJ && MJ.typesetClear) { try { MJ.typesetClear([el]); } catch (e) { /* rien */ } }
    el.innerHTML = html;
    if (math) typeset(el);
  }
  function errMsg(e) {
    if (e instanceof SyntaxError) return 'Expression invalide : vérifie la syntaxe (ex. 2*x, x**2, sin(x)).';
    if (e instanceof ReferenceError) return 'Nom inconnu dans l\'expression (ex. écris Math.PI ou pi).';
    return 'Erreur : ' + (e && e.message ? e.message : e);
  }
  function fail(res, e, p) {
    setRes(res, '<p class="err">' + esc(errMsg(e)) + '</p>');
    if (p) p.reset();
  }

  let pAn, pDer, pAs, pDl, pCx, pInt;
  const plotters = [];
  function plotterFor(id) {
    const c = $(id);
    if (!c) return null;
    const p = new CanvasPlotter(c);
    plotters.push(p);
    return p;
  }

  /* 1. TVI + dichotomie */
  function runAnalyse() {
    const res = $('an-res');
    if (!res || !pAn) return;
    try {
      const f = MathCore.parseFunc(val('an-fx'));
      const a = MathCore.num(val('an-a')), b = MathCore.num(val('an-b')), lam = MathCore.num(val('an-lambda'));
      if (!(a < b)) throw new Error('il faut a < b.');
      const fa = f(a), fb = f(b);
      let html = '<p>f(a) = ' + fmt(fa) + '  ·  f(b) = ' + fmt(fb) + '</p>';
      let c = null;
      if (!isFinite(fa) || !isFinite(fb)) {
        html += '<p class="err">f n\'est pas définie en a ou en b.</p>';
      } else if ((fa - lam) * (fb - lam) > 0) {
        html += '<p class="err">λ n\'est pas compris entre f(a) et f(b) : le TVI ne permet pas de conclure.</p>';
      } else {
        c = MathCore.bisection((x) => f(x) - lam, a, b, 100);
        html += '<p>Si f est continue sur [a, b] (à vérifier !), le TVI garantit un c tel que f(c) = λ.</p>' +
          '<p><strong>c ≈ ' + fmt(c, 8) + '</strong>  (dichotomie, 100 itérations)</p>';
      }
      setRes(res, html);
      const pad = (b - a) * 0.3, x0 = a - pad, x1 = b + pad;
      pAn.view(x0, x1, ...autoY([f], x0, x1, [lam]));
      pAn.clear();
      pAn.drawAxes();
      pAn.vline(a, C.ink3);
      pAn.vline(b, C.ink3);
      pAn.hline(lam, C.alt);
      pAn.plot(f, C.accent);
      if (c !== null) pAn.drawPoint(c, lam, C.alt);
    } catch (e) { fail(res, e, pAn); }
  }

  /* 2. Dérivée + tangente */
  function runDerivee() {
    const res = $('der-res');
    if (!res || !pDer) return;
    try {
      const f = MathCore.parseFunc(val('der-fx'));
      const x0 = MathCore.num(val('der-x0'));
      const y0 = f(x0);
      if (!isFinite(y0)) throw new Error('f n\'est pas définie en x₀.');
      const m = MathCore.derivative(f, x0);
      const h = 1e-6, dl = (y0 - f(x0 - h)) / h, dr = (f(x0 + h) - y0) / h;
      let html = '<p>f(x₀) = ' + fmt(y0, 6) + '  ·  f\'(x₀) ≈ ' + fmt(m, 6) + '</p>';
      const derivable = isFinite(m) && isFinite(dl) && isFinite(dr) && Math.abs(dl - dr) <= 1e-3 * Math.max(1, Math.abs(m));
      if (!derivable) {
        html += '<p class="err">Dérivées à gauche (' + fmt(dl) + ') et à droite (' + fmt(dr) + ') différentes : f n\'est pas dérivable en x₀ (point anguleux).</p>';
      } else {
        html += '<p><strong>Tangente : y = ' + lineEq(round(m, 6), round(y0 - m * x0, 6)) + '</strong></p>';
      }
      setRes(res, html);
      const xa = x0 - 4, xb = x0 + 4;
      pDer.view(xa, xb, ...autoY([f], xa, xb, [y0]));
      pDer.clear();
      pDer.drawAxes();
      pDer.plot(f, C.accent);
      if (derivable) pDer.plot((x) => m * (x - x0) + y0, C.alt, 1.75);
      pDer.drawPoint(x0, y0, C.alt);
    } catch (e) { fail(res, e, pDer); }
  }

  /* 3. Asymptotes */
  function runAsym() {
    const res = $('as-res');
    if (!res || !pAs) return;
    try {
      const src = val('as-fx');
      const f = MathCore.parseFunc(src);
      const out = [], verts = [], lines = [];
      const m = src.match(/\/\s*[(]([^)]+)[)]/) || src.match(/\/\s*([A-Za-z_][\w.]*(?:\s*\*\*\s*\d+)?)/);
      if (m) {
        try {
          const den = MathCore.parseFunc(m[1]);
          MathCore.findRoots(den, -50, 50, 4000).forEach((r) => {
            r = round(r, 6);
            const big = Math.max(Math.abs(f(r - 1e-7)), Math.abs(f(r + 1e-7)));
            if (!isFinite(big) || big > 1e4) verts.push(r);
            else out.push('<p>x = ' + fmt(r) + ' annule le dénominateur mais f y a une limite finie (≈ ' + fmt(f(r + 1e-7)) + ') : pas d\'asymptote, prolongement par continuité possible.</p>');
          });
        } catch (e) { /* dénominateur non analysable */ }
      }
      verts.forEach((r) => out.unshift('<p><strong>Asymptote verticale : x = ' + fmt(r) + '</strong></p>'));
      [[1, '+∞'], [-1, '−∞']].forEach(([s, lbl]) => {
        const X = 1e5 * s, f1 = f(X), f2 = f(2 * X), f3 = f(3 * X);
        if (![f1, f2, f3].every((v) => isFinite(v))) {
          out.push('<p>En ' + lbl + ' : f n\'est pas définie ou explose trop vite, pas d\'asymptote détectée.</p>');
          return;
        }
        const a = (f2 - f1) / X, b = f1 - a * X;
        if (Math.abs(f3 - (a * 3 * X + b)) > 1e-3 * Math.max(1, Math.abs(b))) {
          out.push('<p>En ' + lbl + ' : pas d\'asymptote horizontale ni oblique.</p>');
          return;
        }
        const ar = round(a, 3), br = round(b, 3);
        if (ar === 0) out.push('<p><strong>En ' + lbl + ' : asymptote horizontale y = ' + fmt(br, 3) + '</strong></p>');
        else out.push('<p><strong>En ' + lbl + ' : asymptote oblique y = ' + lineEq(ar, br) + '</strong></p>');
        if (!lines.some((l) => l[0] === ar && l[1] === br)) lines.push([ar, br]);
      });
      if (!verts.length && !m) out.push('<p>Pas de dénominateur repéré (écris-le entre parenthèses) : asymptotes verticales non cherchées.</p>');
      setRes(res, out.join(''));
      const x0 = Math.min(-10, ...verts.map((v) => v - 5)), x1 = Math.max(10, ...verts.map((v) => v + 5));
      pAs.view(x0, x1, ...autoY([f], x0, x1));
      pAs.clear();
      pAs.drawAxes();
      lines.forEach(([a, b]) => pAs.drawLine(x0, a * x0 + b, x1, a * x1 + b, C.alt, true));
      verts.forEach((v) => pAs.vline(v, C.alt));
      pAs.plot(f, C.accent);
    } catch (e) { fail(res, e, pAs); }
  }

  /* 4. Développement limité (Mac Laurin) */
  const DENOMS = [1, 2, 3, 4, 5, 6, 8, 9, 10, 12, 15, 16, 18, 20, 24, 30, 40, 45, 48, 60, 72, 90, 120, 144, 180,
    240, 315, 360, 720, 945, 1440, 2520, 5040, 40320];
  function texCoef(v) {
    for (const q of DENOMS) {
      const p = Math.round(v * q);
      if (p >= 1 && p <= 5000 && Math.abs(v * q - p) < 1e-3) return q === 1 ? String(p) : '\\frac{' + p + '}{' + q + '}';
    }
    return fmtTeX(v, 5);
  }
  function taylorTeX(coefs) {
    let s = '';
    coefs.forEach((c, k) => {
      if (c === 0) return;
      let cs = texCoef(Math.abs(c));
      if (cs === '1' && k > 0) cs = '';
      const xs = k === 0 ? '' : k === 1 ? 'x' : 'x^{' + k + '}';
      s += (s ? (c < 0 ? ' - ' : ' + ') : (c < 0 ? '-' : '')) + cs + xs;
    });
    return s || '0';
  }
  function runTaylor() {
    const res = $('dl-res');
    if (!res || !pDl) return;
    try {
      const f = MathCore.parseFunc(val('dl-fx'));
      const n = Math.round(MathCore.num(val('dl-n')));
      if (!(n >= 0 && n <= 8)) throw new Error('choisis un ordre n entre 0 et 8.');
      if (!isFinite(f(0))) throw new Error('f doit être définie en 0 (développement de Mac Laurin).');
      const coefs = [];
      let fact = 1;
      for (let k = 0; k <= n; k++) {
        if (k > 0) fact *= k;
        let c = MathCore.nthDerivative(f, 0, k) / fact;
        if (Math.abs(c) < 1e-7) c = 0;
        coefs.push(c);
      }
      if (!coefs.every((c) => isFinite(c))) throw new Error('f ne semble pas assez dérivable en 0.');
      const P = (x) => coefs.reduce((s, c, k) => s + c * Math.pow(x, k), 0);
      setRes(res, '<p>\\(f(x) = ' + taylorTeX(coefs) + ' + o(x^{' + n + '})\\)</p>' +
        '<p>Coefficients \\(\\frac{f^{(k)}(0)}{k!}\\) estimés numériquement (différences finies) : vérifie avec le cours !</p>', true);
      pDl.view(-4, 4, ...autoY([f], -4, 4));
      pDl.clear();
      pDl.drawAxes();
      pDl.plot(f, C.accent);
      pDl.plot(P, C.alt, 1.75);
    } catch (e) { fail(res, e, pDl); }
  }

  /* 5. Complexes */
  function parseC(str) {
    const parts = String(str).split(',');
    if (parts.length !== 2) throw new Error('écris un complexe sous la forme « a, b » pour a + ib.');
    return new Complex(MathCore.num(parts[0]), MathCore.num(parts[1]));
  }
  function runComplex() {
    const res = $('cx-res');
    if (!res || !pCx) return;
    try {
      const z1 = parseC(val('cx-z1')), z2 = parseC(val('cx-z2'));
      const s = z1.add(z2), p = z1.mul(z2), r1 = z1.abs();
      const rows = [
        ['z₁ + z₂', fmtC(s)],
        ['z₁ − z₂', fmtC(z1.sub(z2))],
        ['z₁ × z₂', fmtC(p)],
        ['z₁ / z₂', z2.abs() === 0 ? 'indéfini (z₂ = 0)' : fmtC(z1.div(z2))],
        ['1 / z₁', r1 === 0 ? 'indéfini (z₁ = 0)' : fmtC(z1.inv())],
        ['conjugué de z₁', fmtC(z1.conj())],
        ['|z₁|', fmt(r1, 4)],
        ['arg z₁', r1 === 0 ? 'indéfini' : fmt(z1.arg(), 4) + ' rad (' + fmt(z1.arg() * 180 / Math.PI, 2) + '°)'],
        ['forme expo de z₁', r1 === 0 ? '0' : fmt(r1, 3) + ' · e^(i · ' + fmt(z1.arg(), 3) + ')']
      ];
      setRes(res, rows.map((r) => '<p><strong>' + r[0] + '</strong> = ' + r[1] + '</p>').join(''));
      const pts = [[z1, C.accent, 'z₁'], [z2, C.alt, 'z₂'], [s, C.ok, 'z₁+z₂'], [p, C.ink, 'z₁·z₂']];
      let R = 1;
      pts.forEach((q) => { R = Math.max(R, Math.abs(q[0].re), Math.abs(q[0].im)); });
      R *= 1.25;
      const ratio = pCx.w / pCx.h;
      pCx.view(-R * ratio, R * ratio, -R, R);
      pCx.clear();
      pCx.drawAxes();
      pts.forEach(([z, col, lbl]) => {
        pCx.drawLine(0, 0, z.re, z.im, col, false, 2);
        pCx.drawPoint(z.re, z.im, col);
        pCx.label(z.re, z.im, lbl, col);
      });
    } catch (e) { fail(res, e, pCx); }
  }

  /* 6. Polynômes & fractions rationnelles */
  function parseCoefs(str) {
    const arr = String(str).split(',').map((s) => s.trim()).filter((s) => s !== '').map((s) => MathCore.num(s));
    while (arr.length > 1 && arr[0] === 0) arr.shift();
    if (!arr.length) throw new Error('liste de coefficients vide.');
    return arr;
  }
  function polyTeX(P) {
    const n = P.length - 1;
    let s = '';
    P.forEach((c, i) => {
      const d = n - i;
      c = cleanNum(c);
      if (Math.abs(c) < 1e-12) return;
      let cs = fmtTeX(Math.abs(c), 4);
      if (cs === '1' && d > 0) cs = '';
      const xs = d === 0 ? '' : d === 1 ? 'x' : 'x^{' + d + '}';
      s += (s ? (c < 0 ? ' - ' : ' + ') : (c < 0 ? '-' : '')) + cs + xs;
    });
    return s || '0';
  }
  // Toutes les racines complexes (Durand-Kerner) : illustre D'Alembert-Gauss
  function polyRoots(P) {
    const n = P.length - 1;
    if (n < 1) return [];
    const c = P.map((v) => v / P[0]);
    const evalC = (z) => c.reduce((acc, v) => acc.mul(z).add(new Complex(v, 0)), new Complex(0, 0));
    let roots = [], z = new Complex(1, 0);
    const seed = new Complex(0.4, 0.9);
    for (let k = 0; k < n; k++) { roots.push(z); z = z.mul(seed); }
    for (let it = 0; it < 800; it++) {
      let delta = 0;
      roots = roots.map((r, i) => {
        let den = new Complex(1, 0);
        roots.forEach((q, j) => { if (j !== i) den = den.mul(r.sub(q)); });
        const step = evalC(r).div(den);
        delta = Math.max(delta, step.abs());
        return r.sub(step);
      });
      if (delta < 1e-14) break;
    }
    return roots.map((r) => new Complex(cleanNum(r.re), cleanNum(r.im))).sort((a, b) => a.re - b.re || a.im - b.im);
  }
  function polyDiv(P, Q) {
    const R = P.slice(), E = [], dq = Q.length - 1;
    while (R.length - 1 >= dq) {
      const k = R[0] / Q[0];
      E.push(k);
      for (let i = 0; i < Q.length; i++) R[i] -= k * Q[i];
      R.shift();
    }
    const clean = R.map((v) => (Math.abs(v) < 1e-10 ? 0 : v));
    while (clean.length > 1 && clean[0] === 0) clean.shift();
    return { E: E.length ? E : [0], R: clean.length ? clean : [0] };
  }
  function listRoots(arr) {
    return arr.length ? arr.map((z) => fmtC(z, 4)).join(' ; ') : 'aucune';
  }
  function runPoly() {
    const res = $('poly-res');
    if (!res) return;
    try {
      const P = parseCoefs(val('poly-num')), Q = parseCoefs(val('poly-den'));
      if (Q.length === 1 && Q[0] === 0) throw new Error('le dénominateur Q ne peut pas être nul.');
      const zP = polyRoots(P), zQ = polyRoots(Q);
      const common = zP.filter((r) => zQ.some((q) => r.sub(q).abs() < 1e-5));
      let html = '<p>\\(F(x) = \\dfrac{' + polyTeX(P) + '}{' + polyTeX(Q) + '}\\)</p>';
      html += '<p><strong>Zéros</strong> (racines de P dans ℂ) : ' + listRoots(zP) + '</p>';
      html += '<p><strong>Pôles</strong> (racines de Q dans ℂ) : ' + listRoots(zQ) + '</p>';
      if (common.length) html += '<p class="err">Racine commune à P et Q (' + listRoots(common) + ') : F n\'est pas irréductible, simplifie avant de décomposer.</p>';
      else html += '<p>Pas de racine commune : F est irréductible.</p>';
      if (P.length >= Q.length) {
        const d = polyDiv(P, Q);
        const exact = d.R.length === 1 && d.R[0] === 0;
        html += '<p><strong>Division euclidienne</strong> : \\(E(x) = ' + polyTeX(d.E) + '\\), \\(R(x) = ' + polyTeX(d.R) + '\\)</p>';
        html += exact
          ? '<p>Division exacte : \\(F(x) = ' + polyTeX(d.E) + '\\)</p>'
          : '<p>\\(F(x) = ' + polyTeX(d.E) + ' + \\dfrac{' + polyTeX(d.R) + '}{' + polyTeX(Q) + '}\\)</p>';
      } else {
        html += '<p>deg P &lt; deg Q : partie entière nulle, on décompose directement en éléments simples.</p>';
      }
      setRes(res, html, true);
    } catch (e) { fail(res, e); }
  }

  /* 7. Intégrale (point milieu) */
  function runIntegral() {
    const res = $('int-res');
    if (!res || !pInt) return;
    try {
      const f = MathCore.parseFunc(val('int-fx'));
      let a = MathCore.num(val('int-a')), b = MathCore.num(val('int-b'));
      let improper = false;
      if (a === -Infinity || a < -1e5) { a = -1000; improper = true; }
      if (b === Infinity || b > 1e5) { b = 1000; improper = true; }
      if (a === Infinity || b === -Infinity) throw new Error('bornes incohérentes.');
      const I = MathCore.integral(f, a, b, 5000);
      if (!isFinite(I)) throw new Error('valeur infinie ou f non définie sur l\'intervalle.');
      let html = '<p><strong>∫ f(x) dx de ' + fmt(a) + ' à ' + fmt(b) + ' ≈ ' + fmt(I, 6) + '</strong>  (point milieu, 5000 pas)</p>';
      if (improper) html += '<p class="err">Intégrale généralisée : borne infinie remplacée par ±1000. Si la valeur se stabilise quand la borne grandit, elle converge.</p>';
      setRes(res, html);
      const lo = Math.min(a, b), hi = Math.max(a, b), pad = (hi - lo) * 0.15 || 1;
      pInt.view(lo - pad, hi + pad, ...autoY([f], lo - pad, hi + pad));
      pInt.clear();
      pInt.drawAxes();
      pInt.fillArea(f, lo, hi, C.accent, 0.2);
      pInt.vline(lo, C.ink3);
      pInt.vline(hi, C.ink3);
      pInt.plot(f, C.accent);
    } catch (e) { fail(res, e, pInt); }
  }

  /* ---------- Init ---------- */
  const runners = [];
  function bind(ids, run) {
    let t;
    ids.forEach((id) => {
      const el = $(id);
      if (!el) return;
      el.addEventListener('input', () => { clearTimeout(t); t = setTimeout(run, 300); });
      el.addEventListener('change', () => { clearTimeout(t); run(); });
    });
    runners.push(run);
  }
  const runAll = () => runners.forEach((r) => r());

  function init() {
    readColors();
    pAn = plotterFor('an-canvas');
    pDer = plotterFor('der-canvas');
    pAs = plotterFor('as-canvas');
    pDl = plotterFor('dl-canvas');
    pCx = plotterFor('cx-canvas');
    pInt = plotterFor('int-canvas');

    bind(['an-fx', 'an-a', 'an-b', 'an-lambda'], runAnalyse);
    bind(['der-fx', 'der-x0'], runDerivee);
    bind(['as-fx'], runAsym);
    bind(['dl-fx', 'dl-n'], runTaylor);
    bind(['cx-z1', 'cx-z2'], runComplex);
    bind(['poly-num', 'poly-den'], runPoly);
    bind(['int-fx', 'int-a', 'int-b'], runIntegral);
    runAll();

    // Changement de thème : on relit les couleurs et on redessine
    new MutationObserver(() => { readColors(); runAll(); })
      .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    // Redimensionnement (debounce)
    let t, lastW = window.innerWidth;
    window.addEventListener('resize', () => {
      clearTimeout(t);
      t = setTimeout(() => {
        if (window.innerWidth === lastW) return;
        lastW = window.innerWidth;
        plotters.forEach((p) => p.resize());
        runAll();
      }, 150);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
