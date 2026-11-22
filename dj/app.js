const select = (id) => document.getElementById(id);
const fade = select('fade');
const automate = select('automix');
const mixStatus = select('mix-status');
let audio;
let master;
let limiter, mainOutput, monitor, headphoneMaster, headphoneCue, headphoneStream, headphonePlayer, mic;
let selectedOutput = false;
let effectsBeats = 1;
let libraryTracks = [];
let requestGeneration = 0;
let mixFrame = 0;
let cancelPendingMix;

function initAudio() {
  if (!audio) {
    audio = new AudioContext();
    master = audio.createGain();
    limiter = audio.createDynamicsCompressor();
    limiter.threshold.value = -4;
    limiter.ratio.value = 12;
    mainOutput = audio.createGain();
    monitor = audio.createGain();
    headphoneMaster = audio.createGain();
    headphoneCue = audio.createGain();
    headphoneStream = audio.createMediaStreamDestination();
    master.connect(limiter).connect(mainOutput).connect(audio.destination);
    limiter.connect(headphoneMaster).connect(monitor);
    headphoneCue.connect(monitor);
    monitor.connect(audio.destination);
    master.gain.value = +select('master').value;
    decks.forEach(deck => deck.setup());
    updateFade();
    patchMonitor();
  }
  return audio.resume();
}
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
const formatTime = value => Math.floor(value / 60) + ':' + String(Math.floor(value % 60)).padStart(2, '0');
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
    const parts = select('deck').content.cloneNode(true);
    [this.node, this.strip, this.extra] = parts.children;
    this.get('.badge').textContent = letter;
    this.node.setAttribute('aria-label', 'Platine ' + letter);
    this.node.dataset.letter = letter;
    this.readout = document.createElement('div');
    this.readout.className = 'deck-readout';
    this.readout.dataset.letter = letter;
    this.readout.setAttribute('aria-label', 'Écran de la platine ' + letter);
    for (const selector of ['.deck-head', '.youtube-player', '.time', '.state']) {
      this.readout.append(this.node.querySelector(selector));
    }
    select('readouts').append(this.readout);
    this.strip.setAttribute('aria-label', 'Canal ' + letter);
    this.get('.channel-name').textContent = 'CH ' + letter;
    this.get('.channel-volume-name').textContent = 'Volume ' + letter;
    this.get('.extra-name').textContent = 'Platine ' + letter;
    select('decks').append(this.node);
    select('channels').append(this.strip);
    select('extra-decks').append(this.extra);
    this.generation = 0;
    this.position = this.cue = 0;
    this.rate = 1;
    this.sources = [];
    this.padMode = 'cue';
    this.hotCues = Array(8).fill(null);
    this.loopIn = null;
    this.shift = false;
    this.samples = new Map();
    this.renderPads();
    this.bindJog();
    this.get('.filter-control').oninput = event => this.setFilter(+event.target.value);
    this.get('.channel-level').oninput = () => {
      if (this.shift && this.ready && +this.get('.channel-level').value > .05 && !this.playing) {
        this.seek(this.cue);
        this.start();
      }
      updateFade();
    };
    this.get('.bpm-value').oninput = event => {
      const input = event.target;
      this.meta.bpm = input.validity.valid ? +input.value : 0;
      this.get('[data-action=loop]').disabled = !this.meta.bpm;
      this.get('[data-mode=loop]').disabled = !this.meta.bpm;
      updateSyncControls();
      updateBeatFx();
    };
    this.get('.seek').oninput = event => {
      cancelMix();
      this.seek(+event.target.value);
    };
    this.get('.rate').oninput = event => {
      cancelMix();
      this.get('[data-action=sync]').setAttribute('aria-pressed', 'false');
      if (this.youtube) this.player.setPlaybackRate(this.videoRates[+event.target.value]);
      else this.setRate(+event.target.value);
    };
    for (const name of ['gain', 'low', 'mid', 'high']) {
      this.get('.' + name).oninput = event => {
        if (this.youtube) {
          updateFade();
          return;
        }
        const parameter = name === 'gain' ? this.volume.gain : this.eq[name].gain;
        parameter.setTargetAtTime(+event.target.value, audio.currentTime, .01);
      };
    }
    const handle = async event => {
      const button = event.target.closest('button');
      if (!button || button.disabled || !this.ready) return;
      const action = button.dataset.action;
      const shifted = this.shift || event.shiftKey;
      if (action === 'shift') {
        this.shift = !this.shift;
        button.setAttribute('aria-pressed', String(this.shift));
        return;
      }
      if (button.dataset.mode) {
        this.padMode = shifted && button.dataset.mode === 'jump' ? 'loop' : button.dataset.mode;
        this.renderPads();
        return;
      }
      if (!this.youtube || (button.dataset.pad !== undefined && this.padMode === 'sampler')) {
        const generation = this.generation;
        await initAudio();
        if (generation !== this.generation) return;
      }
      if (button.dataset.pad !== undefined) {
        this.triggerPad(+button.dataset.pad, shifted);
        return;
      }
      if (['play', 'cue', 'loop'].includes(action)) cancelMix();
      if (action === 'play') this.playing ? this.pause() : this.start();
      if (action === 'cue') {
        if (shifted || this.playing) {
          this.pause();
          this.applyLoop(null);
          this.seek(shifted ? 0 : this.cue);
        } else {
          this.cue = this.time();
          this.status('Cue · ' + formatTime(this.cue), 'ready');
        }
      }
      if (action === 'mark') {
        this.cue = this.time();
        this.status('Cue enregistré à ' + formatTime(this.cue) + '.', 'ready');
      }
      if (action === 'loop') this.toggleLoop();
      if (action === 'loop-in') {
        this.loopIn = this.time();
        this.status('Loop In · ' + formatTime(this.loopIn), 'ready');
      }
      if (action === 'loop-out') {
        cancelMix();
        if (this.loop) this.applyLoop(null);
        else if (this.loopIn !== null && this.time() > this.loopIn + .12) {
          this.applyLoop({ start: this.loopIn, end: this.time() });
        } else this.status('Pose Loop In, avance dans le morceau, puis clique sur Loop Out.', 'ready');
      }
      if (action === 'back' || action === 'forward') {
        cancelMix();
        this.cueLoopArrow(action === 'back' ? -1 : 1, shifted);
      }
      if (action === 'sync') this.sync();
      if (action === 'monitor') {
        this.cueOn = !this.cueOn;
        button.setAttribute('aria-pressed', String(this.cueOn));
        patchMonitor();
      }
    };
    for (const section of [this.node, this.strip, this.extra]) section.onclick = handle;
  }
  get(selector) {
    return this.node.querySelector(selector) || this.readout.querySelector(selector)
      || this.strip.querySelector(selector) || this.extra.querySelector(selector);
  }
  controls(selector) {
    return [this.node, this.readout, this.strip, this.extra].flatMap(section => [...section.querySelectorAll(selector)]);
  }
  status(message, state) {
    this.node.dataset.state = state;
    this.readout.dataset.state = state;
    this.get('.state').textContent = message;
  }
  setup() {
    this.volume = audio.createGain();
    this.volume.gain.value = +this.get('.gain').value;
    this.channel = audio.createGain();
    this.levelAnalyser = audio.createAnalyser();
    this.levelAnalyser.fftSize = 256;
    this.levelBuffer = new Float32Array(256);
    this.channel.connect(this.levelAnalyser);
    this.blendBass = audio.createBiquadFilter();
    this.blendBass.type = 'lowshelf';
    this.blendBass.frequency.value = 210;
    this.cueGain = audio.createGain();
    this.cueGain.gain.value = 0;
    this.beatDelay = audio.createDelay(5);
    this.beatDelay.delayTime.value = .5;
    this.beatWet = audio.createGain();
    this.beatFeedback = audio.createGain();
    this.beatWet.gain.value = this.beatFeedback.gain.value = 0;
    this.smartDelay = audio.createDelay(1);
    this.smartDelay.delayTime.value = .16;
    this.smartWet = audio.createGain();
    this.smartWet.gain.value = 0;
    this.filter = audio.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 22000;
    this.filter.Q.value = .7;
    this.delay = audio.createDelay(2);
    this.delay.delayTime.value = .25;
    this.feedback = audio.createGain();
    this.feedback.gain.value = 0;
    this.wet = audio.createGain();
    this.wet.gain.value = 0;
    this.eq = {};
    for (const [name, type, frequency] of [['low', 'lowshelf', 200], ['mid', 'peaking', 1000], ['high', 'highshelf', 4500]]) {
      const filter = audio.createBiquadFilter();
      filter.type = type;
      filter.frequency.value = frequency;
      this.eq[name] = filter;
    }
    this.eq.low.connect(this.eq.mid).connect(this.eq.high).connect(this.filter).connect(this.volume);
    this.volume.connect(this.blendBass).connect(this.channel).connect(master);
    this.volume.connect(this.cueGain).connect(headphoneCue);
    this.volume.connect(this.delay).connect(this.wet).connect(this.channel);
    this.delay.connect(this.feedback).connect(this.delay);
    this.volume.connect(this.smartDelay).connect(this.smartWet).connect(this.channel);
    this.volume.connect(this.beatDelay).connect(this.beatWet).connect(this.channel);
    this.beatDelay.connect(this.beatFeedback).connect(this.beatDelay);
  }
  async load(track) {
    const generation = ++this.generation;
    cancelMix();
    this.pause();
    this.player?.destroy();
    this.player = null;
    this.ready = false;
    this.youtube = !!track.id;
    this.buffer = null;
    this.get('[data-action=play]').textContent = '▶ Play';
    this.duration = 0;
    this.meta = {bpm: 0};
    this.loop = null;
    clearTimeout(this.effectTimer);
    if (this.wet) this.wet.gain.setTargetAtTime(0, audio.currentTime, .02);
    this.position = this.cue = 0;
    this.loopIn = null;
    this.hotCues.fill(null);
    this.cueOn = this.shift = false;
    this.padMode = 'cue';
    for (const action of ['sync', 'shift', 'monitor', 'loop', 'loop-out']) {
      this.get('[data-action=' + action + ']').setAttribute('aria-pressed', 'false');
    }
    if (audio) patchMonitor();
    this.abort?.abort();
    this.abort = new AbortController();
    const signal = this.abort.signal;
    const host = this.get('.youtube-player');
    host.hidden = !this.youtube;
    host.replaceChildren();
    this.get('h2').textContent = track.title;
    this.get('.artist').textContent = track.author || '';
    this.get('.bpm-value').value = '';
    this.resetRateControl();
    this.enableControls();
    this.draw();
    updateFade();
    this.status(this.youtube ? 'Ouverture du lecteur YouTube…' : 'Chargement du fichier audio…', 'loading');
    try {
      if (this.youtube) {
        const YT = await api();
        if (generation !== this.generation) return;
        this.openVideo(YT, track.id, host, generation);
        return;
      }
      await initAudio();
      let data;
      if (track.file) {
        if (track.file.size > 60_000_000) throw Error('Le fichier dépasse 60 Mo.');
        data = await track.file.arrayBuffer();
      } else {
        const response = await fetch(track.url, {signal, credentials:'omit'});
        if (!response.ok) throw Error('Le fichier audio est indisponible.');
        if (+response.headers.get('Content-Length') > 60_000_000) throw Error('Le fichier dépasse 60 Mo.');
        data = await response.arrayBuffer();
      }
      if (data.byteLength > 60_000_000) throw Error('Le fichier dépasse 60 Mo.');
      if (generation !== this.generation) return;
      const buffer = await audio.decodeAudioData(data);
      if (generation !== this.generation) return;
      this.buffer = buffer;
      this.duration = buffer.duration;
      this.ready = true;
      this.enableControls();
      this.status('Audio prêt.', 'ready');
      updateFade();
      updateBeatFx();
    } catch (error) {
      if (generation === this.generation) {
        this.status(error instanceof TypeError ? 'Lien audio illisible. Utilise un fichier ou un lien HTTPS qui autorise la lecture externe.' : error.message, 'error');
      }
    }
  }
  openVideo(YT, id, host, generation) {
    const placeholder = document.createElement('div');
    host.append(placeholder);
    this.player = new YT.Player(placeholder, {
      width: '100%', height: '100%', videoId: id,
      playerVars: {playsinline: 1, origin: location.origin, rel: 0},
      events: {
        onReady: () => {
          if (generation !== this.generation) return;
          this.ready = true;
          this.refreshVideoRate();
          this.enableControls();
          updateFade();
          this.status('YouTube prêt · transport et mixage de volume.', 'ready');
        },
        onStateChange: event => {
          if (generation !== this.generation) return;
          this.playing = event.data === 1;
          this.get('[data-action=play]').textContent = this.playing ? '❚❚ Pause' : '▶ Play';
          if (event.data === 1 || event.data === 5) this.refreshVideoRate();
        },
        onPlaybackRateChange: () => {
          if (generation === this.generation) this.refreshVideoRate();
        },
        onAutoplayBlocked: () => {
          if (generation === this.generation) this.status('Démarre la vidéo depuis le lecteur YouTube.', 'error');
        },
        onError: event => {
          if (generation !== this.generation) return;
          this.ready = this.playing = false;
          if (this.loop) this.applyLoop(null);
          cancelMix();
          this.enableControls();
          const message = ({
            100: 'Vidéo privée ou retirée.',
            101: 'YouTube réserve cette vidéo à son site. Essaie une autre version.',
            150: 'YouTube réserve cette vidéo à son site. Essaie une autre version.',
            153: 'YouTube refuse le lecteur intégré sur cette page.'
          })[event.data];
          this.status(message || 'Lecture impossible. Essaie une autre version.', 'error');
        }
      }
    });
  }
  enableControls() {
    this.controls('button,input:not(.channel-level)').forEach(control => control.disabled = !this.ready);
    for (const selector of ['.high', '.mid', '.low', '.filter-control', '[data-action=monitor]', '[data-mode=fx]']) {
      this.get(selector).disabled = !this.ready || this.youtube;
    }
    this.get('[data-action=loop]').disabled = this.get('[data-mode=loop]').disabled = !this.ready || !this.meta.bpm;
    this.get('.rate').disabled = !this.ready || (this.youtube && this.videoRates.length < 2);
    this.renderPads();
    updateSyncControls();
    updateMixButton();
  }
  resetRateControl() {
    this.videoRates = [1];
    const slider = this.get('.rate');
    slider.min = .84;
    slider.max = 1.16;
    slider.step = .001;
    this.rate = 1;
    slider.value = 1;
    this.showRate();
  }
  refreshVideoRate() {
    this.videoRates = this.player.getAvailablePlaybackRates() || [1];
    if (!this.videoRates.length) this.videoRates = [1];
    const slider = this.get('.rate');
    slider.min = 0;
    slider.max = Math.max(1, this.videoRates.length - 1);
    slider.step = 1;
    this.rate = this.player.getPlaybackRate() || 1;
    slider.value = Math.max(0, this.videoRates.indexOf(this.rate));
    slider.disabled = this.videoRates.length < 2;
    this.showRate();
  }
  showRate() {
    paintFader(this.get('.rate'));
    this.get('.speed').textContent = Math.round((this.rate - 1) * 1000) / 10 + ' %';
  }
  setRate(rate, follow = true) {
    this.position = this.time();
    if (this.playing) this.startedAt = audio.currentTime;
    this.rate = rate;
    const slider = this.get('.rate');
    slider.value = rate;
    this.showRate();
    for (const source of this.sources) source.playbackRate.value = rate;
    updateBeatFx();
    if (follow && this.meta?.bpm) {
      const other = decks.find(deck => deck !== this);
      if (!other.youtube && other.meta?.bpm && other.get('[data-action=sync]').getAttribute('aria-pressed') === 'true') {
        const ratio = this.meta.bpm * rate / other.meta.bpm;
        if (ratio >= .84 && ratio <= 1.16) other.setRate(ratio, false);
      }
    }
  }
  time() {
    if (this.youtube && this.ready) return this.player.getCurrentTime() || 0;
    if (!this.playing) return this.position;
    const position = this.position + Math.max(0, audio.currentTime - this.startedAt) * this.rate;
    if (this.loop && position >= this.loop.end) {
      return this.loop.start + (position - this.loop.start) % (this.loop.end - this.loop.start);
    }
    return Math.min(this.duration, position);
  }
  seek(position) {
    if (this.youtube) {
      if (this.ready && this.duration) this.player.seekTo(Math.min(this.duration, Math.max(0, position)), true);
      return;
    }
    const restart = this.playing;
    this.pause();
    this.position = Math.min(this.duration || 0, Math.max(0, position));
    if (restart) this.start();
    this.draw();
  }
  pause() {
    if (this.youtube) {
      if (this.ready) this.player.pauseVideo();
      this.playing = false;
      this.get('[data-action=play]').textContent = '▶ Play';
      return;
    }
    if (this.playing) this.position = this.time();
    this.playing = false;
    for (const source of this.sources) source.stop();
    this.sources = [];
    this.get('[data-action=play]').textContent = '▶ Play';
  }
  start() {
    if (!this.ready || this.playing) return;
    if (this.youtube) {
      this.player.playVideo();
      return;
    }
    if (this.position >= this.duration - .02) this.position = 0;
    this.startedAt = audio.currentTime + .025;
    this.playing = true;
    const source = audio.createBufferSource();
    source.buffer = this.buffer;
    source.playbackRate.value = this.rate;
    if (this.loop) {
      source.loop = true;
      source.loopStart = this.loop.start;
      source.loopEnd = this.loop.end;
    }
    source.connect(this.eq.low);
    source.onended = () => source.disconnect();
    source.start(this.startedAt, this.position);
    this.sources.push(source);
    this.get('[data-action=play]').textContent = '❚❚ Pause';
  }
  toggleLoop() {
    const position = this.time();
    if (this.loop) {
      this.applyLoop(null);
    } else {
      const end = Math.min(position + 240 / this.meta.bpm, this.duration);
      if (end - position < .2) return;
      this.applyLoop({ start: position, end });
    }
  }
  applyLoop(loop) {
    const position = this.time();
    this.loop = loop;
    this.get('[data-action=loop]').setAttribute('aria-pressed', String(!!this.loop));
    this.get('[data-action=loop-out]').setAttribute('aria-pressed', String(!!this.loop));
    this.seek(loop ? loop.start : position);
  }
  setFilter(value) {
    const cutoff = value < 0 ? 20000 * Math.pow(.008, -value) : 25 * Math.pow(280, value);
    this.filter.type = value > 0 ? 'highpass' : 'lowpass';
    this.filter.frequency.setTargetAtTime(value === 0 ? 22000 : cutoff, audio.currentTime, .025);
    this.get('.filter-value').textContent = value < 0 ? 'Passe-bas' : value > 0 ? 'Passe-haut' : 'Neutre';
    if (this.smartWet) {
      this.smartWet.gain.setTargetAtTime(pressed('smart-cfx') ? Math.abs(value) * .45 : 0, audio.currentTime, .04);
    }
  }
  cueLoopArrow(direction, shifted) {
    if (this.loop) {
      const { start, end } = this.loop;
      const duration = (end - start) * (direction < 0 ? .5 : 2);
      if (duration >= .08) this.applyLoop({ start, end: Math.min(this.duration, start + duration) });
      return;
    }
    if (shifted) {
      this.cue = direction < 0 ? 0 : this.time();
      this.status(direction < 0 ? 'Cue effacé.' : 'Cue enregistré.', 'ready');
      return;
    }
    const points = [...new Set([this.cue, ...this.hotCues.filter(point => point !== null)])].sort((a, b) => a - b);
    const position = this.time();
    const point = direction < 0 ? points.findLast(value => value < position - .08) : points.find(value => value > position + .08);
    if (point !== undefined) this.seek(point);
    else this.jump(direction);
  }
  jump(beats) {
    this.seek(this.time() + beats * (this.meta.bpm ? 60 / this.meta.bpm : .5));
  }
  sync() {
    const control = this.get('[data-action=sync]');
    if (control.getAttribute('aria-pressed') === 'true') {
      control.setAttribute('aria-pressed', 'false');
      this.status('Beat Sync désactivé.', 'ready');
      return;
    }
    const other = decks.find(deck => deck !== this);
    if (!this.meta.bpm || !other.meta?.bpm) {
      this.status('Renseigne les deux BPM.', 'ready');
      return;
    }
    const rate = other.meta.bpm * other.rate / this.meta.bpm;
    if (rate < .84 || rate > 1.16) {
      this.status('Écart trop grand pour la plage de tempo ±16 %.', 'ready');
      return;
    }
    cancelMix();
    const offset = ((other.time() - 0) % otherBeat + otherBeat) % otherBeat;
    const nearest = 0 + Math.round((this.time() - 0) / beat) * beat;
    other.get('[data-action=sync]').setAttribute('aria-pressed', 'false');
    this.setRate(rate);
    control.setAttribute('aria-pressed', 'true');
    this.status('Tempo calé sur la platine ' + other.letter + '.', 'ready');
  }
  renderPads() {
    const labels = this.padMode === 'cue' ? this.hotCues.map((point, i) => 'Cue ' + (i + 1) + (point === null ? '' : ' · ' + formatTime(point)))
      : this.padMode === 'jump' ? ['−16', '−8', '−4', '−1', '+1', '+4', '+8', '+16']
      : this.padMode === 'loop' ? ['¼', '½', '1', '2', '4', '8', '16', '32']
      : this.padMode === 'sampler' ? ['Kick', 'Snare', 'Hat', 'Clap', 'Tom bas', 'Tom haut', 'Ride', 'Impact']
      : ['Écho ½', 'Écho 1', 'Écho 2', 'Doublage', 'Coupe-bas', 'Coupe-haut', 'Vinyl stop', 'Reset FX'];
    this.controls('[data-mode]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.mode === this.padMode));
    });
    this.get('.pads').replaceChildren(...labels.map((name, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = name;
      button.dataset.pad = index;
      button.dataset.active = this.padMode === 'cue' && this.hotCues[index] !== null;
      button.disabled = !this.ready;
      if (this.padMode === 'cue') button.title = 'Clique pour poser ou rappeler. Maj + clic pour effacer.';
      return button;
    }));
  }
  triggerPad(index, shift) {
    if (this.padMode === 'cue') {
      if (shift) this.hotCues[index] = null;
      else if (this.hotCues[index] === null) this.hotCues[index] = this.time();
      else {
        cancelMix();
        this.applyLoop(null);
        this.seek(this.hotCues[index]);
        this.start();
      }
      this.renderPads();
      return;
    }
    cancelMix();
    if (this.padMode === 'jump') this.jump([-16, -8, -4, -1, 1, 4, 8, 16][index]);
    if (this.padMode === 'loop') {
      if (!this.meta.bpm) {
        this.status('Tempo indéterminé. Utilise Loop In et Loop Out.', 'ready');
        return;
      }
      const start = this.time();
      const length = [0.25, 0.5, 1, 2, 4, 8, 16, 32][index] * 60 / this.meta.bpm;
      const end = Math.min(start + length, this.duration);
      if (end - start > .03) this.applyLoop({ start, end });
    }
    if (this.padMode === 'fx') this.padEffect(index);
    if (this.padMode === 'sampler') this.playSample(index, shift);
  }
  playSample(index, stop) {
    const previous = this.samples.get(index);
    if (previous) {
      this.samples.delete(index);
      previous.stop();
    }
    if (stop) return;
    const when = audio.currentTime;
    const length = [.24, .14, .08, .14, .28, .2, .35, .45][index];
    const gain = audio.createGain();
    gain.gain.setValueAtTime(.34, when);
    gain.gain.exponentialRampToValueAtTime(.001, when + length);
    gain.connect(master);
    let source;
    if ([0, 4, 5].includes(index)) {
      source = audio.createOscillator();
      source.frequency.setValueAtTime([130, 0, 0, 0, 180, 260][index], when);
      source.frequency.exponentialRampToValueAtTime([45, 0, 0, 0, 85, 130][index], when + length);
      source.connect(gain);
    } else {
      source = audio.createBufferSource();
      const buffer = audio.createBuffer(1, Math.ceil(length * audio.sampleRate), audio.sampleRate);
      const channel = buffer.getChannelData(0);
      for (let i = 0; i < channel.length; i++) channel[i] = Math.random() * 2 - 1;
      source.buffer = buffer;
      const tone = audio.createBiquadFilter();
      tone.type = 'bandpass';
      tone.frequency.value = [0, 1600, 8200, 2200, 0, 0, 6100, 750][index];
      tone.Q.value = .8;
      source.connect(tone).connect(gain);
      source.addEventListener('ended', () => tone.disconnect(), {once:true});
    }
    this.samples.set(index, source);
    source.start();
    source.stop(when + length);
    source.onended = () => {
      if (this.samples.get(index) === source) this.samples.delete(index);
      source.disconnect();
      gain.disconnect();
    };
  }
  padEffect(index) {
    clearTimeout(this.effectTimer);
    const now = audio.currentTime;
    this.wet.gain.setTargetAtTime(0, now, .018);
    if (index < 4) {
      const beat = this.meta.bpm ? 60 / this.meta.bpm : .5;
      this.delay.delayTime.setValueAtTime(Math.min(1.9, [beat / 2, beat, beat * 2, .026][index]), now);
      this.feedback.gain.setValueAtTime(index === 3 ? .14 : .43, now);
      this.wet.gain.setTargetAtTime(.48, now, .018);
      this.status(index === 3 ? 'Doublage actif.' : 'Écho actif.', 'ready');
      this.effectTimer = setTimeout(() => this.wet.gain.setTargetAtTime(0, audio.currentTime, .1), 1700);
    } else if (index === 6 && this.playing) {
      const generation = this.generation;
      const pausedRate = this.rate;
      for (const source of this.sources) source.playbackRate.exponentialRampToValueAtTime(.035, now + .38);
      this.status('Ralentissement vinyle…', 'ready');
      this.effectTimer = setTimeout(() => {
        if (this.generation !== generation) return;
        this.pause();
        this.setRate(pausedRate);
        this.status('Lecture arrêtée.', 'ready');
      }, 400);
    } else if (index !== 6) {
      const value = index === 4 ? .69 : index === 5 ? -.65 : 0;
      const filter = this.get('.filter-control');
      filter.value = value;
      filter.dispatchEvent(new Event('input', {bubbles:true}));
      this.status(index === 7 ? 'Effets remis à zéro.' : 'Filtre actif.', 'ready');
    }
  }
  bindJog() {
    const wheel = this.get('.jog');
    let drag;
    wheel.onpointerdown = event => {
      if (!this.ready || event.button !== 0) return;
      cancelMix();
      if (!this.youtube) initAudio();
      const rect = wheel.getBoundingClientRect();
      const edge = Math.hypot(event.clientX - rect.left - rect.width / 2,
                              event.clientY - rect.top - rect.height / 2) > rect.width * .37;
      const bend = !this.youtube && edge && this.playing && !this.shift;
      drag = { x: event.clientX, y: event.clientY, playing: this.playing, bend, rate: this.rate, position: this.time(), id: event.pointerId, last: 0 };
      if (!bend) this.pause();
      wheel.setPointerCapture(event.pointerId);
    };
    wheel.onpointermove = event => {
      if (!drag || drag.id !== event.pointerId) return;
      const movement = (event.clientX - drag.x) - (event.clientY - drag.y) * .35;
      drag.x = event.clientX;
      drag.y = event.clientY;
      if (Math.abs(movement) < .3) return;
      if (drag.bend) {
        this.setRate(drag.rate * (1 + Math.max(-.07, Math.min(.07, movement * .004))));
        return;
      }
      drag.position = Math.max(0, Math.min(this.duration, (this.youtube ? drag.position : this.time()) + movement * (this.shift ? .09 : .014)));
      if (this.youtube) {
        wheel.style.setProperty('--jog-angle', (drag.position * 200 % 360) + 'deg');
        return;
      }
      this.seek(drag.position);
      if (!this.shift && audio.currentTime - drag.last > .05) {
        this.previewJog(Math.sign(movement), Math.abs(movement));
        drag.last = audio.currentTime;
      }
    };
    wheel.onlostpointercapture = () => {
      if (drag && this.youtube) this.seek(drag.position);
      if (drag?.bend) this.setRate(drag.rate);
      else if (drag?.playing) this.start();
      drag = null;
    };
    wheel.onkeydown = event => {
      if (!this.ready || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      cancelMix();
      this.jump(event.key === 'ArrowLeft' ? -1 : 1);
    };
  }
  previewJog(direction, speed) {
    const first = this.buffer;
    const length = Math.floor(first.sampleRate * .065);
    const buffer = audio.createBuffer(2, length, first.sampleRate);
    const position = Math.floor(this.time() * first.sampleRate);
    const rate = Math.min(3, Math.max(.65, speed * .18));
    for (let channel = 0; channel < 2; channel++) {
      const signal = first.getChannelData(Math.min(channel, first.numberOfChannels - 1));
      const samples = buffer.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        const index = Math.floor(position + direction * i * rate);
        const envelope = Math.sin(i / length * Math.PI) * .5;
        samples[i] = envelope * (signal[index] || 0);
      }
    }
    const preview = audio.createBufferSource();
    preview.buffer = buffer;
    preview.connect(this.eq.low);
    preview.onended = () => preview.disconnect();
    preview.start();
  }
  draw() {
    if (this.youtube && this.ready) {
      this.duration = this.player.getDuration() || 0;
      if (this.playing && this.loop && this.time() >= this.loop.end) this.seek(this.loop.start);
    }
    const position = this.time();
    if (this.levelAnalyser) {
      this.levelAnalyser.getFloatTimeDomainData(this.levelBuffer);
      const peak = this.levelBuffer.reduce((max, sample) => Math.max(max, Math.abs(sample)), 0);
      const meter = select('meter-' + this.letter.toLowerCase());
      meter.style.setProperty('--leds', String(Math.max(0, Math.min(5, Math.ceil((20 * Math.log10(peak || .0001) + 45) / 9)))));
    }
    this.get('.jog').style.setProperty('--jog-angle', (position * 200 % 360) + 'deg');
    this.get('.elapsed').textContent = formatTime(position);
    this.get('.length').textContent = formatTime(this.duration || 0);
    const seek = this.get('.seek');
    seek.max = this.duration || 1;
    if (document.activeElement !== seek) seek.value = position;
  }
}
const decks = [new Deck('A'), new Deck('B')];
function paintFader(input) {
  const fraction = (+input.max - +input.value) / (+input.max - +input.min);
  input.parentElement.style.setProperty('--fader-position', Math.max(0, Math.min(1, fraction)));
}
for (const input of document.querySelectorAll('.channel-level, .tempo-strip .rate')) {
  const rail = document.createElement('span');
  rail.className = 'vertical-fader';
  input.before(rail);
  rail.append(input);
  input.addEventListener('input', () => paintFader(input));
  paintFader(input);
}
for (const id of ['mic-level', 'monitor-mix', 'monitor-level']) {
  const field = select(id).closest('label');
  field.classList.add('hardware-' + id);
  select('hardware-audio').append(field);
}

