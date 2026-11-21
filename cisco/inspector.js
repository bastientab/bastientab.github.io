import * as engine from './engine.js';
import { aclType, validAclName, parseRule, ruleText, isAddress } from './acl.js';
const { dhcp, routesFor } = engine;

const instances = new WeakMap();
const kindNames = {
  router: 'Routeur',
  switch: 'Commutateur',
  pc: 'Ordinateur',
  server: 'Serveur',
  ap: 'Point d’accès',
  laptop: 'Portable',
};
const paths = {
  router: 'M3 8h18v10H3z M6 13h4m-2-2 2 2-2 2m10-2h-4m2-2-2 2 2 2',
  switch: 'M3 7h18v10H3z M6 11v2m3-2v2m3-2v2m3-2v2m3-2v2',
  pc: 'M3 4h18v13H3z M12 17v3m-5 0h10',
  laptop: 'M5 4h14v12H5z M5 16l-3 4h20l-3-4',
  server: 'M5 3h14v8H5z M5 13h14v8H5z M8 7h1m-1 10h1m3-10h4m-4 10h4',
  ap: 'M2 8a16 16 0 0 1 20 0M5 12a11 11 0 0 1 14 0m-11 4a6 6 0 0 1 8 0m-4 4h.01',
  x: 'M6 6l12 12M18 6 6 18',
  terminal: 'm4 6 5 5-5 5m8 1h8',
  test: 'M2 13h5l3-8 4 14 3-6h5',
  trash: 'M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7',
};

function el(tag, className, content) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (content !== undefined) node.textContent = content;
  return node;
}
function icon(name) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  for (const [key, value] of Object.entries({
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': '1.7',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'aria-hidden': 'true',
  }))
    svg.setAttribute(key, value);
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('d', paths[name] || paths.pc);
  svg.append(path);
  return svg;
}
function btn(text, action, style = '', glyph = '') {
  const button = el('button', 'ni-btn ' + style);
  button.type = 'button';
  if (glyph) button.append(icon(glyph));
  button.append(document.createTextNode(text));
  if (action) button.addEventListener('click', action);
  return button;
}
function iconBtn(label, glyph, action) {
  const button = el('button', 'ni-icon-btn');
  button.type = 'button';
  button.setAttribute('aria-label', label);
  button.title = label;
  button.append(icon(glyph));
  button.addEventListener('click', action);
  return button;
}
function section(parent, title) {
  const box = el('section', 'ni-section');
  box.append(el('h3', '', title));
  parent.append(box);
  return box;
}
function field(title, input) {
  const node = el('label', 'ni-field');
  node.append(el('span', '', title), input);
  return node;
}
function input(value, placeholder = '', max = 140) {
  const node = el('input', 'ni-input');
  node.type = 'text';
  node.value = value ?? '';
  node.placeholder = placeholder;
  node.spellcheck = false;
  node.autocomplete = 'off';
  node.maxLength = max;
  return node;
}
function integer(value, min, max) {
  const node = input(value);
  node.type = 'number';
  node.min = min;
  node.max = max;
  node.step = '1';
  node.required = true;
  return node;
}
function select(entries, value) {
  const node = el('select', 'ni-input');
  for (const [key, label] of entries) {
    const option = el('option', '', label);
    option.value = key;
    node.append(option);
  }
  node.value = value;
  return node;
}
function check(label, checked) {
  const control = el('input');
  control.type = 'checkbox';
  control.checked = !!checked;
  const node = el('label', 'ni-check');
  node.append(control, document.createTextNode(label));
  return { node, control };
}
function row(a, b, wide = false) {
  const node = el('div', 'ni-fields' + (wide ? ' ni-fields-address' : ''));
  node.append(a, b);
  return node;
}
function details(parent, title) {
  const box = el('details', 'ni-details');
  box.append(el('summary', '', title));
  parent.append(box);
  return box;
}
function note(parent, content) {
  parent.append(el('p', 'ni-info', content));
}
function form(parent, controls, label, action) {
  const node = el('form', 'ni-form');
  node.append(...controls);
  const error = el('p', 'ni-message');
  error.hidden = true;
  error.setAttribute('role', 'alert');
  const actions = el('div', 'ni-actions');
  const submit = btn(label, null, 'ni-btn-primary');
  submit.type = 'submit';
  actions.append(submit);
  node.append(error, actions);
  node.addEventListener('submit', (event) => {
    event.preventDefault();
    try {
      action();
    } catch (err) {
      error.textContent = err.message;
      error.hidden = false;
    }
  });
  parent.append(node);
  return actions;
}
function list(parent, items, remove) {
  if (!items.length) return;
  const ul = el('ul', 'ni-list');
  items.forEach((item, i) => {
    const li = el('li');
    li.append(el('span', '', item));
    if (remove) li.append(iconBtn('Supprimer ' + item, 'x', () => remove(i)));
    ul.append(li);
  });
  parent.append(ul);
}
function ipv4(value, label, required = false) {
  const text = String(value).trim();
  if (!text && !required) return '';
  if (!isAddress(text)) throw Error(label + ' : entre une adresse IPv4 valide.');
  return text;
}
function ipv6(value, label, required = false) {
  const text = value.trim();
  if (!text && !required) return '';
  try {
    if (!engine.isIPv6(text)) throw Error();
    return new URL('http://[' + text + ']/').hostname.slice(1, -1);
  } catch {
    throw Error(label + ' : entre une adresse IPv6 valide.');
  }
}
function asNumber(ip) {
  return ip.split('.').reduce((v, n) => v * 256 + Number(n), 0);
}
function addrOf(n) {
  return [24, 16, 8, 0].map((shift) => (n >>> shift) & 255).join('.');
}
function subnet(value, prefix) {
  const address = ipv4(value, 'Réseau', true);
  const block = 2 ** (32 - prefix);
  return addrOf(Math.floor(asNumber(address) / block) * block);
}
function required(value, label) {
  const text = value.trim();
  if (!text) throw Error('Renseigne ' + label + '.');
  return text;
}
function allowedText(value) {
  if (!Array.isArray(value)) return 'all';
  if (!value.length) return 'none';
  const numbers = [...new Set(value.map(Number))].sort((a, b) => a - b);
  const pieces = [];
  for (let i = 0; i < numbers.length; i++) {
    const start = numbers[i];
    while (i + 1 < numbers.length && numbers[i + 1] === numbers[i] + 1) i++;
    pieces.push(start === numbers[i] ? String(start) : start + '-' + numbers[i]);
  }
  return pieces.join(',');
}
function allowedList(value) {
  const text = value.trim().toLowerCase();
  if (!text || text === 'all' || text === 'tous') return undefined;
  if (text === 'none' || text === 'aucun') return [];
  const set = new Set();
  for (const item of text.split(',')) {
    const match = /^(\d+)(?:-(\d+))?$/.exec(item.trim());
    const start = Number(match?.[1]),
      end = Number(match?.[2] || match?.[1]);
    if (!match || start < 1 || end > 4094 || end < start)
      throw Error('VLAN autorisés : utilise all, none ou une liste telle que 10,20-30.');
    for (let i = start; i <= end; i++) set.add(i);
  }
  return [...set].sort((a, b) => a - b);
}
function updateService(d, key, patch) {
  d.services ??= {};
  d.services[key] = { ...d.services[key], ...patch };
}

