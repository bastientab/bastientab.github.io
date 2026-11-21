import * as engine from './engine.js';
import { aclType, validAclName, parseRule, ruleText } from './acl.js';

const { simulate, dhcp, routesFor } = engine;

const networkOS = (device) => device.type === 'router' || device.type === 'switch';
const findDevice = (project, id) => project.devices.find((device) => device.id === id);
const reply = (text = '', changed = false) => ({ text, changed });
const error = (message) => reply('% ' + message);
const isIP = (value) =>
  typeof value === 'string' &&
  /^(?:0|[1-9]\d{0,2})(?:\.(?:0|[1-9]\d{0,2})){3}$/.test(value) &&
  value.split('.').every((n) => +n <= 255);
const toInt = (ip) => ip.split('.').reduce((n, octet) => (n * 256 + Number(octet)) >>> 0, 0);
const toIP = (n) => [24, 16, 8, 0].map((shift) => (n >>> shift) & 255).join('.');
const mask = (prefix) => (prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0);
const prefixText = (prefix) => toIP(mask(prefix));
const netInt = (ip, prefix) => (toInt(ip) & mask(prefix)) >>> 0;
const validNumber = (value, low, high) => /^\d+$/.test(value) && +value >= low && +value <= high;
const validVlan = (value) => validNumber(value, 1, 4094);
const validName = (value) => /^[a-z\d][a-z\d._-]{0,62}$/i.test(value);
function ip6(value) {
  if (typeof value !== 'string' || !value.includes(':') || !/^[0-9a-f:.]+$/i.test(value)) return null;
  try {
    return new URL('http://[' + value + ']/').hostname.slice(1, -1);
  } catch {
    return null;
  }
}
function ipv6Prefix(text) {
  const [address, length, ...extra] = text.split('/');
  const normalized = ip6(address);
  return !extra.length && normalized && validNumber(length, 0, 128)
    ? { address: normalized, length: +length }
    : null;
}
const validHost = (ip, prefix) => {
  if (!isIP(ip) || !prefix || +ip.split('.')[0] >= 224 || +ip.split('.')[0] === 0) return false;
  if (prefix >= 31) return true;
  const host = (toInt(ip) & ~mask(prefix)) >>> 0;
  return host !== 0 && host !== ~mask(prefix) >>> 0;
};

function readPrefix(str) {
  if (/^\/?\d+$/.test(str)) {
    const n = Number(str.replace('/', ''));
    return n <= 32 ? n : null;
  }
  if (!isIP(str)) return null;
  const bits = toInt(str).toString(2).padStart(32, '0');
  return /^1*0*$/.test(bits) ? bits.lastIndexOf('1') + 1 : null;
}

function portKey(input) {
  return input
    .toLowerCase()
    .replace(/\s/g, '')
    .replace(/^(gigabitethernet|gig|gi|g)(?=\d)/, 'gi')
    .replace(/^(fastethernet|fast|fa|f)(?=\d)/, 'fa')
    .replace(/^(ethernet|eth|e)(?=\d)/, 'eth')
    .replace(/^(vlan|vl)(?=\d)/, 'vlan');
}

function lookupPort(device, input) {
  const key = portKey(input);
  return device.ports.find((port) => portKey(port.name) === key);
}

function connections(project, device, name) {
  return project.links.flatMap((link) => {
    const peer =
      link.a.device === device.id && link.a.port === name
        ? link.b
        : link.b.device === device.id && link.b.port === name
          ? link.a
          : null;
    if (!peer) return [];
    const remote = findDevice(project, peer.device);
    const port = remote?.ports.find((p) => p.name === peer.port);
    return port ? [{ remote, port, link }] : [];
  });
}

function operational(project, device, port) {
  if (port.up === false) return false;
  if (port.management) {
    return device.ports.some(
      (p) =>
        !p.management &&
        !p.parent &&
        p.up !== false &&
        (p.mode === 'trunk'
          ? !p.allowedVlans || p.allowedVlans.includes(+port.vlan)
          : +p.vlan === +port.vlan) &&
        connections(project, device, p.name).some(({ port: peer }) => peer.up !== false),
    );
  }
  const physical = port.parent ? lookupPort(device, port.parent) : port;
  return (
    physical?.up !== false &&
    connections(project, device, physical?.name).some(({ port: peer }) => peer.up !== false)
  );
}

function table(headers, rows) {
  const values = [headers, ...rows].map((row) => row.map((value) => String(value ?? '—')));
  const widths = headers.map((_, i) => Math.max(...values.map((row) => row[i].length)));
  return values
    .map((row) =>
      row.map((cell, i) => (i === row.length - 1 ? cell : cell.padEnd(widths[i]))).join('  '),
    )
    .join('\n');
}

function vlanList(text) {
  const ids = new Set();
  for (const item of text.split(',')) {
    const match = /^(\d+)(?:-(\d+))?$/.exec(item);
    if (!match || !validVlan(match[1]) || (match[2] && !validVlan(match[2]))) return null;
    const first = +match[1],
      last = match[2] ? +match[2] : first;
    if (last < first) return null;
    for (let i = first; i <= last; i++) ids.add(i);
  }
  return [...ids].sort((a, b) => a - b);
}

