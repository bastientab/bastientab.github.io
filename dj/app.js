const $ = id => document.getElementById(id);
const players = [];
const cross = $('cross');
const automix = $('automix');
const notice = $('mix-status');
let transition;
let requestGeneration = 0;

function loadIframeApi() {
  return new Promise((resolve, reject) => {
    if (window.YT?.Player) return resolve(window.YT);
    const script = document.createElement('script');
    const timeout = setTimeout(() => reject(Error('Le lecteur YouTube ne répond pas. Recharge la page.')), 14000);
    window.onYouTubeIframeAPIReady = () => {
      clearTimeout(timeout);
      resolve(window.YT);
    };
    script.onerror = () => {
      clearTimeout(timeout);
      reject(Error('Le lecteur YouTube est inaccessible.'));
    };
    script.src = 'https://www.youtube.com/iframe_api';
    document.head.append(script);
  });
}

let iframeApi;
const api = () => iframeApi ??= loadIframeApi().catch(error => {
  iframeApi = undefined;
  throw error;
});
const validId = /^[A-Za-z0-9_-]{11}$/;
const clock = seconds => Math.floor(seconds / 60) + ':' + String(Math.floor(seconds % 60)).padStart(2, '0');
function videoId(input) {
  try {
    const url = new URL(input, 'https://www.youtube.com/');
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    const parts = url.pathname.split('/');
    let id;
    if (url.hostname === 'youtu.be') id = parts[1];
    if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com'].includes(url.hostname)) {
      id = url.searchParams.get('v') || (['shorts', 'live', 'embed'].includes(parts[1]) ? parts[2] : '');
    }
    return validId.test(id || '') ? id : null;
  } catch {
    return null;
  }
}

class Deck {
  constructor(letter) {
    this.letter = letter;
    this.node = $('deck-template').content.firstElementChild.cloneNode(true);
    this.node.dataset.letter = letter;
    this.node.setAttribute('aria-label', 'Platine ' + letter);
    this.get('.letter').textContent = letter;
    document.querySelector('.console').append(this.node);
    this.host = this.get('.player');
    this.seekBar = this.get('.seek');
    this.player = null;
    this.invalidate = 0;
    this.seekBar.onchange = () => this.seek(+this.seekBar.value);
    this.get('.speed').onchange = event => this.player?.setPlaybackRate(+event.target.value);
    this.node.addEventListener('click', event => {
      const command = event.target.closest('[data-command]')?.dataset.command;
      if (!command || !this.canControl) return;
      if (command === 'play') {
        stopMix();
        if (this.playing) this.player.pauseVideo();
        else this.player.playVideo();
      }
      if (command === 'cue') {
        stopMix();
        this.player.pauseVideo();
        this.seek(this.cue);
      }
      if (command === 'mark') {
        this.cue = this.position;
        this.status('Cue posé à ' + clock(this.cue) + '.');
      }
      if (command === 'back') this.seek(this.position - 5);
      if (command === 'forward') this.seek(this.position + 5);
    });
  }

  get(selector) { return this.node.querySelector(selector); }
  get playing() { return this.state === 1; }
  get position() { return Number(this.player?.getCurrentTime?.()) || 0; }

  status(message, error = false) {
    this.get('.notice').textContent = message;
    this.get('.notice').classList.toggle('problem', error);
  }

  controls(enabled) {
    this.canControl = enabled;
    this.node.querySelectorAll('button, select, input').forEach(control => control.disabled = !enabled);
    automix.disabled = players.some(deck => !deck.canControl);
  }

  seek(seconds) {
    const duration = Number(this.player?.getDuration?.()) || 0;
    if (this.canControl && duration) this.player.seekTo(Math.max(0, Math.min(duration, seconds)), true);
  }