export function renderInspector(container, project, deviceId, callbacks = {}) {
  const d = project.devices.find((device) => device.id === deviceId);
  if (!d) {
    container.replaceChildren();
    instances.delete(container);
    return;
  }
  let state = instances.get(container);
  if (state?.id !== deviceId || state.project !== project) {
    state = { id: deviceId, project, port: d.ports[0]?.name, tab: 'interfaces', notice: '', scroll: 0 };
    instances.set(container, state);
  }
  const redraw = () => renderInspector(container, project, deviceId, callbacks);
  const rememberScroll = () => {
    state.scroll = container.querySelector('.ni-scroll')?.scrollTop || 0;
  };
  function saved(message) {
    rememberScroll();
    state.notice = message;
    callbacks.onChange?.(message);
    if (instances.get(container) === state) redraw();
  }
  const panel = el('div', 'net-inspector');
  const heading = el('div', 'ni-heading');
  const deviceIcon = el('span', 'ni-device-icon');
  deviceIcon.append(icon(d.type));
  const headingText = el('div');
  headingText.append(el('h2', '', d.name), el('p', 'ni-kind', kindNames[d.type] || 'Équipement'));
  heading.append(
    deviceIcon,
    headingText,
    iconBtn('Fermer les réglages', 'x', () => callbacks.onClose?.()),
  );
  const shortcuts = el('div', 'ni-shortcuts');
  shortcuts.append(
    btn('Console', () => callbacks.onTerminal?.(d.id), '', 'terminal'),
    btn('Tester', () => callbacks.onTest?.(d.id), '', 'test'),
  );
  const nav = el('nav', 'ni-tabs');
  nav.setAttribute('aria-label', 'Réglages de l’équipement');
  const tabs = [
    ['interfaces', 'Interfaces'],
    ['network', 'Réseau'],
  ];
  if (d.type === 'server' || d.type === 'router') tabs.push(['services', 'Services']);
  if (!tabs.some(([key]) => key === state.tab)) state.tab = 'interfaces';
  for (const [key, label] of tabs) {
    const button = el('button', 'ni-tab', label);
    button.type = 'button';
    button.setAttribute('aria-pressed', String(state.tab === key));
    button.addEventListener('click', () => {
      state.tab = key;
      state.notice = '';
      state.scroll = 0;
      redraw();
      container.querySelector('.ni-tab[aria-pressed="true"]')?.focus({ preventScroll: true });
    });
    nav.append(button);
  }
  const body = el('div', 'ni-scroll');
  if (state.notice) {
    const status = el('p', 'ni-notice', state.notice);
    status.setAttribute('role', 'status');
    body.append(status);
  }
  if (state.tab === 'interfaces') interfacesView(body, project, d, state, saved, redraw);
  if (state.tab === 'network') networkView(body, project, d, saved, callbacks);
  if (state.tab === 'services') servicesView(body, d, saved);
  panel.append(heading, shortcuts, nav, body);
  container.replaceChildren(panel);
  body.scrollTop = state.scroll;
}