function runningConfig(d) {
  const lines = ['hostname ' + d.name];
  if (d.ipv6Routing) lines.push('ipv6 unicast-routing');
  for (const [id, value] of Object.entries(d.stpPriority ?? {}))
    lines.push('spanning-tree vlan ' + id + ' priority ' + value);
  for (const [name, list] of Object.entries(d.acls ?? {})) {
    lines.push('!', 'ip access-list ' + list.type + ' ' + name);
    for (const rule of list.rules) lines.push(' ' + rule.sequence + ' ' + ruleText(list.type, rule));
  }
  if (d.gateway) lines.push('ip default-gateway ' + d.gateway);
  if (d.dns) lines.push('ip name-server ' + d.dns);
  if (d.type === 'switch') {
    for (const [id, name] of Object.entries(d.vlans ?? {})) {
      if (id !== '1') lines.push('!', 'vlan ' + id, ' name ' + name);
    }
  }
  for (const p of d.ports) {
    lines.push('!', 'interface ' + p.name);
    if (p.description) lines.push(' description ' + p.description);
    if (p.parent && p.tag) lines.push(' encapsulation dot1Q ' + p.tag + (p.native ? ' native' : ''));
    if (d.type === 'switch' && !p.management) {
      lines.push(' switchport mode ' + (p.mode || 'access'));
      if (p.mode === 'trunk') {
        if (p.nativeVlan && +p.nativeVlan !== 1)
          lines.push(' switchport trunk native vlan ' + p.nativeVlan);
        if (p.allowedVlans)
          lines.push(' switchport trunk allowed vlan ' + (p.allowedVlans.join(',') || 'none'));
      } else if (+p.vlan > 1) lines.push(' switchport access vlan ' + p.vlan);
    }
    if (p.ip) lines.push(' ip address ' + (p.dhcp ? 'dhcp' : p.ip + ' ' + prefixText(+p.prefix)));
    if (p.ipv6) lines.push(' ipv6 address ' + p.ipv6 + '/' + (p.prefix6 ?? 64));
    if (p.linkLocal) lines.push(' ipv6 address ' + p.linkLocal + ' link-local');
    if (p.ipv6Enabled && !p.ipv6 && !p.linkLocal) lines.push(' ipv6 enable');
    if (p.helper) lines.push(' ip helper-address ' + p.helper);
    if (p.nat === 'inside' || p.nat === 'outside') lines.push(' ip nat ' + p.nat);
    if (p.ospfCost) lines.push(' ip ospf cost ' + p.ospfCost);
    if (p.stpCost) lines.push(' spanning-tree cost ' + p.stpCost);
    for (const [direction, name] of Object.entries(p.acl ?? {}))
      lines.push(' ip access-group ' + name + ' ' + direction);
    lines.push(p.up === false ? ' shutdown' : ' no shutdown');
  }
  for (const r of d.routes ?? [])
    lines.push('ip route ' + r.network + ' ' + prefixText(+r.prefix) + ' ' + r.via);
  for (const r of d.routes6 ?? [])
    lines.push(
      'ipv6 route ' + r.network + '/' + r.prefix + ' ' + [r.interface, r.via].filter(Boolean).join(' '),
    );
  for (const entry of d.nat?.statics ?? [])
    lines.push('ip nat inside source static ' + entry.inside + ' ' + entry.outside);
  for (const entry of d.nat?.overloads ?? [])
    lines.push('ip nat inside source list ' + entry.acl + ' interface ' + entry.interface + ' overload');
  if (d.ospf?.enabled) {
    lines.push('!', 'router ospf ' + (d.ospf.processId || 1));
    for (const n of d.ospf.networks ?? [])
      lines.push(' network ' + n.network + ' ' + toIP(~mask(+n.prefix)) + ' area ' + n.area);
    for (const p of d.ports.filter((p) => p.passive)) lines.push(' passive-interface ' + p.name);
  }
  if (d.rip?.enabled) {
    lines.push('!', 'router rip', ' version 2');
    for (const n of d.rip.networks ?? []) lines.push(' network ' + n.network);
    for (const p of d.ports.filter((p) => p.passive)) lines.push(' passive-interface ' + p.name);
  }
  const service = d.services?.dhcp;
  for (const range of service?.exclusions ?? [])
    lines.push('ip dhcp excluded-address ' + range.start + ' ' + range.end);
  const pools = [...(service?.start && service?.end ? [service] : []), ...(service?.pools ?? [])];
  for (const [index, p] of pools.entries()) {
    lines.push('!', 'ip dhcp pool ' + (p.name || 'POOL' + (index + 1)));
    if (p.network || isIP(p.start))
      lines.push(
        ' network ' + (p.network || toIP(netInt(p.start, +p.prefix))) + ' ' + prefixText(+p.prefix),
      );
    if (p.gateway) lines.push(' default-router ' + p.gateway);
    if (p.dns) lines.push(' dns-server ' + p.dns);
  }
  if (service && !service.enabled && pools.length) lines.push('no service dhcp');
  return [...lines, '!', 'end'].join('\n');
}

const suffix = {
  user: '>',
  exec: '#',
  config: '(config)#',
  iface: '(config-if)#',
  vlan: '(config-vlan)#',
  router: '(config-router)#',
  pool: '(dhcp-config)#',
  acl: '(config-nacl)#',
};
export function cliPrompt(project, id, session = {}) {
  const device = findDevice(project, id);
  if (!device) return '>';
  if (session.mode === 'acl')
    return (
      device.name +
      (device.acls?.[session.acl]?.type === 'standard' ? '(config-std-nacl)#' : '(config-ext-nacl)#')
    );
  if (session.mode === 'iface' && session.range?.length > 1) return device.name + '(config-if-range)#';
  return device.name + (networkOS(device) ? suffix[session.mode || 'user'] || '>' : '>');
}

function stepInto(s, mode, fields = {}) {
  Object.assign(s, { mode }, fields);
  return reply();
}

function diagnostics(ctx, protocol, target) {
  const { project, d } = ctx;
  const result = simulate(project, d.id, target, protocol);
  const names = result.hops.map((id) => findDevice(project, id)?.name || id);
  let output;
  if (protocol === 'traceroute') {
    const trace =
      result.trace?.map((h) =>
        h.ok ? (findDevice(project, h.device)?.name || '') + '   ' + (h.ip || '') : '*',
      ) || names.slice(1);
    output =
      'Trace vers ' +
      target +
      '\n' +
      trace.map((name, i) => '  ' + (i + 1) + '   ' + name).join('\n') +
      '\n' +
      result.reason;
  } else if (protocol === 'dns' && result.ok) output = target + '   A   ' + result.address;
  else if (protocol === 'http' && result.ok) output = 'HTTP/1.1 200 OK\n\n' + (result.body ?? '');
  else if (protocol === 'icmp' && result.ok)
    output = result.reason + '\n1 écho envoyé, 1 réponse reçue.';
  else output = result.reason;
  return { text: output, events: result.events };
}

function dhcpRequest({ project, d }, p) {
  const result = dhcp(project, d.id, p?.name);
  return { text: result.reason, changed: result.ok, events: result.events };
}

function hostConfig(d) {
  return (
    d.ports
      .map((p) =>
        [
          p.name + (p.up === false ? ' (désactivée)' : ''),
          '  Adresse IPv4     ' + (p.ip || 'non attribuée'),
          '  Masque           ' + (p.ip ? prefixText(+p.prefix) : '—'),
          '  Adresse MAC      ' + (p.mac || '—'),
          p.ipv6 ? '  Adresse IPv6     ' + p.ipv6 + '/' + (p.prefix6 ?? 64) : '',
        ]
          .filter(Boolean)
          .join('\n'),
      )
      .join('\n\n') +
    '\n\nPasserelle         ' +
    (d.gateway || '—') +
    (d.gateway6 ? '\nPasserelle IPv6    ' + d.gateway6 : '') +
    '\nServeur DNS        ' +
    (d.dns || '—')
  );
}