function makeKnob(input) {
  const wrap = document.createElement('span');
  wrap.className = 'knob';
  const dial = document.createElement('span');
  dial.className = 'knob-dial';
  dial.setAttribute('aria-hidden', 'true');
  input.before(wrap);
  wrap.append(dial, input);
  const paint = () => {
    const t = (+input.value - +input.min) / Math.max(1e-6, +input.max - +input.min);
    dial.style.setProperty('--angle', (t * 270 - 135) + 'deg');
    const label = input.closest('label')?.textContent.trim() || input.labels?.[0]?.textContent.trim();
    wrap.title = (label ? label + ' · ' : '') + input.value;
  };
  const set = value => {
    const min = +input.min, max = +input.max, step = +input.step || 1;
    input.value = Math.max(min, Math.min(max, Math.round(value / step) * step));
    input.dispatchEvent(new Event('input', {bubbles:true}));
  };
  let gesture;
  input.addEventListener('pointerdown', event => {
    if (event.button !== 0 || input.disabled) return;
    event.preventDefault();
    input.focus();
    input.setPointerCapture(event.pointerId);
    gesture = {x:event.clientX, y:event.clientY, value:+input.value};
  });
  input.addEventListener('pointermove', event => {
    if (!gesture) return;
    const delta = (gesture.y - event.clientY + .55 * (event.clientX - gesture.x)) * (+input.max - +input.min) / 110;
    set(gesture.value + delta);
  });
  input.addEventListener('lostpointercapture', () => { gesture = null; });
  input.addEventListener('dblclick', () => set(+input.defaultValue));
  input.addEventListener('input', paint);
  paint();
}
document.querySelectorAll('.channel-strip label:not(.channel-fader) input, #master, #fx-depth, #browse, #hardware-audio input')
  .forEach(makeKnob);

