import { CONFIG, mixVoice } from './config.js';
import { loadSettings, saveSettings } from './settings.js';
import { bindHelp } from './help.js';
import * as a11y from './a11y.js';
import * as camera from './camera.js';
import * as preprocess from './preprocess.js';
import * as ocr from './ocr.js';
import * as subtitle from './subtitle.js';
import * as tts from './tts.js';

const state = {
  running: false,
  settings: loadSettings(),
  lastFp: null,
  stableCount: 0,
  didOcrThisStable: false,
  emptyCount: 0,
  stableSince: 0,
  frameCanvas: document.createElement('canvas'),
  raf: 0,
  lastSample: 0,
  wakeLock: null,
};

const $ = (id) => document.getElementById(id);

async function boot() {
  applyScale();
  applyRegionClass();
  bind();
  bindHelp();
  paintSettings();
  tts.setOnChange(onTtsChange);
  registerSw();
  window.speechSynthesis?.addEventListener('voiceschanged', () => tts.loadVoices());
  ocr.init(onOcrProgress).then(() => {
    $('engine-state').textContent = '준비됨';
  }).catch((err) => {
    $('engine-state').textContent = '엔진 준비 실패';
    a11y.announce('인식 엔진을 불러오지 못했습니다.', 'assertive');
    console.error(err);
  });
}

function bind() {
  $('btn-start-camera').addEventListener('click', () => start('camera'));
  $('btn-start-file').addEventListener('click', () => $('file-input').click());
  $('file-input').addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (file) await start('file', file);
  });
  $('btn-stop').addEventListener('click', () => stop('button'));
  $('btn-settings').addEventListener('click', openSettings);
  $('btn-home-voice').addEventListener('click', openSettings);
  $('btn-voice').addEventListener('click', openSettings);
  $('btn-speed').addEventListener('click', openSettings);
  $('btn-sample').addEventListener('click', sampleVoice);
  $('set-speed-down').addEventListener('click', () => changeSpeed(-CONFIG.rateStep));
  $('set-speed-up').addEventListener('click', () => changeSpeed(CONFIG.rateStep));

  bindSeg('seg-scale', 'scale', (v) => {
    state.settings.textScale = Number(v);
    applyScale();
    persist();
  });
  bindSeg('seg-gender', 'gender', (v) => {
    state.settings.gender = v;
    persist();
  });
  bindSeg('seg-age', 'age', (v) => {
    state.settings.age = v;
    persist();
  });
  bindSeg('seg-creature', 'creature', (v) => {
    state.settings.creature = v;
    persist();
  });
  bindSeg('seg-region', 'region', (v) => {
    state.settings.regionMode = v;
    applyRegionClass();
    state.lastFp = null;
    persist();
  });

  document.addEventListener('keydown', onKey);
  document.addEventListener('visibilitychange', onVisibility);
}

function bindSeg(id, attr, onPick) {
  $(id).addEventListener('click', (e) => {
    const btn = e.target.closest('button[type="button"]');
    if (!btn || !btn.dataset[attr]) return;
    onPick(btn.dataset[attr]);
    paintSettings();
  });
}

function persist() {
  saveSettings(state.settings);
}

function applyScale() {
  document.documentElement.style.setProperty('--scale', String(state.settings.textScale || 1.15));
}

function applyRegionClass() {
  document.body.classList.toggle('region-top', state.settings.regionMode === 'top');
  const hint = $('zone-hint-text');
  if (hint) {
    hint.textContent = state.settings.regionMode === 'top'
      ? '위 자막을 노란 칸에 맞추세요'
      : '자막을 노란 칸에 맞추세요';
  }
}

function paintSettings() {
  const s = state.settings;
  press('seg-scale', 'scale', String(s.textScale));
  press('seg-gender', 'gender', s.gender);
  press('seg-age', 'age', s.age);
  press('seg-creature', 'creature', s.creature);
  press('seg-region', 'region', s.regionMode);
  $('speed-value').textContent = Number(s.rate).toFixed(2);
  const voice = mixVoice(s.gender, s.age, s.creature);
  $('btn-voice').setAttribute('aria-label', `목소리, 현재 ${voice.label}`);
  $('btn-home-voice').setAttribute('aria-label', `목소리, 현재 ${voice.label}`);
}

function press(id, attr, value) {
  $(id).querySelectorAll('button').forEach((btn) => {
    btn.setAttribute('aria-pressed', String(btn.dataset[attr] === value));
  });
}

function openSettings() {
  const d = $('settings-dialog');
  if (typeof d.showModal === 'function') d.showModal();
  else d.setAttribute('open', '');
}

function sampleVoice() {
  tts.unlock();
  tts.speakSample(state.settings);
}

function changeSpeed(delta) {
  const next = Math.round(Math.min(CONFIG.maxRate, Math.max(CONFIG.minRate, state.settings.rate + delta)) * 100) / 100;
  state.settings.rate = next;
  persist();
  paintSettings();
  a11y.announce(`속도 ${next.toFixed(2)}배`);
}

function onOcrProgress(_status, progress) {
  $('engine-state').textContent = `준비 중 ${Math.round(progress * 100)}%`;
}