function showInterfaces(ctx, name) {
  const { d, project } = ctx;
  const selected = name ? lookupPort(d, name) : null;
  if (name && !selected) return error('Interface introuvable.');
  const ports = selected ? [selected] : d.ports;
  return reply(
    ports
      .map((p) => {
        const status =
          p.up === false ? 'administratively down' : operational(project, d, p) ? 'up' : 'down';
        return [
          p.name +
            ' is ' +
            status +
            ', line protocol is ' +
            (operational(project, d, p) ? 'up' : 'down'),
          p.description ? '  Description : ' + p.description : '',
          p.mac ? '  MAC ' + p.mac : '',
          p.ip ? '  IPv4 ' + p.ip + '/' + p.prefix : '',
          d.type === 'switch' && !p.management
            ? '  ' +
              (p.mode === 'trunk'
                ? 'Trunk 802.1Q, VLAN natif ' + (p.nativeVlan || 1)
                : 'Access VLAN ' + (p.vlan || 1))
            : '',
        ]
          .filter(Boolean)
          .join('\n');
      })
      .join('\n'),
  );
}

function showBrief({ d, project }) {
  return reply(
    table(
      ['Interface', 'IP-Address', 'Status', 'Protocol'],
      d.ports.map((p) => [
        p.name,
        p.ip || 'unassigned',
        p.up === false ? 'administratively down' : operational(project, d, p) ? 'up' : 'down',
        operational(project, d, p) ? 'up' : 'down',
      ]),
    ),
  );
}

function showRoutes({ d, project }, target) {
  let routes = routesFor(project, d.id);
  if (target) {
    if (!isIP(target)) return error('Adresse IPv4 incorrecte.');
    routes = routes
      .filter((r) => netInt(target, +r.prefix) === netInt(r.network, +r.prefix))
      .sort((a, b) => b.prefix - a.prefix)
      .slice(0, 1);
  }
  if (!routes.length) return reply('Aucune route active' + (target ? ' vers ' + target : '') + '.');
  return reply(
    'C connecté · S statique · O OSPF · R RIP\n' +
      table(
        ['Code', 'Préfixe', 'Prochain saut', 'Interface'],
        routes.map((r) => [
          r.protocol,
          r.network + '/' + r.prefix,
          r.via || 'direct',
          r.interface || '—',
        ]),
      ),
  );
}

function showVlans({ d }) {
  return reply(
    table(
      ['VLAN', 'Nom', 'Ports access'],
      Object.entries(d.vlans ?? {}).map(([id, name]) => [
        id,
        name,
        d.ports
          .filter((p) => !p.management && p.mode !== 'trunk' && +p.vlan === +id)
          .map((p) => p.name)
          .join(', ') || '—',
      ]),
    ),
  );
}

function showArp({ d }) {
  return reply(
    table(
      ['Adresse IPv4', 'Adresse MAC', 'Interface'],
      (d.arp ?? []).map((a) => [a.ip, a.mac, a.interface]),
    ),
  );
}

function showNeighbors({ project, d }) {
  const rows = d.ports.flatMap((p) =>
    p.up === false
      ? []
      : connections(project, d, p.name)
          .filter(({ remote, port }) => networkOS(remote) && port.up !== false)
          .map(({ remote, port }) => [
            remote.name,
            p.name,
            remote.type === 'router' ? 'R' : 'S',
            port.name,
          ]),
  );
  return reply(table(['Device ID', 'Local interface', 'Capability', 'Port ID'], rows));
}

function needAddress(port, ip, rawMask) {
  const prefix = readPrefix(rawMask);
  if (prefix === null || !validHost(ip, prefix)) return error('Adresse hôte ou masque IPv4 incorrect.');
  Object.assign(port, { ip, prefix, dhcp: false });
  return reply('', true);
}

function selectInterface({ d, s }, input) {
  const existing = lookupPort(d, input);
  if (existing) return stepInto(s, 'iface', { iface: existing.name });
  if (d.ports.length >= 128) return error('La limite de 128 interfaces par équipement est atteinte.');
  const key = portKey(input);
  let port;
  const svi = /^vlan(\d+)$/.exec(key);
  const sub = /^([a-z]+\d+(?:\/\d+)*)\.(\d+)$/.exec(key);
  if (svi && d.type === 'switch' && validVlan(svi[1])) {
    port = { name: 'Vlan' + Number(svi[1]), management: true, vlan: +svi[1] };
  } else if (sub && d.type === 'router' && validNumber(sub[2], 1, 4294967295)) {
    const physical = lookupPort(d, sub[1]);
    if (!physical) return error('Interface physique introuvable.');
    port = { name: physical.name + '.' + sub[2], parent: physical.name };
    if (physical.mac) port.mac = physical.mac;
  }
  if (!port)
    return error('Interface introuvable. Utilise « show ip interface brief » pour voir les ports.');
  d.ports.push({ ip: '', prefix: 24, up: true, mode: 'access', vlan: 1, ...port });
  stepInto(s, 'iface', { iface: port.name });
  return reply('', true);
}

function staticRoute({ d }, remove, network, rawMask, via) {
  const prefix = readPrefix(rawMask);
  if (prefix === null || !isIP(network) || !isIP(via) || !validHost(via, 32))
    return error('Adresse, masque ou prochain saut incorrect.');
  if (toIP(netInt(network, prefix)) !== network)
    return error('Le préfixe doit commencer à l’adresse réseau.');
  const routes = (d.routes ??= []);
  const index = routes.findIndex((r) => r.network === network && +r.prefix === prefix && r.via === via);
  if (remove && index < 0) return error('Route statique introuvable.');
  if (remove) routes.splice(index, 1);
  else if (index < 0) routes.push({ network, prefix, via });
  return reply('', true);
}

function selectVlan({ d, s }, id) {
  if (!validVlan(id)) return error('Choisis un VLAN de 1 à 4094.');
  d.vlans ??= { 1: 'default' };
  d.vlans[+id] ??= 'VLAN' + id.padStart(4, '0');
  stepInto(s, 'vlan', { vlan: +id });
  return reply('', true);
}

function routeProtocol({ d, s }, proto, process) {
  if (proto === 'ospf' && !validNumber(process, 1, 65535))
    return error('Le numéro de processus OSPF doit être compris entre 1 et 65535.');
  const cfg = (d[proto] ??= { enabled: false, networks: [] });
  if (cfg.enabled && cfg.processId && +cfg.processId !== +process)
    return error('Un seul processus OSPF est pris en charge par routeur.');
  cfg.enabled = true;
  if (proto === 'ospf') cfg.processId = +process;
  stepInto(s, 'router', { proto });
  return reply('', true);
}