function pressed(id) {
  return select(id).getAttribute('aria-pressed') === 'true';
}
function toggle(id) {
  const active = !pressed(id);
  select(id).setAttribute('aria-pressed', String(active));
  return active;
}
function patchMonitor() {
  if (!audio) return;
  const now = audio.currentTime;
  const hasCues = decks.some(deck => deck.cueOn);
  const active = hasCues || pressed('master-cue');
  const mix = +select('monitor-mix').value;
  for (const deck of decks) deck.cueGain.gain.setTargetAtTime(deck.cueOn ? 1 : 0, now, .018);
  headphoneMaster.gain.setTargetAtTime(pressed('master-cue') ? (hasCues ? mix : 1) : 0, now, .018);
  headphoneCue.gain.setTargetAtTime(pressed('master-cue') ? 1 - mix : 1, now, .018);
  monitor.gain.setTargetAtTime(active ? +select('monitor-level').value : 0, now, .018);
  mainOutput.gain.setTargetAtTime(active && !selectedOutput ? 0 : 1, now, .018);
}
select('master-cue').onclick = async () => {
  await initAudio();
  toggle('master-cue');
  patchMonitor();
};
for (const id of ['monitor-level', 'monitor-mix']) select(id).oninput = patchMonitor;
select('monitor-output').onclick = async () => {
  const status = select('audio-status');
  if (!navigator.mediaDevices?.selectAudioOutput || !HTMLMediaElement.prototype.setSinkId) {
    status.textContent = 'Le navigateur ne propose pas de seconde sortie. Cue utilise la sortie actuelle.';
    return;
  }
  try {
    const device = await navigator.mediaDevices.selectAudioOutput();
    await initAudio();
    headphonePlayer ??= new Audio();
    headphonePlayer.srcObject = headphoneStream.stream;
    await headphonePlayer.setSinkId(device.deviceId);
    await headphonePlayer.play();
    if (!selectedOutput) {
      monitor.disconnect(audio.destination);
      monitor.connect(headphoneStream);
      selectedOutput = true;
    }
    patchMonitor();
    status.textContent = 'Sortie casque · ' + (device.label || 'périphérique sélectionné');
  } catch {
    status.textContent = 'Sortie casque indisponible. La préécoute reste sur la sortie actuelle.';
  }
};
function updateMic() {
  if (!mic) return;
  mic.gain.gain.setTargetAtTime(+select('mic-level').value * +select('mic-att').value, audio.currentTime, .02);
}
select('mic-level').oninput = select('mic-att').onchange = updateMic;
select('mic').onclick = async () => {
  const button = select('mic');
  if (mic) {
    mic.stream.getTracks().forEach(track => track.stop());
    mic.input.disconnect();
    mic.gain.disconnect();
    mic = null;
    toggle('mic');
    select('audio-status').textContent = 'Micro coupé.';
    return;
  }
  button.disabled = true;
  try {
    await initAudio();
    const stream = await navigator.mediaDevices.getUserMedia({audio: true});
    const input = audio.createMediaStreamSource(stream);
    const gain = audio.createGain();
    gain.gain.value = 0;
    input.connect(gain).connect(master);
    mic = {stream, input, gain};
    select('mic-level').value = 0;
    toggle('mic');
    select('audio-status').textContent = 'Micro connecté. Monte son niveau pour l’entendre.';
  } catch {
    select('audio-status').textContent = 'Micro indisponible ou autorisation refusée.';
  } finally {
    button.disabled = false;
  }
};
select('output-mode').onchange = async () => {
  await initAudio();
  mainOutput.channelCountMode = 'explicit';
  mainOutput.channelCount = select('output-mode').value === 'mono' ? 1 : 2;
};
select('smart-cfx').onclick = async () => {
  await initAudio();
  toggle('smart-cfx');
  for (const deck of decks) deck.setFilter(+deck.get('.filter-control').value);
};
select('smart-fader').onclick = () => {
  toggle('smart-fader');
  updateFade();
};
function updateBeatFx() {
  if (!audio) return;
  const target = select('fx-channel').value;
  const kind = select('fx-kind').value;
  const strength = +select('fx-depth').value;
  const now = audio.currentTime;
  for (const deck of decks) {
    const beat = deck.meta?.bpm ? 60 / (deck.meta.bpm * deck.rate) : .5;
    const active = pressed('fx-on') && target.includes(deck.letter);
    const timing = kind === 'slap' ? .065 * effectsBeats : beat * effectsBeats;
    deck.beatDelay.delayTime.setTargetAtTime(Math.min(4.8, timing), now, .03);
    deck.beatFeedback.gain.setTargetAtTime(kind === 'dub' ? .65 : kind === 'slap' ? .15 : .39, now, .03);
    deck.beatWet.gain.setTargetAtTime(active ? strength * .65 : 0, now, .025);
  }
}
select('fx-on').onclick = async () => {
  await initAudio();
  toggle('fx-on');
  updateBeatFx();
};
for (const id of ['fx-channel', 'fx-kind', 'fx-depth']) select(id).oninput = updateBeatFx;
function stepFx(factor) {
  effectsBeats = Math.max(.25, Math.min(8, effectsBeats * factor));
  select('fx-beats').textContent = ({'0.25':'¼', '0.5':'½'})[effectsBeats] || effectsBeats;
  select('fx-beats').append(' temps');
  updateBeatFx();
}
select('fx-less').onclick = () => stepFx(.5);
select('fx-more').onclick = () => stepFx(2);

