import { createDevice, createId, simulate, dhcp } from './engine.js';
import { runCommand, cliPrompt } from './cli.js';
import { renderInspector } from './inspector.js';
import { validateProject } from './import.js';
import { labs, makeLab } from './labs.js';
import { icon, fillIcons, deviceArt, deviceTypes } from './graphics.js';

const $ = (id) => document.getElementById(id);
const storeKey = 'cisco-packhess-tracer.project.v1';
const deviceDragType = 'application/x-cisco-packhess-tracer-device';
const stage = $('stage'),
  scene = $('scene'),
  wireLayer = $('wires'),
  dialog = $('dialog'),
  dialogBody = $('dialog-body');
const state = {
  tool: 'select',
  wireType: 'ethernet',
  first: null,
  selected: null,
  mode: 'real',
  view: 'events',
  collapsed: false,
  scale: 1,
  tx: 0,
  ty: 0,
};
const undo = [],
  redo = [],
  journal = [],
  activeSteps = [],
  sessions = new Map();
let project,
  checkpoint,
  termId = null,
  gesture = null,
  toastTimer,
  packetTimer,
  animation,
  token = 0,
  pendingTest = null;
let testTarget = '',
  autoFit = true,
  saveOK = true,
  priorFocus;
try {
  const previous = localStorage.getItem(storeKey) ?? localStorage.getItem('netlab.project.v1');
  if (previous) project = validateProject(JSON.parse(previous));
} catch {
  toast('La sauvegarde locale est illisible. Un atelier de campus a été ouvert.');
}
project ??= makeLab();
checkpoint = JSON.stringify(project);
const device = (id) => project.devices.find((d) => d.id === id);
function el(tag, cls, value) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (value !== undefined) e.textContent = value;
  return e;
}
function btn(label, action, cls = 'secondary', symbol) {
  const b = el('button', cls);
  b.type = 'button';
  if (symbol) b.append(icon(symbol));
  b.append(document.createTextNode(label));
  b.onclick = action;
  return b;
}
function toast(msg) {
  const e = $('toast');
  e.textContent = msg;
  e.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (e.hidden = true), 3500);
}
function persist() {
  try {
    localStorage.setItem(storeKey, JSON.stringify(project));
    saveOK = true;
  } catch {
    saveOK = false;
  }
  const save = $('save-state');
  save.lastElementChild.textContent = saveOK ? 'Enregistré' : 'Sauvegarde indisponible';
  save.title = saveOK
    ? 'Projet enregistré dans ce navigateur'
    : 'Stockage local indisponible. Exporte ton projet en JSON.';
  if (!saveOK) toast(save.title);
}
function remember(msg, { graph = true, inspect = false } = {}) {
  const next = JSON.stringify(project);
  if (next !== checkpoint) {
    stopPlayback();
    hideResult();
    undo.push(checkpoint);
    if (undo.length > 32) undo.shift();
    redo.length = 0;
    checkpoint = next;
    persist();
  }
  if (msg) addLog('Atelier', msg);
  if (graph) renderGraph();
  else updateCounts();
  if (inspect) openInspector(state.selected);
  buttonStates();
}
function silentSave() {
  checkpoint = JSON.stringify(project);
  persist();
}
function stopPlayback() {
  activeSteps.length = 0;
  pendingTest = null;
  token++;
  clearTimeout(packetTimer);
  animation?.cancel();
  $('packet').hidden = true;
  updateStep();
}
function travel(from, to) {
  const a = device(from),
    b = device(to);
  if (!a || !b) return;
  const e = $('packet');
  animation?.cancel();
  clearTimeout(packetTimer);
  e.hidden = false;
  e.style.left = b.x + 'px';
  e.style.top = b.y + 'px';
  const low = matchMedia('(prefers-reduced-motion: reduce)').matches;
  animation = e.animate(
    [
      { transform: 'translate(-50%,-50%) translate(' + (a.x - b.x) + 'px,' + (a.y - b.y) + 'px)' },
      { transform: 'translate(-50%,-50%)' },
    ],
    { duration: low ? 0 : 210, easing: 'ease-in-out' },
  );
  packetTimer = setTimeout(() => (e.hidden = true), 370);
}
function addLog(protocol, msg, bad = false) {
  journal.push({
    time: new Date().toLocaleTimeString('fr-FR', { hour12: false }),
    protocol: String(protocol),
    msg: String(msg),
    bad,
  });
  if (journal.length > 400) journal.shift();
  renderEvents();
}
function renderEvents() {
  const body = $('event-rows');
  body.replaceChildren();
  for (const e of journal.slice(-100).reverse()) {
    const tr = el('tr');
    tr.append(el('td', '', e.time));
    const td = el('td');
    td.append(
      el(
        'span',
        'proto' +
          (e.bad ? ' alert' : /^(ICMP|TCP|UDP|HTTP|DNS|NDP)/i.test(e.protocol) ? ' diagnostic' : ''),
        e.protocol,
      ),
    );
    tr.append(td, el('td', '', e.msg));
    body.append(tr);
  }
  $('event-count').textContent = String(journal.length);
  $('no-events').hidden = !!journal.length;
}
function checkpointTravel(direction) {
  const list = direction === 'undo' ? undo : redo,
    other = direction === 'undo' ? redo : undo;
  if (!list.length) return;
  other.push(checkpoint);
  project = JSON.parse(list.pop());
  silentSave();
  stopPlayback();
  hideResult();
  clearSelection();
  sessions.clear();
  setTool('select');
  renderGraph();
  if (autoFit) fit();
  if (state.view === 'terminal') renderTerminal();
  addLog('Atelier', direction === 'undo' ? 'Modification annulée.' : 'Modification rétablie.');
  buttonStates();
}
function buttonStates() {
  $('undo').disabled = !undo.length;
  $('redo').disabled = !redo.length;
  $('send-packet').disabled = !project.devices.length;
}
function updateCounts() {
  $('project-title').textContent = project.name;
  document.title = project.name + ' · Cisco Packhess Tracer';
  $('device-count').textContent =
    project.devices.length + ' équipement' + (project.devices.length === 1 ? '' : 's');
  $('link-count').textContent =
    project.links.length + ' liaison' + (project.links.length === 1 ? '' : 's');
  $('empty-canvas').hidden = !!project.devices.length;
  buttonStates();
}
function fillPalette() {
  const list = $('device-list'),
    q = $('device-search').value.toLocaleLowerCase('fr');
  list.replaceChildren();
  for (const group of ['Infrastructure', 'Terminaux']) {
    const matches = Object.entries(deviceTypes).filter(
      ([k, v]) =>
        v.group === group && [k, v.label, v.desc].some((s) => s.toLocaleLowerCase('fr').includes(q)),
    );
    if (!matches.length) continue;
    list.append(el('h3', '', group));
    for (const [type, meta] of matches) {
      const b = btn('', () => addDevice(type), 'device-item');
      b.draggable = true;
      b.title = 'Ajouter · ' + meta.label;
      b.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData(deviceDragType, type);
        e.dataTransfer.effectAllowed = 'copy';
      });
      const words = el('span');
      words.append(el('strong', '', meta.label), el('small', '', meta.desc));
      b.replaceChildren(deviceArt(type), words);
      list.append(b);
    }
  }
  if (!list.children.length) list.append(el('small', '', 'Aucun équipement trouvé.'));
}
function viewPoint(x, y) {
  const r = stage.getBoundingClientRect();
  return { x: (x - r.left - state.tx) / state.scale, y: (y - r.top - state.ty) / state.scale };
}
function updateTransform() {
  scene.style.transform = 'translate(' + state.tx + 'px,' + state.ty + 'px) scale(' + state.scale + ')';
  scene.style.setProperty('--label-boost', Math.max(1, Math.min(2.5, 0.84 / state.scale)));
  $('zoom-label').textContent = Math.round(state.scale * 100) + ' %';
  stage.style.backgroundPosition = state.tx + 'px ' + state.ty + 'px';
  stage.style.backgroundSize = 20 * state.scale + 'px ' + 20 * state.scale + 'px';
}
function fit() {
  autoFit = true;
  const w = stage.clientWidth,
    h = stage.clientHeight;
  if (!w || !h) return;
  const xs = project.devices.map((d) => d.x),
    ys = project.devices.map((d) => d.y);
  const xmin = xs.length ? Math.min(...xs) - 63 : 100,
    xmax = xs.length ? Math.max(...xs) + 63 : 900,
    ymin = ys.length ? Math.min(...ys) - 34 : 30,
    ymax = ys.length ? Math.max(...ys) + 62 : 415;
  const bar = w < 600 ? 46 : 37,
    foot = w < 600 ? 32 : 20;
  state.scale = Math.max(
    0.12,
    Math.min((w - (w < 600 ? 20 : 76)) / (xmax - xmin), (h - bar - foot) / (ymax - ymin), 1.65),
  );
  state.tx = (w - (xmax + xmin) * state.scale) / 2;
  state.ty = bar + (h - bar - foot - (ymax - ymin) * state.scale) / 2 - ymin * state.scale;
  updateTransform();
}
function zoom(factor, cx = stage.clientWidth / 2, cy = stage.clientHeight / 2) {
  autoFit = false;
  const old = state.scale;
  state.scale = Math.max(0.1, Math.min(3, old * factor));
  state.tx = cx - ((cx - state.tx) * state.scale) / old;
  state.ty = cy - ((cy - state.ty) * state.scale) / old;
  updateTransform();
}
function addDevice(type, pos) {
  if (!Object.hasOwn(deviceTypes, type)) return;
  if (project.devices.length >= 256) {
    toast('Le projet contient déjà 256 équipements.');
    return;
  }
  const meta = deviceTypes[type];
  let n = 1;
  while (project.devices.some((d) => d.name === meta.prefix + '-' + n)) n++;
  if (!pos) {
    pos = {
      x: (stage.clientWidth * 0.47 - state.tx) / state.scale,
      y: (stage.clientHeight * 0.47 - state.ty) / state.scale,
    };
    let i = 0;
    while (
      i < 60 &&
      project.devices.some((d) => Math.abs(d.x - pos.x) < 102 && Math.abs(d.y - pos.y) < 74)
    ) {
      i++;
      pos.x += i % 6 === 0 ? -275 : 55;
      pos.y += i % 6 === 0 ? 32 : 8;
    }
  }
  const d = createDevice(type, meta.prefix + '-' + n, Math.round(pos.x), Math.round(pos.y));
  project.devices.push(d);
  setTool('select');
  $('palette').classList.remove('open');
  remember(d.name + ' ajouté au plan.');
  openInspector(d.id);
  return d;
}
function setTool(tool, wireType = 'ethernet') {
  state.tool = tool;
  state.wireType = wireType;
  state.first = null;
  stage.classList.toggle('hand', tool === 'hand');
  stage.classList.toggle('linking', tool === 'link');
  for (const [id, t] of [
    ['select-tool', 'select'],
    ['hand-tool', 'hand'],
    ['link-tool', 'link'],
  ])
    $(id).setAttribute('aria-pressed', String(t === tool));
  document
    .querySelectorAll('[data-cable]')
    .forEach((b) => b.classList.toggle('chosen', tool === 'link' && b.dataset.cable === wireType));
  if (tool !== 'select') clearSelection();
  updateInstruction();
  highlight();
}
function updateInstruction() {
  const e = $('instruction');
  e.hidden = state.tool !== 'link';
  if (!e.hidden)
    e.textContent = state.first
      ? 'Choisis le second équipement. Échap pour annuler.'
      : 'Choisis le premier équipement à relier.';
}
function highlight() {
  document.querySelectorAll('.node').forEach((n) => {
    n.classList.toggle('selected', n.dataset.id === state.selected);
    n.classList.toggle('pending', n.dataset.id === state.first);
    n.setAttribute('aria-pressed', String(n.dataset.id === state.selected));
  });
}
function clearSelection() {
  state.selected = null;
  $('inspector').hidden = true;
  $('inspector').replaceChildren();
  highlight();
}
function openInspector(id) {
  const d = device(id);
  if (!d) {
    clearSelection();
    return;
  }
  state.selected = id;
  highlight();
  const panel = $('inspector');
  panel.hidden = false;
  renderInspector(panel, project, id, {
    onChange: (msg) => remember(msg),
    onClose: clearSelection,
    onDelete: removeDevice,
    onTerminal: showTerminal,
    onTest: openTest,
  });
}
const svgns = 'http://www.w3.org/2000/svg';
function svg(name, attrs) {
  const n = document.createElementNS(svgns, name);
  for (const [key, v] of Object.entries(attrs)) n.setAttribute(key, v);
  return n;
}
function linkActive(link, a, b) {
  const pa = a.ports.find((p) => p.name === link.a.port),
    pb = b.ports.find((p) => p.name === link.b.port);
  return (
    !!pa?.up &&
    !!pb?.up &&
    (link.type !== 'wifi' ||
      (a.wireless?.ssid && a.wireless?.ssid === b.wireless?.ssid && a.wireless?.key === b.wireless?.key))
  );
}
function drawWires() {
  wireLayer.replaceChildren();
  for (const link of project.links) {
    const a = device(link.a.device),
      b = device(link.b.device);
    if (!a || !b) continue;
    let dx = b.x - a.x,
      dy = b.y - a.y;
    const length = Math.hypot(dx, dy) || 1;
    dx /= length;
    dy /= length;
    const x1 = a.x + dx * 32,
      y1 = a.y + dy * 14,
      x2 = b.x - dx * 32,
      y2 = b.y - dy * 14,
      active = linkActive(link, a, b);
    const g = svg('g', {
      class: 'wire-group',
      tabindex: 0,
      role: 'button',
      'aria-label': 'Liaison ' + a.name + ' ' + link.a.port + ' vers ' + b.name + ' ' + link.b.port,
    });
    const path = 'M ' + x1 + ' ' + y1 + ' L ' + x2 + ' ' + y2;
    const title = svg('title', {});
    title.textContent = a.name + ' ' + link.a.port + ' ↔ ' + b.name + ' ' + link.b.port;
    g.append(
      title,
      svg('path', {
        d: path,
        class: 'wire' + (link.type === 'wifi' ? ' wifi' : '') + (active ? '' : ' off'),
      }),
      svg('path', { d: path, class: 'wire-hit' }),
    );
    for (const [x, y] of [
      [x1, y1],
      [x2, y2],
    ])
      g.append(
        svg('circle', {
          cx: x,
          cy: y,
          r: 3.1,
          fill: active ? '#42997f' : '#b26e68',
          stroke: '#f3f6f4',
          'stroke-width': 1,
        }),
      );
    if ((a.type === 'router' || b.type === 'router') && length > 120) {
      const text = link[a.type === 'router' ? 'a' : 'b'].port;
      let ratio = a.type === 'router' ? 0.39 : 0.61;
      const x = x1 + (x2 - x1) * ratio,
        y = y1 + (y2 - y1) * ratio;
      const badge = svg('g', { 'pointer-events': 'none' });
      badge.append(
        svg('rect', {
          x: x - 20,
          y: y - 8,
          width: 40,
          height: 15,
          rx: 4,
          fill: '#eef4ee',
          stroke: '#c9d9cf',
          'stroke-width': 0.8,
        }),
      );
      const label = svg('text', {
        x,
        y: y + 2.7,
        'text-anchor': 'middle',
        fill: '#3b6259',
        'font-family': 'Consolas, monospace',
        'font-size': 9,
      });
      label.textContent = text;
      badge.append(label);
      g.append(badge);
    }
    const open = () => {
      if (state.tool !== 'hand') linkDetails(link);
    };
    g.addEventListener('click', open);
    g.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        open();
      }
    });
    wireLayer.append(g);
  }
}
function drawNodes() {
  const layer = $('nodes');
  layer.replaceChildren();
  for (const d of project.devices) {
    const n = el('button', 'node');
    n.type = 'button';
    n.dataset.id = d.id;
    n.style.left = d.x + 'px';
    n.style.top = d.y + 'px';
    n.setAttribute('aria-label', d.name + ', ' + deviceTypes[d.type].label + ', configurer');
    const addr = d.ports.find((p) => p.ip || p.ipv6);
    const hint = ['pc', 'server', 'laptop'].includes(d.type)
      ? addr?.ip || addr?.ipv6 || 'Sans adresse IP'
      : d.type === 'router'
        ? 'Routeur'
        : d.type === 'switch'
          ? 'Commutateur'
          : d.wireless?.ssid || 'Wi-Fi';
    n.append(deviceArt(d.type), el('strong', '', d.name), el('small', '', hint));
    n.addEventListener('click', (e) => {
      if (e.detail === 0) activate(d.id);
    });
    layer.append(n);
  }
  highlight();
}
function renderGraph() {
  drawWires();
  drawNodes();
  updateCounts();
}
function activate(id) {
  if (state.tool === 'link') {
    if (!state.first) {
      state.first = id;
      highlight();
      updateInstruction();
    } else if (state.first !== id) {
      connectDialog(state.first, id);
    } else toast('Choisis un autre équipement.');
    return;
  }
  if (state.tool === 'select') openInspector(id);
}
stage.addEventListener('pointerdown', (e) => {
  if (e.button !== 0 && e.button !== 1) return;
  if (
    e.target.closest(
      '#inspector,.canvas-tools,.zoom-tools,.test-btn,.result-bar,#empty-canvas,.wire-group',
    )
  )
    return;
  const n = e.target.closest('.node'),
    d = n && device(n.dataset.id);
  gesture = {
    pointer: e.pointerId,
    x: e.clientX,
    y: e.clientY,
    tx: state.tx,
    ty: state.ty,
    d: d?.id,
    ox: d?.x,
    oy: d?.y,
    pan: state.tool === 'hand' || !d || e.button === 1,
    moved: false,
  };
  stage.setPointerCapture(e.pointerId);
});
stage.addEventListener('pointermove', (e) => {
  const g = gesture;
  if (!g || g.pointer !== e.pointerId) return;
  const dx = e.clientX - g.x,
    dy = e.clientY - g.y;
  if (!g.moved && Math.hypot(dx, dy) < 4) return;
  g.moved = true;
  if (g.pan) {
    autoFit = false;
    state.tx = g.tx + dx;
    state.ty = g.ty + dy;
    updateTransform();
    stage.classList.add('dragging');
  } else if (state.tool === 'select') {
    const d = device(g.d);
    if (!d) return;
    autoFit = false;
    d.x = Math.round(g.ox + dx / state.scale);
    d.y = Math.round(g.oy + dy / state.scale);
    const n = [...$('nodes').children].find((i) => i.dataset.id === d.id);
    n.style.left = d.x + 'px';
    n.style.top = d.y + 'px';
    drawWires();
    stage.classList.add('dragging');
  }
});
function finishGesture(e) {
  const g = gesture;
  if (!g || g.pointer !== e.pointerId) return;
  gesture = null;
  stage.classList.remove('dragging');
  if (stage.hasPointerCapture(e.pointerId)) stage.releasePointerCapture(e.pointerId);
  if (!g.moved && e.type !== 'pointercancel') {
    if (g.d) activate(g.d);
    else clearSelection();
  } else if (!g.pan && g.moved && state.tool === 'select') remember('', { graph: false });
}
stage.addEventListener('pointerup', finishGesture);
stage.addEventListener('pointercancel', finishGesture);
stage.addEventListener(
  'wheel',
  (e) => {
    if (e.target.closest('#inspector')) return;
    e.preventDefault();
    const r = stage.getBoundingClientRect();
    zoom(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX - r.left, e.clientY - r.top);
  },
  { passive: false },
);
stage.addEventListener('dragover', (e) => {
  if (e.dataTransfer.types.includes(deviceDragType)) e.preventDefault();
});
stage.addEventListener('drop', (e) => {
  const type = e.dataTransfer.getData(deviceDragType);
  if (type) {
    e.preventDefault();
    addDevice(type, viewPoint(e.clientX, e.clientY));
  }
});
function modal(title) {
  if (!dialog.open) priorFocus = document.activeElement;
  dialogBody.replaceChildren();
  $('dialog-title').textContent = title;
  closeMenu();
  if (!dialog.open) dialog.showModal();
  return dialogBody;
}
function closeDialog() {
  dialog.close();
}
dialog.addEventListener('close', () => {
  if (priorFocus?.isConnected) priorFocus.focus({ preventScroll: true });
});
$('close-dialog').onclick = closeDialog;
dialog.addEventListener('click', (e) => {
  if (e.target === dialog) {
    const r = dialog.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)
      closeDialog();
  }
});
function form(parent) {
  const f = el('form');
  parent.append(f);
  return f;
}
function field(f, label, input) {
  const l = el('label', '', label);
  l.append(input);
  f.append(l);
  return input;
}
function select(options) {
  const s = el('select');
  for (const [v, t] of options) {
    const o = el('option', '', t);
    o.value = v;
    s.append(o);
  }
  return s;
}
function actions(f, label, doIt) {
  const row = el('div', 'dialog-actions'),
    submit = el('button', 'primary', label);
  submit.type = 'submit';
  row.append(btn('Annuler', closeDialog), submit);
  f.append(row);
  f.onsubmit = (e) => {
    e.preventDefault();
    doIt();
  };
}
function freePorts(d, wifi) {
  return d.ports.filter((p) => {
    if (p.parent || p.management || /^wlan/i.test(p.name) !== wifi) return false;
    if (wifi && d.type === 'ap') return true;
    return !project.links.some((l) => [l.a, l.b].some((e) => e.device === d.id && e.port === p.name));
  });
}
function connectDialog(aId, bId) {
  const a = device(aId),
    b = device(bId),
    wifi = state.wireType === 'wifi';
  const body = modal(wifi ? 'Associer en Wi-Fi' : 'Câbler deux équipements'),
    f = form(body);
  const done = () => {
    closeDialog();
    state.first = null;
    highlight();
    updateInstruction();
  };
  if (wifi && ![a.type, b.type].sort().every((t, i) => t === ['ap', 'laptop'][i])) {
    body.append(
      el('p', '', 'Une association Wi-Fi relie un portable à un point d’accès.'),
      btn('Revenir au plan', done),
    );
    return;
  }
  const aa = freePorts(a, wifi),
    bb = freePorts(b, wifi);
  if (!aa.length || !bb.length) {
    body.append(
      el('p', '', 'Aucun port compatible libre sur ' + (!aa.length ? a.name : b.name) + '.'),
      btn('Revenir au plan', done),
    );
    return;
  }
  const s1 = field(f, a.name, select(aa.map((p) => [p.name, p.name]))),
    s2 = field(f, b.name, select(bb.map((p) => [p.name, p.name])));
  if (wifi)
    f.append(
      el(
        'p',
        '',
        'L’association fonctionne lorsque le SSID et la clé des deux équipements correspondent.',
      ),
    );
  actions(f, wifi ? 'Associer' : 'Brancher le câble', () => {
    project.links.push({
      id: createId(),
      type: state.wireType,
      a: { device: a.id, port: s1.value },
      b: { device: b.id, port: s2.value },
    });
    remember(a.name + ' ' + s1.value + ' ↔ ' + b.name + ' ' + s2.value + '.');
    closeDialog();
    setTool('select');
  });
}
function linkDetails(l) {
  const body = modal('Détails de la liaison'),
    a = device(l.a.device),
    b = device(l.b.device);
  body.append(
    el('p', '', a.name + ' · ' + l.a.port + ' ↔ ' + b.name + ' · ' + l.b.port),
    el(
      'p',
      '',
      (l.type === 'wifi' ? 'Wi-Fi' : 'Ethernet') +
        ' · ' +
        (linkActive(l, a, b) ? 'Liaison active' : 'Liaison inactive'),
    ),
    btn('Retirer la liaison', () => {
      project.links = project.links.filter((v) => v.id !== l.id);
      stopPlayback();
      remember('Liaison entre ' + a.name + ' et ' + b.name + ' retirée.');
      closeDialog();
    }),
  );
}
function removeDevice(id) {
  const d = device(id);
  if (!d) return;
  const b = modal('Supprimer ' + d.name + ' ?');
  b.append(
    el(
      'p',
      '',
      'Les liaisons de cet équipement seront retirées. Tu pourras annuler cette modification.',
    ),
  );
  const f = form(b);
  actions(f, 'Supprimer', () => {
    project.links = project.links.filter((l) => l.a.device !== id && l.b.device !== id);
    project.devices = project.devices.filter((v) => v.id !== id);
    clearSelection();
    stopPlayback();
    sessions.delete(id);
    remember(d.name + ' retiré du plan.');
    if (state.view === 'terminal') renderTerminal();
    closeDialog();
  });
}
function menuItem(label, action, sym) {
  const b = btn(
    label,
    () => {
      closeMenu();
      action();
    },
    '',
    sym,
  );
  b.setAttribute('role', 'menuitem');
  return b;
}
function closeMenu() {
  $('menu').hidden = true;
  $('project-menu').setAttribute('aria-expanded', 'false');
}
function projectMenu() {
  const m = $('menu');
  if (!m.hidden) {
    closeMenu();
    return;
  }
  m.replaceChildren(
    menuItem('Nouveau projet', () => replaceLab('empty'), 'plus'),
    menuItem('Renommer le projet', renameProject, 'pencil'),
    menuItem('Exporter en JSON', exportProject, 'download'),
    menuItem('Importer un projet', () => $('import-input').click(), 'upload'),
  );
  m.hidden = false;
  $('project-menu').setAttribute('aria-expanded', 'true');
  m.firstElementChild.focus();
}
function renameProject() {
  const b = modal('Renommer le projet'),
    f = form(b),
    i = field(f, 'Nom du projet', el('input'));
  i.value = project.name;
  i.required = true;
  i.maxLength = 80;
  actions(f, 'Enregistrer', () => {
    if (!i.value.trim()) return;
    project.name = i.value.trim();
    remember('Projet renommé.');
    closeDialog();
  });
  i.select();
}
function exportProject() {
  const url = URL.createObjectURL(
      new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' }),
    ),
    a = el('a');
  a.href = url;
  a.download =
    (project.name
      .normalize('NFKD')
      .replace(/[^a-zA-Z0-9_-]+/g, '-')
      .replace(/^-|-$/g, '') || 'reseau') + '.cisco-packhess-tracer.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('Projet exporté au format JSON.');
}
function loadProject(p) {
  stopPlayback();
  clearSelection();
  sessions.clear();
  termId = null;
  project = p;
  journal.length = 0;
  testTarget = '';
  setTool('select');
  showView('events');
  remember('Topologie chargée · ' + project.name + '.');
  fit();
  if (dialog.open) closeDialog();
}
function confirmLoad(p) {
  const b = modal('Ouvrir « ' + p.name + ' » ?');
  b.append(
    el('p', '', 'Ce projet remplacera le plan ouvert. Tu peux exporter ton travail avant de continuer.'),
  );
  const f = form(b);
  f.append(btn('Exporter le projet actuel', exportProject));
  actions(f, 'Ouvrir le projet', () => loadProject(p));
}
function replaceLab(key) {
  confirmLoad(makeLab(key));
}
function showLabs() {
  const b = modal('Laboratoires');
  for (const l of labs) {
    const card = btn('', () => replaceLab(l.id), 'lab-card'),
      words = el('span');
    words.append(el('strong', '', l.name), el('small', '', l.info));
    card.replaceChildren(icon(l.icon), words);
    b.append(card);
  }
}
$('import-input').onchange = async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    if (file.size > 5 * 1024 * 1024) throw Error('Le fichier dépasse 5 Mo.');
    const p = validateProject(JSON.parse(await file.text()));
    confirmLoad(p);
  } catch (err) {
    const b = modal('Import impossible');
    b.append(
      el(
        'p',
        'form-error',
        err instanceof SyntaxError ? 'Le fichier ne contient pas un projet JSON valide.' : err.message,
      ),
      btn('Fermer', closeDialog),
    );
  }
};

