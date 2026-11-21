import { isAddress, validAclName } from './acl.js';

const types = ['router', 'switch', 'server', 'pc', 'ap', 'laptop'];
const limit = 5 * 1024 * 1024;
const bad = (message) => {
  throw Error('Projet invalide. ' + message);
};
const record = (value, path) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) bad(path + ' doit être un objet.');
  return value;
};
function array(value, path, max = 1024) {
  if (!Array.isArray(value) || value.length > max)
    bad(path + ' doit être une liste de ' + max + ' éléments au maximum.');
  return value;
}
function string(value, path, max = 128, empty = false) {
  if (typeof value !== 'string' || (!empty && !value.trim()) || value.length > max)
    bad(path + ' contient un texte absent ou trop long.');
  return value;
}
function number(value, path, min, max, integer = true) {
  if (!Number.isFinite(value) || (integer && !Number.isInteger(value)) || value < min || value > max)
    bad(path + ' doit être compris entre ' + min + ' et ' + max + '.');
}
function oneOf(value, path, choices) {
  if (!choices.includes(value)) bad(path + ' contient une valeur inconnue.');
}
function bool(obj, key, path) {
  if (Object.hasOwn(obj, key) && typeof obj[key] !== 'boolean')
    bad(path + '.' + key + ' doit être un booléen.');
}
function addr(value, path, v6 = false, empty = false) {
  if (empty && value === '') return;
  if (!v6 && isAddress(value)) return;
  if (v6 && typeof value === 'string' && value.includes(':') && /^[a-f\d:.]+$/i.test(value)) {
    try {
      new URL('http://[' + value + ']/');
      return;
    } catch {}
  }
  bad(path + ' contient une adresse IPv' + (v6 ? '6' : '4') + ' incorrecte.');
}
function optional(obj, key, fn) {
  if (obj[key] !== undefined) fn(obj[key]);
}
function unique(set, key, path) {
  if (set.has(key)) bad(path + ' apparaît plusieurs fois.');
  set.add(key);
}
function identifier(value, path) {
  string(value, path);
  if (!/^[a-z\d._:-]+$/i.test(value) || Object.hasOwn(Object.prototype, value))
    bad(path + ' contient un identifiant incorrect.');
}
function verifyJson(root) {
  const protoKeys = new Set(['__proto__', 'prototype', 'constructor']);
  let count = 0,
    size = 0;
  function visit(value, depth, parentKey) {
    if (++count > 350000 || depth > 18 || size > limit)
      bad('La taille ou la profondeur du projet dépasse la limite autorisée.');
    if (typeof value === 'string') {
      size += value.length;
      if (value.length > limit || size > limit) bad('Le projet dépasse 5 Mo.');
      return;
    }
    if (value === null || typeof value === 'boolean' || Number.isFinite(value)) return;
    if (
      typeof value !== 'object' ||
      (!Array.isArray(value) && ![null, Object.prototype].includes(Object.getPrototypeOf(value)))
    )
      bad('Le contenu doit être du JSON.');
    for (const [k, v] of Object.entries(value)) {
      const dnsName = parentKey === 'records' && isAddress(v) && k !== '__proto__';
      if ((protoKeys.has(k) && !dnsName) || k.length > 512) bad('Une clé du projet est invalide.');
      size += k.length;
      visit(v, depth + 1, k);
    }
  }
  visit(root, 0);
}
function vlan(value, path) {
  number(value, path, 1, 4094);
}
function uniqueVlans(value, path) {
  const ids = new Set();
  for (const id of array(value, path, 4094)) {
    vlan(id, path);
    unique(ids, id, path + ' : VLAN ' + id);
  }
}
function checkPort(p, d, path) {
  record(p, path);
  string(p.name, path + '.name', 64);
  if (!/^[A-Za-z][\w/.-]*$/.test(p.name)) bad(path + ' contient un nom d’interface incorrect.');
  for (const key of ['up', 'native', 'dhcp', 'management', 'passive', 'ipv6Enabled']) bool(p, key, path);
  for (const key of ['ip', 'ipv6', 'linkLocal'])
    optional(p, key, (v) => addr(v, path + '.' + key, key !== 'ip', true));
  optional(p, 'helper', (v) => addr(v, path + '.helper', false, true));
  optional(p, 'nat', (v) => oneOf(v, path + '.nat', ['inside', 'outside', '']));
  optional(p, 'prefix', (v) => number(v, path + '.prefix', 0, 32));
  optional(p, 'prefix6', (v) => number(v, path + '.prefix6', 0, 128));
  optional(p, 'mode', (v) => oneOf(v, path + '.mode', ['access', 'trunk']));
  for (const key of ['vlan', 'nativeVlan', 'tag']) optional(p, key, (v) => vlan(v, path + '.' + key));
  optional(p, 'allowedVlans', (v) => uniqueVlans(v, path + '.allowedVlans'));
  optional(p, 'ospfCost', (v) => number(v, path + '.ospfCost', 1, 65535));
  optional(p, 'stpCost', (v) => number(v, path + '.stpCost', 1, 200000000));
  optional(p, 'mac', (v) => {
    if (typeof v !== 'string' || !/^([\da-f]{2}:){5}[\da-f]{2}$/i.test(v))
      bad(path + ' contient une adresse MAC incorrecte.');
  });
  if (p.management && d.type !== 'switch')
    bad(path + ' ne peut pas être une interface VLAN de gestion.');
  if (p.parent && (d.type !== 'router' || p.management))
    bad(path + ' ne peut pas être une sous-interface.');
  if (p.acl !== undefined) {
    for (const [dir, name] of Object.entries(record(p.acl, path + '.acl'))) {
      oneOf(dir, path + '.acl', ['in', 'out']);
      if (typeof name !== 'string' || !validAclName(name))
        bad(path + ' contient une référence ACL incorrecte.');
    }
  }
  optional(p, 'description', (v) => string(v, path + '.description', 1024, true));
  p.ip ??= '';
  p.prefix ??= 24;
  p.up ??= true;
}
function serviceConfig(s, path) {
  record(s, path);
  for (const key of ['dhcp', 'dns', 'http'])
    if (s[key] !== undefined) {
      record(s[key], path + '.' + key);
      bool(s[key], 'enabled', path + '.' + key);
    }
  if (s.http) optional(s.http, 'body', (v) => string(v, path + '.http.body', 65536, true));
  if (s.dns?.records !== undefined) {
    const entries = Object.entries(record(s.dns.records, path + '.dns.records'));
    if (entries.length > 2048) bad('Trop de noms DNS.');
    for (const [name, ip] of entries) {
      string(name, path + '.dns.records', 254);
      addr(ip, path + '.dns.records.' + name);
    }
  }
  if (s.dhcp) {
    const pools = array(s.dhcp.pools || [], path + '.dhcp.pools', 256);
    for (const p of [s.dhcp, ...pools]) {
      record(p, path + '.dhcp');
      for (const key of ['start', 'end', 'dns', 'gateway', 'network'])
        optional(p, key, (v) => addr(v, path + '.dhcp.' + key, false, true));
      optional(p, 'prefix', (v) => number(v, path + '.dhcp.prefix', 0, 32));
      optional(p, 'name', (v) => string(v, path + '.dhcp.name', 128));
      for (const ex of array(p.exclusions ?? [], path + '.dhcp.exclusions', 1024)) {
        record(ex, path + '.dhcp.exclusions');
        addr(ex.start, path + '.dhcp.exclusions.start');
        optional(ex, 'end', (v) => addr(v, path + '.dhcp.exclusions.end'));
      }
    }
  }
}
function aclConfig(acls, path) {
  const entries = Object.entries(record(acls, path));
  if (entries.length > 256) bad('Trop de listes ACL sur un équipement.');
  const address = (obj, key) => {
    record(obj, key);
    addr(obj.ip, key);
    addr(obj.wildcard, key);
  };
  for (const [name, acl] of entries) {
    if (!validAclName(name)) bad(path + ' contient un nom d’ACL incorrect.');
    record(acl, path);
    oneOf(acl.type, path, ['standard', 'extended']);
    for (const rule of array(acl.rules, path + '.rules', 2048)) {
      record(rule, path);
      oneOf(rule.action, path, ['permit', 'deny']);
      oneOf(rule.protocol, path, ['ip', 'icmp', 'tcp', 'udp']);
      address(rule.source, path + '.source');
      if (rule.destination !== null && rule.destination !== undefined)
        address(rule.destination, path + '.destination');
      optional(rule, 'sequence', (v) => number(v, path + '.sequence', 1, 2147483647));
      for (const p of [rule.sourcePort, rule.destinationPort])
        if (p != null) {
          record(p, path + '.port');
          oneOf(p.op, path + '.port', ['eq', 'neq', 'lt', 'gt', 'range']);
          number(p.low, path + '.port', 0, 65535);
          number(p.high, path + '.port', p.low, 65535);
        }
    }
  }
}
function deviceConfig(d, path) {
  record(d, path);
  identifier(d.id, path + '.id');
  oneOf(d.type, path + '.type', types);
  string(d.name, path + '.name', 160);
  number(d.x, path + '.x', -100000, 100000, false);
  number(d.y, path + '.y', -100000, 100000, false);
  const ports = array(d.ports, path + '.ports', 128),
    names = new Set();
  if (!ports.length) bad(path + ' doit contenir au moins un port.');
  for (const p of ports) {
    checkPort(p, d, path + '.ports');
    unique(names, p.name.toLowerCase(), d.name + ' · ' + p.name);
  }
  for (const p of ports)
    if (p.parent) {
      const parent = ports.find((v) => v.name === p.parent);
      if (!parent || parent === p || parent.parent || parent.management)
        bad('Interface physique inconnue pour ' + d.name + ' · ' + p.name + '.');
    }
  for (const key of ['gateway', 'dns', 'gateway6'])
    optional(d, key, (v) => addr(v, path + '.' + key, key === 'gateway6', true));
  for (const key of ['routes', 'routes6'])
    for (const route of array(d[key] ?? [], path + '.' + key, 2048)) {
      record(route, path + '.' + key);
      const v6 = key === 'routes6';
      addr(route.network, path + '.' + key, v6);
      number(route.prefix, path + '.' + key, 0, v6 ? 128 : 32);
      optional(route, 'via', (v) => addr(v, path + '.' + key, v6, true));
      if (route.interface) string(route.interface, path + '.interface', 64);
      if (!route.via && !route.interface)
        bad('Route sans prochain saut ni interface sur ' + d.name + '.');
    }
  for (const key of ['ospf', 'rip'])
    if (d[key] !== undefined) {
      const proto = record(d[key], path + '.' + key);
      bool(proto, 'enabled', path + '.' + key);
      optional(proto, 'processId', (v) => number(v, path + '.processId', 1, 65535));
      for (const net of array(proto.networks ?? [], path + '.networks', 1024)) {
        record(net, path + '.networks');
        addr(net.network, path + '.networks');
        number(net.prefix, path + '.networks', 0, 32);
        if (
          net.area !== undefined &&
          !isAddress(net.area) &&
          !(
            (typeof net.area === 'number' || typeof net.area === 'string') &&
            /^\d+$/.test(String(net.area)) &&
            Number(net.area) <= 4294967295
          )
        )
          bad('Identifiant de zone OSPF incorrect sur ' + d.name + '.');
      }
    }
  if (d.vlans !== undefined)
    for (const [key, name] of Object.entries(record(d.vlans, path + '.vlans'))) {
      vlan(Number(key), path + '.vlans');
      string(name, path + '.vlans', 128, true);
    }
  if (d.stpPriority !== undefined)
    for (const [key, value] of Object.entries(record(d.stpPriority, path + '.stpPriority'))) {
      vlan(Number(key), path + '.stpPriority');
      number(value, path + '.stpPriority', 0, 61440);
    }
  if (d.wireless !== undefined) {
    const wifi = record(d.wireless, path + '.wireless');
    optional(wifi, 'ssid', (v) => string(v, path + '.ssid', 64, true));
    optional(wifi, 'key', (v) => string(v, path + '.key', 128, true));
  }
  if (d.services !== undefined) serviceConfig(d.services, path + '.services');
  if (d.acls !== undefined) aclConfig(d.acls, path + '.acls');
  if (d.nat !== undefined) {
    const nat = record(d.nat, path + '.nat');
    for (const r of array(nat.statics ?? [], path + '.nat.statics', 1024)) {
      record(r, path + '.nat.statics');
      addr(r.inside, path + '.nat.inside');
      addr(r.outside, path + '.nat.outside');
    }
    for (const r of array(nat.overloads ?? [], path + '.nat.overloads', 1024)) {
      record(r, path + '.nat.overloads');
      string(r.acl, path + '.nat.acl');
      string(r.interface, path + '.nat.interface', 64);
    }
  }
  bool(d, 'ipv6Routing', path);
  for (const key of ['arp', 'macTable', 'ndp', 'natTable'])
    if (d[key] !== undefined) {
      for (const entry of array(d[key], path + '.' + key, 8192)) record(entry, path + '.' + key);
    }
  optional(d, 'startupConfig', (v) => string(v, path + '.startupConfig', 262144, true));
  d.routes ??= [];
  d.vlans ??= { 1: 'default' };
  d.gateway ??= '';
  d.dns ??= '';
}