  async load(track) {
    const version = ++this.invalidate;
    stopMix();
    this.player?.destroy?.();
    this.player = null;
    this.state = -1;
    this.cue = 0;
    this.node.classList.remove('playing');
    this.get('[data-command=play]').textContent = 'Lecture';
    this.get('h2').textContent = track.title;
    this.get('.artist').textContent = track.author || '';
    this.get('.placeholder').hidden = false;
    this.controls(false);
    this.status('Ouverture du lecteur YouTube…');
    const placeholder = document.createElement('div');
    this.host.replaceChildren(placeholder);
    try {
      const YT = await api();
      if (version !== this.invalidate) return;
      this.get('.placeholder').hidden = true;
      this.player = new YT.Player(placeholder, {
        width: '100%', height: '100%', videoId: track.id,
        playerVars: { playsinline: 1, origin: location.origin, rel: 0 },
        events: {
          onReady: () => {
            if (version !== this.invalidate) return;
            this.controls(true);
            this.status('Prêt');
            updateVolumes();
          },
          onStateChange: event => {
            if (version !== this.invalidate) return;
            this.state = event.data;
            this.node.classList.toggle('playing', this.playing);
            this.get('[data-command=play]').textContent = this.playing ? 'Pause' : 'Lecture';
            if (this.playing || this.state === 5) {
              this.updateRates();
              if (!transition) this.status(this.playing ? 'En lecture' : 'Prêt');
            }
            if (this.playing && transition?.incoming === this && transition.started === null) {
              transition.started = performance.now();
              scheduleFade(transition);
            }
          },
          onPlaybackRateChange: event => { if (version === this.invalidate) this.get('.speed').value = event.data; },
          onAutoplayBlocked: () => {
            if (version !== this.invalidate) return;
            this.status('Clique sur Lecture dans le lecteur YouTube pour démarrer.', true);
            if (transition?.incoming === this) stopMix('Démarre la deuxième platine, puis relance le fondu.');
          },
          onError: event => {
            if (version !== this.invalidate) return;
            this.controls(false);
            const description = ({100: 'Cette vidéo a été retirée ou est privée.', 101: 'Cette vidéo ne peut pas être lue hors de YouTube.', 150: 'Cette vidéo ne peut pas être lue hors de YouTube.', 153: 'YouTube refuse le lecteur intégré.'})[event.data]
              || 'Lecture impossible. Essaie une autre version.';
            this.status(description, true);
            if (transition) stopMix('Fondu interrompu, une vidéo est indisponible.');
          }
        }
      });
    } catch (error) {
      if (version === this.invalidate) this.status(error.message, true);
    }
  }

  updateRates() {
    const dropdown = this.get('.speed');
    const speed = this.player.getPlaybackRate() || 1;
    const options = this.player.getAvailablePlaybackRates() || [1];
    dropdown.replaceChildren(...options.map(rate => new Option(rate + '×', rate)));
    dropdown.value = speed;
  }

  tick() {
    const duration = Number(this.player?.getDuration?.()) || 0;
    const elapsed = this.position;
    this.seekBar.max = duration || 1;
    if (document.activeElement !== this.seekBar) this.seekBar.value = elapsed;
    this.get('.time').textContent = clock(elapsed);
    this.get('.total').textContent = clock(duration);
  }
}

players.push(new Deck('A'), new Deck('B'));

