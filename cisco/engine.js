import { filterPacket } from './acl.js';
import { linkLocalFromMac, ipv6Routes, simulateIPv6 } from './ipv6.js';
import { alias, replyFlow, translateInbound, translateOutbound, transport } from './nat.js';
export { isIPv6 } from './ipv6.js';
// Moteur discret. Toutes les adresses, trames et requêtes restent dans la maquette.
const prefixes = { router: 'R', switch: 'SW', pc: 'PC', laptop: 'LT', server: 'SRV', ap: 'AP' };
const bridged = (d) => d.type === 'switch' || d.type === 'ap';
const radio = (p) => /^wlan/i.test(p.name);
const num = (s) => {
  const fields = String(s ?? '').split('.');
  if (fields.length !== 4 || !fields.every((v) => /^(0|[1-9]\d{0,2})$/.test(v) && Number(v) < 256))
    return NaN;
  return fields.reduce((acc, v) => acc * 256 + Number(v), 0);
};
const dotted = (value) => [24, 16, 8, 0].map((n) => (value >>> n) & 255).join('.');
const prefixOk = (p) =>
  p !== '' && p != null && Number.isInteger(Number(p)) && Number(p) >= 0 && Number(p) <= 32;
const base = (address, prefix) =>
  Math.floor(num(address) / 2 ** (32 - Number(prefix))) * 2 ** (32 - Number(prefix));
const includes = (network, prefix, ip) => prefixOk(prefix) && base(network, prefix) === base(ip, prefix);
const endpointKey = (id, port) => JSON.stringify([id, port]);
const apAddress = (d, p) => d.type === 'ap' && (p.ip || p.ipv6 || p.linkLocal || p.ipv6Enabled);
const ipPort = (d, p) => !bridged(d) || p.management || apAddress(d, p);
const allowed = (p, vlan) =>
  !Array.isArray(p.allowedVlans) || p.allowedVlans.map(Number).includes(Number(vlan));
const vlanExists = (d, vlan) =>
  d.type !== 'switch' || Number(vlan) === 1 || Object.hasOwn(d.vlans || {}, vlan);
const macFrom = (id, name) => {
  let h = 2166136261;
  for (const char of id + '/' + name) h = Math.imul(h ^ char.charCodeAt(0), 16777619) >>> 0;
  return [
    '02',
    'ab',
    ...[24, 16, 8, 0].map((n) => ((h >>> n) & 255).toString(16).padStart(2, '0')),
  ].join(':');
};
const portMac = (ref) => ref.p.mac || macFrom(ref.d.id, ref.p.name);

export function createId() {
  return globalThis.crypto?.randomUUID?.() ||
    'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function createDevice(type, name, x = 0, y = 0) {
  if (!Object.hasOwn(prefixes, type)) throw Error('Type d’équipement inconnu.');
  const id = createId();
  let names = ['Eth0'];
  if (type === 'router') names = Array.from({ length: 4 }, (_, i) => 'Gi0/' + i);
  if (type === 'switch')
    names = [...Array.from({ length: 24 }, (_, i) => 'Fa0/' + (i + 1)), 'Gi0/1', 'Gi0/2'];
  if (type === 'laptop' || type === 'ap') names = ['Eth0', 'Wlan0'];
  return {
    id,
    type,
    name: name || prefixes[type],
    x,
    y,
    ports: names.map((name) => ({
      name,
      ip: '',
      prefix: 24,
      ipv6: '',
      prefix6: 64,
      up: true,
      mode: 'access',
      vlan: 1,
      nativeVlan: 1,
      mac: macFrom(id, name),
    })),
    gateway: '',
    gateway6: '',
    dns: '',
    routes: [],
    routes6: [],
    ipv6Routing: false,
    vlans: { 1: 'default' },
    ospf: { enabled: false, networks: [] },
    rip: { enabled: false, networks: [] },
    services: {
      dhcp: { enabled: false, start: '', end: '', prefix: 24, gateway: '', dns: '' },
      dns: { enabled: false, records: {} },
      http: { enabled: false, body: 'Bienvenue sur le serveur du laboratoire.' },
    },
    wireless: { ssid: 'Campus', key: '' },
    arp: [],
    macTable: [],
  };
}

function ingressVlan(port, tag) {
  if (port.mode === 'trunk') {
    const vlan = Number(tag ?? port.nativeVlan ?? 1);
    return allowed(port, vlan) ? vlan : null;
  }
  return tag == null ? Number(port.vlan || 1) : null;
}
// Retourne undefined si le port ne peut pas transporter ce VLAN, null pour une trame non marquée.
function egressTag(port, vlan) {
  if (port.mode === 'trunk') {
    if (!allowed(port, vlan)) return undefined;
    return Number(port.nativeVlan ?? 1) === vlan ? null : vlan;
  }
  return Number(port.vlan || 1) === vlan ? null : undefined;
}

