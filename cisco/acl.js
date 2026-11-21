// Règles IPv4 ordonnées. Les adresses et les ports sont ceux de la maquette.
export const isAddress = (ip) =>
  typeof ip === 'string' &&
  /^(?:0|[1-9]\d{0,2})(?:\.(?:0|[1-9]\d{0,2})){3}$/.test(ip) &&
  ip.split('.').every((octet) => Number(octet) <= 255);
const addressNumber = (ip) => ip.split('.').reduce((value, byte) => value * 256 + Number(byte), 0);
const namedPorts = { www: 80, http: 80, https: 443, domain: 53, bootps: 67, bootpc: 68 };
export function aclType(name) {
  if (!/^\d+$/.test(name)) return null;
  const n = +name;
  if ((n >= 1 && n <= 99) || (n >= 1300 && n <= 1999)) return 'standard';
  if ((n >= 100 && n <= 199) || (n >= 2000 && n <= 2699)) return 'extended';
  return null;
}
export const validAclName = (name) =>
  Boolean(aclType(name)) ||
  (/^[a-z][a-z\d_-]{0,62}$/i.test(name) && name !== 'prototype' && !(name in Object.prototype));

function takeAddress(words) {
  const first = words.shift();
  if (first === 'any') return { ip: '0.0.0.0', wildcard: '255.255.255.255' };
  const host = first === 'host';
  const ip = host ? words.shift() : first;
  if (!isAddress(ip))
    throw Error('Adresse attendue : « any », « host <ipv4> » ou « <réseau> <wildcard> ».');
  // IOS accepte également une adresse seule pour une règle standard.
  let wildcard = '0.0.0.0';
  if (!host && isAddress(words[0])) wildcard = words.shift();
  return { ip, wildcard };
}

function takePort(words) {
  if (!['eq', 'neq', 'lt', 'gt', 'range'].includes(words[0])) return null;
  const op = words.shift();
  const readPort = () => {
    const token = words.shift();
    if (Object.hasOwn(namedPorts, token)) return namedPorts[token];
    if (!/^\d+$/.test(token || '') || +token > 65535) throw Error('Port TCP/UDP incorrect.');
    return +token;
  };
  const low = readPort();
  const high = op === 'range' ? readPort() : low;
  if (high < low) throw Error('Plage de ports inversée.');
  return { op, low, high };
}

export function parseRule(type, action, expression) {
  const words = expression.toLowerCase().trim().split(/\s+/);
  const protocol = type === 'standard' ? 'ip' : words.shift();
  if (!['ip', 'icmp', 'tcp', 'udp'].includes(protocol))
    throw Error('Protocoles IPv4 disponibles : ip, icmp, tcp, udp.');
  const source = takeAddress(words);
  const transport = protocol === 'tcp' || protocol === 'udp';
  const sourcePort = transport ? takePort(words) : null;
  const destination = type === 'extended' ? takeAddress(words) : null;
  const destinationPort = transport ? takePort(words) : null;
  let icmp = null;
  if (protocol === 'icmp' && ['echo', 'echo-reply', 'time-exceeded'].includes(words[0]))
    icmp = words.shift();
  if (words.length) throw Error('Paramètre de règle non pris en charge : ' + words.join(' '));
  return { action, protocol, source, sourcePort, destination, destinationPort, icmp };
}

function addressText(addr) {
  if (addr.wildcard === '255.255.255.255') return 'any';
  return addr.wildcard === '0.0.0.0' ? 'host ' + addr.ip : addr.ip + ' ' + addr.wildcard;
}
function portText(p) {
  return p ? p.op + ' ' + p.low + (p.op === 'range' ? ' ' + p.high : '') : '';
}
export function ruleText(type, rule) {
  return [
    rule.action,
    type === 'extended' ? rule.protocol : '',
    addressText(rule.source),
    portText(rule.sourcePort),
    rule.destination ? addressText(rule.destination) : '',
    portText(rule.destinationPort),
    rule.icmp,
  ]
    .filter(Boolean)
    .join(' ');
}

function matchesAddress(addr, ip) {
  if (!addr || !isAddress(ip)) return !addr;
  return ((addressNumber(addr.ip) ^ addressNumber(ip)) & ~addressNumber(addr.wildcard)) === 0;
}
function matchesPort(condition, port) {
  if (!condition) return true;
  if (port == null) return false;
  switch (condition.op) {
    case 'eq':
      return port === condition.low;
    case 'neq':
      return port !== condition.low;
    case 'lt':
      return port < condition.low;
    case 'gt':
      return port > condition.low;
    case 'range':
      return port >= condition.low && port <= condition.high;
    default:
      return false;
  }
}
function packetFields(packet) {
  const kind = String(packet.protocol).toLowerCase();
  const label = String(packet.label || '').toLowerCase();
  let protocol = kind,
    service,
    response = false;
  if (kind === 'dns') {
    protocol = 'udp';
    service = 53;
    response = label.includes('réponse');
  } else if (kind === 'dhcp') {
    protocol = 'udp';
    service = 67;
  } else if (kind === 'tcp' || kind === 'http') {
    protocol = 'tcp';
    service = 80;
    response = label.includes('200 ok') || label.includes('syn, ack') || label.includes('rst');
  }
  let icmp = '';
  if (kind === 'icmp') {
    if (/time exceeded|durée de vie/.test(label)) icmp = 'time-exceeded';
    else if (/reply|réponse/.test(label)) icmp = 'echo-reply';
    else icmp = 'echo';
  }
  return {
    protocol,
    icmp,
    sourcePort: packet.sourcePort ?? (service && (response ? service : 49152)),
    destinationPort: packet.destinationPort ?? (service && (response ? 49152 : service)),
  };
}
function firstMatch(list, packet) {
  const fields = packetFields(packet);
  for (const rule of list?.rules ?? []) {
    if (rule.protocol !== 'ip' && rule.protocol !== fields.protocol) continue;
    if (rule.icmp && rule.icmp !== fields.icmp) continue;
    if (
      !matchesAddress(rule.source, packet.source) ||
      !matchesAddress(rule.destination, packet.destination)
    )
      continue;
    if (
      !matchesPort(rule.sourcePort, fields.sourcePort) ||
      !matchesPort(rule.destinationPort, fields.destinationPort)
    )
      continue;
    return rule;
  }
  return null;
}
export function matchesAcl(device, name, packet) {
  return (
    Object.hasOwn(device.acls || {}, name) && firstMatch(device.acls[name], packet)?.action === 'permit'
  );
}
export function filterPacket(device, port, direction, packet) {
  const name = port?.acl?.[direction];
  if (!name || !Object.hasOwn(device.acls || {}, name)) return null;
  const list = device.acls[name];
  if (!list.rules?.length) return null;
  const rule = firstMatch(list, packet);
  if (rule?.action === 'permit') return null;
  if (rule)
    return (
      'Paquet refusé par l’ACL ' +
      name +
      ', règle ' +
      rule.sequence +
      ', sur ' +
      device.name +
      ' (' +
      port.name +
      ' ' +
      direction +
      ').'
    );
  return (
    'Paquet refusé par le deny implicite de l’ACL ' +
    name +
    ' sur ' +
    device.name +
    ' (' +
    port.name +
    ' ' +
    direction +
    ').'
  );
}