export function validateProject(raw) {
  if (typeof raw === 'string') {
    if (raw.length > limit) bad('Le fichier dépasse 5 Mo.');
    try {
      raw = JSON.parse(raw);
    } catch {
      bad('Le fichier doit contenir du JSON lisible.');
    }
  }
  verifyJson(raw);
  const project = structuredClone(record(raw, 'Projet'));
  if (project.version !== 1) bad('Version de projet non prise en charge.');
  string(project.name, 'Nom du projet', 160);
  const devices = array(project.devices, 'Équipements', 256),
    links = array(project.links, 'Liens', 1024);
  const byId = new Map(),
    portsById = new Map(),
    ids = new Set();
  for (const [index, d] of devices.entries()) {
    deviceConfig(d, 'Équipement ' + (index + 1));
    unique(ids, d.id, 'Identifiant ' + d.id);
    byId.set(d.id, d);
    portsById.set(d.id, new Map(d.ports.map((p) => [p.name, p])));
  }
  const used = new Set();
  for (const [index, link] of links.entries()) {
    const path = 'Lien ' + (index + 1);
    record(link, path);
    identifier(link.id, path + '.id');
    unique(ids, link.id, 'Identifiant ' + link.id);
    oneOf(link.type, path + '.type', ['ethernet', 'wifi']);
    const ends = [link.a, link.b].map((end) => {
      record(end, path);
      const d = byId.get(end.device),
        p = portsById.get(end.device)?.get(end.port);
      if (!d || !p || p.parent || p.management) bad(path + ' pointe vers un port physique inconnu.');
      if (/^wlan/i.test(p.name) !== (link.type === 'wifi'))
        bad(path + ' utilise un support incompatible avec ' + p.name + '.');
      const endpoint = JSON.stringify([d.id, p.name]);
      if (link.type !== 'wifi' || d.type !== 'ap')
        unique(used, endpoint, 'Connexion de ' + d.name + ' · ' + p.name);
      return d;
    });
    if (ends[0] === ends[1]) bad(path + ' relie un équipement à lui-même.');
    if (
      link.type === 'wifi' &&
      (!ends.some((d) => d.type === 'ap') || !ends.some((d) => d.type === 'laptop'))
    )
      bad(path + ' doit associer un portable à un point d’accès.');
  }
  return project;
}
