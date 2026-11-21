import { matchesAcl } from './acl.js';

// Un identifiant ICMP distingue les échanges Echo de la même manière que le
// port source distingue deux connexions TCP ou deux requêtes UDP.
export function transport(protocol) {
  if (protocol === 'TCP' || protocol === 'HTTP') return { kind: 'tcp', src: 49152, dst: 80 };
  if (protocol === 'DNS') return { kind: 'udp', src: 49152, dst: 53 };
  if (protocol === 'DHCP') return { kind: 'udp', src: 67, dst: 67 };
  return { kind: 'icmp', src: 1, dst: 0 };
}
export const replyFlow = (flow) => ({ kind: flow.kind, src: flow.dst, dst: flow.src });
const position = (device, events, detail) =>
  events.push({ protocol: 'NAT', from: device.id, to: device.id, detail });
export function alias(ref, address) {
  return (
    ref.d.type === 'router' &&
    ref.p.nat === 'outside' &&
    ref.d.nat?.statics?.some((row) => row.outside === address)
  );
}
export function translateInbound(d, ingress, packet, flow, events) {
  if (d.type !== 'router' || ingress?.nat !== 'outside') return;
  const staticRule = d.nat?.statics?.find((row) => row.outside === packet.destination);
  if (staticRule) {
    position(d, events, 'NAT statique · destination ' + packet.destination + ' → ' + staticRule.inside);
    packet.destination = staticRule.inside;
    return;
  }
  const existing = d.natTable?.find(
    (row) =>
      row.protocol === flow.kind &&
      row.insideGlobal === packet.destination &&
      row.globalPort === flow.dst &&
      row.outside === (flow.related || packet.source) &&
      row.outsidePort === flow.src &&
      row.insideGlobal === ingress.ip &&
      d.nat?.overloads?.some((o) => o.interface === ingress.name && o.acl === row.acl),
  );
  if (!existing) return;
  position(
    d,
    events,
    'PAT retour · ' +
      packet.destination +
      ':' +
      flow.dst +
      ' → ' +
      existing.insideLocal +
      ':' +
      existing.localPort,
  );
  packet.destination = existing.insideLocal;
  flow.dst = existing.localPort;
}
export function translateOutbound(d, ingress, out, packet, flow, events) {
  if (d.type !== 'router' || ingress?.nat !== 'inside' || out.nat !== 'outside') return null;
  const staticRule = d.nat?.statics?.find((row) => row.inside === packet.source);
  if (staticRule) {
    position(d, events, 'NAT statique · source ' + packet.source + ' → ' + staticRule.outside);
    packet.source = staticRule.outside;
    return null;
  }
  const overload = d.nat?.overloads?.find(
    (o) =>
      o.interface === out.name &&
      matchesAcl(d, o.acl, { ...packet, sourcePort: flow.src, destinationPort: flow.dst }),
  );
  if (!overload) return null;
  const table = (d.natTable ||= []);
  let entry = table.find(
    (r) =>
      r.protocol === flow.kind &&
      r.acl === overload.acl &&
      r.insideLocal === packet.source &&
      r.insideGlobal === out.ip &&
      r.outside === packet.destination &&
      r.localPort === flow.src &&
      r.outsidePort === flow.dst,
  );
  if (!entry) {
    const taken = new Set(
      table
        .filter((r) => r.protocol === flow.kind && r.insideGlobal === out.ip)
        .map((r) => r.globalPort),
    );
    let port = flow.src;
    if (taken.has(port)) {
      port = flow.kind === 'icmp' ? 1 : 1024;
      while (taken.has(port) && port <= 65535) port++;
    }
    if (port > 65535) return 'Aucun port disponible pour la traduction PAT sur ' + d.name + '.';
    entry = {
      protocol: flow.kind,
      insideLocal: packet.source,
      insideGlobal: out.ip,
      outside: packet.destination,
      localPort: flow.src,
      globalPort: port,
      outsidePort: flow.dst,
      acl: overload.acl,
    };
    table.push(entry);
  }
  position(
    d,
    events,
    'PAT · ' + packet.source + ':' + flow.src + ' → ' + entry.insideGlobal + ':' + entry.globalPort,
  );
  packet.source = entry.insideGlobal;
  flow.src = entry.globalPort;
  return null;
}