function note(parent, text) {
  parent.append(el('p', '', text));
}
function showHelp() {
  const b = modal('Prendre en main Cisco Packhess Tracer');
  note(
    b,
    'Le laboratoire fonctionne dans ton navigateur. Les appareils et le trafic sont simulés sur le plan.',
  );
  const list = el('ol', 'help-list');
  for (const item of [
    'Clique sur un équipement ou glisse-le depuis la palette. Clique ensuite sur son icône pour configurer ses interfaces et ses services.',
    'Pour câbler le réseau, choisis Câble Ethernet, clique sur les deux équipements, puis sélectionne leurs ports.',
    'Dans le campus, lance un ping de PC-Étudiant vers 192.168.20.10. Essaie ensuite HTTP vers intranet.campus pour observer DNS, TCP et la requête web.',
    'Choisis Pas à pas avant le test pour parcourir les événements un par un. Clique sur le résultat pour revoir la trace complète.',
    'Dans la console d’un routeur, saisis enable puis show ip route. Le caractère ? affiche les commandes du mode courant.',
    'Le menu Projet permet d’importer ou d’exporter une maquette Cisco Packhess Tracer au format JSON. Les maquettes sont enregistrées automatiquement dans ce navigateur.',
  ])
    list.append(el('li', '', item));
  b.append(list);
  note(
    b,
    'Raccourcis du plan : V pour sélectionner, H pour déplacer la vue, C pour câbler, Échap pour annuler et Ctrl+Z pour revenir en arrière.',
  );
  note(
    b,
    'Cisco Packhess Tracer est un simulateur pédagogique indépendant. Les fichiers Cisco Packet Tracer .pkt et .pka, les images IOS et leurs commandes complètes ne sont pas pris en charge.',
  );
}
function showView(view, expand = true) {
  state.view = view;
  if (expand) state.collapsed = false;
  const t = view === 'terminal';
  $('dock').classList.toggle('terminal-mode', t);
  $('dock').classList.toggle('collapsed', state.collapsed);
  $('events-tab').setAttribute('aria-pressed', String(!t));
  $('terminal-tab').setAttribute('aria-pressed', String(t));
  $('terminal-panel').hidden = !t;
  $('log-panel').hidden = t;
  $('clear-events').hidden = t;
  $('toggle-dock').setAttribute('aria-expanded', String(!state.collapsed));
  $('toggle-dock').title = $('toggle-dock').ariaLabel = state.collapsed
    ? 'Déplier le panneau'
    : 'Replier le panneau';
  $('toggle-dock').style.transform = state.collapsed ? 'rotate(180deg)' : '';
  if (t) renderTerminal();
  updateStep();
}
function terminalSession(id) {
  if (!sessions.has(id)) sessions.set(id, { settings: {}, lines: [], history: [], index: 0 });
  return sessions.get(id);
}
function renderTerminal() {
  const drop = $('terminal-device');
  const options = project.devices.map((d) => [d.id, d.name]);
  if (!device(termId))
    termId =
      state.selected || project.devices.find((d) => d.type === 'router')?.id || project.devices[0]?.id;
  drop.replaceChildren(
    ...options.map(([id, name]) => {
      const o = el('option', '', name);
      o.value = id;
      return o;
    }),
  );
  if (termId) drop.value = termId;
  const d = device(termId),
    history = d ? terminalSession(termId) : null;
  $('terminal-prompt').textContent = d ? cliPrompt(project, termId, history.settings) : '>';
  const out = $('terminal-output');
  out.textContent = d
    ? history.lines.length
      ? history.lines.join('\n')
      : 'Console de ' + d.name + ' · Saisis ? pour les commandes disponibles.'
    : 'Ajoute un équipement pour ouvrir sa console.';
  out.scrollTop = out.scrollHeight;
  $('terminal-input').disabled = !d;
  $('command-help').disabled = !d;
}
function showTerminal(id) {
  termId = id || state.selected || termId;
  clearSelection();
  showView('terminal');
  $('terminal-input').focus();
}
function execLine(input) {
  const d = device(termId);
  if (!d || !input.trim()) return;
  const s = terminalSession(termId);
  s.lines.push(cliPrompt(project, termId, s.settings) + ' ' + input);
  s.history.push(input);
  if (s.history.length > 100) s.history.shift();
  s.index = s.history.length;
  const res = runCommand(project, termId, s.settings, input);
  if (res.text) s.lines.push(res.text);
  if (s.lines.length > 180) s.lines.splice(0, s.lines.length - 180);
  if (res.changed) remember('Configuration modifiée sur ' + d.name + '.');
  else if (res.events?.length) silentSave();
  if (res.events?.length) {
    for (const ev of res.events.slice(-100)) recordEvent(ev, false);
    renderEvents();
  }
  renderTerminal();
}
$('terminal-device').onchange = (e) => {
  termId = e.target.value;
  renderTerminal();
  $('terminal-input').focus();
};
$('terminal-form').onsubmit = (e) => {
  e.preventDefault();
  const input = $('terminal-input');
  execLine(input.value);
  input.value = '';
};
$('terminal-input').addEventListener('paste', (e) => {
  const pasted = e.clipboardData?.getData('text');
  if (!pasted || !pasted.trimEnd().includes('\n')) return;
  e.preventDefault();
  const input = $('terminal-input'),
    lines = (
      input.value.slice(0, input.selectionStart) +
      pasted +
      input.value.slice(input.selectionEnd)
    ).split(/\r?\n/);
  input.value = '';
  for (const l of lines.slice(0, 300)) execLine(l);
});
$('terminal-input').addEventListener('keydown', (e) => {
  if (!['ArrowUp', 'ArrowDown'].includes(e.key) || !termId) return;
  e.preventDefault();
  const s = terminalSession(termId);
  s.index = Math.max(0, Math.min(s.history.length, s.index + (e.key === 'ArrowUp' ? -1 : 1)));
  e.target.value = s.history[s.index] || '';
});
$('command-help').onclick = () => execLine('?');
const resultBar = btn('', showResult, 'result-bar');
resultBar.hidden = true;
stage.append(resultBar);
let lastResult = null;
function hideResult() {
  resultBar.hidden = true;
  lastResult = null;
}
function describeEvent(ev) {
  const a = device(ev.from)?.name || '',
    b = device(ev.to)?.name || '';
  return (a ? (a === b || !b ? a : a + ' → ' + b) + ' · ' : '') + (ev.detail || '');
}
function recordEvent(ev, draw = true) {
  journal.push({
    time: new Date().toLocaleTimeString('fr-FR', { hour12: false }),
    protocol: ev.protocol || 'Réseau',
    msg: describeEvent(ev),
    bad: false,
  });
  if (journal.length > 400) journal.shift();
  if (draw) renderEvents();
}
function updateStep() {
  $('next-event').hidden = !activeSteps.length;
  $('next-event').title = activeSteps.length + ' étape(s) restante(s)';
}
function revealResult(r, title) {
  lastResult = { r, title };
  resultBar.replaceChildren(
    el('b', '', ''),
    el('span', '', r.ok ? 'Test réussi' : 'Test échoué'),
    el('small', '', title),
  );
  resultBar.classList.toggle('failed', !r.ok);
  resultBar.title = r.reason + ' · Voir le détail';
  resultBar.hidden = false;
  addLog(r.ok ? 'Résultat' : 'Échec', r.reason, !r.ok);
}
function showResult() {
  if (!lastResult) return;
  const { r, title } = lastResult,
    b = modal(title);
  note(b, r.reason);
  if (r.body !== undefined) {
    b.append(el('h3', 'trace-head', 'Réponse du serveur HTTP'), el('pre', 'trace-body', String(r.body)));
  }
  if (r.trace?.length) {
    b.append(el('h3', 'trace-head', 'Sauts de routage'));
    const hops = el('ol', 'help-list');
    for (const v of r.trace)
      hops.append(el('li', '', (device(v.device)?.name || 'Saut') + ' · ' + v.ip));
    b.append(hops);
  }
  if (r.events?.length) {
    b.append(el('h3', 'trace-head', 'Déroulement du test'));
    const list = el('ol', 'trace-list');
    for (const e of r.events) {
      const row = el('li');
      row.append(el('strong', '', e.protocol + ' '), document.createTextNode(describeEvent(e)));
      list.append(row);
    }
    b.append(list);
  }
}
function step() {
  const ev = activeSteps.shift();
  if (ev) {
    recordEvent(ev);
    travel(ev.from, ev.to);
  }
  updateStep();
  if (!activeSteps.length && pendingTest) {
    const { r, title } = pendingTest;
    pendingTest = null;
    revealResult(r, title);
  }
}
function playResult(r, title) {
  stopPlayback();
  hideResult();
  clearSelection();
  showView('events');
  addLog('Test', title);
  const events = r.events || [];
  if (state.mode === 'step' && events.length) {
    activeSteps.push(...events);
    pendingTest = { r, title };
    updateStep();
    toast('Test prêt. Clique sur Étape suivante.');
    return;
  }
  for (const ev of events) recordEvent(ev, false);
  renderEvents();
  revealResult(r, title);
  const path = events.filter((e) => e.from && e.to && e.from !== e.to);
  const run = token;
  function frame(i) {
    if (run !== token || i >= path.length || i >= 32) return;
    travel(path[i].from, path[i].to);
    setTimeout(() => frame(i + 1), 240);
  }
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) frame(0);
}
function chooseMode(mode) {
  state.mode = mode;
  $('realtime').setAttribute('aria-pressed', String(mode === 'real'));
  $('stepmode').setAttribute('aria-pressed', String(mode === 'step'));
  if (mode === 'real' && pendingTest) {
    const { r, title } = pendingTest;
    for (const ev of activeSteps) recordEvent(ev, false);
    stopPlayback();
    revealResult(r, title);
  }
}
function openTest(id) {
  if (!project.devices.length) return;
  const body = modal('Tester le réseau'),
    f = form(body),
    source = field(f, 'Équipement source', select(project.devices.map((d) => [d.id, d.name])));
  source.value =
    device(id)?.id ||
    project.devices.find((d) => d.type === 'pc' || d.type === 'laptop')?.id ||
    project.devices[0].id;
  const kind = field(
    f,
    'Protocole',
    select([
      ['icmp', 'Ping · ICMP'],
      ['traceroute', 'Traceroute'],
      ['http', 'HTTP · page web'],
      ['dns', 'DNS · résolution de nom'],
      ['dhcp', 'DHCP · demander un bail'],
    ]),
  );
  const target = el('input');
  target.maxLength = 253;
  target.setAttribute('list', 'target-options');
  target.autocomplete = 'off';
  target.placeholder = 'Adresse IP ou nom DNS';
  field(f, 'Destination', target);
  const destinations = el('datalist');
  destinations.id = 'target-options';
  f.append(destinations);
  const port = field(f, 'Interface cliente', select([]));
  function refresh() {
    const d = device(source.value);
    const list = [];
    const put = (value, detail) => {
      if (value && !list.some((v) => v[0] === value)) list.push([value, detail]);
    };
    const servers = project.devices.filter((n) => n.type === 'server' && n.id !== d.id);
    if (kind.value === 'dns' || kind.value === 'http')
      for (const n of project.devices)
        for (const [name, ip] of Object.entries(n.services?.dns?.records || {})) put(name, ip);
    for (const n of [...servers, ...project.devices.filter((n) => n.id !== d.id)])
      for (const p of n.ports) {
        put(p.ip, n.name + ' · ' + p.name);
        put(p.ipv6, n.name + ' · ' + p.name);
      }
    destinations.replaceChildren(
      ...list.map(([value, detail]) => {
        const o = el('option', '', detail);
        o.value = value;
        return o;
      }),
    );
    target.value =
      (testTarget &&
      kind.value !== 'dns' &&
      kind.value !== 'http' &&
      list.some((v) => v[0] === testTarget)
        ? testTarget
        : list[0]?.[0]) || '';
    const leasing = kind.value === 'dhcp';
    target.parentElement.hidden = leasing;
    target.required = !leasing;
    port.parentElement.hidden = !leasing;
    port.replaceChildren(
      ...d.ports
        .filter((p) => p.up && !p.parent && !p.management)
        .map((p) => {
          const o = el('option', '', p.name);
          o.value = p.name;
          return o;
        }),
    );
    const active = d.ports.find((p) =>
      project.links.some((l) => [l.a, l.b].some((v) => v.device === d.id && v.port === p.name)),
    );
    if (active) port.value = active.name;
  }
  source.onchange = kind.onchange = refresh;
  refresh();
  actions(f, 'Lancer le test', () => {
    const d = device(source.value);
    const leasing = kind.value === 'dhcp';
    let r;
    if (leasing) {
      r = dhcp(project, d.id, port.value);
      if (r.ok) remember('Bail DHCP obtenu par ' + d.name + '.');
    } else {
      testTarget = target.value.trim();
      r = simulate(project, d.id, testTarget, kind.value);
      silentSave();
    }
    const title =
      kind.options[kind.selectedIndex].textContent.split(' · ')[0] +
      ' · ' +
      d.name +
      (leasing ? '' : ' → ' + testTarget);
    closeDialog();
    playResult(r, title);
  });
}
$('next-event').onclick = step;
$('send-packet').onclick = () => openTest(state.selected);
$('project-menu').onclick = projectMenu;
$('rename').onclick = renameProject;
$('help').onclick = showHelp;
$('view-labs').onclick = showLabs;
$('view-topology').onclick = () => {
  closeMenu();
  if (dialog.open) closeDialog();
  clearSelection();
  $('palette').classList.remove('open');
};
$('device-search').oninput = fillPalette;
$('palette-close').onclick = () => $('palette').classList.remove('open');
$('palette-open').onclick = () => $('palette').classList.toggle('open');
$('add-first').onclick = () => {
  if (matchMedia('(max-width:740px)').matches) $('palette').classList.add('open');
  $('device-search').focus();
};
$('select-tool').onclick = () => setTool('select');
$('hand-tool').onclick = () => setTool('hand');
$('link-tool').onclick = () => setTool('link');
document.querySelectorAll('[data-cable]').forEach(
  (b) =>
    (b.onclick = () => {
      setTool('link', b.dataset.cable);
      $('palette').classList.remove('open');
    }),
);
$('zoom-in').onclick = () => zoom(1.2);
$('zoom-out').onclick = () => zoom(1 / 1.2);
$('fit').onclick = fit;
$('undo').onclick = () => checkpointTravel('undo');
$('redo').onclick = () => checkpointTravel('redo');
$('events-tab').onclick = () => showView('events');
$('terminal-tab').onclick = () => showTerminal(state.selected);
$('toggle-dock').onclick = () => {
  state.collapsed = !state.collapsed;
  showView(state.view, false);
};
$('clear-events').onclick = () => {
  journal.length = 0;
  renderEvents();
};
$('realtime').onclick = () => chooseMode('real');
$('stepmode').onclick = () => chooseMode('step');
document.addEventListener('pointerdown', (e) => {
  if (!e.target.closest('#menu,#project-menu')) closeMenu();
  if (!e.target.closest('#palette,#palette-open')) $('palette').classList.remove('open');
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (dialog.open) return;
    closeMenu();
    clearSelection();
    setTool('select');
    $('palette').classList.remove('open');
    return;
  }
  if (dialog.open || e.target.closest('input,textarea,select,[contenteditable=true],#inspector')) return;
  if ((e.ctrlKey || e.metaKey) && ['z', 'y'].includes(e.key.toLowerCase())) {
    e.preventDefault();
    checkpointTravel(e.shiftKey || e.key.toLowerCase() === 'y' ? 'redo' : 'undo');
    return;
  }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const action = {
    v: () => setTool('select'),
    h: () => setTool('hand'),
    c: () => setTool('link'),
    Delete: () => state.selected && removeDevice(state.selected),
  }[e.key];
  if (action) {
    e.preventDefault();
    action();
  }
});
new ResizeObserver(() => {
  if (autoFit) fit();
}).observe(stage);
fillIcons();
fillPalette();
renderGraph();
setTool('select');
persist();
addLog('Atelier', 'Topologie chargée · ' + project.name + '.');
const ethernetCount = project.links.filter(
  (l) => l.type !== 'wifi' && linkActive(l, device(l.a.device), device(l.b.device)),
).length;
if (ethernetCount)
  addLog(
    'Ethernet',
    ethernetCount + (ethernetCount === 1 ? ' liaison Ethernet active.' : ' liaisons Ethernet actives.'),
  );
fit();