async function start(source, file) {
  try {
    tts.unlock();
    a11y.setStatus('시작');
    if (!ocr.isReady()) {
      a11y.announce('인식 엔진을 준비하는 중입니다.');
      await ocr.init(onOcrProgress);
    }
    if (source === 'file') await camera.startFile(file);
    else await camera.startCamera();

    state.running = true;
    state.lastFp = null;
    state.stableCount = 0;
    state.didOcrThisStable = false;
    state.emptyCount = 0;
    subtitle.markGap();
    tts.clear();

    $('home').hidden = true;
    $('stage').hidden = false;
    document.body.classList.add('is-live');
    applyRegionClass();
    await keepAwake();

    a11y.setStatus('찾는 중');
    a11y.announce('노란 칸에 자막을 맞추세요. 한글 자막만 읽습니다.', 'assertive');
    a11y.vibrate([20, 40, 20]);
    loop(performance.now());
  } catch (err) {
    console.error(err);
    a11y.setStatus('실패');
    const msg = source === 'file'
      ? '영상을 열지 못했습니다.'
      : '카메라를 켤 수 없습니다. 권한을 허용해 주세요.';
    a11y.announce(msg, 'assertive');
    $('camera-error').textContent = msg;
    $('camera-error').hidden = false;
  }
}

async function stop(reason) {
  state.running = false;
  if (state.raf) cancelAnimationFrame(state.raf);
  tts.clear();
  await camera.stop();
  releaseWake();
  document.body.classList.remove('is-live');
  $('home').hidden = false;
  $('stage').hidden = true;
  $('now-text').textContent = '자막을 찾고 있습니다';
  $('now-meta').textContent = '';
  a11y.setStatus('대기');
  if (reason !== 'silent') {
    a11y.announce('정지했습니다.');
    a11y.vibrate(30);
  }
}

function loop(now) {
  if (!state.running) return;
  state.raf = requestAnimationFrame(loop);
  if (now - state.lastSample < 1000 / CONFIG.analysisFps) return;
  state.lastSample = now;

  if (!camera.drawFrame(state.frameCanvas)) return;
  preprocess.drawGuides(
    $('overlay'),
    state.frameCanvas,
    state.settings.regionMode,
    state.settings.regionMode === 'top' ? 'top' : 'bottom'
  );
  track(pickRegion(state.frameCanvas), now);
}

function pickRegion(frame) {
  const mode = state.settings.regionMode;
  if (mode === 'top') return preprocess.prepare(frame, 'top');
  if (mode === 'bottom') return preprocess.prepare(frame, 'bottom');
  const bottom = preprocess.prepare(frame, 'bottom');
  if (!bottom.empty) return bottom;
  return preprocess.prepare(frame, 'top');
}

function track(prepared, now) {
  const dist = preprocess.sad(prepared.fingerprint, state.lastFp);

  if (dist >= CONFIG.sadChanged) {
    state.lastFp = prepared.fingerprint;
    state.stableCount = 0;
    state.didOcrThisStable = false;
    state.stableSince = now;
  } else if (dist < CONFIG.sadStable) {
    state.stableCount += 1;
    if (state.stableCount === 1) state.stableSince = now;
  } else {
    state.lastFp = prepared.fingerprint;
    state.stableCount = 0;
    state.didOcrThisStable = false;
  }

  if (prepared.empty) {
    state.emptyCount += 1;
    if (state.emptyCount > 8) subtitle.markGap();
    return;
  }
  state.emptyCount = 0;

  if (state.stableCount >= CONFIG.stableFrames && !state.didOcrThisStable && !ocr.isBusy()) {
    state.didOcrThisStable = true;
    runOcr(prepared);
  }
}

async function runOcr(prepared) {
  try {
    const result = await ocr.recognize(prepared.canvas);
    if (!state.running || !result) return;
    const parsed = subtitle.parse(result.text, result.confidence);
    if (!parsed) return;
    if (subtitle.isDuplicate(parsed.speakText)) return;

    const added = tts.enqueue(parsed.speakText, state.settings);
    if (!added) return;
    subtitle.remember(parsed.speakText);
    a11y.setStatus('읽는 중');
    a11y.vibrate(10);
  } catch (err) {
    console.error(err);
    state.didOcrThisStable = false;
  }
}

function onTtsChange(info) {
  if (info.current) $('now-text').textContent = info.current;
  const voice = mixVoice(state.settings.gender, state.settings.age, state.settings.creature);
  const wait = info.waiting ? ` · 대기 ${info.waiting}문장` : '';
  $('now-meta').textContent = `${voice.label}${wait}`;
  if (!info.current && !info.waiting && state.running) {
    a11y.setStatus('찾는 중');
  }
}

function onKey(e) {
  if (e.target && e.target.closest('dialog, input, textarea, select')) return;
  if (e.target && e.target.closest('button')) return;
  if (e.code === 'Space') {
    e.preventDefault();
    if (state.running) stop('button');
    else start('camera');
  } else if (e.key === 'Escape' && state.running) {
    stop('button');
  }
}

async function keepAwake() {
  try {
    state.wakeLock = await navigator.wakeLock?.request('screen');
  } catch {
    /* ignore */
  }
}

function releaseWake() {
  try {
    state.wakeLock?.release();
  } catch {
    /* ignore */
  }
  state.wakeLock = null;
}

async function onVisibility() {
  if (document.visibilityState === 'visible' && state.running) await keepAwake();
}

async function registerSw() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.register('/sw.js?v=4', { updateViaCache: 'none' });
    await reg.update();
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (sessionStorage.getItem('sw-reloaded-v4')) return;
      sessionStorage.setItem('sw-reloaded-v4', '1');
      location.reload();
    });
  } catch {
    /* ignore */
  }
}

boot();
