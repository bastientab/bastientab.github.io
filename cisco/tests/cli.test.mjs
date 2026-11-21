import assert from 'node:assert/strict';
import { runCommand, cliPrompt } from '../cli.js';
import { createDevice } from '../engine.js';
import { makeExtraLab } from '../extra-labs.js';

const devices = ['router', 'switch', 'pc', 'pc'].map((type, i) =>
  createDevice(type, ['R1', 'SW1', 'PC1', 'PC2'][i]),
);
const [router, sw, pc1, pc2] = devices;
const project = { version: 1, name: 'Console', devices, links: [] };
function link(a, p, b, q) {
  project.links.push({
    id: 'L' + project.links.length,
    type: 'ethernet',
    a: { device: a.id, port: p },
    b: { device: b.id, port: q },
  });
}
link(router, 'Gi0/0', sw, 'Gi0/1');
link(sw, 'Fa0/1', pc1, 'Eth0');
link(sw, 'Fa0/2', pc2, 'Eth0');
const sessions = new Map(devices.map((d) => [d.id, {}]));
function run(d, command, success = true) {
  const result = runCommand(project, d.id, sessions.get(d.id), command);
  assert.equal(result.text.startsWith('%'), !success, command + ' -> ' + result.text);
  return result;
}
const cmd = (d, commands) => commands.forEach((input) => run(d, input));
assert.equal(cliPrompt(project, router.id, {}), 'R1>');
run(router, 'conf t', false);
cmd(router, [
  'en',
  'conf t',
  'host BORDURE',
  'int g 0/0.10',
  'enc dot1q 10',
  'ip add 10.10.10.1 255.255.255.0',
  'no sh',
]);
assert.equal(cliPrompt(project, router.id, sessions.get(router.id)), 'BORDURE(config-if)#');
cmd(router, [
  'int Gi0/0.20',
  'enc dot1q 20',
  'ip addr 10.20.20.1 /24',
  'exit',
  'ip dhcp excluded-address 10.10.10.1 10.10.10.49',
  'ip dhcp pool STUDENTS',
  'network 10.10.10.0 255.255.255.0',
  'default-router 10.10.10.1',
  'dns-server 10.20.20.10',
  'exit',
  'router ospf 1',
  'network 10.10.10.0 0.0.0.255 area 0',
  'end',
  'wr mem',
]);
assert.match(run(router, 'sh start').text, /ip dhcp pool STUDENTS/);
assert.match(run(router, 'sh run').text, /encapsulation dot1Q 20/);
assert.deepEqual(router.ospf.networks, [{ network: '10.10.10.0', prefix: 24, area: 0 }]);
cmd(sw, [
  'en',
  'conf t',
  'vlan 10',
  'name ETUDIANTS',
  'exit',
  'int range fa0/1-2',
  'switchport mode access',
  'switchport access vlan 10',
  'int FastEthernet 0/2',
  'sw acc vlan 20',
  'int g0/1',
  'sw mode trunk',
  'sw trunk allowed vlan 10,20',
  'end',
]);
assert.match(run(sw, 'sh int trunk').text, /10,20/);
assert.match(run(sw, 'show vlan b').text, /ETUDIANTS/);
assert.match(run(pc1, 'ipconfig /renew').text, /10.10.10.50/);
Object.assign(pc2.ports[0], { ip: '10.20.20.10', prefix: 24 });
pc2.gateway = '10.20.20.1';
assert.match(run(pc1, 'ping 10.20.20.10').text, /1 réponse reçue/);
assert.ok(run(pc1, 'arp -a').text.includes('10.10.10.1'));
assert.ok(run(sw, 'show mac address-table').text.includes('Fa0/1'));
cmd(sw, ['conf t', 'int gi0/1', 'switchport trunk allowed vlan remove 20', 'end']);
assert.doesNotMatch(run(pc1, 'ping 10.20.20.10').text, /1 réponse reçue/);
cmd(router, [
  'conf t',
  'ip route 0.0.0.0 0.0.0.0 10.10.10.254',
  'router rip',
  'network 10.0.0.0',
  'no network 10.0.0.0',
  'end',
]);
assert.match(run(router, 'sh ip route 192.0.2.2').text, /0.0.0.0\/0/);
run(router, 'conf t');
run(router, 'ip route 10.10.10.10 255.255.255.0 10.10.10.1', false);
run(router, 'int gi0/0');
run(router, 'ip address 192.0.2.0 255.255.255.0', false);
run(router, 'ip address 192.0.2.1 255.0.255.0', false);
assert.match(run(router, 'do show ip int brief').text, /Gi0\/0.10/);
assert.match(run(sw, 'show int ?').text, /show interfaces trunk/);
cmd(sw, [
  'conf t',
  'spanning-tree vlan 10 priority 4096',
  'int gi0/1',
  'sw trunk allowed vlan add 20',
  'end',
]);
assert.match(run(sw, 'show spanning-tree vlan 10').text, /SW1/);
cmd(router, [
  'end',
  'conf t',
  'ip access-list extended CAMPUS',
  '10 deny tcp any host 10.20.20.10 eq www',
  '20 permit ip any any',
  'exit',
  'int gi0/0.10',
  'ip access-group CAMPUS in',
  'end',
]);
pc2.services.http.enabled = true;
pc2.services.http.body = 'Bonjour';
assert.match(run(pc1, 'http 10.20.20.10').text, /CAMPUS, règle 10/);
assert.match(run(pc1, 'ping 10.20.20.10').text, /1 réponse reçue/);
assert.match(run(router, 'show access-lists').text, /10 deny tcp any host 10.20.20.10 eq 80/);
cmd(router, ['conf t', 'ip access-list extended CAMPUS', 'no 10', 'end']);
assert.match(run(pc1, 'http 10.20.20.10').text, /Bonjour/);
cmd(router, [
  'conf t',
  'ipv6 unicast-routing',
  'int gi0/0.10',
  'ipv6 address 2001:db8:10::1/64',
  'int gi0/0.20',
  'ipv6 address 2001:db8:20::1/64',
  'end',
]);
Object.assign(pc1.ports[0], { ipv6: '2001:db8:10::2', prefix6: 64 });
Object.assign(pc2.ports[0], { ipv6: '2001:db8:20::2', prefix6: 64 });
pc1.gateway6 = '2001:db8:10::1';
pc2.gateway6 = '2001:db8:20::1';
assert.match(run(pc1, 'ping 2001:db8:20::2').text, /1 réponse reçue/);
assert.match(run(router, 'sh ipv6 int br').text, /fe80::/);
assert.match(run(router, 'sh ipv6 route').text, /2001:db8:20::\/64/);
assert.match(run(router, 'sh ipv6 neighbors').text, /2001:db8:20::2/);
assert.match(run(pc1, 'tracert 2001:db8:20::2').text, /BORDURE/);
const dual = makeExtraLab('dual-stack');
const dualRun = (name, input) =>
  runCommand(dual, dual.devices.find((d) => d.name === name).id, {}, input);