function networkEntry({ d, s }, remove, ip, wildcard, rawArea) {
  if (!isIP(ip)) return error('Adresse réseau IPv4 incorrecte.');
  const config = d[s.proto];
  if (!config) return error('Processus de routage introuvable.');
  const ospf = s.proto === 'ospf';
  if (ospf && !isIP(wildcard)) return error('Masque générique IPv4 incorrect.');
  const first = +ip.split('.')[0];
  const prefix = ospf
    ? readPrefix(toIP(~toInt(wildcard)))
    : first < 128
      ? 8
      : first < 192
        ? 16
        : first < 224
          ? 24
          : null;
  if (prefix === null) return error('Ce réseau nécessite un masque contigu et une adresse unicast.');
  const area = ospf && isIP(rawArea) ? toInt(rawArea) : Number(rawArea);
  if (ospf && (!Number.isInteger(area) || area < 0 || area > 4294967295))
    return error('Identifiant de zone OSPF incorrect.');
  const network = toIP(netInt(ip, prefix));
  const entries = (config.networks ??= []);
  const index = entries.findIndex(
    (r) => r.network === network && +r.prefix === prefix && (!ospf || +r.area === area),
  );
  if (remove && index < 0) return error('Réseau absent de ce processus.');
  if (remove) entries.splice(index, 1);
  else if (index < 0) entries.push(ospf ? { network, prefix, area } : { network, prefix });
  return reply('', true);
}

function dhcpService(d) {
  d.services ??= {};
  const cfg = (d.services.dhcp ??= {
    enabled: false,
    start: '',
    end: '',
    prefix: 24,
    gateway: '',
    dns: '',
  });
  cfg.pools ??= [];
  return cfg;
}

function selectPool({ d, s }, name) {
  if (!validName(name)) return error('Nom de pool incorrect.');
  const svc = dhcpService(d);
  if (!svc.pools.some((p) => p.name === name))
    svc.pools.push({ name, start: '', end: '', prefix: 24, gateway: '', dns: '' });
  svc.enabled = true;
  stepInto(s, 'pool', { pool: name });
  return reply('', true);
}

function excludeRange({ d }, remove, start, end = start) {
  if (!isIP(start) || !isIP(end) || toInt(start) > toInt(end))
    return error('Plage d’exclusion incorrecte.');
  const ranges = (dhcpService(d).exclusions ??= []);
  const i = ranges.findIndex((e) => e.start === start && e.end === end);
  if (remove && i < 0) return error('Exclusion introuvable.');
  if (remove) ranges.splice(i, 1);
  else if (i < 0) ranges.push({ start, end });
  return reply('', true);
}

function selectRange(ctx, input) {
  const devices = ctx.d.ports;
  const names = [];
  for (const item of input.split(',')) {
    const part = item.trim().split(/\s*-\s*/);
    const first = lookupPort(ctx.d, part[0]);
    if (!first || first.management || first.parent || part.length > 2)
      return error('Plage d’interfaces incorrecte.');
    if (part.length === 1) {
      names.push(first.name);
      continue;
    }
    const last = lookupPort(
      ctx.d,
      /^\d+$/.test(part[1]) ? first.name.replace(/\d+$/, part[1]) : part[1],
    );
    const stem = (name) => name.replace(/\d+$/, '');
    if (!last || stem(first.name) !== stem(last.name))
      return error('La plage doit appartenir à une même série de ports.');
    const start = +first.name.match(/\d+$/)[0],
      end = +last.name.match(/\d+$/)[0];
    if (end < start) return error('Plage inversée.');
    names.push(
      ...devices
        .filter(
          (p) =>
            stem(p.name) === stem(first.name) &&
            +p.name.slice(stem(p.name).length) >= start &&
            +p.name.slice(stem(p.name).length) <= end,
        )
        .map((p) => p.name),
    );
  }
  return stepInto(ctx.s, 'iface', { iface: names[0], range: [...new Set(names)] });
}

function showACLs(d, selected) {
  const lists = Object.entries(d.acls || {}).filter(([name]) => !selected || name === selected);
  if (!lists.length) return reply('Aucune liste d’accès correspondante.');
  return reply(
    lists
      .map(
        ([name, list]) =>
          list.type +
          ' ' +
          name +
          '\n' +
          list.rules.map((rule) => '  ' + rule.sequence + ' ' + ruleText(list.type, rule)).join('\n'),
      )
      .join('\n'),
  );
}

function enterACL({ d, s }, type, name) {
  if (!validAclName(name) || (aclType(name) && aclType(name) !== type))
    return error('Nom ou numéro de liste incorrect pour ce type.');
  d.acls ??= {};
  if (Object.hasOwn(d.acls, name) && d.acls[name].type !== type)
    return error('Une liste d’un autre type porte déjà ce nom.');
  d.acls[name] ??= { type, rules: [] };
  stepInto(s, 'acl', { acl: name });
  return reply('', true);
}

function addACLRule(d, type, name, action, expression, seq) {
  if (!validAclName(name) || !type || (aclType(name) && aclType(name) !== type))
    return error('Nom ou numéro ACL incorrect.');
  let rule;
  try {
    rule = parseRule(type, action, expression);
  } catch (e) {
    return error(e.message);
  }
  const list = ((d.acls ??= {})[name] ??= { type, rules: [] });
  if (list.type !== type) return error('Type de liste incompatible.');
  const sequence = seq === undefined ? (list.rules.at(-1)?.sequence || 0) + 10 : Number(seq);
  if (!Number.isSafeInteger(sequence) || sequence < 1 || sequence > 2147483647)
    return error('Numéro de séquence incorrect.');
  if (list.rules.some((r) => r.sequence === sequence))
    return error('Séquence déjà utilisée ; supprime-la d’abord avec « no ' + sequence + ' ».');
  list.rules.push({ sequence, ...rule });
  list.rules.sort((a, b) => a.sequence - b.sequence);
  return reply('', true);
}

function showTree(project, d, id) {
  if (!validVlan(id)) return error('Numéro de VLAN incorrect.');
  const tree = engine.spanningTree(project, d.id, +id);
  if (!tree) return reply('Aucune instance STP active pour le VLAN ' + id + '.');
  const rows = tree.ports.map((port) => [port.interface, port.role, port.state]);
  return reply(
    'VLAN ' +
      id +
      ' · Pont racine : ' +
      tree.rootName +
      '\n' +
      table(['Interface', 'Rôle', 'État'], rows),
  );
}

function staticRoute6(d, remove, dest, raw) {
  const network = ipv6Prefix(dest);
  if (!network) return error('Préfixe IPv6 incorrect, par exemple 2001:db8:2::/64.');
  const args = raw.trim().split(/\s+/);
  let via = '',
    iface = '';
  if (args.length === 1 && ip6(args[0])) via = ip6(args[0]);
  else {
    const port = lookupPort(d, args[0]);
    if (!port || args.length > 2 || (args[1] && !ip6(args[1])))
      return error('Indique une interface de sortie ou un prochain saut IPv6.');
    iface = port.name;
    if (args[1]) via = ip6(args[1]);
  }
  if (!iface && /^fe[89ab]/i.test(via))
    return error('Précise l’interface de sortie avec un prochain saut link-local.');
  const routes = (d.routes6 ??= []);
  const i = routes.findIndex(
    (r) =>
      r.network === network.address &&
      +r.prefix === network.length &&
      (r.via || '') === via &&
      (r.interface || '') === iface,
  );
  if (remove && i < 0) return error('Route IPv6 introuvable.');
  if (remove) routes.splice(i, 1);
  else if (i < 0)
    routes.push({ network: network.address, prefix: network.length, via, interface: iface });
  return reply('', true);
}