// Instantané convergé de STP par VLAN : élection de la racine, choix du port racine,
// puis élection du port désigné sur chaque liaison entre commutateurs.
function createTree(net, vlan) {
  const switches = [...net.byId.values()].filter((d) => d.type === 'switch' && vlanExists(d, vlan));
  const id = (d) => [
    Number(d.stpPriority?.[vlan] ?? 32768),
    (d.ports[0]?.mac || macFrom(d.id, 'STP')).toLowerCase(),
    d.id,
  ];
  const compare = (a, b) => {
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
    return 0;
  };
  const bridgeIds = new Map(switches.map((d) => [d, id(d)]));
  const peers = new Map(),
    trees = new Map();
  for (const sw of switches) {
    const adjacent = [];
    for (let i = 0; i < sw.ports.length; i++) {
      const ref = net.physical(sw, sw.ports[i].name),
        tag = egressTag(ref.p, vlan);
      if (ref.p.management || ref.p.parent || ref.p.up === false || tag === undefined) continue;
      for (const other of net.cables.get(ref.key) || []) {
        if (
          other.d.type !== 'switch' ||
          !vlanExists(other.d, vlan) ||
          ingressVlan(other.p, tag) !== vlan ||
          egressTag(other.p, vlan) === undefined ||
          ingressVlan(ref.p, egressTag(other.p, vlan)) !== vlan
        )
          continue;
        adjacent.push({ port: ref, other, idx: i, remoteIdx: other.d.ports.indexOf(other.p) });
      }
    }
    peers.set(sw, adjacent);
  }
  for (const root of switches.slice().sort((a, b) => compare(bridgeIds.get(a), bridgeIds.get(b)))) {
    if (trees.has(root)) continue;
    const pending = new Map([[root, { cost: 0, rootPort: null, tie: [] }]]),
      dist = new Map();
    while (pending.size) {
      let current, data;
      for (const [sw, route] of pending)
        if (!data || route.cost < data.cost) {
          current = sw;
          data = route;
        }
      pending.delete(current);
      dist.set(current, data);
      for (const e of peers.get(current)) {
        const next = e.other.d;
        if (dist.has(next)) continue;
        const configured = Number(e.other.p.stpCost);
        const cost = data.cost + (configured > 0 ? configured : /^Gi/i.test(e.other.p.name) ? 4 : 19);
        const tie = [...bridgeIds.get(current), e.idx, e.remoteIdx];
        const old = pending.get(next);
        if (!old || cost < old.cost || (cost === old.cost && compare(tie, old.tie) < 0))
          pending.set(next, { cost, tie, rootPort: e.other.p });
      }
    }
    for (const [sw, route] of dist) {
      const ports = [];
      for (const p of sw.ports) {
        const r = net.physical(sw, p.name);
        if (!net.cables.has(r.key) || egressTag(p, vlan) === undefined) continue;
        let role = route.rootPort === p ? 'Root' : 'Designated';
        if (role === 'Designated') {
          const edge = peers.get(sw).find((e) => e.port.p === p);
          if (
            edge &&
            compare(
              [route.cost, ...bridgeIds.get(sw), edge.idx],
              [dist.get(edge.other.d).cost, ...bridgeIds.get(edge.other.d), edge.remoteIdx],
            ) > 0
          )
            role = 'Alternate';
        }
        ports.push({ interface: p.name, role, state: role === 'Alternate' ? 'Blocking' : 'Forwarding' });
      }
      trees.set(sw, {
        root: root.id,
        rootName: root.name,
        bridge: sw.id,
        bridgeName: sw.name,
        cost: route.cost,
        ports,
      });
    }
  }
  return trees;
}