function updateVolumes() {
  const position = (+cross.value + 100) / 200 * Math.PI / 2;
  const gains = [Math.cos(position), Math.sin(position)];
  const master = +$('master').value / 100;
  players.forEach((deck, i) => {
    if (deck.canControl) deck.player.setVolume(Math.round(+$('volume-' + deck.letter).value * master * gains[i]));
  });
}
function stopMix(message) {
  if (!transition) return;
  clearTimeout(transition.timeout);
  transition = null;
  automix.textContent = 'Automix';
  notice.textContent = message || 'Fondu interrompu.';
}
function scheduleFade(current) {
  requestAnimationFrame(now => fadeFrame(now, current));
}
function fadeFrame(now, current) {
  if (transition !== current || current.started === null) return;
  const part = Math.min(1, (now - current.started) / current.duration);
  cross.value = current.start + part * (current.end - current.start);
  updateVolumes();
  if (part < 1) scheduleFade(current);
  else {
    current.outgoing.player.pauseVideo();
    stopMix('Fondu terminé · platine ' + current.incoming.letter);
  }
}
automix.onclick = () => {
  if (transition) { stopMix(); return; }
  if (players.some(deck => !deck.canControl)) return;
  const [a,b] = players;
  if (!a.playing && !b.playing) {
    notice.textContent = 'Lance un morceau avant le fondu.';
    return;
  }
  const outgoing = a.playing !== b.playing ? (a.playing ? a : b) : (+cross.value <= 0 ? a : b);
  const incoming = outgoing === a ? b : a;
  const end = incoming === b ? 100 : -100;
  if (!incoming.playing) cross.value = -end;
  const alreadyPlaying = incoming.playing;
  transition = {outgoing, incoming, start:+cross.value, end, duration:+$('duration').value * 1000,
    started:alreadyPlaying ? performance.now() : null,
    timeout:setTimeout(() => {
      if (transition?.started === null) stopMix('La deuxième platine n’a pas démarré. Lance sa lecture puis réessaie.');
    }, 12000)};
  updateVolumes();
  automix.textContent = 'Arrêter le fondu';
  notice.textContent = 'Transition ' + outgoing.letter + ' → ' + incoming.letter;
  if (alreadyPlaying) scheduleFade(transition);
  else {
    if (incoming.cue) incoming.seek(incoming.cue);
    incoming.player.playVideo();
  }
};
cross.oninput = () => { stopMix(); updateVolumes(); };
for (const name of ['volume-A', 'volume-B', 'master']) $(name).oninput = updateVolumes;
setInterval(() => players.forEach(deck => deck.tick()), 350);

function displayResults(tracks) {
  $('results').replaceChildren();
  for (const track of tracks) {
    const row = document.createElement('li');
    const text = document.createElement('div');
    const title = document.createElement('strong');
    const details = document.createElement('small');
    title.textContent = track.title;
    details.textContent = [track.author, track.duration > 0 ? clock(track.duration) : ''].filter(Boolean).join(' · ');
    text.append(title, details);
    row.append(text);
    for (const deck of players) {
      const button = document.createElement('button');
      button.textContent = 'Charger ' + deck.letter;
      button.onclick = () => deck.load(track);
      row.append(button);
    }
    $('results').append(row);
  }
}

$('search').onsubmit = async event => {
  event.preventDefault();
  const term = $('query').value.trim();
  if (!term) return;
  const generation = ++requestGeneration;
  const status = $('search-status');
  const external = $('youtube-search');
  external.href = 'https://www.youtube.com/results?search_query=' + encodeURIComponent(term);
  external.hidden = false;
  const direct = videoId(term);
  if (direct) {
    status.textContent = 'Lien YouTube prêt. Choisis une platine.';
    displayResults([{id:direct,title:'Vidéo YouTube'}]);
    return;
  }
  status.textContent = 'Recherche en cours…';
  displayResults([]);
  try {
    const url = new URL('https://pipedapi.ducks.party/search');
    url.search = new URLSearchParams({q:term, filter:'videos'});
    const response = await fetch(url, {signal:AbortSignal.timeout(9000), referrerPolicy:'no-referrer'});
    if (!response.ok) throw Error('Recherche momentanément indisponible');
    const {items} = await response.json();
    if (generation !== requestGeneration) return;
    const seen = new Set();
    const tracks = [];
    for (const item of items || []) {
      const id = videoId(item.url);
      if (!id || item.type !== 'stream' || item.duration < 0 || seen.has(id)) continue;
      seen.add(id);
      tracks.push({id,title:item.title || 'Vidéo YouTube',author:item.uploaderName || '',duration:item.duration});
      if (tracks.length === 8) break;
    }
    displayResults(tracks);
    status.textContent = tracks.length ? 'Choisis la version à charger.' : 'Aucun résultat. Tu peux chercher sur YouTube et coller le lien ici.';
  } catch {
    if (generation !== requestGeneration) return;
    status.textContent = 'La recherche intégrée est indisponible. Ouvre YouTube, copie le lien du morceau et colle-le ici.';
  }
};
