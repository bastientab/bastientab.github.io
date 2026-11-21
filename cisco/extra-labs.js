import { createDevice } from './engine.js';
import { parseRule } from './acl.js';

export const extraLabs = [
  {
    id: 'dual-stack',
    name: 'Double pile et filtrage',
    icon: 'layers',
    info: 'Depuis PC-Formation, le ping IPv6 vers 2001:db8:20::80 aboutit. L’ACL bloque le web IPv4 vers 10.20.0.80 pour ce poste et l’autorise pour PC-Admin.',
  },
  {
    id: 'nat',
    name: 'Traduction NAT et PAT',
    icon: 'route',
    info: 'Depuis PC-Agence, contacte 198.51.100.80 via PAT. Depuis SRV-Externe, ouvre 203.0.113.20 pour atteindre le serveur interne par NAT statique.',
  },
];

export function makeExtraLab(key) {
  const definition = extraLabs.find((lab) => lab.id === key);
  if (!definition) return null;
  const project = { version: 1, name: definition.name, devices: [], links: [] };
  const add = (type, name, x, y) => {
    const d = createDevice(type, name, x, y);
    project.devices.push(d);
    return d;
  };
  const link = (a, portA, b, portB) =>
    project.links.push({
      id: 'L' + (project.links.length + 1),
      type: 'ethernet',
      a: { device: a.id, port: portA },
      b: { device: b.id, port: portB },
    });
  const address = (d, name, ip, extra = {}) =>
    Object.assign(
      d.ports.find((p) => p.name === name),
      { ip, prefix: 24, ...extra },
    );
  const site = (d, name) => {
    d.services.http = { enabled: true, body: 'Bienvenue sur le site ' + name + ' !' };
  };
  if (key === 'dual-stack') {
    const r = add('router', 'R-Campus', 500, 63),
      left = add('switch', 'SW-Formation', 305, 190),
      right = add('switch', 'SW-Services', 700, 190);
    const pc = add('pc', 'PC-Formation', 165, 321),
      admin = add('pc', 'PC-Admin', 415, 321),
      srv = add('server', 'SRV-Web', 700, 321);
    address(r, 'Gi0/0', '10.10.0.1', {
      ipv6: '2001:db8:10::1',
      prefix6: 64,
      acl: { in: 'WEB-FORMATION' },
    });
    address(r, 'Gi0/1', '10.20.0.1', { ipv6: '2001:db8:20::1', prefix6: 64 });
    r.ipv6Routing = true;
    r.acls = {
      'WEB-FORMATION': {
        type: 'extended',
        rules: [
          {
            sequence: 10,
            ...parseRule('extended', 'deny', 'tcp host 10.10.0.10 host 10.20.0.80 eq www'),
          },
          { sequence: 20, ...parseRule('extended', 'permit', 'ip any any') },
        ],
      },
    };
    for (const [d, ip, ipv6] of [
      [pc, '10.10.0.10', '2001:db8:10::10'],
      [admin, '10.10.0.20', '2001:db8:10::20'],
    ]) {
      address(d, 'Eth0', ip, { ipv6, prefix6: 64 });
      d.gateway = '10.10.0.1';
      d.gateway6 = '2001:db8:10::1';
    }
    address(srv, 'Eth0', '10.20.0.80', { ipv6: '2001:db8:20::80', prefix6: 64 });
    srv.gateway = '10.20.0.1';
    srv.gateway6 = '2001:db8:20::1';
    site(srv, 'de formation');
    link(pc, 'Eth0', left, 'Fa0/1');
    link(admin, 'Eth0', left, 'Fa0/2');
    link(left, 'Gi0/1', r, 'Gi0/0');
    link(r, 'Gi0/1', right, 'Gi0/1');
    link(right, 'Fa0/1', srv, 'Eth0');
  } else {
    const border = add('router', 'R-Agence', 375, 92),
      isp = add('router', 'R-FAI', 670, 92);
    const sw = add('switch', 'SW-Agence', 305, 205),
      pc = add('pc', 'PC-Agence', 160, 325);
    const intranet = add('server', 'SRV-Interne', 435, 325),
      external = add('server', 'SRV-Externe', 720, 280);
    address(border, 'Gi0/0', '10.14.0.1', { nat: 'inside' });
    address(border, 'Gi0/1', '192.0.2.1', { prefix: 30, nat: 'outside' });
    address(isp, 'Gi0/0', '192.0.2.2', { prefix: 30 });
    address(isp, 'Gi0/1', '198.51.100.1');
    border.routes = [{ network: '0.0.0.0', prefix: 0, via: '192.0.2.2' }];
    isp.routes = [{ network: '203.0.113.0', prefix: 24, via: '192.0.2.1' }];
    border.acls = {
      1: {
        type: 'standard',
        rules: [{ sequence: 10, ...parseRule('standard', 'permit', '10.14.0.0 0.0.0.255') }],
      },
    };
    border.nat = {
      statics: [{ inside: '10.14.0.20', outside: '203.0.113.20' }],
      overloads: [{ acl: '1', interface: 'Gi0/1' }],
    };
    address(pc, 'Eth0', '10.14.0.10');
    pc.gateway = '10.14.0.1';
    address(intranet, 'Eth0', '10.14.0.20');
    intranet.gateway = '10.14.0.1';
    site(intranet, 'interne de l’agence');
    address(external, 'Eth0', '198.51.100.80');
    external.gateway = '198.51.100.1';
    site(external, 'du réseau externe simulé');
    link(pc, 'Eth0', sw, 'Fa0/1');
    link(intranet, 'Eth0', sw, 'Fa0/2');
    link(sw, 'Gi0/1', border, 'Gi0/0');
    link(border, 'Gi0/1', isp, 'Gi0/0');
    link(isp, 'Gi0/1', external, 'Eth0');
  }
  return project;
}
