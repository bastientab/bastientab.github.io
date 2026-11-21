const paths = {
  network: 'M12 8v4M5 16v-4h14v4 M9 3h6v5H9z M2 16h6v5H2z M9 16h6v5H9z M16 16h6v5h-6z',
  layers: 'm3 8 9-5 9 5-9 5z M3 12l9 5 9-5 M3 16l9 5 9-5',
  cloudCheck: 'M7 18H6a4 4 0 0 1-1-8 7 7 0 0 1 13-2 5 5 0 0 1 1 10h-2 M9 16l2 2 4-5',
  folder: 'M3 7V5h6l2 3h10v11H3z',
  down: 'm6 9 6 6 6-6',
  help: 'M9.5 9a2.6 2.6 0 1 1 4.4 1.8c-1.5 1.1-1.9 1.5-1.9 3 M12 17h.01 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  search: 'M16 16l5 5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  x: 'M6 6l12 12 M6 18 18 6',
  mouse: 'M5 10a7 7 0 0 1 14 0v4a7 7 0 0 1-14 0z M12 3v6',
  boxes: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  pencil: 'm4 16 12-12 4 4L8 20l-5 1z M14 6l4 4',
  activity: 'M2 12h5l3-8 4 16 3-8h5',
  steps: 'M3 17h5v-5h5V7h8',
  pointer: 'm5 3 15 10-8 1-4 7z',
  hand: 'M5 13l-2-2c-1-2 1-3 3-1l2 2V5a1.5 1.5 0 0 1 3 0v5-7a1.5 1.5 0 0 1 3 0v7-5a1.5 1.5 0 0 1 3 0v6-3a1.5 1.5 0 0 1 3 0v7c0 4-3 7-7 7-3 0-5-2-8-9z',
  cable: 'M7 4H3v4h4z M21 16h-4v4h4z M7 6h4a2 2 0 0 1 2 2v8a2 2 0 0 0 2 2h2',
  undo: 'm8 4-5 5 5 5 M3 9h11a6 6 0 0 1 0 12',
  redo: 'm16 4 5 5-5 5 M21 9H10a6 6 0 0 0 0 12',
  send: 'm21 3-7 18-4-8-8-4z M10 13 21 3',
  minus: 'M5 12h14',
  plus: 'M5 12h14 M12 5v14',
  fit: 'M3 9V3h6 M15 3h6v6 M21 15v6h-6 M9 21H3v-6',
  list: 'M8 5h13 M8 12h13 M8 19h13 M3 5h.01 M3 12h.01 M3 19h.01',
  terminal: 'M3 4h18v16H3z M6 8l3 3-3 3 M12 15h5',
  next: 'm4 4 11 8-11 8z M19 4v16',
  trash: 'M3 6h18 M6 6l1 15h10l1-15 M9 6V3h6v3 M10 10v7 M14 10v7',
  enter: 'M21 5v9H5 M10 9l-5 5 5 5',
  mail: 'M2 5h20v14H2z M2 6l10 8L22 6',
  download: 'M12 3v12m-5-5 5 5 5-5 M4 16v5h16v-5',
  upload: 'M12 16V4m-5 5 5-5 5 5 M4 16v5h16v-5',
  wifi: 'M2 8a16 16 0 0 1 20 0 M5 12a11 11 0 0 1 14 0 M9 16a5 5 0 0 1 6 0 M12 20h.01',
  route: 'M4 7h15m-4-4 4 4-4 4 M20 17H5m4 4-4-4 4-4',
  grid: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  file: 'M5 2h9l5 5v15H5z M14 2v6h5',
};
const ns = 'http://www.w3.org/2000/svg';
export function icon(name) {
  const i = document.createElement('i');
  i.dataset.icon = name;
  i.setAttribute('aria-hidden', 'true');
  decorate(i);
  return i;
}
function decorate(i) {
  const s = document.createElementNS(ns, 'svg'),
    p = document.createElementNS(ns, 'path');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('fill', 'none');
  s.setAttribute('stroke', 'currentColor');
  s.setAttribute('stroke-width', '1.7');
  s.setAttribute('stroke-linecap', 'round');
  s.setAttribute('stroke-linejoin', 'round');
  p.setAttribute('d', paths[i.dataset.icon] || '');
  s.append(p);
  i.replaceChildren(s);
  i.setAttribute('aria-hidden', 'true');
}
export function fillIcons(root = document) {
  root.querySelectorAll('i[data-icon]').forEach(decorate);
}
export const deviceTypes = {
  router: { label: 'Routeur', desc: 'Routage IP', group: 'Infrastructure', prefix: 'R' },
  switch: { label: 'Commutateur', desc: 'Switch Ethernet', group: 'Infrastructure', prefix: 'SW' },
  ap: { label: 'Point d’accès', desc: 'Réseau Wi-Fi', group: 'Infrastructure', prefix: 'AP' },
  pc: { label: 'Poste de travail', desc: 'PC de bureau', group: 'Terminaux', prefix: 'PC' },
  laptop: { label: 'Portable', desc: 'Ethernet et Wi-Fi', group: 'Terminaux', prefix: 'LT' },
  server: { label: 'Serveur', desc: 'DHCP, DNS et HTTP', group: 'Terminaux', prefix: 'SRV' },
};
export function deviceArt(type) {
  const c = document.createElement('canvas');
  c.width = 240;
  c.height = 160;
  c.setAttribute('aria-hidden', 'true');
  const g = c.getContext('2d');
  g.scale(2, 2);
  function poly(points, fill, stroke) {
    g.beginPath();
    points.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.closePath();
    g.fillStyle = fill;
    g.fill();
    if (stroke) {
      g.lineWidth = 0.8;
      g.strokeStyle = stroke;
      g.stroke();
    }
  }
  function line(points, color, width = 1) {
    g.beginPath();
    points.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.strokeStyle = color;
    g.lineWidth = width;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.stroke();
  }
  function oval(x, y, rx, ry, color) {
    g.beginPath();
    g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    g.fillStyle = color;
    g.fill();
  }
  function box(x, y, w, d, h, top, left, right) {
    const a = [x, y],
      b = [x + w, y + w * 0.27],
      e = [x + w + d, y + w * 0.27 - d * 0.55],
      f = [x + d, y - d * 0.55];
    poly([a, b, e, f], top);
    poly([a, b, [b[0], b[1] + h], [a[0], a[1] + h]], left);
    poly([b, e, [e[0], e[1] + h], [b[0], b[1] + h]], right);
    line([a, b, e], '#ffffff75', 1);
  }
  function frontPort(x, y, w = 5) {
    poly(
      [
        [x, y],
        [x + w, y + w * 0.27],
        [x + w, y + w * 0.27 + 3.6],
        [x, y + 3.6],
      ],
      '#192e3b',
    );
    line(
      [
        [x + 0.9, y + 2.8],
        [x + w - 0.6, y + (w - 0.6) * 0.27 + 2.8],
      ],
      '#9fb5ac',
      0.7,
    );
  }
  oval(61, 67, 43, 6, '#213e3a0c');
  oval(62, 66, 34, 4, '#213e3a0c');
  if (type === 'router') {
    g.fillStyle = '#246d74';
    g.beginPath();
    g.ellipse(60, 52, 42, 14, 0, 0, 2 * Math.PI);
    g.fill();
    g.fillRect(18, 37, 84, 15);
    const grad = g.createLinearGradient(18, 0, 102, 0);
    grad.addColorStop(0, '#2f8387');
    grad.addColorStop(0.55, '#469c9a');
    grad.addColorStop(1, '#216168');
    g.fillStyle = grad;
    g.fillRect(18, 37, 84, 15);
    g.beginPath();
    g.ellipse(60, 51, 42, 14, 0, 0, Math.PI);
    g.fill();
    oval(60, 37, 42, 15.5, '#25777c');
    oval(60, 35.7, 41.5, 15.2, '#73b9ae');
    oval(60, 35.4, 38.7, 13.4, '#68b1a8');
    [
      [45, 34, 56, 32],
      [63, 31, 72, 27],
      [58, 39, 49, 43],
      [66, 38, 78, 39],
    ].forEach(([x, y, xx, yy]) => {
      line(
        [
          [x, y],
          [xx, yy],
        ],
        '#e0f6df',
        2.5,
      );
      line(
        [
          [xx - 3, yy - 1],
          [xx, yy],
          [xx - 1, yy + 2],
        ],
        '#e0f6df',
        1.8,
      );
    });
    [31, 36, 41].forEach((x, i) => oval(x, 51 + i * 0.6, 1.1, 1.1, '#bbebae'));
    [67, 74, 81].forEach((x, i) =>
      line(
        [
          [x, 55 - i * 0.8],
          [x + 3, 54.5 - i * 0.8],
        ],
        '#22575e',
        2,
      ),
    );
  } else if (type === 'switch') {
    box(9, 41, 69, 31, 13, '#8897c6', '#556b9d', '#3e507f');
    poly(
      [
        [16, 40],
        [42, 26],
        [99, 41],
        [74, 54],
      ],
      '#8192bd',
    );
    for (let j = 0; j < 6; j++)
      line(
        [
          [51 + j * 3, 33 + j * 0.8],
          [44 + j * 3, 36.5 + j * 0.8],
        ],
        '#6476a4',
        1,
      );
    for (let j = 0; j < 10; j++) frontPort(14 + j * 5.8, 44 + j * 1.56, 4.6);
    oval(71, 61, 1, 1, '#cdedaf');
  } else if (type === 'pc') {
    box(32, 61, 34, 18, 3, '#7a91a4', '#49677f', '#38536b');
    poly(
      [
        [54, 47],
        [62, 49],
        [62, 65],
        [54, 63],
      ],
      '#4b6476',
    );
    poly(
      [
        [25, 10],
        [86, 20],
        [86, 58],
        [25, 48],
      ],
      '#354e68',
    );
    poly(
      [
        [86, 20],
        [91, 17],
        [91, 55],
        [86, 58],
      ],
      '#263e52',
    );
    poly(
      [
        [25, 10],
        [30, 7],
        [91, 17],
        [86, 20],
      ],
      '#8fa9bb',
    );
    poly(
      [
        [29, 14],
        [82, 23],
        [82, 52],
        [29, 44],
      ],
      '#80b9c3',
    );
    poly(
      [
        [29, 14],
        [82, 23],
        [82, 31],
        [29, 41],
      ],
      '#b0d4d2',
    );
    line(
      [
        [52, 48],
        [59, 49],
      ],
      '#c9dedc',
      1,
    );
  } else if (type === 'server') {
    box(36, 18, 31, 20, 45, '#e9aa89', '#b96d55', '#915443');
    for (let i = 0; i < 3; i++) {
      const y = 25 + i * 11;
      poly(
        [
          [39, y],
          [64, y + 7],
          [64, y + 14],
          [39, y + 7],
        ],
        '#995946',
      );
      line(
        [
          [42, y + 2.8],
          [54, y + 6],
        ],
        '#e8ad8b',
        1.3,
      );
      oval(60, y + 8.6, 1.3, 1.2, '#e0ecaa');
    }
  } else if (type === 'ap') {
    box(22, 46, 47, 26, 9, '#efd6a0', '#c4a370', '#a8865a');
    line(
      [
        [34, 38],
        [34, 15],
      ],
      '#796b57',
      3,
    );
    line(
      [
        [81, 41],
        [81, 17],
      ],
      '#796b57',
      3,
    );
    line(
      [
        [34, 15],
        [34, 11],
      ],
      '#bbaa87',
      3,
    );
    line(
      [
        [81, 17],
        [81, 13],
      ],
      '#bbaa87',
      3,
    );
    oval(58, 45, 8, 3, '#d9ba84');
    oval(58, 45, 3, 1.4, '#fff4d6');
    [31, 36, 41].forEach((x, i) => oval(x, 51 + i, 1, 1, '#e3f0b4'));
  } else {
    poly(
      [
        [38, 19],
        [87, 26],
        [82, 53],
        [33, 46],
      ],
      '#3a606c',
    );
    poly(
      [
        [41, 22],
        [82, 28],
        [78, 49],
        [37, 43],
      ],
      '#92c2c2',
    );
    poly(
      [
        [41, 22],
        [82, 28],
        [81, 32],
        [39, 38],
      ],
      '#bfddcf',
    );
    poly(
      [
        [33, 46],
        [82, 53],
        [64, 67],
        [15, 58],
      ],
      '#89a8ac',
    );
    poly(
      [
        [15, 58],
        [64, 67],
        [64, 70],
        [15, 61],
      ],
      '#53717c',
    );
    poly(
      [
        [64, 67],
        [82, 53],
        [82, 56],
        [64, 70],
      ],
      '#3d5e69',
    );
    poly(
      [
        [35, 49],
        [74, 55],
        [63, 61],
        [25, 55],
      ],
      '#5f7e8a',
    );
    for (let i = 0; i < 3; i++)
      line(
        [
          [34 - i * 2, 50 + i * 1.5],
          [68 - i * 2, 55 + i * 1.5],
        ],
        '#a8bec0',
        0.6,
      );
  }
  return c;
}