function buildNetwork(project) {
  const byId = new Map(project.devices.map((d) => [d.id, d]));
  const refs = new Map(),
    cables = new Map(),
    cache = new Map();
  for (const d of byId.values()) {
    for (const p of d.ports)
      refs.set(endpointKey(d.id, p.name), { d, p, key: endpointKey(d.id, p.name) });
  }
  for (const link of project.links) {
    const a = refs.get(endpointKey(link.a?.device, link.a?.port));
    const b = refs.get(endpointKey(link.b?.device, link.b?.port));
    if (
      !a ||
      !b ||
      a.d === b.d ||
      a.p.up === false ||
      b.p.up === false ||
      a.p.parent ||
      b.p.parent ||
      a.p.management ||
      b.p.management
    )
      continue;
    if (link.type === 'wifi') {
      const [ap, station] = a.d.type === 'ap' ? [a, b] : [b, a];
      if (ap.d.type !== 'ap' || station.d.type !== 'laptop' || !radio(ap.p) || !radio(station.p))
        continue;
      if (
        !ap.d.wireless?.ssid ||
        ap.d.wireless.ssid !== station.d.wireless?.ssid ||
        (ap.d.wireless.key || '') !== (station.d.wireless.key || '')
      )
        continue;
    } else if (radio(a.p) || radio(b.p)) continue;
    for (const [from, to] of [
      [a, b],
      [b, a],
    ]) {
      if (!cables.has(from.key)) cables.set(from.key, []);
      cables.get(from.key).push(to);
    }
  }
  const physical = (d, name) => refs.get(endpointKey(d.id, name));
  const trees = new Map();
  const tree = (vlan) => {
    if (!trees.has(vlan)) trees.set(vlan, createTree({ byId, physical, cables }, vlan));
    return trees.get(vlan);
  };
  const blocked = (ref, vlan) =>
    !vlanExists(ref.d, vlan) ||
    (ref.d.type === 'switch' &&
      tree(vlan)
        .get(ref.d)
        ?.ports.some((row) => row.interface === ref.p.name && row.state === 'Blocking'));
  function exits(ref) {
    const { d, p } = ref;
    if (p.up === false) return [];
    if (p.parent) {
      const parent = physical(d, p.parent);
      if (!parent || parent.p.up === false || !cables.has(parent.key)) return [];
      return [[parent, p.native ? null : Number(p.tag)]];
    }
    if ((p.management && bridged(d)) || apAddress(d, p)) {
      const vlan = Number(p.vlan || 1);
      return d.ports
        .filter((n) => !n.parent && !n.management && n.up !== false)
        .map((n) => [physical(d, n.name), egressTag(n, vlan)])
        .filter(([r, tag]) => tag !== undefined && cables.has(r.key) && !blocked(r, vlan));
    }
    return cables.has(ref.key) ? [[ref, null]] : [];
  }
  function reach(start) {
    if (cache.has(start.key)) return cache.get(start.key);
    const found = new Map(),
      visited = new Set(),
      queue = [];
    const cross = (port, tag, prev) => {
      for (const dest of cables.get(port.key) || []) {
        const state = JSON.stringify([dest.key, tag]);
        if (visited.has(state)) continue;
        visited.add(state);
        queue.push({ out: port, into: dest, tag, prev });
      }
    };
    for (const [port, tag] of exits(start)) cross(port, tag, null);
    function record(ref, step) {
      if (ref.key === start.key || found.has(ref.key)) return;
      found.set(ref.key, { ref, step });
    }
    for (let i = 0; i < queue.length; i++) {
      const step = queue[i],
        { into, tag } = step,
        { d, p } = into;
      if (bridged(d)) {
        const vlan = ingressVlan(p, tag);
        if (vlan == null || blocked(into, vlan)) continue;
        step.vlan = vlan;
        if (d.type === 'ap' && p.ip && tag == null) record(into, step);
        for (const candidate of d.ports) {
          if (candidate.up === false) continue;
          const ref = physical(d, candidate.name);
          if ((candidate.management || apAddress(d, candidate)) && Number(candidate.vlan || 1) === vlan)
            record(ref, step);
          if (candidate.management || candidate.parent || (candidate === p && !radio(p))) continue;
          const outTag = egressTag(candidate, vlan);
          if (outTag !== undefined && !blocked(ref, vlan)) cross(ref, outTag, step);
        }
      } else {
        if (tag == null) record(into, step);
        for (const sub of d.ports) {
          if (
            sub.parent === p.name &&
            sub.up !== false &&
            (sub.native ? tag == null : tag != null && Number(sub.tag) === tag)
          )
            record(physical(d, sub.name), step);
        }
      }
    }
    cache.set(start.key, found);
    return found;
  }
  const addresses = [...refs.values()].filter(
    (r) => ipPort(r.d, r.p) && Number.isFinite(num(r.p.ip)) && prefixOk(r.p.prefix) && exits(r).length,
  );
  return { byId, refs, addresses, reach, exits, physical, tree };
}

export function spanningTree(project, deviceId, vlan = 1) {
  const net = buildNetwork(project);
  return net.tree(Number(vlan)).get(net.byId.get(deviceId)) || null;
}