function interfacesView(body, project, d, state, saved, redraw) {
  const box = section(body, 'Interface');
  const port = d.ports.find((p) => p.name === state.port) || d.ports[0];
  if (port) {
    state.port = port.name;
    const menu = select(
      d.ports.map((p) => [p.name, p.name]),
      port.name,
    );
    menu.addEventListener('change', () => {
      state.port = menu.value;
      state.notice = '';
      state.scroll = 0;
      redraw();
    });
    box.append(field('Port à configurer', menu));
    const physical = port.parent || port.name;
    const links = project.links
      .flatMap((link) => [
        [link.a, link.b],
        [link.b, link.a],
      ])
      .filter(([a]) => a.device === d.id && a.port === physical);
    if (port.management) note(box, 'Interface logique de gestion du VLAN ' + port.vlan + '.');
    else {
      const targets = links.map(
        ([, end]) =>
          (project.devices.find((device) => device.id === end.device)?.name || 'Équipement') +
          ' · ' +
          end.port,
      );
      note(box, targets.length ? 'Relié à ' + targets.join(', ') : 'Aucun lien sur ' + physical + '.');
    }
    const up = check('Interface activée', port.up !== false);
    const nodes = [up.node];
    const layer2 = d.type === 'switch' && !port.management;
    const ip = input(port.ip, '192.168.1.10'),
      prefix = integer(port.prefix ?? 24, 0, 32);
    const addressable = !layer2 && !(d.type === 'ap' && port.name === 'Wlan0');
    const ip6 = input(port.ipv6, '2001:db8:1::1'),
      prefix6 = integer(port.prefix6 ?? 64, 0, 128);
    const local6 = input(port.linkLocal, 'Automatique');
    if (addressable) {
      nodes.push(row(field('Adresse IPv4', ip), field('Préfixe /', prefix), true));
      const advanced = el('details', 'ni-details');
      const group = el('div', 'ni-stack');
      group.append(
        row(field('Adresse IPv6', ip6), field('Préfixe IPv6 /', prefix6), true),
        field('Adresse de lien local', local6),
      );
      advanced.append(el('summary', '', 'Adressage IPv6'), group);
      nodes.push(advanced);
    }
    const cost = integer(port.ospfCost ?? 1, 1, 65535);
    const passive = check('Interface passive pour le routage', port.passive);
    const helper = input(port.helper, 'Adresse du serveur DHCP');
    const nat = select(
      [
        ['', 'Aucun'],
        ['inside', 'Interne (inside)'],
        ['outside', 'Externe (outside)'],
      ],
      port.nat || '',
    );
    const aclNames = [...new Set([...Object.keys(d.acls || {}), ...Object.values(port.acl || {})])];
    const aclOptions = [['', 'Aucune'], ...aclNames.map((name) => [name, name])];
    const aclIn = select(aclOptions, port.acl?.in || ''),
      aclOut = select(aclOptions, port.acl?.out || '');
    if (d.type === 'router') {
      const advanced = el('details', 'ni-details');
      const group = el('div', 'ni-stack');
      group.append(
        field('Coût OSPF', cost),
        passive.node,
        field('Relais DHCP', helper),
        field('Rôle NAT', nat),
      );
      if (aclNames.length)
        group.append(row(field('ACL en entrée', aclIn), field('ACL en sortie', aclOut)));
      advanced.append(el('summary', '', 'Paramètres de routage'), group);
      nodes.push(advanced);
    }
    const mode = select(
      [
        ['access', 'Accès'],
        ['trunk', 'Trunk 802.1Q'],
      ],
      port.mode || 'access',
    );
    const vlan = integer(port.vlan ?? 1, 1, 4094),
      native = integer(port.nativeVlan ?? 1, 1, 4094),
      allowed = input(allowedText(port.allowedVlans), '10,20-30', 2000);
    const stpCost = input(port.stpCost ?? '', 'Automatique');
    stpCost.type = 'number';
    stpCost.min = 1;
    stpCost.max = 200000000;
    stpCost.step = '1';
    if (layer2) {
      const switching = el('div', 'ni-stack');
      function showMode() {
        switching.replaceChildren();
        if (mode.value === 'trunk')
          switching.append(field('VLAN natif', native), field('VLAN autorisés', allowed));
        else switching.append(field('VLAN d’accès', vlan));
      }
      mode.addEventListener('change', showMode);
      showMode();
      nodes.push(field('Mode du port', mode), switching);
      const stp = el('details', 'ni-details');
      stp.append(el('summary', '', 'Spanning Tree'), field('Coût du port', stpCost));
      nodes.push(stp);
    }
    const actions = form(box, nodes, 'Appliquer', () => {
      const change = { up: up.control.checked };
      if (layer2) {
        change.mode = mode.value;
        if (stpCost.value) change.stpCost = Number(stpCost.value);
        if (mode.value === 'access') change.vlan = Number(vlan.value);
        else {
          change.nativeVlan = Number(native.value);
          change.allowedVlans = allowedList(allowed.value);
        }
      } else if (addressable) {
        change.ip = ipv4(ip.value, 'Adresse du port');
        change.prefix = Number(prefix.value);
        change.ipv6 = ipv6(ip6.value, 'Adresse du port');
        change.prefix6 = Number(prefix6.value);
        change.linkLocal = ipv6(local6.value, 'Lien local');
        if (change.linkLocal && !/^fe[89ab]/i.test(change.linkLocal))
          throw Error('Une adresse de lien local appartient à fe80::/10.');
        if (change.ip !== port.ip || change.prefix !== Number(port.prefix)) change.dhcp = false;
      }
      if (d.type === 'router') {
        Object.assign(change, {
          ospfCost: Number(cost.value),
          passive: passive.control.checked,
          helper: ipv4(helper.value, 'Relais DHCP'),
          nat: nat.value,
        });
        if (aclNames.length)
          change.acl = Object.fromEntries(
            [
              ['in', aclIn.value],
              ['out', aclOut.value],
            ].filter(([, name]) => name),
          );
      }
      Object.assign(port, change);
      if (layer2 && !stpCost.value) delete port.stpCost;
      if (layer2 && change.mode === 'trunk' && change.allowedVlans === undefined)
        delete port.allowedVlans;
      if (layer2 && change.mode === 'access') {
        d.vlans ??= {};
        d.vlans[port.vlan] ??= 'VLAN' + port.vlan;
      }
      saved(port.name + ' enregistré.');
    });
    if (['pc', 'server', 'laptop'].includes(d.type)) {
      actions.append(
        btn('Obtenir par DHCP', () => {
          const res = dhcp(project, d.id, port.name);
          if (res.ok) saved('Bail DHCP obtenu sur ' + port.name + ' · ' + port.ip);
          else {
            const message = actions.previousElementSibling;
            message.textContent = res.reason || 'Aucune offre DHCP reçue.';
            message.hidden = false;
          }
        }),
      );
    }
  }
  if (d.type === 'switch' || d.type === 'router') virtualForm(body, d, state, saved);
  if (d.type === 'ap' || d.type === 'laptop') wirelessForm(body, d, saved);
}
function virtualForm(body, d, state, saved) {
  const box = section(body, 'Interfaces logiques');
  const router = d.type === 'router';
  const add = details(box, router ? 'Ajouter une sous-interface 802.1Q' : 'Ajouter une interface VLAN');
  const vlan = integer(10, 1, 4094);
  const physical = d.ports.filter((p) => !p.parent && !p.management);
  const parent = select(
    physical.map((p) => [p.name, p.name]),
    physical[0]?.name,
  );
  const controls = [field('ID du VLAN', vlan)];
  if (router) controls.unshift(field('Interface physique', parent));
  const ip = input('', '192.168.10.1'),
    prefix = integer(24, 0, 32);
  controls.push(row(field('Adresse IPv4', ip), field('Préfixe /', prefix), true));
  form(add, controls, 'Ajouter l’interface', () => {
    const id = Number(vlan.value),
      addr = ipv4(ip.value, 'Adresse IPv4', true);
    const name = router ? parent.value + '.' + id : 'Vlan' + id;
    if (
      d.ports.some(
        (p) =>
          p.name.toLowerCase() === name.toLowerCase() ||
          (router && p.parent === parent.value && Number(p.tag) === id),
      )
    )
      throw Error('Cette interface existe déjà.');
    const p = { name, ip: addr, prefix: Number(prefix.value), up: true, mode: 'access', vlan: id };
    if (router) Object.assign(p, { parent: parent.value, tag: id });
    else p.management = true;
    d.ports.push(p);
    if (!router) {
      d.vlans ??= {};
      d.vlans[id] ??= 'VLAN' + id;
    }
    state.port = name;
    saved('Interface ' + name + ' créée.');
  });
}
function wirelessForm(body, d, saved) {
  const box = section(body, 'Wi-Fi');
  const ssid = input(d.wireless?.ssid, 'Campus', 32),
    key = input(d.wireless?.key, 'Réseau ouvert si vide', 63);
  key.type = 'password';
  key.autocomplete = 'off';
  form(
    box,
    [field('Nom du réseau (SSID)', ssid), field('Clé Wi-Fi du scénario', key)],
    'Enregistrer le Wi-Fi',
    () => {
      d.wireless = { ...d.wireless, ssid: required(ssid.value, 'le SSID'), key: key.value };
      saved('Réglages Wi-Fi enregistrés.');
    },
  );
}

