import assert from 'node:assert/strict';
import {
  createDevice,
  dhcp,
  isIPv6,
  linkLocal6,
  neighborsFor,
  routesFor,
  routes6For,
  simulate,
  spanningTree,
} from '../engine.js';
const project = () => ({ version: 1, name: 'Test', devices: [], links: [] });
function device(p, type, id) {
  const d = createDevice(type, id, 0, 0);
  d.id = id;
  p.devices.push(d);
  return d;
}
const port = (d, name = d.ports[0].name) => d.ports.find((p) => p.name === name);
function ip(d, address, name, prefix = 24) {
  Object.assign(port(d, name), { ip: address, prefix });
}
function wire(p, d1, p1, d2, p2, type = 'ethernet') {
  p.links.push({
    id: 'l' + p.links.length,
    a: { device: d1.id, port: p1 },
    b: { device: d2.id, port: p2 },
    type,
  });
}
function ping(p, d, target, ok = true) {
  const result = simulate(p, d.id, target);
  assert.equal(result.ok, ok, result.reason);
  return result;
}
function testLAN() {
  const p = project(),
    a = device(p, 'pc', 'A'),
    s = device(p, 'switch', 'SW'),
    b = device(p, 'server', 'SRV');
  wire(p, a, 'Eth0', s, 'Fa0/1');
  wire(p, b, 'Eth0', s, 'Fa0/2');
  ip(a, '10.1.1.2');
  ip(b, '10.1.1.3');
  const out = ping(p, a, '10.1.1.3');
  assert.deepEqual(out.hops, ['A', 'SRV']);
  assert.ok(out.events.some((e) => e.protocol === 'ARP' && e.from === 'SW'));
  assert.equal(s.macTable.length, 2);
  assert.equal(a.arp.length, 1);
  assert.ok(!ping(p, a, '10.1.1.3').events.some((e) => e.protocol === 'ARP'));
  s.vlans[10] = 'Équipe';
  port(s, 'Fa0/2').vlan = 10;
  ping(p, a, '10.1.1.3', false);
  port(s, 'Fa0/1').vlan = 10;
  ping(p, a, '10.1.1.3');
  delete s.vlans[10];
  ping(p, a, '10.1.1.3', false);
  s.vlans[10] = 'Équipe';
  ping(p, a, '10.1.1.3');
  port(s, 'Fa0/2').up = false;
  ping(p, a, '10.1.1.3', false);
  port(s, 'Fa0/2').up = true;
  a.dns = '10.1.1.3';
  b.services.dns = { enabled: true, records: { 'web.test': '10.1.1.3' } };
  assert.equal(simulate(p, a.id, 'WEB.test.', 'dns').address, '10.1.1.3');
  assert.equal(simulate(p, a.id, 'none.test', 'dns').ok, false);
  assert.equal(simulate(p, a.id, 'web.test', 'http').ok, false);
  b.services.http.enabled = true;
  assert.equal(simulate(p, a.id, 'http://web.test/', 'http').body, b.services.http.body);
  const c = device(p, 'pc', 'C');
  ip(c, '10.1.1.3');
  wire(p, c, 'Eth0', s, 'Fa0/3');
  port(s, 'Fa0/3').vlan = 10;
  ping(p, a, '10.1.1.3', false);
}
function testRouting() {
  const p = project(),
    a = device(p, 'pc', 'A'),
    r1 = device(p, 'router', 'R1'),
    r2 = device(p, 'router', 'R2'),
    r3 = device(p, 'router', 'R3'),
    b = device(p, 'pc', 'B');
  wire(p, a, 'Eth0', r1, 'Gi0/0');
  wire(p, r1, 'Gi0/1', r2, 'Gi0/0');
  wire(p, r2, 'Gi0/1', r3, 'Gi0/0');
  wire(p, r3, 'Gi0/1', b, 'Eth0');
  ip(a, '10.1.1.2');
  a.gateway = '10.1.1.1';
  ip(r1, '10.1.1.1');
  ip(r1, '10.1.2.1', 'Gi0/1', 30);
  ip(r2, '10.1.2.2', 'Gi0/0', 30);
  ip(r2, '10.1.3.1', 'Gi0/1', 30);
  ip(r3, '10.1.3.2', 'Gi0/0', 30);
  ip(r3, '10.1.4.1', 'Gi0/1');
  ip(b, '10.1.4.2');
  b.gateway = '10.1.4.1';
  ping(p, a, b.ports[0].ip, false);
  r1.routes.push({ network: '10.1.4.0', prefix: 24, via: '10.1.2.2' });
  r2.routes.push({ network: '10.1.4.0', prefix: 24, via: '10.1.3.2' });
  assert.match(ping(p, a, '10.1.4.2', false).reason, /retour/);
  r3.routes.push({ network: '10.1.1.0', prefix: 24, via: '10.1.3.1' });
  r2.routes.push({ network: '10.1.1.0', prefix: 24, via: '10.1.2.1' });
  assert.deepEqual(ping(p, a, '10.1.4.2').hops, ['A', 'R1', 'R2', 'R3', 'B']);
  const trace = simulate(p, 'A', '10.1.4.2', 'traceroute');
  assert.deepEqual(
    trace.trace.map((row) => row.ip),
    ['10.1.1.1', '10.1.2.2', '10.1.3.2', '10.1.4.2'],
  );
  assert.ok(trace.events.some((e) => e.detail.includes('Time Exceeded')));
  for (const r of [r1, r2, r3]) {
    r.routes = [];
    r.ospf = { enabled: true, networks: [{ network: '10.0.0.0', prefix: 8, area: 0 }] };
  }
  ping(p, a, '10.1.4.2');
  assert.deepEqual(neighborsFor(p, 'R1'), [
    {
      device: 'R2',
      name: 'R2',
      address: '10.1.2.2',
      interface: 'Gi0/1',
      remoteInterface: 'Gi0/0',
      area: '0',
    },
  ]);
  r1.ports[1].passive = true;
  assert.equal(neighborsFor(p, 'R1').length, 0);
  ping(p, a, '10.1.4.2', false);
  r1.ports[1].passive = false;
  assert.equal(routesFor(p, 'R1').find((r) => r.network === '10.1.4.0').protocol, 'O');
  r3.ospf.networks[0].area = 1;
  ping(p, a, '10.1.4.2', false);
  for (const r of [r1, r2, r3]) {
    r.ospf.enabled = false;
    r.rip = { enabled: true, networks: [{ network: '10.0.0.0', prefix: 8 }] };
  }
  ping(p, a, '10.1.4.2');
  assert.equal(routesFor(p, 'R1').find((r) => r.network === '10.1.4.0').metric, 2);
  r2.ports[0].up = false;
  ping(p, a, '10.1.4.2', false);
}
function testTrunk() {
  const p = project(),
    a = device(p, 'pc', 'A'),
    s = device(p, 'switch', 'SW'),
    s2 = device(p, 'switch', 'SW2'),
    r = device(p, 'router', 'R'),
    b = device(p, 'server', 'B');
  wire(p, a, 'Eth0', s, 'Fa0/1');
  wire(p, s, 'Gi0/1', s2, 'Gi0/1');
  wire(p, s2, 'Gi0/2', r, 'Gi0/0');
  wire(p, b, 'Eth0', s2, 'Fa0/1');
  Object.assign(port(s, 'Fa0/1'), { vlan: 10 });
  Object.assign(port(s2, 'Fa0/1'), { vlan: 20 });
  for (const dev of [s, s2]) Object.assign(dev.vlans, { 10: 'Admin', 20: 'Serveurs' });
  for (const t of [port(s, 'Gi0/1'), port(s2, 'Gi0/1'), port(s2, 'Gi0/2')])
    Object.assign(t, { mode: 'trunk', allowedVlans: [10, 20] });
  r.ports.push(
    { name: 'Gi0/0.10', parent: 'Gi0/0', tag: 10, ip: '10.10.0.1', prefix: 24, up: true },
    { name: 'Gi0/0.20', parent: 'Gi0/0', tag: 20, ip: '10.20.0.1', prefix: 24, up: true },
  );
  ip(a, '10.10.0.10');
  a.gateway = '10.10.0.1';
  ip(b, '10.20.0.20');
  b.gateway = '10.20.0.1';
  assert.ok(ping(p, a, '10.20.0.20').events.some((e) => e.detail.includes('802.1Q VLAN 10')));
  s2.ports.push({ name: 'Vlan10', vlan: 10, management: true, ip: '10.10.0.21', prefix: 24, up: true });
  ping(p, a, '10.10.0.21');
  delete s2.vlans[10];
  ping(p, a, '10.20.0.20', false);
  ping(p, a, '10.10.0.21', false);
  s2.vlans[10] = 'Admin';
  ping(p, a, '10.20.0.20');
  port(s, 'Gi0/1').allowedVlans = [20];
  ping(p, a, '10.20.0.20', false);
}
function testWirelessDHCP() {
  const p = project(),
    s = device(p, 'server', 'SRV'),
    ap = device(p, 'ap', 'AP'),
    a = device(p, 'laptop', 'A'),
    b = device(p, 'laptop', 'B');
  wire(p, s, 'Eth0', ap, 'Eth0');
  wire(p, ap, 'Wlan0', a, 'Wlan0', 'wifi');
  wire(p, ap, 'Wlan0', b, 'Wlan0', 'wifi');
  ip(s, '192.168.8.1');
  s.services.dhcp = {
    enabled: true,
    start: '192.168.8.1',
    end: '192.168.8.13',
    prefix: 24,
    gateway: '192.168.8.1',
    dns: '192.168.8.1',
    exclusions: [{ start: '192.168.8.2', end: '192.168.8.11' }],
  };
  assert.equal(dhcp(p, 'A').ip, '192.168.8.12');
  assert.equal(dhcp(p, 'B', 'Wlan0').ip, '192.168.8.13');
  assert.equal(dhcp(p, 'B', 'Wlan0').ip, '192.168.8.13');
  ping(p, a, '192.168.8.13');
  const c = device(p, 'laptop', 'C');
  wire(p, ap, 'Wlan0', c, 'Wlan0', 'wifi');
  assert.equal(dhcp(p, 'C').ok, false);
  a.wireless.key = 'incompatible';
  ping(p, a, '192.168.8.1', false);
  assert.equal(dhcp(p, 'A').ok, false);
}
function testSTP() {
  const p = project(),
    a = device(p, 'switch', 'A'),
    b = device(p, 'switch', 'B'),
    c = device(p, 'switch', 'C'),
    pc = device(p, 'pc', 'PC'),
    srv = device(p, 'server', 'SRV');
  a.stpPriority = { 1: 0 };
  b.stpPriority = { 1: 4096 };
  wire(p, a, 'Fa0/1', b, 'Fa0/1');
  wire(p, a, 'Fa0/2', c, 'Fa0/1');
  wire(p, b, 'Fa0/2', c, 'Fa0/2');
  wire(p, b, 'Fa0/3', pc, 'Eth0');
  wire(p, c, 'Fa0/3', srv, 'Eth0');
  ip(pc, '192.168.1.51');
  ip(srv, '192.168.1.52');
  const stp = spanningTree(p, 'C');
  assert.equal(stp.root, 'A');
  assert.ok(stp.ports.some((x) => x.interface === 'Fa0/2' && x.state === 'Blocking'));
  assert.ok(ping(p, pc, '192.168.1.52').events.some((e) => e.from === 'A'));
  port(a, 'Fa0/2').up = false;
  assert.ok(!ping(p, pc, '192.168.1.52').events.some((e) => e.from === 'A'));
  assert.equal(spanningTree(p, 'C').ports.find((x) => x.interface === 'Fa0/2').role, 'Root');
}
function testIPv6() {
  const p = project(),
    pc = device(p, 'pc', 'A'),
    sw = device(p, 'switch', 'S'),
    a = device(p, 'router', 'RA'),
    b = device(p, 'router', 'RB'),
    srv = device(p, 'server', 'B');
  for (const v of ['::1', 'fe80::f00', '::ffff:192.0.2.1', '2001:0DB8:0:0:0:0:0:1'])
    assert.ok(isIPv6(v));
  for (const v of [':::1', 'a:', '0:1:2:3:4:5:6:7:8', '::ffff:2000.0.1.1', 'a::b::f'])
    assert.ok(!isIPv6(v));
  wire(p, pc, 'Eth0', sw, 'Fa0/1');
  wire(p, sw, 'Fa0/2', a, 'Gi0/0');
  wire(p, a, 'Gi0/1', b, 'Gi0/0');
  wire(p, b, 'Gi0/1', srv, 'Eth0');
  pc.ports[0].ipv6 = '2001:db8:1::51';
  a.ports[0].ipv6 = '2001:db8:1::1';
  a.ports[1].ipv6 = '2001:db8:2::1';
  b.ports[0].ipv6 = '2001:db8:2::2';
  b.ports[1].ipv6 = '2001:db8:3::1';
  srv.ports[0].ipv6 = '2001:db8:3::52';
  pc.gateway6 = linkLocal6(a, a.ports[0]);
  srv.gateway6 = '2001:db8:3::1';
  a.routes6 = [
    { network: '2001:db8:3::', prefix: 64, via: linkLocal6(b, b.ports[0]), interface: 'Gi0/1' },
  ];
  b.routes6 = [{ network: '2001:db8:1::', prefix: 64, via: '2001:db8:2::1' }];
  assert.match(ping(p, pc, '2001:db8:3::52', false).reason, /désactivé/);
  a.ipv6Routing = b.ipv6Routing = true;
  const successful = ping(p, pc, '2001:db8:3::52');
  assert.ok(successful.events.some((e) => e.protocol === 'NDP'));
  assert.deepEqual(successful.hops, ['A', 'RA', 'RB', 'B']);
  assert.equal(routes6For(p, 'RA').find((r) => r.network === '2001:db8:3::').protocol, 'S');
  const trace = simulate(p, 'A', '2001:db8:3::52', 'traceroute');
  assert.equal(trace.ok, true, trace.reason);
  assert.deepEqual(
    trace.trace.map((x) => x.ip),
    ['2001:db8:1::1', '2001:db8:2::2', '2001:db8:3::52'],
  );
  ping(p, pc, pc.gateway6 + '%Eth0');
  ping(p, a, linkLocal6(b, b.ports[0]) + '%Gi0/1');
  ping(p, a, linkLocal6(b, b.ports[0]) + '%Gi0/0', false);
  b.routes6 = [];
  assert.match(ping(p, pc, '2001:db8:3::52', false).reason, /retour/);
  port(sw, 'Fa0/2').vlan = 20;
  assert.match(ping(p, pc, '2001:db8:1::1', false).reason, /NDP/);
}
function testNAT() {
  const p = project(),
    a = device(p, 'pc', 'A'),
    b = device(p, 'server', 'B'),
    s = device(p, 'switch', 'SW'),
    r = device(p, 'router', 'R'),
    web = device(p, 'server', 'Web');
  wire(p, a, 'Eth0', s, 'Fa0/1');
  wire(p, b, 'Eth0', s, 'Fa0/2');
  wire(p, s, 'Fa0/3', r, 'Gi0/0');
  wire(p, r, 'Gi0/1', web, 'Eth0');
  ip(a, '10.0.0.2');
  ip(b, '10.0.0.3');
  ip(r, '10.0.0.1');
  ip(r, '203.0.113.1', 'Gi0/1');
  ip(web, '203.0.113.2');
  a.gateway = b.gateway = '10.0.0.1';
  web.services.http.enabled = true;
  web.services.dns = { enabled: true, records: { 'www.test': '203.0.113.2' } };
  a.dns = '203.0.113.2';
  port(r, 'Gi0/0').nat = 'inside';
  port(r, 'Gi0/1').nat = 'outside';
  r.acls = {
    1: {
      type: 'standard',
      rules: [
        {
          sequence: 10,
          action: 'permit',
          protocol: 'ip',
          source: { ip: '10.0.0.0', wildcard: '0.0.0.255' },
        },
      ],
    },
  };
  assert.equal(simulate(p, 'A', '203.0.113.2', 'http').ok, false);
  r.nat = { statics: [], overloads: [{ acl: '1', interface: 'Gi0/1' }] };
  assert.equal(simulate(p, 'A', 'www.test', 'http').ok, true);
  assert.equal(simulate(p, 'B', '203.0.113.2', 'http').ok, true);
  const entries = r.natTable.filter((row) => row.protocol === 'tcp');
  assert.equal(entries.length, 2);
  assert.equal(new Set(entries.map((x) => x.globalPort)).size, 2);
  ping(p, a, '203.0.113.2');
  ping(p, b, '203.0.113.2');
  b.services.http.enabled = true;
  r.nat.statics = [{ inside: '10.0.0.3', outside: '203.0.113.15' }];
  const response = simulate(p, 'Web', '203.0.113.15', 'http');
  assert.equal(response.ok, true, response.reason);
  assert.ok(response.events.some((e) => e.protocol === 'NAT' && e.detail.includes('destination')));
  assert.equal(response.body, b.services.http.body);
  r.nat.statics = [];
  assert.equal(simulate(p, 'Web', '203.0.113.15', 'http').ok, false);
  r.nat.overloads = [];
  assert.equal(simulate(p, 'A', '203.0.113.2', 'http').ok, false);
}
function testDHCPRelay() {
  const p = project(),
    a = device(p, 'pc', 'A'),
    r = device(p, 'router', 'R'),
    b = device(p, 'server', 'B');
  wire(p, a, 'Eth0', r, 'Gi0/0');
  wire(p, r, 'Gi0/1', b, 'Eth0');
  ip(r, '192.168.40.1');
  ip(r, '172.17.5.1', 'Gi0/1');
  ip(b, '172.17.5.2');
  b.services.dhcp = {
    enabled: true,
    pools: [
      {
        start: '192.168.40.50',
        end: '192.168.40.100',
        prefix: 24,
        dns: '172.17.5.2',
        gateway: '192.168.40.1',
      },
    ],
  };
  assert.equal(dhcp(p, 'A').ok, false);
  r.ports[0].helper = '172.17.5.2';
  assert.match(dhcp(p, 'A').reason, /Relais DHCP/);
  assert.equal(a.ports[0].ip, '');
  b.gateway = '172.17.5.1';
  const lease = dhcp(p, 'A');
  assert.equal(lease.ip, '192.168.40.50');
  assert.deepEqual(lease.hops, ['A', 'R', 'B']);
  assert.ok(lease.events.some((e) => e.detail.includes('giaddr 192.168.40.1')));
  ping(p, a, '172.17.5.2');
}
for (const run of [
  testLAN,
  testRouting,
  testTrunk,
  testWirelessDHCP,
  testSTP,
  testIPv6,
  testNAT,
  testDHCPRelay,
]) {
  run();
  console.log(run.name + ' OK');
}