function protocolPorts(net, code) {
  const kind = code === 'O' ? 'ospf' : 'rip';
  const available = net.addresses.filter((ref) => ref.d.type === 'router' && ref.d[kind]?.enabled);
  const enabled = [];
  for (const ref of available) {
    const match = (ref.d[kind].networks || []).find((n) => includes(n.network, n.prefix, ref.p.ip));
    if (match)
      enabled.push({
        ...ref,
        area: code === 'O' ? String(match.area ?? 0).replace(/^0\.0\.0\.(\d+)$/, '$1') : '0',
      });
  }
  return enabled;
}
function adjacentRouters(net, enabled, port, code) {
  if (port.p.passive) return [];
  const segment = net.reach(port);
  return enabled.filter(
    (neighbor) =>
      neighbor.d !== port.d &&
      !neighbor.p.passive &&
      neighbor.area === port.area &&
      neighbor.p.ip !== port.p.ip &&
      segment.has(neighbor.key) &&
      net.reach(neighbor).has(port.key) &&
      includes(port.p.ip, port.p.prefix, neighbor.p.ip) &&
      includes(neighbor.p.ip, neighbor.p.prefix, port.p.ip) &&
      (code !== 'O' || Number(port.p.prefix) === Number(neighbor.p.prefix)),
  );
}
export function neighborsFor(project, deviceId, code = 'O') {
  const net = buildNetwork(project),
    enabled = protocolPorts(net, code);
  return enabled
    .filter((port) => port.d.id === deviceId)
    .flatMap((port) =>
      adjacentRouters(net, enabled, port, code).map((n) => ({
        device: n.d.id,
        name: n.d.name,
        address: n.p.ip,
        interface: port.p.name,
        remoteInterface: n.p.name,
        area: port.area,
      })),
    );
}
function dynamicRoutes(net, id, code) {
  const enabled = protocolPorts(net, code);
  if (!enabled.some((ref) => ref.d.id === id)) return [];
  const routerPorts = new Map();
  for (const ref of enabled) {
    if (!routerPorts.has(ref.d.id)) routerPorts.set(ref.d.id, []);
    routerPorts.get(ref.d.id).push(ref);
  }
  const edgeCost = (ref) => (code === 'R' ? 1 : Math.max(1, Number(ref.p.ospfCost) || 1));
  const queue = [{ d: id, cost: 0, area: null, stage: 0 }],
    visited = new Map(),
    learned = [];
  while (queue.length) {
    queue.sort((a, b) => b.cost - a.cost);
    const state = queue.pop(),
      key = JSON.stringify([state.d, state.area, state.stage]);
    if (visited.has(key)) continue;
    visited.set(key, state.cost);
    const here = routerPorts.get(state.d) || [];
    for (const port of here) {
      let stage = state.stage;
      if (code === 'O' && state.area !== null && state.area !== port.area) {
        // Les changements d’aire passent par une interface active de l’aire dorsale.
        if (!here.some((r) => r.area === '0') || stage === 2) continue;
        if (state.area !== '0' && port.area !== '0' && state.stage === 0) stage = 2;
        else if (port.area === '0') stage = 1;
        else stage = 2;
      }
      if (state.first) {
        learned.push({
          network: dotted(base(port.p.ip, port.p.prefix)),
          prefix: Number(port.p.prefix),
          via: state.first.ip,
          interface: state.first.out,
          metric: state.cost + (code === 'O' ? edgeCost(port) : 0),
          protocol: code,
        });
      }
      if (port.p.passive || (code === 'R' && state.cost >= 15)) continue;
      for (const neighbor of adjacentRouters(net, enabled, port, code)) {
        if (neighbor.d.id === id) continue;
        const nextKey = JSON.stringify([neighbor.d.id, neighbor.area, stage]);
        if (!visited.has(nextKey))
          queue.push({
            d: neighbor.d.id,
            cost: state.cost + edgeCost(port),
            area: neighbor.area,
            stage,
            first: state.first || { ip: neighbor.p.ip, out: port.p.name },
          });
      }
    }
  }
  return learned;
}

function routingTable(net, id) {
  const d = net.byId.get(id);
  if (!d) return [];
  const local = net.addresses.filter((r) => r.d === d);
  const rows = local.map(({ p }) => ({
    network: dotted(base(p.ip, p.prefix)),
    prefix: Number(p.prefix),
    via: '',
    interface: p.name,
    protocol: 'C',
    metric: 0,
  }));
  if (d.type === 'router') {
    for (const r of d.routes || []) {
      if (
        !Number.isFinite(num(r.network)) ||
        !prefixOk(r.prefix) ||
        (!Number.isFinite(num(r.via)) && !r.interface)
      )
        continue;
      rows.push({
        network: dotted(base(r.network, r.prefix)),
        prefix: Number(r.prefix),
        via: r.via || '',
        interface: r.interface || '',
        protocol: 'S',
        metric: 0,
      });
    }
    rows.push(...dynamicRoutes(net, id, 'O'), ...dynamicRoutes(net, id, 'R'));
  } else if (Number.isFinite(num(d.gateway))) {
    rows.push({
      network: '0.0.0.0',
      prefix: 0,
      via: d.gateway,
      interface: '',
      protocol: 'S',
      metric: 0,
    });
  }
  const ad = { C: 0, S: 1, O: 110, R: 120 };
  rows.sort((a, b) => b.prefix - a.prefix || ad[a.protocol] - ad[b.protocol] || a.metric - b.metric);
  const selected = [],
    seen = new Set();
  for (const r of rows) {
    if (r.protocol === 'S' && r.interface && !local.some((ref) => ref.p.name === r.interface)) continue;
    if (r.protocol === 'S' && r.via) {
      // Résolution récursive d’une route statique, y compris via un réseau appris.
      const resolve = (ip, visited) => {
        if (visited.has(ip) || visited.size > 32) return null;
        visited.add(ip);
        for (const candidate of rows) {
          if (candidate === r || !includes(candidate.network, candidate.prefix, ip)) continue;
          if (candidate.interface && local.some((ref) => ref.p.name === candidate.interface))
            return candidate.interface;
          if (candidate.via) {
            const found = resolve(candidate.via, new Set(visited));
            if (found) return found;
          }
        }
        return null;
      };
      const iface = resolve(r.via, new Set());
      if (!iface || (r.interface && r.interface !== iface)) continue;
      r.interface = iface;
    }
    const key = r.network + '/' + r.prefix;
    if (seen.has(key)) continue;
    seen.add(key);
    selected.push(r);
  }
  return selected;
}