function networkView(body, project, d, saved, callbacks) {
  const general = section(body, 'Équipement');
  const name = input(d.name, 'Nom de l’équipement', 64);
  const fields = [field('Nom affiché', name)];
  const gateway = input(d.gateway, '192.168.1.1'),
    gateway6 = input(d.gateway6, '2001:db8:1::1'),
    dns = input(d.dns, '192.168.1.53');
  const forward6 = check('Activer le routage IPv6', d.ipv6Routing);
  if (d.type !== 'router')
    fields.push(field('Passerelle par défaut', gateway), field('Passerelle IPv6', gateway6));
  else fields.push(forward6.node);
  fields.push(field('Serveur DNS', dns));
  form(general, fields, 'Enregistrer', () => {
    const next = { name: required(name.value, 'un nom'), dns: ipv4(dns.value, 'Serveur DNS') };
    if (d.type !== 'router') {
      next.gateway = ipv4(gateway.value, 'Passerelle');
      next.gateway6 = ipv6(gateway6.value, 'Passerelle IPv6');
    } else next.ipv6Routing = forward6.control.checked;
    Object.assign(d, next);
    saved('Réglages de ' + d.name + ' enregistrés.');
  });
  if (d.type === 'switch') vlanView(body, d, saved);
  if (d.type === 'router') {
    staticRoutesView(body, d, saved);
    ipv6RoutesView(body, d, saved);
    protocolView(body, d, 'ospf', saved);
    protocolView(body, d, 'rip', saved);
    aclView(body, d, saved);
    natView(body, d, saved);
    const box = section(body, 'Table de routage');
    const routes = [...routesFor(project, d.id), ...(engine.routes6For?.(project, d.id) || [])];
    if (routes.length) {
      const wrapper = el('div', 'ni-table-wrap');
      const table = el('table', 'ni-table');
      const head = el('thead'),
        tr = el('tr');
      for (const title of ['Origine', 'Préfixe', 'Via / interface']) {
        const th = el('th', '', title);
        th.scope = 'col';
        tr.append(th);
      }
      head.append(tr);
      const rows = el('tbody');
      const labels = { C: 'Direct', S: 'Statique', R: 'RIP', O: 'OSPF' };
      for (const route of routes) {
        const line = el('tr');
        for (const value of [
          labels[route.protocol] || route.protocol,
          route.network + '/' + route.prefix,
          route.via || route.interface || 'Direct',
        ])
          line.append(el('td', '', value));
        rows.append(line);
      }
      table.append(head, rows);
      wrapper.append(table);
      box.append(wrapper);
    } else note(box, 'Aucune route active.');
  }
  const actions = section(body, 'Topologie');
  const wrap = el('div', 'ni-actions');
  wrap.append(btn('Supprimer l’équipement', () => callbacks.onDelete?.(d.id), 'ni-btn-danger', 'trash'));
  actions.append(wrap);
}
function vlanView(body, d, saved) {
  const box = section(body, 'VLAN');
  const entries = Object.entries(d.vlans || {}).sort((a, b) => Number(a[0]) - Number(b[0]));
  list(
    box,
    entries.map(([id, label]) => id + ' · ' + label),
  );
  const add = details(box, 'Créer ou renommer un VLAN');
  const vlan = integer(10, 1, 4094),
    label = input('', 'Étudiants', 48);
  form(add, [row(field('ID', vlan), field('Nom', label))], 'Enregistrer le VLAN', () => {
    d.vlans ??= {};
    d.vlans[vlan.value] = label.value.trim() || 'VLAN' + vlan.value;
    saved('VLAN ' + vlan.value + ' enregistré.');
  });
  const stp = details(box, 'Priorité du pont par VLAN');
  const vlanId = integer(1, 1, 4094),
    priority = integer(d.stpPriority?.[1] ?? 32768, 0, 61440);
  priority.step = '4096';
  vlanId.addEventListener('input', () => {
    priority.value = d.stpPriority?.[vlanId.value] ?? 32768;
  });
  form(
    stp,
    [row(field('VLAN', vlanId), field('Priorité STP', priority))],
    'Appliquer la priorité',
    () => {
      if (Number(priority.value) % 4096)
        throw Error('Utilise un multiple de 4096 pour la priorité STP.');
      d.stpPriority ??= {};
      d.stpPriority[vlanId.value] = Number(priority.value);
      saved('Priorité STP enregistrée pour le VLAN ' + vlanId.value + '.');
    },
  );
}
function aclView(body, d, saved) {
  const box = section(body, 'Listes de contrôle IPv4');
  for (const [name, acl] of Object.entries(d.acls || {})) {
    const detail = details(
      box,
      name +
        ' · ' +
        (acl.type === 'standard' ? 'Standard' : 'Étendue') +
        ' · ' +
        acl.rules.length +
        ' règle(s)',
    );
    list(
      detail,
      acl.rules.map((r) => r.sequence + ' ' + ruleText(acl.type, r)),
      (i) => {
        acl.rules.splice(i, 1);
        saved('Règle supprimée de ' + name + '.');
      },
    );
    detail.append(
      btn(
        'Supprimer la liste',
        () => {
          delete d.acls[name];
          saved('Liste ' + name + ' supprimée.');
        },
        'ni-btn-danger',
      ),
    );
  }
  const add = details(box, 'Ajouter une règle');
  const name = input('', 'LAN-IN', 63),
    type = select(
      [
        ['standard', 'Standard'],
        ['extended', 'Étendue'],
      ],
      'standard',
    );
  const action = select(
    [
      ['permit', 'Autoriser'],
      ['deny', 'Refuser'],
    ],
    'permit',
  );
  const sequence = input('', 'Automatique');
  sequence.type = 'number';
  sequence.min = 1;
  sequence.max = 2147483647;
  const expression = input('', '192.168.10.0 0.0.0.255', 512);
  type.addEventListener('change', () => {
    expression.placeholder =
      type.value === 'standard' ? '192.168.10.0 0.0.0.255' : 'tcp any host 192.168.20.10 eq 80';
  });
  const controls = [
    field('Nom ou numéro de l’ACL', name),
    row(field('Type de liste', type), field('Action', action)),
    field('Expression IOS', expression),
    field('Numéro de séquence', sequence),
  ];
  form(add, controls, 'Ajouter la règle', () => {
    const id = required(name.value, 'un nom ou un numéro de liste');
    if (!validAclName(id) || (aclType(id) && aclType(id) !== type.value))
      throw Error('Nom ou numéro incompatible avec le type de liste.');
    const current = d.acls?.[id];
    if (current && current.type !== type.value) throw Error('Cette liste existe avec un autre type.');
    const rule = parseRule(type.value, action.value, expression.value);
    const rules = current?.rules || [],
      seq = sequence.value ? Number(sequence.value) : Math.max(0, ...rules.map((r) => r.sequence)) + 10;
    if (rules.some((r) => r.sequence === seq)) throw Error('Ce numéro de séquence est déjà utilisé.');
    d.acls ??= {};
    d.acls[id] = {
      ...current,
      type: type.value,
      rules: [...rules, { ...rule, sequence: seq }].sort((a, b) => a.sequence - b.sequence),
    };
    saved('Règle ' + seq + ' ajoutée à ' + id + '.');
  });
  note(
    box,
    'Les ACL s’appliquent en entrée ou en sortie dans les paramètres de routage de l’interface.',
  );
}
function natView(body, d, saved) {
  const box = section(body, 'Traduction d’adresses IPv4');
  const cfg = d.nat || {},
    statics = cfg.statics || [],
    overloads = cfg.overloads || [];
  const staticBox = details(box, 'NAT statique');
  list(
    staticBox,
    statics.map((n) => n.inside + ' ↔ ' + n.outside),
    (i) => {
      statics.splice(i, 1);
      saved('Traduction statique supprimée.');
    },
  );
  const inside = input('', '192.168.1.10'),
    outside = input('', '203.0.113.10');
  form(
    staticBox,
    [field('Adresse interne locale', inside), field('Adresse interne globale', outside)],
    'Ajouter la traduction',
    () => {
      const a = ipv4(inside.value, 'Adresse interne locale', true),
        b = ipv4(outside.value, 'Adresse interne globale', true);
      if (a === b || statics.some((r) => r.inside === a || r.outside === b))
        throw Error('Les adresses doivent être différentes et disponibles.');
      d.nat = { ...cfg, overloads, statics: [...statics, { inside: a, outside: b }] };
      saved('Traduction NAT statique ajoutée.');
    },
  );
  const pat = details(box, 'PAT (surcharge)');
  list(
    pat,
    overloads.map((n) => n.acl + ' · ' + n.interface),
    (i) => {
      overloads.splice(i, 1);
      saved('Règle de surcharge supprimée.');
    },
  );
  const aclNames = Object.entries(d.acls || {})
    .filter(([, a]) => a.type === 'standard')
    .map(([k]) => [k, k]);
  if (!aclNames.length) {
    note(pat, 'Crée une ACL IPv4 standard autorisant les adresses internes à traduire.');
  } else {
    const acl = select(aclNames, aclNames[0][0]),
      iface = select(
        d.ports.map((p) => [p.name, p.name]),
        d.ports.find((p) => p.nat === 'outside')?.name || d.ports[0].name,
      );
    form(
      pat,
      [field('ACL des adresses internes', acl), field('Interface de sortie', iface)],
      'Ajouter la surcharge',
      () => {
        if (overloads.some((n) => n.acl === acl.value && n.interface === iface.value))
          throw Error('Cette règle existe déjà.');
        d.nat = {
          ...cfg,
          statics,
          overloads: [...overloads, { acl: acl.value, interface: iface.value }],
        };
        saved('Règle de surcharge ajoutée.');
      },
    );
  }
  note(
    box,
    'Définis les interfaces internes et externes dans les paramètres de routage de chaque port.',
  );
}
function staticRoutesView(body, d, saved) {
  const box = section(body, 'Routes statiques');
  const routes = d.routes || [];
  if (!routes.length) note(box, 'Aucune route statique configurée.');
  list(
    box,
    routes.map((r) => r.network + '/' + r.prefix + ' via ' + (r.via || r.interface || '—')),
    (i) => {
      routes.splice(i, 1);
      saved('Route statique supprimée.');
    },
  );
  const add = details(box, 'Ajouter une route');
  const network = input('', '0.0.0.0'),
    prefix = integer(0, 0, 32),
    via = input('', '10.0.0.2');
  form(
    add,
    [row(field('Destination', network), field('Préfixe /', prefix), true), field('Prochain saut', via)],
    'Ajouter la route',
    () => {
      const length = Number(prefix.value),
        canonical = subnet(network.value, length),
        nextHop = ipv4(via.value, 'Prochain saut', true);
      if (
        routes.some((r) => r.network === canonical && Number(r.prefix) === length && r.via === nextHop)
      )
        throw Error('Cette route est déjà configurée.');
      d.routes ??= [];
      d.routes.push({ network: canonical, prefix: length, via: nextHop });
      saved('Route vers ' + canonical + '/' + length + ' ajoutée.');
    },
  );
}
function ipv6RoutesView(body, d, saved) {
  const box = section(body, 'Routes statiques IPv6');
  const routes = d.routes6 || [];
  list(
    box,
    routes.map(
      (r) => r.network + '/' + r.prefix + ' via ' + [r.via, r.interface].filter(Boolean).join(' · '),
    ),
    (i) => {
      routes.splice(i, 1);
      saved('Route IPv6 supprimée.');
    },
  );
  const add = details(box, 'Ajouter une route IPv6');
  const dest = input('', '::'),
    prefix = integer(0, 0, 128),
    via = input('', '2001:db8:1::2');
  const iface = select([['', 'Automatique'], ...d.ports.map((p) => [p.name, p.name])], '');
  form(
    add,
    [
      row(field('Destination IPv6', dest), field('Préfixe /', prefix), true),
      field('Prochain saut IPv6', via),
      field('Interface de sortie', iface),
    ],
    'Ajouter la route IPv6',
    () => {
      const network = ipv6(dest.value, 'Destination', true),
        next = ipv6(via.value, 'Prochain saut');
      if (!next && !iface.value) throw Error('Renseigne un prochain saut ou une interface de sortie.');
      if (/^fe[89ab]/i.test(next) && !iface.value)
        throw Error('Indique l’interface de sortie du prochain saut de lien local.');
      const route = { network, prefix: Number(prefix.value), via: next, interface: iface.value };
      if (
        routes.some(
          (r) =>
            r.network === route.network &&
            Number(r.prefix) === route.prefix &&
            r.via === next &&
            (r.interface || '') === iface.value,
        )
      )
        throw Error('Cette route IPv6 existe déjà.');
      d.routes6 ??= [];
      d.routes6.push(route);
      saved('Route IPv6 enregistrée.');
    },
  );
}
function protocolView(body, d, key, saved) {
  const title = key === 'ospf' ? 'OSPF' : 'RIPv2';
  const box = section(body, title);
  const config = d[key] || { networks: [] };
  const networks = config.networks || [];
  const enabled = check('Activer ' + title, config.enabled);
  const fields = [enabled.node];
  const process = integer(config.processId ?? 1, 1, 65535);
  if (key === 'ospf') fields.push(field('Numéro de processus', process));
  form(box, fields, 'Appliquer', () => {
    d[key] = { ...config, networks, enabled: enabled.control.checked };
    if (key === 'ospf') d[key].processId = Number(process.value);
    saved(title + (enabled.control.checked ? ' activé.' : ' désactivé.'));
  });
  list(
    box,
    networks.map((r) => r.network + '/' + r.prefix + (key === 'ospf' ? ' · Zone ' + (r.area ?? 0) : '')),
    (i) => {
      networks.splice(i, 1);
      saved('Réseau retiré de ' + title + '.');
    },
  );
  const add = details(box, 'Déclarer un réseau');
  const network = input('', '10.0.0.0'),
    prefix = integer(24, 0, 32),
    area = integer(0, 0, 4294967295);
  const controls = [row(field('Réseau', network), field('Préfixe /', prefix), true)];
  if (key === 'ospf') controls.push(field('Zone OSPF', area));
  form(add, controls, 'Ajouter le réseau', () => {
    const length = Number(prefix.value);
    const route = { network: subnet(network.value, length), prefix: length };
    if (key === 'ospf') route.area = Number(area.value);
    if (networks.some((r) => r.network === route.network && Number(r.prefix) === length))
      throw Error('Ce réseau est déjà déclaré.');
    d[key] = { ...config, networks: [...networks, route], enabled: !!config.enabled };
    saved('Réseau ajouté à ' + title + '.');
  });
}
function servicesView(body, d, saved) {
  const dh = d.services?.dhcp || {};
  const box = section(body, 'Serveur DHCP');
  const enabled = check('Distribuer des adresses IPv4', dh.enabled);
  const start = input(dh.start, '192.168.1.100');
  const end = input(dh.end, '192.168.1.150');
  const prefix = integer(dh.prefix ?? 24, 0, 32);
  const gateway = input(dh.gateway, '192.168.1.1'),
    dns = input(dh.dns, '192.168.1.53');
  const extraPools = Array.isArray(dh.pools) ? dh.pools : [];
  form(
    box,
    [
      enabled.node,
      field('Première adresse', start),
      row(field('Dernière adresse', end), field('Préfixe /', prefix), true),
      field('Passerelle distribuée', gateway),
      field('Serveur DNS distribué', dns),
    ],
    'Enregistrer le DHCP',
    () => {
      const rangeRequired =
        (enabled.control.checked && !extraPools.length) || !!(start.value.trim() || end.value.trim());
      const range = dhcpRange(
        start.value,
        end.value,
        Number(prefix.value),
        gateway.value,
        dns.value,
        rangeRequired,
      );
      updateService(d, 'dhcp', { ...range, enabled: enabled.control.checked });
      saved('Service DHCP enregistré.');
    },
  );
  if (extraPools.length) {
    list(
      box,
      extraPools.map(
        (pool) =>
          (pool.name ? pool.name + ' · ' : '') +
          (pool.start || pool.network || '—') +
          ' – ' +
          (pool.end || '—'),
      ),
      (i) => {
        extraPools.splice(i, 1);
        saved('Plage DHCP supprimée.');
      },
    );
  }
  const more = details(box, 'Ajouter une plage DHCP');
  const poolName = input('', 'LAN-10', 48),
    lo = input('', '192.168.10.100'),
    hi = input('', '192.168.10.150'),
    length = integer(24, 0, 32);
  const gw = input('', '192.168.10.1'),
    resolver = input('', '192.168.10.53');
  form(
    more,
    [
      field('Nom de la plage', poolName),
      field('Première adresse', lo),
      row(field('Dernière adresse', hi), field('Préfixe /', length), true),
      field('Passerelle distribuée', gw),
      field('Serveur DNS distribué', resolver),
    ],
    'Ajouter la plage',
    () => {
      const name = required(poolName.value, 'le nom de la plage');
      if (extraPools.some((pool) => pool.name?.toLowerCase() === name.toLowerCase()))
        throw Error('Une plage porte déjà ce nom.');
      const pool = dhcpRange(lo.value, hi.value, Number(length.value), gw.value, resolver.value, true);
      updateService(d, 'dhcp', {
        pools: [...extraPools, { ...pool, name, network: subnet(pool.start, pool.prefix) }],
      });
      saved('Plage DHCP ' + name + ' ajoutée.');
    },
  );
  if (d.type === 'server') {
    dnsService(body, d, saved);
    httpService(body, d, saved);
  }
}
function dhcpRange(startValue, endValue, prefix, gatewayValue, dnsValue, requireRange) {
  const start = ipv4(startValue, 'Première adresse', requireRange),
    end = ipv4(endValue, 'Dernière adresse', requireRange);
  const gateway = ipv4(gatewayValue, 'Passerelle'),
    dns = ipv4(dnsValue, 'Serveur DNS');
  if (start && (asNumber(start) > asNumber(end) || subnet(start, prefix) !== subnet(end, prefix)))
    throw Error('La plage doit être ordonnée et contenue dans un même sous-réseau.');
  if (gateway && start && subnet(start, prefix) !== subnet(gateway, prefix))
    throw Error('La passerelle doit se trouver dans le sous-réseau de la plage.');
  return { start, end, prefix, gateway, dns };
}
function dnsService(body, d, saved) {
  const box = section(body, 'Serveur DNS');
  const service = d.services?.dns || {};
  const enabled = check('Résoudre les noms de domaine', service.enabled);
  form(box, [enabled.node], 'Appliquer', () => {
    updateService(d, 'dns', { enabled: enabled.control.checked });
    saved('Service DNS enregistré.');
  });
  const records = Object.entries(service.records || {});
  list(
    box,
    records.map(([name, ip]) => name + ' → ' + ip),
    (i) => {
      updateService(d, 'dns', { records: Object.fromEntries(records.filter((_, idx) => idx !== i)) });
      saved('Enregistrement DNS supprimé.');
    },
  );
  const add = details(box, 'Créer ou modifier un enregistrement A');
  const name = input('', 'intranet.lan', 253),
    address = input('', '192.168.1.80');
  form(add, [field('Nom DNS', name), field('Adresse IPv4', address)], 'Enregistrer le nom', () => {
    const fqdn = required(name.value, 'un nom DNS').toLowerCase().replace(/\.$/, '');
    if (!fqdn.split('.').every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)))
      throw Error('Entre un nom DNS valide.');
    const value = ipv4(address.value, 'Adresse IPv4', true);
    updateService(d, 'dns', { records: { ...service.records, [fqdn]: value } });
    saved('Enregistrement ' + fqdn + ' enregistré.');
  });
}
function httpService(body, d, saved) {
  const box = section(body, 'Serveur HTTP');
  const service = d.services?.http || {};
  const enabled = check('Servir une page HTTP', service.enabled);
  const text = el('textarea', 'ni-input');
  text.rows = 3;
  text.maxLength = 6000;
  text.value = service.body || '';
  form(box, [enabled.node, field('Contenu de la réponse', text)], 'Enregistrer le HTTP', () => {
    updateService(d, 'http', { enabled: enabled.control.checked, body: text.value });
    saved('Service HTTP enregistré.');
  });
}