function updateFade() {
  const position = +fade.value;
  const phase = (position + 1) * Math.PI / 4;
  const gains = [Math.cos(phase), Math.sin(phase)];
  decks.forEach((deck, index) => {
    const fader = +deck.get('.channel-level').value;
    if (deck.youtube && deck.ready) {
      const trim = +deck.get('.gain').value;
      const masterLevel = +select('master').value;
      deck.player.setVolume(Math.round(Math.min(1, trim * masterLevel * fader * gains[index]) * 100));
    }
    if (audio) {
      deck.channel.gain.setTargetAtTime(deck.youtube ? 0 : gains[index] * fader, audio.currentTime, .016);
      const cut = Math.max(0, 1 - Math.abs(position)) * (index === 0 ? 1 + position : 1 - position) * .5;
      deck.blendBass.gain.setTargetAtTime(pressed('smart-fader') ? -22 * cut : 0, audio.currentTime, .06);
    }
  });
}
function updateSyncControls() {
  for (const deck of decks) {
    const sync = deck.get('[data-action=sync]');
    sync.disabled = deck.youtube || decks.some(channel => !channel.ready || !channel.meta.bpm);
    if (sync.disabled) sync.setAttribute('aria-pressed', 'false');
  }
}
function updateMixButton() {
  automate.disabled = decks.some(deck => !deck.ready);
}
function cancelMix(message = 'Transition interrompue.') {
  if (!mixFrame && !cancelPendingMix) return;
  cancelPendingMix?.();
  cancelPendingMix = undefined;
  cancelAnimationFrame(mixFrame);
  mixFrame = 0;
  mixStatus.textContent = message;
  automate.textContent = 'Automix';
}
function automix() {
  if (mixFrame || cancelPendingMix) {
    cancelMix();
    return;
  }
  if (decks.some(deck => !deck.ready)) return;
  const [left, right] = decks;
  if (!left.playing && !right.playing) {
    mixStatus.textContent = 'Lance un morceau avant le fondu.';
    return;
  }
  const from = left.playing !== right.playing ? (left.playing ? left : right) : (+fade.value <= 0 ? left : right);
  const to = from === left ? right : left;
  const end = to === right ? 1 : -1;
  if (from.loop) from.applyLoop(null);
  if (to.loop) to.applyLoop(null);
  if (!to.playing) fade.value = -end;
  const start = +fade.value;
  const duration = +select('duration').value * 1000;
  const deadline = performance.now() + 12000;
  let started;
  updateFade();
  automate.textContent = 'Arrêter le fondu';
  mixStatus.textContent = 'Transition ' + from.letter + ' → ' + to.letter;
  cancelPendingMix = () => { if (started === undefined) to.pause(); };
  if (!to.playing) {
    if (to.cue) to.seek(to.cue);
    to.start();
  }
  function frame(now) {
    if (!to.playing && started === undefined) {
      if (now >= deadline) cancelMix('Démarre la deuxième platine, puis relance le fondu.');
      else mixFrame = requestAnimationFrame(frame);
      return;
    }
    if (started === undefined) started = now;
    const progress = Math.min(1, (now - started) / duration);
    fade.value = start + (end - start) * progress;
    updateFade();
    if (progress < 1) mixFrame = requestAnimationFrame(frame);
    else {
      from.pause();
      cancelMix('Transition terminée · Platine ' + to.letter);
    }
  }
  mixFrame = requestAnimationFrame(frame);
}
fade.oninput = () => {
  cancelMix();
  const incoming = +fade.value >= 0 ? decks[1] : decks[0];
  if (incoming.shift && incoming.ready && !incoming.playing) {
    incoming.seek(incoming.cue);
    incoming.start();
  }
  updateFade();
};
select('master').oninput = event => {
  if (master) master.gain.setTargetAtTime(+event.target.value, audio.currentTime, .015);
  updateFade();
};
automate.onclick = automix;
setInterval(() => {
  for (const deck of decks) {
    if (!deck.youtube && deck.playing && deck.time() >= deck.duration) deck.pause();
    deck.draw();
  }
}, 120);