export function routesFor(project, deviceId) {
  return routingTable(buildNetwork(project), deviceId);
}
export const linkLocal6 = (device, port) => linkLocalFromMac(port, portMac({ d: device, p: port }));
const v6Helpers = { ipPort, frame, linkLocal6, portMac };
export function routes6For(project, deviceId) {
  const net = buildNetwork(project);
  return ipv6Routes(net, net.byId.get(deviceId), v6Helpers);
}

function frame(start, dest, step, protocol, detail, events) {
  const path = [];
  for (let s = step; s; s = s.prev) path.push(s);
  path.reverse();
  for (const s of path) {
    events.push({
      protocol,
      from: s.out.d.id,
      to: s.into.d.id,
      detail:
        detail +
        ' · ' +
        s.out.p.name +
        ' → ' +
        s.into.p.name +
        (s.tag == null ? '' : ' · 802.1Q VLAN ' + s.tag),
    });
    if (s.into.d.type === 'switch' && s.vlan != null) {
      const mac = portMac(start),
        table = (s.into.d.macTable ||= []);
      const learned = table.find((e) => e.vlan === s.vlan && e.mac === mac);
      if (learned) learned.interface = s.into.p.name;
      else table.push({ vlan: s.vlan, mac, interface: s.into.p.name });
    }
  }
}
function neighborAddress(start, end, outward, back, events, lookup = end.p.ip) {
  const srcTable = (start.d.arp ||= []),
    mac = portMac(end);
  if (srcTable.some((a) => a.ip === lookup && a.interface === start.p.name && a.mac === mac)) return;
  frame(start, end, outward, 'ARP', 'Who has ' + lookup + ' ? Tell ' + start.p.ip, events);
  frame(end, start, back, 'ARP', lookup + ' a pour adresse MAC ' + mac, events);
  for (const [owner, peer, ip] of [
    [start, end, lookup],
    [end, start, start.p.ip],
  ]) {
    const table = (owner.d.arp ||= []),
      entry = table.find((a) => a.ip === ip && a.interface === owner.p.name);
    if (entry) entry.mac = portMac(peer);
    else table.push({ ip, mac: portMac(peer), interface: owner.p.name });
  }
}
function routeChoice(table, target) {
  let ip = target;
  const visited = new Set();
  while (!visited.has(ip) && visited.size < 32) {
    visited.add(ip);
    const r = table.find((candidate) => includes(candidate.network, candidate.prefix, ip));
    if (!r) return null;
    if (r.protocol === 'C' || !r.via) return { iface: r.interface, next: ip, route: r };
    ip = r.via;
  }
  return null;
}
function forward(
  net,
  source,
  toIP,
  protocol,
  label,
  events,
  tables,
  initialIP,
  ttl = 64,
  ports = transport(protocol),
) {
  let cur = source,
    incoming = null;
  const packet = { source: initialIP, destination: toIP, protocol, label };
  const flow = { ...ports };
  const hops = [],
    seen = new Set();
  while (cur && hops.length < 64) {
    hops.push(cur.id);
    translateInbound(cur, incoming?.p, packet, flow, events);
    const local = net.addresses.filter((r) => r.d === cur);
    const self = local.find((r) => r.p.ip === packet.destination);
    if (self)
      return {
        ok: true,
        device: cur,
        sourceIP: packet.source || packet.destination,
        destinationIP: packet.destination,
        flow,
        hops,
      };
    if (incoming && --ttl === 0 && cur.type === 'router') {
      return {
        ok: false,
        expired: true,
        device: cur,
        ip: incoming.p.ip,
        sourceIP: packet.source,
        destinationIP: packet.destination,
        flow,
        hops,
        reason: 'TTL expiré sur ' + cur.name + '.',
      };
    }
    if (seen.has(cur.id))
      return { ok: false, reason: 'Boucle de routage détectée sur ' + cur.name + '.', hops };
    seen.add(cur.id);
    if (cur !== source && cur.type !== 'router')
      return { ok: false, reason: cur.name + ' ne peut pas router ce paquet.', hops };
    if (!tables.has(cur.id)) tables.set(cur.id, routingTable(net, cur.id));
    const route = routeChoice(tables.get(cur.id), packet.destination);
    if (!route)
      return {
        ok: false,
        reason: cur.name + ' ne possède aucune route active vers ' + packet.destination + '.',
        hops,
      };
    const out = net.physical(cur, route.iface);
    packet.source ||= out.p.ip;
    const natError = translateOutbound(cur, incoming?.p, out.p, packet, flow, events);
    if (natError) return { ok: false, reason: natError, hops };
    packet.sourcePort = flow.src;
    packet.destinationPort = flow.dst;
    const peers = [...net.reach(out).values()].filter(
      (v) => (v.ref.p.ip === route.next || alias(v.ref, route.next)) && ipPort(v.ref.d, v.ref.p),
    );
    if (peers.length !== 1) {
      events.push({
        protocol: 'ARP',
        from: cur.id,
        to: cur.id,
        detail:
          'Résolution de ' +
          route.next +
          ' sur ' +
          out.p.name +
          ' : ' +
          (peers.length ? 'adresse en conflit' : 'aucune réponse'),
      });
      return {
        ok: false,
        reason: peers.length
          ? 'Adresse IPv4 en conflit sur le segment : ' + route.next + '.'
          : cur.name +
            ' ne reçoit aucune réponse ARP pour ' +
            route.next +
            ' sur ' +
            out.p.name +
            '. Vérifie le câblage, les VLAN et l’adresse du prochain saut.',
        hops,
      };
    }
    const { ref: peer, step } = peers[0],
      back = net.reach(peer).get(out.key);
    if (!back) return { ok: false, reason: 'Le chemin Ethernet de retour est interrompu.', hops };
    neighborAddress(out, peer, step, back.step, events, route.next);
    const blockedOut = filterPacket(cur, out.p, 'out', packet);
    if (blockedOut) {
      events.push({ protocol: 'ACL', from: cur.id, to: cur.id, detail: blockedOut });
      return { ok: false, reason: blockedOut, hops };
    }
    frame(out, peer, step, protocol, label + ' · ' + packet.source + ' → ' + packet.destination, events);
    const blockedIn = filterPacket(peer.d, peer.p, 'in', packet);
    if (blockedIn) {
      events.push({ protocol: 'ACL', from: peer.d.id, to: peer.d.id, detail: blockedIn });
      return { ok: false, reason: blockedIn, hops: [...hops, peer.d.id] };
    }
    incoming = peer;
    cur = peer.d;
  }
  return { ok: false, reason: 'Durée de vie du paquet épuisée.', hops };
}
function exchange(net, source, address, kind, events, tables) {
  const labels = {
    icmp: ['ICMP', 'Echo Request', 'Echo Reply'],
    http: ['TCP', 'SYN · port 80', 'SYN, ACK · port 80'],
    dns: ['DNS', 'Requête A · UDP 53', 'Réponse A · UDP 53'],
    traceroute: ['ICMP', 'Sonde de chemin', 'Réponse de destination'],
  };
  const [protocol, request, response] = labels[kind];
  const out = forward(net, source, address, protocol, request, events, tables);
  if (!out.ok) return out;
  const d = out.device;
  if ((kind === 'http' || kind === 'dns') && !d.services?.[kind]?.enabled) {
    events.push({
      protocol: kind === 'http' ? 'TCP' : 'ICMP',
      from: d.id,
      to: d.id,
      detail: kind === 'http' ? 'Port 80 fermé · RST' : 'UDP 53 inaccessible',
    });
    return {
      ...out,
      ok: false,
      reason: 'Le service ' + kind.toUpperCase() + ' est désactivé sur ' + d.name + '.',
    };
  }
  const returnPorts = replyFlow(out.flow);
  const back = forward(
    net,
    d,
    out.sourceIP,
    protocol,
    response,
    events,
    tables,
    out.destinationIP,
    64,
    returnPorts,
  );
  if (!back.ok || back.device !== source)
    return {
      ...out,
      ok: false,
      reason: 'Échec du trajet retour. ' + (back.reason || 'La réponse n’atteint pas l’émetteur.'),
    };
  if (kind === 'http') {
    for (const [src, dst, protocol, detail, ip, ports] of [
      [source, address, 'TCP', 'ACK · connexion établie'],
      [source, address, 'HTTP', 'GET /'],
      [d, out.sourceIP, 'HTTP', '200 OK · contenu du serveur', out.destinationIP, returnPorts],
    ]) {
      const packet = forward(net, src, dst, protocol, detail, events, tables, ip, 64, ports);
      if (!packet.ok) return { ...out, ok: false, reason: packet.reason };
    }
  }
  return out;
}
function traceRoute(net, source, address, events, tables) {
  const trace = [];
  let hops = [];
  for (let ttl = 1; ttl <= 30; ttl++) {
    const probe = forward(
      net,
      source,
      address,
      'ICMP',
      'Sonde Echo · TTL ' + ttl,
      events,
      tables,
      undefined,
      ttl,
    );
    hops = probe.hops;
    if (!probe.ok && !probe.expired) return { ok: false, reason: probe.reason, events, hops, trace };
    const ip = probe.expired ? probe.ip : probe.destinationIP;
    const ports = replyFlow(probe.flow);
    if (probe.expired) ports.related = probe.destinationIP;
    const reply = forward(
      net,
      probe.device,
      probe.sourceIP,
      'ICMP',
      probe.expired ? 'Time Exceeded' : 'Echo Reply',
      events,
      tables,
      ip,
      64,
      ports,
    );
    const delivered = reply.ok && reply.device === source;
    trace.push({ device: probe.device.id, ip: delivered ? reply.sourceIP : '*', ok: delivered });
    if (probe.ok)
      return {
        ok: delivered,
        reason: delivered
          ? 'Destination atteinte · ' + address
          : 'Échec du trajet retour. ' + (reply.reason || 'Émetteur inaccessible.'),
        events,
        hops,
        trace,
        address,
      };
  }
  return { ok: false, reason: 'Limite de 30 sauts atteinte.', events, hops, trace };
}
export function simulate(project, sourceDeviceId, targetIPorName, protocol = 'icmp') {
  const net = buildNetwork(project),
    source = net.byId.get(sourceDeviceId),
    events = [],
    tables = new Map();
  const fail = (reason, hops = []) => ({ ok: false, reason, events, hops });
  if (!source) return fail('Équipement source introuvable.');
  let target = String(targetIPorName ?? '').trim();
  const kind = String(protocol).toLowerCase();
  if (!['icmp', 'traceroute', 'http', 'dns'].includes(kind)) return fail('Protocole de test inconnu.');
  if (kind === 'http') target = target.replace(/^http:\/\//i, '').split('/')[0];
  if (target.includes(':')) return simulateIPv6(net, source, target, kind, v6Helpers);
  if (!target) return fail('Saisis une adresse IPv4 ou un nom DNS.');
  if (kind === 'dns' || !Number.isFinite(num(target))) {
    if (!Number.isFinite(num(source.dns)))
      return fail('Aucun serveur DNS valide n’est configuré sur ' + source.name + '.');
    const dns = exchange(net, source, source.dns, 'dns', events, tables);
    if (!dns.ok) return fail(dns.reason, dns.hops);
    const host = target.toLowerCase().replace(/\.$/, '');
    const entry = Object.entries(dns.device.services.dns.records || {}).find(
      ([name]) => name.toLowerCase().replace(/\.$/, '') === host,
    );
    if (!entry || !Number.isFinite(num(entry[1]))) {
      events.push({ protocol: 'DNS', from: dns.device.id, to: source.id, detail: 'NXDOMAIN · ' + host });
      return fail('Le serveur DNS ne connaît pas ' + host + '.', dns.hops);
    }
    target = entry[1];
    events.push({
      protocol: 'DNS',
      from: dns.device.id,
      to: source.id,
      detail: 'A · ' + host + ' → ' + target,
    });
    if (kind === 'dns')
      return { ok: true, reason: host + ' → ' + target, events, hops: dns.hops, address: target };
  }
  if (kind === 'traceroute') return traceRoute(net, source, target, events, tables);
  const result = exchange(net, source, target, kind, events, tables);
  if (!result.ok) return fail(result.reason, result.hops);
  const reason =
    kind === 'http'
      ? 'HTTP 200 OK · ' + result.device.name
      : kind === 'traceroute'
        ? 'Destination atteinte · ' + target
        : 'Réponse ICMP de ' + target + '.';
  return {
    ok: true,
    reason,
    events,
    hops: result.hops,
    address: target,
    ...(kind === 'http' ? { body: String(result.device.services.http.body ?? '') } : {}),
  };
}

function leaseOffer(service, segment, client, used) {
  const pools = [service, ...(service.pools || [])];
  for (const pool of pools) {
    const first = num(pool.start),
      last = num(pool.end);
    if (!Number.isFinite(first) || !Number.isFinite(last) || first > last || !prefixOk(pool.prefix))
      continue;
    if (
      !includes(segment.ip, segment.prefix, pool.start) ||
      !includes(pool.start, pool.prefix, pool.end) ||
      !includes(pool.start, pool.prefix, segment.ip)
    )
      continue;
    const network = base(pool.start, pool.prefix),
      broadcast = network + 2 ** (32 - Number(pool.prefix)) - 1;
    const ranges = [...(service.exclusions || []), ...(pool !== service ? pool.exclusions || [] : [])]
      .map((e) => [num(e.start), num(e.end || e.start)])
      .filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b) && b >= a);
    const unavailable = new Set(used);
    for (const ip of [pool.gateway, pool.dns]) if (Number.isFinite(num(ip))) unavailable.add(num(ip));
    if (Number(pool.prefix) <= 30) {
      unavailable.add(network);
      unavailable.add(broadcast);
    }
    const exclusionEnd = (v) =>
      ranges.reduce((end, [a, b]) => (v >= a && v <= b ? Math.max(end, b) : end), -1);
    let offered = num(client.p.ip);
    if (
      !Number.isFinite(offered) ||
      offered < first ||
      offered > last ||
      unavailable.has(offered) ||
      exclusionEnd(offered) >= offered
    ) {
      offered = first;
      while (offered <= last) {
        const end = exclusionEnd(offered);
        if (end >= offered) offered = end + 1;
        else if (unavailable.has(offered)) offered++;
        else break;
      }
    }
    if (offered <= last) return { ip: dotted(offered), pool };
  }
  return null;
}
export function dhcp(project, deviceId, portName) {
  const net = buildNetwork(project),
    d = net.byId.get(deviceId),
    events = [];
  const fail = (reason) => ({ ok: false, reason, events, hops: [] });
  if (!d) return fail('Équipement client introuvable.');
  let active = d.ports.filter((p) => p.up !== false && !p.parent && (!bridged(d) || p.management));
  if (portName) active = active.filter((p) => p.name === portName);
  const client = active.map((p) => net.physical(d, p.name)).find((r) => net.exits(r).length);
  if (!client) return fail('Aucune interface cliente active et reliée.');
  const reach = net.reach(client);
  let responding = false,
    relayError = '';
  const tables = new Map();
  const peers = [...reach.values()];
  const used = new Set(peers.map((entry) => num(entry.ref.p.ip)).filter(Number.isFinite));
  for (const candidate of peers) {
    const { ref: local, step: outward } = candidate;
    if (!ipPort(local.d, local.p) || !Number.isFinite(num(local.p.ip)) || !prefixOk(local.p.prefix))
      continue;
    const helper =
      local.d.type === 'router' && Number.isFinite(num(local.p.helper)) ? local.p.helper : null;
    if (!local.d.services?.dhcp?.enabled && !helper) continue;
    const reply = net.reach(local).get(client.key);
    if (!reply) continue;
    frame(client, local, outward, 'DHCP', 'DISCOVER · UDP 68 → 67 · diffusion locale', events);
    for (const relay of [false, ...(helper ? [true] : [])]) {
      let server = local.d;
      const relayRequest = (label) =>
        forward(
          net,
          local.d,
          helper,
          'DHCP',
          label + ' relayé · giaddr ' + local.p.ip,
          events,
          tables,
          local.p.ip,
        );
      if (relay) {
        const fwd = relayRequest('DISCOVER');
        if (!fwd.ok) {
          relayError = fwd.reason;
          continue;
        }
        server = fwd.device;
      }
      const service = server.services?.dhcp;
      if (!service?.enabled) continue;
      responding = true;
      const offer = leaseOffer(service, local.p, client, used);
      if (!offer) continue;
      const { ip, pool } = offer;
      const relayReply = (label) =>
        forward(
          net,
          server,
          local.p.ip,
          'DHCP',
          label + ' vers le relais · ' + ip,
          events,
          tables,
          helper,
        );
      if (relay) {
        const reply = relayReply('OFFER');
        if (!reply.ok || reply.device !== local.d) {
          relayError = reply.reason || 'Le relais DHCP ne reçoit pas l’offre.';
          continue;
        }
      }
      frame(local, client, reply.step, 'DHCP', 'OFFER · ' + ip, events);
      frame(client, local, outward, 'DHCP', 'REQUEST · ' + ip, events);
      if (relay) {
        const request = relayRequest('REQUEST');
        if (!request.ok) {
          relayError = request.reason;
          continue;
        }
        const ack = relayReply('ACK');
        if (!ack.ok || ack.device !== local.d) {
          relayError = ack.reason || 'Le relais DHCP ne reçoit pas l’ACK.';
          continue;
        }
      }
      frame(local, client, reply.step, 'DHCP', 'ACK · ' + ip, events);
      client.p.ip = ip;
      client.p.prefix = Number(pool.prefix);
      client.p.dhcp = true;
      d.gateway = pool.gateway || '';
      d.dns = pool.dns || '';
      return {
        ok: true,
        reason:
          'Bail accordé par ' +
          server.name +
          (relay ? ' via ' + local.d.name : '') +
          ' : ' +
          ip +
          '/' +
          pool.prefix +
          '.',
        events,
        hops: [d.id, ...(relay ? [local.d.id] : []), server.id],
        ip,
        address: ip,
        interface: client.p.name,
      };
    }
  }
  if (!responding)
    events.push({
      protocol: 'DHCP',
      from: d.id,
      to: d.id,
      detail: 'DISCOVER · aucune offre reçue sur ' + client.p.name,
    });
  return fail(
    relayError
      ? 'Relais DHCP : ' + relayError
      : responding
        ? 'Aucune adresse disponible dans les plages DHCP de ce segment.'
        : 'Aucun serveur DHCP accessible dans ce domaine de diffusion.',
  );
}
