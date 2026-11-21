import { createDevice, createId } from './engine.js';
import { extraLabs, makeExtraLab } from './extra-labs.js';
export const labs = [
  {
    id: 'campus',
    name: 'Réseau de campus',
    icon: 'network',
    info: 'Deux réseaux locaux reliés par un routeur. Teste le DNS et le serveur web.',
  },
  {
    id: 'vlan',
    name: 'Routage inter-VLAN',
    icon: 'layers',
    info: 'VLAN 10 et 20, trunk 802.1Q et sous-interfaces du routeur.',
  },
  {
    id: 'ospf',
    name: 'Deux sites en OSPF',
    icon: 'route',
    info: 'Deux routeurs échangent les routes de leurs réseaux locaux dans l’aire 0.',
  },
  {
    id: 'wireless',
    name: 'Wi-Fi et services IP',
    icon: 'wifi',
    info: 'Renouvelle le bail DHCP du portable, puis contacte wifi.campus via le point d’accès.',
  },
  ...extraLabs,
  {
    id: 'empty',
    name: 'Atelier vide',
    icon: 'plus',
    info: 'Construis et configure ta propre topologie.',
  },
];
export function makeLab(key = 'campus') {
  if (extraLabs.some((l) => l.id === key)) return makeExtraLab(key);
  const def = labs.find((l) => l.id === key) || labs[0];
  const p = { version: 1, name: def.name, devices: [], links: [] };
  const add = (type, name, x, y) => {
    const d = createDevice(type, name, x, y);
    p.devices.push(d);
    return d;
  };
  const wire = (a, pa, b, pb, type = 'ethernet') =>
    p.links.push({
      id: createId(),
      a: { device: a.id, port: pa },
      b: { device: b.id, port: pb },
      type,
    });
  const addr = (d, port, ip, prefix = 24) =>
    Object.assign(
      d.ports.find((q) => q.name === port),
      { ip, prefix },
    );
  const host = (d, ip, gw, dns, port = 'Eth0') => {
    addr(d, port, ip);
    d.gateway = gw;
    d.dns = dns;
  };
  const web = (d, ip, name) => {
    d.services.dns = { enabled: true, records: { [name]: ip } };
    d.services.http = {
      enabled: true,
      body: 'Bienvenue sur le serveur ' + d.name + ' du laboratoire Netlab.',
    };
  };
  if (key === 'empty') return p;
  if (key === 'campus') {
    const r = add('router', 'R-Campus', 500, 71),
      s1 = add('switch', 'SW-Formation', 285, 192),
      s2 = add('switch', 'SW-Services', 715, 192);
    const pc = add('pc', 'PC-Étudiant', 150, 320),
      lt = add('laptop', 'LT-Formation', 405, 320),
      srv = add('server', 'SRV-Campus', 595, 320),
      admin = add('pc', 'PC-Admin', 850, 320);
    addr(r, 'Gi0/0', '192.168.10.1');
    addr(r, 'Gi0/1', '192.168.20.1');
    host(pc, '192.168.10.10', '192.168.10.1', '192.168.20.10');
    host(lt, '192.168.10.11', '192.168.10.1', '192.168.20.10');
    host(srv, '192.168.20.10', '192.168.20.1', '192.168.20.10');
    host(admin, '192.168.20.11', '192.168.20.1', '192.168.20.10');
    web(srv, '192.168.20.10', 'intranet.campus');
    wire(r, 'Gi0/0', s1, 'Gi0/1');
    wire(r, 'Gi0/1', s2, 'Gi0/1');
    wire(s1, 'Fa0/1', pc, 'Eth0');
    wire(s1, 'Fa0/2', lt, 'Eth0');
    wire(s2, 'Fa0/1', srv, 'Eth0');
    wire(s2, 'Fa0/2', admin, 'Eth0');
  } else if (key === 'vlan') {
    const r = add('router', 'R-InterVLAN', 500, 65),
      sw = add('switch', 'SW-Distribution', 500, 196);
    const pc = add('pc', 'PC-VLAN10', 315, 325),
      srv = add('server', 'SRV-VLAN20', 685, 325);
    for (const v of [10, 20]) {
      r.ports.push({
        name: 'Gi0/0.' + v,
        parent: 'Gi0/0',
        tag: v,
        ip: '10.0.' + v + '.1',
        prefix: 24,
        up: true,
      });
      sw.vlans[v] = v === 10 ? 'Formation' : 'Services';
    }
    Object.assign(
      sw.ports.find((q) => q.name === 'Gi0/1'),
      { mode: 'trunk', allowedVlans: [10, 20] },
    );
    sw.ports[0].vlan = 10;
    sw.ports[1].vlan = 20;
    host(pc, '10.0.10.10', '10.0.10.1', '10.0.20.10');
    host(srv, '10.0.20.10', '10.0.20.1', '10.0.20.10');
    web(srv, '10.0.20.10', 'web.campus');
    wire(r, 'Gi0/0', sw, 'Gi0/1');
    wire(sw, 'Fa0/1', pc, 'Eth0');
    wire(sw, 'Fa0/2', srv, 'Eth0');
  } else if (key === 'ospf') {
    const r1 = add('router', 'R-Site-A', 355, 100),
      r2 = add('router', 'R-Site-B', 645, 100),
      s1 = add('switch', 'SW-Site-A', 280, 207),
      s2 = add('switch', 'SW-Site-B', 720, 207);
    const pc = add('pc', 'PC-Site-A', 220, 321),
      srv = add('server', 'SRV-Site-B', 780, 321);
    addr(r1, 'Gi0/0', '10.1.0.1');
    addr(r2, 'Gi0/0', '10.2.0.1');
    addr(r1, 'Gi0/1', '10.255.0.1', 30);
    addr(r2, 'Gi0/1', '10.255.0.2', 30);
    for (const r of [r1, r2])
      r.ospf = { enabled: true, networks: [{ network: '10.0.0.0', prefix: 8, area: 0 }] };
    host(pc, '10.1.0.10', '10.1.0.1', '10.2.0.10');
    host(srv, '10.2.0.10', '10.2.0.1', '10.2.0.10');
    web(srv, '10.2.0.10', 'site-b.campus');
    wire(r1, 'Gi0/1', r2, 'Gi0/1');
    wire(r1, 'Gi0/0', s1, 'Gi0/1');
    wire(r2, 'Gi0/0', s2, 'Gi0/1');
    wire(s1, 'Fa0/1', pc, 'Eth0');
    wire(s2, 'Fa0/1', srv, 'Eth0');
  } else if (key === 'wireless') {
    const r = add('router', 'R-Passerelle', 500, 58),
      sw = add('switch', 'SW-LAN', 500, 172),
      ap = add('ap', 'AP-Campus', 317, 260),
      srv = add('server', 'SRV-DHCP', 690, 270),
      lt = add('laptop', 'LT-Mobile', 156, 320);
    addr(r, 'Gi0/0', '172.16.1.1');
    host(srv, '172.16.1.2', '172.16.1.1', '172.16.1.2');
    web(srv, '172.16.1.2', 'wifi.campus');
    host(lt, '172.16.1.15', '172.16.1.1', '172.16.1.2', 'Wlan0');
    srv.services.dhcp = {
      enabled: true,
      start: '172.16.1.100',
      end: '172.16.1.150',
      prefix: 24,
      gateway: '172.16.1.1',
      dns: '172.16.1.2',
    };
    ap.wireless = { ssid: 'Campus', key: 'formation' };
    lt.wireless = { ...ap.wireless };
    wire(r, 'Gi0/0', sw, 'Gi0/1');
    wire(sw, 'Fa0/1', srv, 'Eth0');
    wire(sw, 'Fa0/2', ap, 'Eth0');
    wire(ap, 'Wlan0', lt, 'Wlan0', 'wifi');
  }
  return p;
}