function natRule(d, remove, type, first, second) {
  let entry;
  if (type === 'statics') {
    if (!validHost(first, 32) || !validHost(second, 32) || first === second)
      return error('Indique deux adresses IPv4 unicast différentes.');
    entry = { inside: first, outside: second };
  } else {
    const port = lookupPort(d, second);
    if (!validAclName(first) || !port) return error('Nom ACL ou interface de sortie incorrect.');
    entry = { acl: first, interface: port.name };
  }
  const config = (d.nat ??= { statics: [], overloads: [] });
  const entries = (config[type] ??= []);
  const index = entries.findIndex((existing) =>
    Object.entries(entry).every(([key, value]) => existing[key] === value),
  );
  if (remove && index < 0) return error('Règle de traduction introuvable.');
  if (
    !remove &&
    index < 0 &&
    type === 'statics' &&
    entries.some((e) => e.inside === first || e.outside === second)
  )
    return error('Une adresse est déjà affectée à une autre traduction statique.');
  if (remove) entries.splice(index, 1);
  else if (index < 0) entries.push(entry);
  d.natTable = [];
  return reply('', true);
}

function natTable(d) {
  const addr = (ip, port) => (ip ? ip + (port != null ? ':' + port : '') : '—');
  const rows = (d.nat?.statics ?? []).map((n) => ['static', n.outside, n.inside, '—']);
  for (const n of d.natTable ?? [])
    rows.push([
      n.protocol,
      addr(n.insideGlobal, n.globalPort),
      addr(n.insideLocal, n.localPort),
      addr(n.outside, n.outsidePort),
    ]);
  return reply(table(['Protocole', 'Inside global', 'Inside local', 'Outside global'], rows));
}

function mainCommands(ctx, add) {
  const { d, project, s } = ctx;
  const isSwitch = d.type === 'switch';
  const privileged = s.mode === 'exec';
  add('show ip interface brief', () => showBrief(ctx));
  add('show interfaces', () => showInterfaces(ctx));
  add('show interfaces <interface...>', (name) => showInterfaces(ctx, name));
  add('show ip route', () => showRoutes(ctx));
  add('show ip route <ipv4>', (target) => showRoutes(ctx, target));
  add('show ipv6 route', () =>
    reply(
      table(
        ['Code', 'Préfixe IPv6', 'Prochain saut', 'Interface'],
        engine
          .routes6For(project, d.id)
          .map((r) => [r.protocol, r.network + '/' + r.prefix, r.via || 'direct', r.interface || '—']),
      ),
    ),
  );
  add('show ipv6 interface brief', () =>
    reply(
      table(
        ['Interface', 'IPv6', 'Link-local', 'État'],
        d.ports
          .filter((p) => p.ipv6 || p.ipv6Enabled || p.linkLocal)
          .map((p) => [
            p.name,
            p.ipv6 ? p.ipv6 + '/' + (p.prefix6 ?? 64) : '—',
            engine.linkLocal6(d, p),
            operational(project, d, p) ? 'up' : 'down',
          ]),
      ),
    ),
  );
  add('show ipv6 neighbors', () =>
    reply(
      table(
        ['IPv6', 'MAC', 'Interface'],
        (d.ndp ?? []).map((n) => [n.ip, n.mac, n.interface]),
      ),
    ),
  );
  add('show access-lists', () => showACLs(d));
  add('show access-lists <nom>', (name) => showACLs(d, name));
  add('show ip access-lists', () => showACLs(d));
  add('show ip access-lists <nom>', (name) => showACLs(d, name));
  if (d.type === 'router') {
    add('show ip ospf neighbor', () =>
      reply(
        table(
          ['Voisin', 'Adresse', 'Interface locale', 'Interface distante', 'Zone'],
          engine
            .neighborsFor(project, d.id, 'O')
            .map((neighbor) => [
              neighbor.name,
              neighbor.address,
              neighbor.interface,
              neighbor.remoteInterface,
              neighbor.area,
            ]),
        ),
      ),
    );
    add('show ip nat translations', () => natTable(d));
    add('show ip nat statistics', () =>
      reply(
        [
          'Traductions statiques : ' + (d.nat?.statics?.length || 0),
          'Entrées dynamiques : ' + (d.natTable?.length || 0),
          'Inside : ' +
            (d.ports
              .filter((p) => p.nat === 'inside')
              .map((p) => p.name)
              .join(', ') || '—'),
          'Outside : ' +
            (d.ports
              .filter((p) => p.nat === 'outside')
              .map((p) => p.name)
              .join(', ') || '—'),
        ].join('\n'),
      ),
    );
    add('show ip dhcp pool', () => {
      const cfg = d.services?.dhcp;
      const pools = [...(cfg?.start ? [cfg] : []), ...(cfg?.pools || [])];
      return reply(
        table(
          ['Pool', 'Début', 'Fin', 'Passerelle', 'DNS'],
          pools.map((p, i) => [p.name || 'POOL' + (i + 1), p.start, p.end, p.gateway, p.dns]),
        ),
      );
    });
    if (privileged)
      add('clear ip nat translation *', () => {
        d.natTable = [];
        return reply('Traductions dynamiques effacées.', true);
      });
  }
  add('show arp', () => showArp(ctx));
  add('show ip arp', () => showArp(ctx));
  add('show cdp neighbors', () => showNeighbors(ctx));
  add('show ip protocols', () => {
    if (d.type !== 'router') return reply('Routage dynamique indisponible sur ce modèle.');
    const protocols = ['ospf', 'rip'].filter((proto) => d[proto]?.enabled);
    return reply(
      protocols
        .map(
          (proto) =>
            proto.toUpperCase() +
            (proto === 'ospf' ? ' ' + (d.ospf.processId || 1) : ' v2') +
            '\n' +
            (d[proto].networks ?? [])
              .map(
                (n) => '  ' + n.network + '/' + n.prefix + (proto === 'ospf' ? ' area ' + n.area : ''),
              )
              .join('\n'),
        )
        .join('\n') || 'Aucun protocole de routage dynamique activé.',
    );
  });
  if (isSwitch) {
    add('show spanning-tree', () =>
      reply(
        Object.keys(d.vlans || { 1: 'default' })
          .map((id) => showTree(project, d, id).text)
          .join('\n\n'),
      ),
    );
    add('show spanning-tree vlan <id>', (id) => showTree(project, d, id));
    add('show vlan brief', () => showVlans(ctx));
    add('show vlan', () => showVlans(ctx));
    add('show interfaces trunk', () =>
      reply(
        table(
          ['Port', 'VLAN natif', 'VLAN autorisés', 'État'],
          d.ports
            .filter((p) => !p.management && p.mode === 'trunk')
            .map((p) => [
              p.name,
              p.nativeVlan || 1,
              p.allowedVlans?.join(',') ?? 'all',
              operational(project, d, p) ? 'trunking' : 'down',
            ]),
        ),
      ),
    );
    add('show interfaces status', () =>
      reply(
        table(
          ['Port', 'État', 'VLAN'],
          d.ports
            .filter((p) => !p.management)
            .map((p) => [
              p.name,
              p.up === false ? 'disabled' : operational(project, d, p) ? 'connected' : 'notconnect',
              p.mode === 'trunk' ? 'trunk' : p.vlan || 1,
            ]),
        ),
      ),
    );
    add('show mac address-table', () =>
      reply(
        table(
          ['VLAN', 'Adresse MAC', 'Port'],
          (d.macTable ?? []).map((row) => [row.vlan, row.mac, row.interface]),
        ),
      ),
    );
  }
  add('ping <destination>', (target) => diagnostics(ctx, 'icmp', target));
  add('ping ipv6 <destination>', (target) => diagnostics(ctx, 'icmp', target));
  add('traceroute <destination>', (target) => diagnostics(ctx, 'traceroute', target));
  add('traceroute ipv6 <destination>', (target) => diagnostics(ctx, 'traceroute', target));
  if (!privileged) {
    add('enable', () => stepInto(s, 'exec'));
    return;
  }
  add('disable', () => stepInto(s, 'user'));
  add('configure terminal', () => stepInto(s, 'config'));
  add('show running-config', () => reply(runningConfig(d)));
  add('show startup-config', () =>
    reply(d.startupConfig || 'Aucune configuration de démarrage enregistrée.'),
  );
  const save = () => {
    d.startupConfig = runningConfig(d);
    return reply('Configuration de démarrage enregistrée.\n[OK]', true);
  };
  add('copy running-config startup-config', save);
  add('write memory', save);
  add('write', save);
}