assert.match(dualRun('PC-Formation', 'ping 2001:db8:20::80').text, /1 réponse reçue/);
assert.match(dualRun('PC-Formation', 'http 10.20.0.80').text, /WEB-FORMATION/);
assert.match(dualRun('PC-Admin', 'http 10.20.0.80').text, /200 OK/);
const n = makeExtraLab('nat');
const nSession = {};
const nRun = (name, input) => runCommand(n, n.devices.find((d) => d.name === name).id, nSession, input);
const publicRequest = nRun('PC-Agence', 'http 198.51.100.80');
assert.match(publicRequest.text, /200 OK/);
assert.ok(publicRequest.events.some((e) => e.protocol === 'NAT'));
assert.match(nRun('SRV-Externe', 'http 203.0.113.20').text, /interne de l’agence/);
assert.doesNotMatch(nRun('SRV-Externe', 'http 10.14.0.20').text, /200 OK/);
assert.match(nRun('R-Agence', 'sh ip nat trans').text, /10.14.0.10/);
nRun('R-Agence', 'en');
nRun('R-Agence', 'conf t');
nRun('R-Agence', 'no ip nat inside source list 1 interface g0/1 overload');
assert.doesNotMatch(nRun('PC-Agence', 'http 198.51.100.80').text, /200 OK/);
nRun('R-Agence', 'ip nat inside source list 1 interface gi0/1 overload');
nRun('R-Agence', 'int g0/0');
nRun('R-Agence', 'ip helper-address 198.51.100.80');
assert.match(nRun('R-Agence', 'do sh run').text, /ip helper-address 198.51.100.80/);
assert.match(nRun('PC-Agence', 'http 198.51.100.80').text, /200 OK/);
console.log(
  'CLI et maquettes : modes, ACL, VLAN, trunk, STP, DHCP, OSPF, RIP, NAT/PAT, IPv4/IPv6, services et diagnostics validés.',
);
