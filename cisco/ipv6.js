// Adressage 128 bits et routage statique IPv6. La livraison Ethernet réutilise
// exactement les liaisons, VLAN, règles STP et associations Wi-Fi du moteur IPv4.
function parse(ip) {
  if (typeof ip !== 'string' || !ip.includes(':')) return null;
  let address = ip.toLowerCase();
  if (address.includes('.')) {
    const suffix = address.slice(address.lastIndexOf(':') + 1).split('.');
    if (suffix.length !== 4 || !suffix.every((s) => /^(0|[1-9]\d{0,2})$/.test(s) && +s < 256))
      return null;
    const [a, b, c, d] = suffix.map(Number);
    address =
      address.slice(0, address.lastIndexOf(':') + 1) +
      (a * 256 + b).toString(16) +
      ':' +
      (c * 256 + d).toString(16);
  }
  const halves = address.split('::');
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(':') : [],
    right = halves[1] ? halves[1].split(':') : [];
  const missing = 8 - left.length - right.length;
  if ((halves.length === 1 && missing !== 0) || (halves.length === 2 && missing < 1)) return null;
  const parts = [...left, ...Array(missing).fill('0'), ...right];
  if (parts.some((s) => !/^[\da-f]{1,4}$/.test(s))) return null;
  return parts.reduce((acc, part) => acc * 65536n + BigInt('0x' + part), 0n);
}
export const isIPv6 = (ip) => parse(ip) !== null;
function format(n) {
  const parts = Array.from({ length: 8 }, (_, i) => ((n >> BigInt(16 * (7 - i))) & 65535n).toString(16));
  let bestStart = -1,
    bestLength = 1;
  for (let i = 0; i < 8; i++) {
    if (parts[i] !== '0') continue;
    let end = i + 1;
    while (end < 8 && parts[end] === '0') end++;
    if (end - i > bestLength) {
      bestStart = i;
      bestLength = end - i;
    }
    i = end - 1;
  }
  return bestStart < 0
    ? parts.join(':')
    : parts.slice(0, bestStart).join(':') + '::' + parts.slice(bestStart + bestLength).join(':');
}
const validPrefix = (p) => p != null && p !== '' && Number.isInteger(+p) && +p >= 0 && +p <= 128;
const network = (n, p) => (n >> BigInt(128 - p)) << BigInt(128 - p);
const linkLocal = (n) => n !== null && n >> 118n === 0x3fan;
const globalUnicast = (n) => n !== null && n > 1n && n >> 120n !== 255n && !linkLocal(n);
const scope = (address) => String(address || '').split('%');
export function linkLocalFromMac(port, mac) {
  const manual = parse(port.linkLocal || '');
  if (linkLocal(manual)) return format(manual);
  const bytes = mac.replace(/[^0-9a-f]/gi, '').match(/../g) || [];
  if (bytes.length !== 6) return '';
  bytes[0] = (parseInt(bytes[0], 16) ^ 2).toString(16).padStart(2, '0');
  bytes.splice(3, 0, 'ff', 'fe');
  return format((0xfe80n << 112n) | BigInt('0x' + bytes.join('')));
}
function context(net, helpers) {
  const ports = [];
  for (const ref of net.refs.values()) {
    const { p, d } = ref;
    if (!helpers.ipPort(d, p) || !net.exits(ref).length || !(p.ipv6 || p.linkLocal || p.ipv6Enabled))
      continue;
    const configured = parse(p.ipv6 || '');
    ports.push({
      ref,
      addr: globalUnicast(configured) && validPrefix(p.prefix6 ?? 64) ? configured : null,
      local: linkLocal(configured) ? configured : parse(helpers.linkLocal6(d, p)),
      prefix: Number(p.prefix6 ?? 64),
    });
  }
  return { net, ports, helpers, tables: new Map() };
}
function table(ctx, d) {
  if (ctx.tables.has(d.id)) return ctx.tables.get(d.id);
  const local = ctx.ports.filter((r) => r.ref.d === d);
  const rows = local
    .filter((p) => p.addr !== null)
    .map((r) => ({
      network: format(network(r.addr, r.prefix)),
      prefix: r.prefix,
      via: '',
      interface: r.ref.p.name,
      protocol: 'C',
      metric: 0,
    }));
  const statics =
    d.type === 'router'
      ? d.routes6 || []
      : d.gateway6
        ? [{ network: '::', prefix: 0, via: d.gateway6 }]
        : [];
  for (const s of statics) {
    if (!validPrefix(s.prefix) || parse(s.network) === null) continue;
    const [via, scopeName] = scope(s.via);
    const next = parse(via);
    let iface = s.interface || scopeName || '';
    if (next === null && !iface) continue;
    if (linkLocal(next) && !iface) {
      if (local.length !== 1) continue;
      iface = local[0].ref.p.name;
    }
    if (iface && !local.some((r) => r.ref.p.name === iface)) continue;
    rows.push({
      network: format(network(parse(s.network), s.prefix)),
      prefix: Number(s.prefix),
      via: next === null ? '' : format(next),
      interface: iface,
      protocol: 'S',
      metric: 0,
    });
  }
  rows.sort(
    (a, b) => b.prefix - a.prefix || (a.protocol === b.protocol ? 0 : a.protocol === 'C' ? -1 : 1),
  );
  ctx.tables.set(d.id, rows);
  return rows;
}
export function ipv6Routes(net, d, helpers) {
  return d ? table(context(net, helpers), d) : [];
}
function findRoute(ctx, d, addr, zone) {
  const local = ctx.ports.filter((p) => p.ref.d === d);
  if (linkLocal(addr)) {
    const chosen = zone
      ? local.find((p) => p.ref.p.name.toLowerCase() === zone.toLowerCase())
      : local.length === 1
        ? local[0]
        : null;
    return chosen && { port: chosen, next: addr };
  }
  const visited = new Set(),
    rows = table(ctx, d);
  let next = addr;
  while (!visited.has(next) && visited.size < 32) {
    visited.add(next);
    const row = rows.find((r) => network(next, r.prefix) === parse(r.network));
    if (!row) return null;
    if (row.interface) {
      const port = local.find((p) => p.ref.p.name === row.interface);
      return port && { port, next: row.via ? parse(row.via) : next };
    }
    next = parse(row.via);
    if (next === null || linkLocal(next)) return null;
  }
  return null;
}
function discovery(ctx, a, b, out, back, lookup, events) {
  const cache = (a.ref.d.ndp ||= []),
    target = format(lookup),
    mac = ctx.helpers.portMac(b.ref);
  if (cache.some((v) => v.ip === target && v.mac === mac && v.interface === a.ref.p.name)) return;
  const multicast = format((0xff02n << 112n) | 0x1ff000000n | (lookup & 0xffffffn));
  ctx.helpers.frame(
    a.ref,
    b.ref,
    out,
    'NDP',
    'Neighbor Solicitation · ' + multicast + ' · qui possède ' + target + ' ?',
    events,
  );
  ctx.helpers.frame(
    b.ref,
    a.ref,
    back,
    'NDP',
    'Neighbor Advertisement · ' + target + ' → ' + mac,
    events,
  );
  const entry = cache.find((v) => v.ip === target && v.interface === a.ref.p.name);
  if (entry) entry.mac = mac;
  else cache.push({ ip: target, mac, interface: a.ref.p.name });
}
function send(ctx, source, dest, zone, label, events, ttl = 64, suppliedIP = null) {
  let d = source,
    sender = suppliedIP,
    ingress = null;
  const hops = [],
    visited = new Set();
  while (hops.length < 64) {
    hops.push(d.id);
    const local = ctx.ports.filter((p) => p.ref.d === d);
    const own = local.find(
      (p) =>
        (p.addr === dest || p.local === dest) &&
        (!linkLocal(dest) ||
          (ingress ? p === ingress : !zone || zone.toLowerCase() === p.ref.p.name.toLowerCase())),
    );
    if (own || (dest === 1n && d === source))
      return { ok: true, device: d, incoming: ingress, sourceIP: sender ?? dest, hops };
    if (visited.has(d.id))
      return { ok: false, reason: 'Boucle de routage IPv6 sur ' + d.name + '.', hops };
    visited.add(d.id);
    if (ingress) {
      if (d.type !== 'router' || !d.ipv6Routing)
        return { ok: false, reason: 'Routage IPv6 désactivé sur ' + d.name + '.', hops };
      if (linkLocal(dest) || linkLocal(sender))
        return { ok: false, reason: 'Une adresse link-local est limitée à sa liaison.', hops };
      if (--ttl === 0)
        return {
          ok: false,
          expired: true,
          device: d,
          sourceIP: sender,
          ip: ingress.addr ?? ingress.local,
          incoming: ingress,
          hops,
        };
    }
    const route = findRoute(ctx, d, dest, zone);
    if (!route)
      return {
        ok: false,
        reason:
          d.name +
          ' ne possède aucune route IPv6 active vers ' +
          format(dest) +
          (linkLocal(dest) ? ' ; indique la zone %interface si nécessaire.' : '.'),
        hops,
      };
    const { port, next } = route;
    sender ??= linkLocal(dest) ? port.local : port.addr;
    if (sender === null)
      return {
        ok: false,
        reason: 'Aucune adresse source IPv6 adaptée sur ' + port.ref.p.name + '.',
        hops,
      };
    const layer2 = ctx.net.reach(port.ref);
    const peers = ctx.ports.filter(
      (p) => (p.addr === next || p.local === next) && layer2.has(p.ref.key),
    );
    if (peers.length !== 1) {
      events.push({
        protocol: 'NDP',
        from: d.id,
        to: d.id,
        detail:
          'Résolution de ' +
          format(next) +
          ' sur ' +
          port.ref.p.name +
          ' · ' +
          (peers.length ? 'adresse dupliquée' : 'aucune réponse'),
      });
      return { ok: false, reason: 'Échec NDP sur ' + d.name + ' pour ' + format(next) + '.', hops };
    }
    const peer = peers[0],
      out = layer2.get(peer.ref.key),
      back = ctx.net.reach(peer.ref).get(port.ref.key);
    if (!back) return { ok: false, reason: 'Liaison retour indisponible pour NDP.', hops };
    discovery(ctx, port, peer, out.step, back.step, next, events);
    ctx.helpers.frame(
      port.ref,
      peer.ref,
      out.step,
      'ICMPv6',
      label + ' · ' + format(sender) + ' → ' + format(dest),
      events,
    );
    d = peer.ref.d;
    ingress = peer;
    zone = '';
  }
  return { ok: false, reason: 'Limite de sauts IPv6 atteinte.', hops };
}
export function simulateIPv6(net, source, target, kind, helpers) {
  const events = [],
    trace = [];
  const [raw, zone, extra] = scope(target),
    address = parse(raw);
  if (
    address === null ||
    !address ||
    address >> 120n === 255n ||
    extra != null ||
    (zone && !linkLocal(address))
  )
    return { ok: false, reason: 'Adresse IPv6 unicast ou zone incorrecte.', events, hops: [] };
  if (kind !== 'icmp' && kind !== 'traceroute')
    return { ok: false, reason: 'En IPv6, utilise ping ou traceroute.', events, hops: [] };
  const ctx = context(net, helpers),
    tracing = kind === 'traceroute';
  let hops = [];
  for (let ttl = tracing ? 1 : 64; ttl <= (tracing ? 30 : 64); ttl++) {
    const out = send(ctx, source, address, zone, 'Echo Request · Hop Limit ' + ttl, events, ttl);
    hops = out.hops;
    if (!out.ok && !out.expired) return { ok: false, reason: out.reason, events, hops, trace };
    const replyIP = out.expired ? out.ip : address;
    const reply = send(
      ctx,
      out.device,
      out.sourceIP,
      out.incoming?.ref.p.name,
      out.expired ? 'Time Exceeded' : 'Echo Reply',
      events,
      64,
      replyIP,
    );
    if (tracing)
      trace.push({ device: out.device.id, ip: reply.ok ? format(replyIP) : '*', ok: reply.ok });
    if (out.ok)
      return {
        ok: reply.ok,
        reason: reply.ok
          ? 'Réponse ICMPv6 de ' + format(address) + '.'
          : 'Échec du trajet retour. ' + reply.reason,
        events,
        hops,
        trace,
        address: format(address),
      };
  }
  return { ok: false, reason: 'Limite de 30 sauts IPv6 atteinte.', events, hops, trace };
}