function hostCommands(ctx, add) {
  const { d } = ctx;
  add('ipconfig', () => reply(hostConfig(d)));
  add('ipconfig /all', () => reply(hostConfig(d)));
  add('ipconfig /renew', () => dhcpRequest(ctx));
  add('ipconfig /renew <interface>', (p) =>
    lookupPort(d, p) ? dhcpRequest(ctx, lookupPort(d, p)) : error('Interface introuvable.'),
  );
  add('arp -a', () => showArp(ctx));
  add('ping <destination>', (target) => diagnostics(ctx, 'icmp', target));
  add('tracert <destination>', (target) => diagnostics(ctx, 'traceroute', target));
  add('traceroute <destination>', (target) => diagnostics(ctx, 'traceroute', target));
  add('nslookup <nom>', (target) => diagnostics(ctx, 'dns', target));
  add('http <destination>', (target) =>
    diagnostics(ctx, 'http', target.replace(/^http:\/\//i, '').replace(/\/$/, '')),
  );
}

function globalCommands(ctx, add) {
  const { d, s } = ctx;
  add('hostname <nom>', (name) => {
    if (!validName(name))
      return error(
        'Nom invalide. Utilise 1 à 63 lettres, chiffres, points, tirets ou caractères de soulignement.',
      );
    d.name = name;
    return reply('', true);
  });
  add('interface <port...>', (input) => {
    const result = selectInterface(ctx, input);
    if (!result.text) delete s.range;
    return result;
  });
  add('interface range <ports...>', (input) => selectRange(ctx, input));
  add('ip name-server <ipv4>', (ip) => {
    if (!isIP(ip)) return error('Adresse DNS incorrecte.');
    d.dns = ip;
    return reply('', true);
  });
  add('ip default-gateway <ipv4>', (ip) => {
    if (!isIP(ip) || d.type !== 'switch')
      return error(
        'Cette commande configure la passerelle IPv4 d’un switch. Sur un routeur, utilise « ip route 0.0.0.0 0.0.0.0 <prochain-saut> ».',
      );
    d.gateway = ip;
    return reply('', true);
  });
  if (d.type === 'switch') {
    add('vlan <id>', (id) => selectVlan(ctx, id));
    add('spanning-tree vlan <id> priority <valeur>', (id, value) => {
      if (!validVlan(id) || !validNumber(value, 0, 61440) || +value % 4096 !== 0)
        return error('VLAN ou priorité STP incorrecte. Utilise un multiple de 4096 entre 0 et 61440.');
      (d.stpPriority ??= {})[+id] = +value;
      return reply('', true);
    });
    add('no vlan <id>', (id) => {
      if (!validVlan(id) || +id === 1 || !Object.hasOwn(d.vlans ?? {}, +id))
        return error('VLAN introuvable ou VLAN par défaut.');
      delete d.vlans[+id];
      return reply('', true);
    });
    return;
  }
  add('ip route <réseau> <masque> <prochain-saut>', (...args) => staticRoute(ctx, false, ...args));
  add('no ip route <réseau> <masque> <prochain-saut>', (...args) => staticRoute(ctx, true, ...args));
  for (const negative of [false, true]) {
    const start = negative ? 'no ' : '';
    add(start + 'ipv6 unicast-routing', () => {
      d.ipv6Routing = !negative;
      return reply('', true);
    });
    add(start + 'ipv6 route <préfixe> <sortie...>', (prefix, output) =>
      staticRoute6(d, negative, prefix, output),
    );
    add(start + 'ip nat inside source static <locale> <globale>', (inside, outside) =>
      natRule(d, negative, 'statics', inside, outside),
    );
    add(start + 'ip nat inside source list <acl> interface <port> overload', (acl, port) =>
      natRule(d, negative, 'overloads', acl, port),
    );
  }
  for (const type of ['standard', 'extended']) {
    add('ip access-list ' + type + ' <nom>', (name) => enterACL(ctx, type, name));
    add('no ip access-list ' + type + ' <nom>', (name) => {
      if (!Object.hasOwn(d.acls || {}, name) || d.acls[name].type !== type)
        return error('Liste d’accès introuvable.');
      delete d.acls[name];
      return reply('', true);
    });
  }
  for (const action of ['permit', 'deny'])
    add('access-list <numéro> ' + action + ' <règle...>', (id, expr) =>
      addACLRule(d, aclType(id), id, action, expr),
    );
  add('no access-list <numéro>', (id) => {
    if (!aclType(id) || !Object.hasOwn(d.acls || {}, id))
      return error('Liste d’accès numérotée introuvable.');
    delete d.acls[id];
    return reply('', true);
  });
  add('router ospf <processus>', (process) => routeProtocol(ctx, 'ospf', process));
  add('router rip', () => routeProtocol(ctx, 'rip'));
  add('no router ospf <processus>', (process) => {
    if (!d.ospf?.enabled || +(d.ospf.processId || 1) !== +process)
      return error('Processus OSPF introuvable.');
    d.ospf = { enabled: false, networks: [] };
    return reply('', true);
  });
  add('no router rip', () => {
    d.rip = { enabled: false, networks: [] };
    return reply('', true);
  });
  add('ip dhcp pool <nom>', (name) => selectPool(ctx, name));
  add('no ip dhcp pool <nom>', (name) => {
    const svc = dhcpService(d);
    const i = svc.pools.findIndex((p) => p.name === name);
    if (i < 0) return error('Pool introuvable.');
    svc.pools.splice(i, 1);
    return reply('', true);
  });
  for (const negative of [false, true]) {
    const stem = (negative ? 'no ' : '') + 'ip dhcp excluded-address <début>';
    add(stem, (ip) => excludeRange(ctx, negative, ip));
    add(stem + ' <fin>', (start, end) => excludeRange(ctx, negative, start, end));
    add((negative ? 'no ' : '') + 'service dhcp', () => {
      dhcpService(d).enabled = !negative;
      return reply('', true);
    });
  }
}

function interfaceCommands(ctx, add) {
  const { d, s } = ctx;
  const ports = (s.range || [s.iface]).map((name) => lookupPort(d, name)).filter(Boolean);
  if (!ports.length) return;
  const first = ports[0];
  const assign = (fields) => {
    ports.forEach((p) => Object.assign(p, fields));
    return reply('', true);
  };
  add('description <texte...>', (text) => assign({ description: text.slice(0, 200) }));
  add('no description', () => assign({ description: '' }));
  add('shutdown', () => assign({ up: false }));
  add('no shutdown', () => assign({ up: true }));
  if (d.type === 'router' || first.management) {
    if (ports.length === 1) {
      add('ip address <ipv4> <masque>', (ip, rawMask) => needAddress(first, ip, rawMask));
      add('ip address dhcp', () => dhcpRequest(ctx, first));
      add('ipv6 address <préfixe>', (input) => {
        const value = ipv6Prefix(input);
        if (!value || /^(ff|fe[89ab])/i.test(value.address) || ['::', '::1'].includes(value.address))
          return error(
            'Adresse IPv6 unicast attendue avec son préfixe. Pour une adresse link-local, ajoute « link-local ».',
          );
        return assign({ ipv6: value.address, prefix6: value.length, ipv6Enabled: true });
      });
      add('ipv6 address <adresse> link-local', (input) => {
        const addr = ip6(input);
        return addr && /^fe[89ab]/i.test(addr)
          ? assign({ linkLocal: addr, ipv6Enabled: true })
          : error('Adresse link-local attendue (fe80::/10).');
      });
    }
    add('no ip address', () => assign({ ip: '', dhcp: false }));
    add('ipv6 enable', () => assign({ ipv6Enabled: true }));
    add('no ipv6 address', () => assign({ ipv6: '', linkLocal: '' }));
    add('no ipv6 enable', () => assign({ ipv6Enabled: false }));
    if (d.type === 'router') {
      for (const side of ['inside', 'outside']) {
        add('ip nat ' + side, () => assign({ nat: side }));
        add('no ip nat ' + side, () => {
          for (const p of ports) if (p.nat === side) p.nat = '';
          return reply('', true);
        });
      }
      add('ip helper-address <ipv4>', (ip) =>
        validHost(ip, 32) ? assign({ helper: ip }) : error('Adresse du serveur DHCP incorrecte.'),
      );
      add('no ip helper-address <ipv4>', (ip) => {
        if (!ports.every((p) => p.helper === ip))
          return error('Relais DHCP introuvable sur cette interface.');
        return assign({ helper: '' });
      });
      add('ip ospf cost <métrique>', (cost) =>
        validNumber(cost, 1, 65535)
          ? assign({ ospfCost: +cost })
          : error('Coût OSPF attendu entre 1 et 65535.'),
      );
      for (const direction of ['in', 'out']) {
        add('ip access-group <acl> ' + direction, (name) => {
          if (!validAclName(name)) return error('Nom ou numéro ACL incorrect.');
          ports.forEach((p) => {
            (p.acl ??= {})[direction] = name;
          });
          return reply('', true);
        });
        add('no ip access-group <acl> ' + direction, (name) => {
          if (!ports.every((p) => p.acl?.[direction] === name))
            return error('Cette ACL n’est pas appliquée dans ce sens.');
          ports.forEach((p) => {
            delete p.acl[direction];
          });
          return reply('', true);
        });
      }
    }
    const encapsulate = (vlan, native) => {
      if (!validVlan(vlan)) return error('VLAN 802.1Q incorrect.');
      if (d.ports.some((p) => p !== first && p.parent === first.parent && +p.tag === +vlan))
        return error('Ce VLAN est déjà affecté à une sous-interface du port.');
      return assign({ tag: +vlan, native });
    };
    if (first.parent) {
      add('encapsulation dot1q <vlan>', (vlan) => encapsulate(vlan, false));
      add('encapsulation dot1q <vlan> native', (vlan) => encapsulate(vlan, true));
    }
    return;
  }
  add('spanning-tree cost <coût>', (cost) =>
    validNumber(cost, 1, 200000000) ? assign({ stpCost: +cost }) : error('Coût STP incorrect.'),
  );
  add('switchport mode access', () => assign({ mode: 'access' }));
  add('switchport mode trunk', () => assign({ mode: 'trunk' }));
  add('switchport access vlan <id>', (id) => {
    if (!validVlan(id)) return error('Choisis un VLAN de 1 à 4094.');
    (d.vlans ??= { 1: 'default' })[+id] ??= 'VLAN' + id.padStart(4, '0');
    return assign({ vlan: +id });
  });
  add('switchport trunk native vlan <id>', (id) =>
    validVlan(id) ? assign({ nativeVlan: +id }) : error('VLAN natif incorrect.'),
  );
  add('switchport trunk allowed vlan <liste>', (list) => {
    if (list.toLowerCase() === 'all') {
      ports.forEach((p) => {
        delete p.allowedVlans;
      });
      return reply('', true);
    }
    const allowed = list.toLowerCase() === 'none' ? [] : vlanList(list);
    return allowed
      ? assign({ allowedVlans: allowed })
      : error('Liste attendue, par exemple 10,20,30-35.');
  });
  for (const op of ['add', 'remove'])
    add('switchport trunk allowed vlan ' + op + ' <liste>', (text) => {
      const ids = vlanList(text);
      if (!ids) return error('Liste de VLAN incorrecte.');
      for (const p of ports) {
        const vlanSet = new Set(p.allowedVlans || Array.from({ length: 4094 }, (_, i) => i + 1));
        for (const id of ids) op === 'add' ? vlanSet.add(id) : vlanSet.delete(id);
        p.allowedVlans = [...vlanSet].sort((a, b) => a - b);
      }
      return reply('', true);
    });
}

function subCommands(ctx, add) {
  const { d, s } = ctx;
  if (s.mode === 'acl' && d.acls?.[s.acl]) {
    const list = d.acls[s.acl];
    for (const action of ['permit', 'deny']) {
      add(action + ' <règle...>', (expr) => addACLRule(d, list.type, s.acl, action, expr));
      add('<séquence> ' + action + ' <règle...>', (seq, expr) =>
        addACLRule(d, list.type, s.acl, action, expr, seq),
      );
    }
    add('no <séquence>', (seq) => {
      const i = list.rules.findIndex((r) => r.sequence === +seq);
      if (i < 0) return error('Séquence introuvable.');
      list.rules.splice(i, 1);
      return reply('', true);
    });
    return;
  }
  if (s.mode === 'iface') return interfaceCommands(ctx, add);
  if (s.mode === 'vlan') {
    add('name <nom>', (name) => {
      if (!validName(name) || name.length > 32)
        return error('Nom de VLAN incorrect (32 caractères maximum).');
      d.vlans[s.vlan] = name;
      return reply('', true);
    });
    return;
  }
  if (s.mode === 'router') {
    for (const negative of [false, true]) {
      const pattern =
        (negative ? 'no ' : '') +
        (s.proto === 'ospf' ? 'network <ipv4> <wildcard> area <zone>' : 'network <ipv4>');
      add(pattern, (...args) => networkEntry(ctx, negative, ...args));
      add((negative ? 'no ' : '') + 'passive-interface <port...>', (name) => {
        const p = lookupPort(d, name);
        if (!p) return error('Interface introuvable.');
        p.passive = !negative;
        return reply('', true);
      });
    }
    if (s.proto === 'rip') {
      add('version <numéro>', (version) =>
        +version === 2 ? reply('RIPv2 actif.') : error('Seule la version 2 de RIP est simulée.'),
      );
      add('no auto-summary', () => reply('RIPv2 annonce les préfixes avec leur masque.'));
    }
    return;
  }
  if (s.mode === 'pool') {
    const pool = d.services?.dhcp?.pools?.find((p) => p.name === s.pool);
    if (!pool) return;
    add('network <réseau> <masque>', (network, rawMask) => {
      const prefix = readPrefix(rawMask);
      if (
        !isIP(network) ||
        prefix === null ||
        prefix < 1 ||
        prefix > 30 ||
        toIP(netInt(network, prefix)) !== network
      )
        return error('Réseau DHCP incorrect. Utilise son adresse réseau et un masque de /1 à /30.');
      const base = netInt(network, prefix);
      Object.assign(pool, {
        network,
        prefix,
        start: toIP(base + 1),
        end: toIP(base + 2 ** (32 - prefix) - 2),
      });
      return reply('', true);
    });
    for (const [command, prop] of [
      ['default-router', 'gateway'],
      ['dns-server', 'dns'],
    ])
      add(command + ' <ipv4>', (ip) => {
        if (!isIP(ip)) return error('Adresse IPv4 incorrecte.');
        pool[prop] = ip;
        return reply('', true);
      });
  }
}

function catalog(ctx, onlyGlobal = false) {
  const { d, s } = ctx;
  const entries = [];
  const add = (pattern, run) => entries.push({ pattern, tokens: pattern.split(' '), run });
  if (!networkOS(d)) hostCommands(ctx, add);
  else if (onlyGlobal || s.mode === 'config') globalCommands(ctx, add);
  else if (['user', 'exec'].includes(s.mode || 'user')) mainCommands(ctx, add);
  else subCommands(ctx, add);
  if (networkOS(d) && !onlyGlobal) {
    add('exit', () =>
      stepInto(
        s,
        ['user', 'exec'].includes(s.mode || 'user') ? 'user' : s.mode === 'config' ? 'exec' : 'config',
      ),
    );
    if (!['user', 'exec'].includes(s.mode || 'user')) {
      add('end', () => stepInto(s, 'exec'));
      add('do <commande...>', (input) => runCommand(ctx.project, d.id, { mode: 'exec' }, input));
    }
  }
  return entries;
}

// Literal keywords can be shortened to any unambiguous prefix. Variables keep their original case.
function match(entry, words, forHelp = false) {
  let score = 0;
  const args = [];
  let i = 0;
  for (const token of entry.tokens) {
    if (i >= words.length) return forHelp ? { score, args } : null;
    if (token.startsWith('<')) {
      if (token.endsWith('...>')) {
        args.push(words.slice(i).join(' '));
        i = words.length;
        break;
      }
      args.push(words[i]);
    } else {
      const word = words[i].toLowerCase();
      if (!token.startsWith(word)) return null;
      score += token === word ? 3 : 2;
    }
    i++;
  }
  return i === words.length ? { score, args } : null;
}

export function runCommand(project, id, session, input) {
  const d = findDevice(project, id);
  if (!d) return error('Équipement introuvable.');
  const s = session || {};
  const line = String(input ?? '').trim();
  if (!line || line.startsWith('!')) return reply();
  if (line.length > 2048) return error('Commande trop longue.');
  const ctx = { project, d, s };
  const commands = catalog(ctx);
  const help = line.endsWith('?') || /^help$/i.test(line);
  const body = help ? (line.endsWith('?') ? line.slice(0, -1).trim() : '') : line;
  const words = body ? body.split(/\s+/) : [];
  if (help) {
    const options = commands
      .filter((entry) => match(entry, words, true))
      .map((entry) => '  ' + entry.pattern);
    return reply(options.length ? options.join('\n') : 'Aucune commande correspondante dans ce mode.');
  }
  const matching = (list) =>
    list.map((entry) => ({ entry, result: match(entry, words) })).filter((item) => item.result);
  let candidates = matching(commands);
  if (!candidates.length && ['iface', 'vlan', 'router', 'pool', 'acl'].includes(s.mode))
    candidates = matching(catalog(ctx, true));
  if (!candidates.length) {
    if (commands.some((entry) => match(entry, words, true)))
      return error('Commande incomplète. Ajoute « ? » pour afficher la syntaxe.');
    return error(
      'Commande inconnue dans ce mode. Saisis « ? » pour afficher les commandes disponibles.',
    );
  }
  const score = Math.max(...candidates.map((item) => item.result.score));
  const best = candidates.filter((item) => item.result.score === score);
  if (best.length > 1)
    return error('Commande ambiguë : ' + best.map((item) => item.entry.pattern).join(' / '));
  return best[0].entry.run(...best[0].result.args);
}