function fromLink(query) {
  const id = videoId(query);
  if (id) return {id, title:'Vidéo YouTube'};
  try {
    const url = new URL(query);
    if (url.protocol === 'https:' && /\.(wav|mp3|m4a|aac|ogg|flac|webm|opus)$/i.test(url.pathname)) {
      return {url:url.href, title:url.pathname.split('/').pop(), author:url.hostname};
    }
  } catch { /* Un titre peut être recherché sans URL. */ }
  return null;
}
for (const deck of decks) {
  const input = select('file-' + deck.letter.toLowerCase());
  input.onchange = () => {
    const file = input.files[0];
    if (file) deck.load({file, title:file.name});
    input.value = '';
  };
}
const browse = select('browse');
function setBrowse(tracks) {
  libraryTracks = tracks;
  browse.max = Math.max(0, tracks.length - 1);
  browse.value = 0;
  for (const id of ['browse', 'load-a', 'load-b']) select(id).disabled = !tracks.length;
  browse.dispatchEvent(new Event('input', {bubbles:true}));
}
browse.oninput = () => {
  const current = libraryTracks[+browse.value];
  select('selected-track').textContent = current?.title || 'Recherche un titre';
  const rows = [...select('results').children];
  rows.forEach((row, index) => row.classList.toggle('selected', index === +browse.value));
};
select('load-a').onclick = () => decks[0].load(libraryTracks[+browse.value]);
select('load-b').onclick = () => decks[1].load(libraryTracks[+browse.value]);
function displayResults(tracks) {
  select('results').replaceChildren();
  for (const track of tracks) {
    const row = document.createElement('li');
    const text = document.createElement('div');
    const title = document.createElement('strong');
    const details = document.createElement('small');
    title.textContent = track.title;
    details.textContent = [track.author, track.duration > 0 ? formatTime(track.duration) : ''].filter(Boolean).join(' · ');
    text.append(title, details);
    row.append(text);
    for (const deck of decks) {
      const button = document.createElement('button');
      button.textContent = 'Charger ' + deck.letter;
      button.onclick = () => deck.load(track);
      row.append(button);
    }
    select('results').append(row);
  }
  setBrowse(tracks);
}

select('search').onsubmit = async event => {
  event.preventDefault();
  const term = select('query').value.trim();
  if (!term) return;
  const generation = ++requestGeneration;
  const status = select('search-status');
  const external = select('youtube-search');
  external.href = 'https://www.youtube.com/results?search_query=' + encodeURIComponent(term);
  external.hidden = false;
  const direct = fromLink(term);
  if (direct) {
    status.textContent = 'Lien prêt. Choisis une platine.';
    displayResults([direct]);
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
