import { CONFIG } from './config.js';
import * as a11y from './a11y.js';
import * as camera from './camera.js';
import * as preprocess from './preprocess.js';
import * as ocr from './ocr.js';
import * as subtitle from './subtitle.js';
import * as tts from './tts.js';

const state = {
  running: false,
  source: 'camera',
  regionMode: 'auto',
  activeRegion: 'bottom',
  rate: CONFIG.defaultRate,
  previewOn: true,
  debugOn: false,
  theaterOn: false,
  roles: loadRoles(),
  lastFp: null,
  stableCount: 0,
  didOcrThisStable: false,
  emptyCount: 0,
  stableSince: 0,
  lastSpokenDisplay: '',
  lastVoiceId: CONFIG.defaultVoiceId,
  lastSpeaker: '_default',
  frameCanvas: document.createElement('canvas'),
  overlay: null,
  raf: 0,
  lastSample: 0,
  wakeLock: null,
  ocrMs: 0,
  speakDelayMs: 0,
  fps: 0,
  samples: 0,
  fpsAt: 0,
};

const $ = (id) => document.getElementById(id);

function loadRoles() {
  try {
    const raw = JSON.parse(localStorage.getItem(CONFIG.storageKey) || 'null');
    if (raw && raw.map) return raw;
  } catch {
    /* ignore */
  }
  return {
    map: { _default: CONFIG.defaultVoiceId },
    next: 1,
  };
}

function saveRoles() {
  localStorage.setItem(CONFIG.storageKey, JSON.stringify(state.roles));
}

function voiceIdFor(speaker) {
  const key = speaker || '_default';
  if (!state.roles.map[key]) {
    let id = state.roles.next;
    const used = new Set(Object.values(state.roles.map));
    let guard = 0;
    while (used.has(id) && guard < CONFIG.voiceCount) {
      id = (id % CONFIG.voiceCount) + 1;
      guard++;
    }
    state.roles.map[key] = id;
    state.roles.next = (id % CONFIG.voiceCount) + 1;
    saveRoles();
  }
  return state.roles.map[key];
}

function currentSpeakerKey() {
  return state.lastSpeaker || '_default';
}

async function boot() {
  bind();
  restoreUi();
  updateVoiceLabel();
  updateSpeedLabel();
  registerSw();
  window.speechSynthesis?.addEventListener('voiceschanged', updateVoiceLabel);
  ocr.init(onOcrProgress).then(() => {
    $('engine-state').textContent = '인식 엔진 준비됨';
    a11y.announce('한글 자막 인식 엔진이 준비되었습니다.');
  }).catch((err) => {
    $('engine-state').textContent = '인식 엔진 준비 실패';
    a11y.announce('인식 엔진을 불러오지 못했습니다. 네트워크를 확인하세요.', 'assertive');
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
  $('btn-speed-down').addEventListener('click', () => changeSpeed(-CONFIG.rateStep));
  $('btn-speed-up').addEventListener('click', () => changeSpeed(CONFIG.rateStep));
  $('btn-voice').addEventListener('click', changeVoice);
  $('btn-preview').addEventListener('click', togglePreview);
  $('btn-theater').addEventListener('click', toggleTheater);
  $('btn-debug').addEventListener('click', toggleDebug);
  $('region-mode').addEventListener('change', (e) => {
    state.regionMode = e.target.value;
    state.lastFp = null;
    state.stableCount = 0;
    a11y.announce(regionLabel(state.regionMode));
  });
  $('btn-sample').addEventListener('click', () => {
    tts.unlock();
    const preset = tts.presetById(voiceIdFor(currentSpeakerKey()));
    tts.speakSample(preset, state.rate);
  });

  document.addEventListener('keydown', onKey);
  document.addEventListener('visibilitychange', onVisibility);
}

function restoreUi() {
  $('region-mode').value = state.regionMode;
  $('speed-value').textContent = state.rate.toFixed(2);
}

function onOcrProgress(status, progress) {
  const pct = Math.round(progress * 100);
  $('engine-state').textContent = `인식 엔진 준비 중 ${pct}%`;
}

async function start(source, file) {
  try {
    tts.unlock();
    a11y.setStatus('시작하는 중');
    if (!ocr.isReady()) {
      a11y.announce('인식 엔진을 준비하는 중입니다. 잠시만요.');
      await ocr.init(onOcrProgress);
    }
    if (source === 'file') await camera.startFile(file);
    else await camera.startCamera();

    state.source = source;
    state.running = true;
    state.lastFp = null;
    state.stableCount = 0;
    state.didOcrThisStable = false;
    state.emptyCount = 0;
    subtitle.markGap();

    $('setup').hidden = true;
    $('stage').hidden = false;
    $('controls').hidden = false;
    document.body.classList.add('is-live');
    applyPreview();
    await keepAwake();

    a11y.setStatus('자막을 찾고 있습니다');
    a11y.announce('자막 읽기를 시작합니다. 화면 아래부터 한글 자막을 찾습니다.', 'assertive');
    a11y.vibrate([20, 40, 20]);
    loop(performance.now());
  } catch (err) {
    console.error(err);
    a11y.setStatus('시작하지 못했습니다');
    const msg = source === 'file'
      ? '영상을 열지 못했습니다.'
      : '카메라를 켤 수 없습니다. 브라우저 권한을 허용해 주세요.';
    a11y.announce(msg, 'assertive');
    $('camera-error').textContent = msg;
    $('camera-error').hidden = false;
  }
}

async function stop(reason) {
  state.running = false;
  if (state.raf) cancelAnimationFrame(state.raf);
  tts.cancel();
  await camera.stop();
  releaseWake();
  document.body.classList.remove('is-live', 'theater');
  $('setup').hidden = false;
  $('stage').hidden = true;
  $('controls').hidden = true;
  a11y.setStatus('대기 중');
  if (reason !== 'silent') {
    a11y.announce('정지했습니다.');
    a11y.vibrate(30);
  }
}

function loop(now) {
  if (!state.running) return;
  state.raf = requestAnimationFrame(loop);
  const interval = 1000 / CONFIG.analysisFps;
  if (now - state.lastSample < interval) return;
  const dt = now - state.lastSample;
  state.lastSample = now;
  state.samples++;
  if (now - state.fpsAt > 1000) {
    state.fps = state.samples;
    state.samples = 0;
    state.fpsAt = now;
  }

  const ok = camera.drawFrame(state.frameCanvas);
  if (!ok) return;

  const overlay = $('overlay');
  if (state.previewOn) {
    preprocess.drawGuides(overlay, state.frameCanvas, state.regionMode, state.activeRegion);
  }

  const region = pickRegion(state.frameCanvas);
  track(region, now);
  if (state.debugOn) renderDebug(dt);
}

function pickRegion(frame) {
  if (state.regionMode === 'top') return preprocess.prepare(frame, 'top');
  if (state.regionMode === 'bottom') return preprocess.prepare(frame, 'bottom');
  const bottom = preprocess.prepare(frame, 'bottom');
  if (!bottom.empty) return bottom;
  return preprocess.prepare(frame, 'top');
}

function track(prepared, now) {
  state.activeRegion = prepared.region;
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
    if (state.debugOn) {
      $('dbg-text').textContent = '(자막 없음)';
    }
    return;
  }
  state.emptyCount = 0;

  if (
    state.stableCount >= CONFIG.stableFrames &&
    !state.didOcrThisStable &&
    !ocr.isBusy()
  ) {
    state.didOcrThisStable = true;
    runOcr(prepared, now);
  }
}

async function runOcr(prepared, now) {
  const t0 = performance.now();
  try {
    const result = await ocr.recognize(prepared.canvas);
    if (!state.running || !result) return;
    state.ocrMs = Math.round(performance.now() - t0);
    const parsed = subtitle.parse(result.text, result.confidence);
    if (state.debugOn) {
      $('dbg-raw').textContent = result.text.replace(/\s+/g, ' ').trim() || '(빈 결과)';
      $('dbg-conf').textContent = `${Math.round(result.confidence)}점`;
      $('dbg-ocr').textContent = `${state.ocrMs}ms`;
      $('dbg-prep').src = prepared.canvas.toDataURL();
    }
    if (!parsed) return;
    if (subtitle.isDuplicate(parsed.speakText)) return;

    const speaker = parsed.speaker || (subtitle.lastAge() < CONFIG.unnamedHoldMs ? state.lastSpeaker : '_default');
    const voiceId = voiceIdFor(speaker);
    const preset = tts.presetById(voiceId);
    state.speakDelayMs = Math.round(performance.now() - (state.stableSince || now));
    tts.speak(parsed.speakText, { preset, rate: state.rate });
    subtitle.remember(parsed.speakText);
    state.lastSpokenDisplay = parsed.speakText;
    state.lastVoiceId = voiceId;
    state.lastSpeaker = speaker;
    $('now-text').textContent = parsed.speakText;
    $('now-meta').textContent = `${speakerLabel(speaker)} · ${preset.label}`;
    a11y.setStatus('자막을 읽는 중');
    a11y.vibrate(12);
    updateVoiceLabel();
    updateRoleList();
  } catch (err) {
    console.error(err);
    state.didOcrThisStable = false;
  }
}

function speakerLabel(speaker) {
  if (!speaker || speaker === '_default') return '기본 배역';
  return speaker;
}

function changeSpeed(delta) {
  state.rate = Math.round(Math.min(CONFIG.maxRate, Math.max(CONFIG.minRate, state.rate + delta)) * 100) / 100;
  updateSpeedLabel();
  a11y.announce(`속도 ${state.rate.toFixed(2)}배`);
}

function updateSpeedLabel() {
  $('speed-value').textContent = state.rate.toFixed(2);
  $('btn-speed-down').disabled = state.rate <= CONFIG.minRate;
  $('btn-speed-up').disabled = state.rate >= CONFIG.maxRate;
}

function changeVoice() {
  const key = currentSpeakerKey();
  const current = voiceIdFor(key);
  const next = (current % CONFIG.voiceCount) + 1;
  state.roles.map[key] = next;
  state.lastVoiceId = next;
  saveRoles();
  updateVoiceLabel();
  updateRoleList();
  tts.unlock();
  const preset = tts.presetById(next);
  tts.speakSample(preset, state.rate);
  a11y.announce(`${speakerLabel(key)}를 ${preset.label}로 바꿨습니다.`);
}

function updateVoiceLabel() {
  const preset = tts.presetById(voiceIdFor(currentSpeakerKey()));
  $('btn-voice').setAttribute('aria-label', `지금 목소리 변경, 현재 ${preset.label}`);
  $('voice-count').textContent = `이 기기 한국어 목소리 ${tts.koreanVoiceCount()}개. 피치로 ${CONFIG.voiceCount}개 슬롯을 씁니다.`;
}

function togglePreview() {
  state.previewOn = !state.previewOn;
  applyPreview();
  a11y.announce(state.previewOn ? '미리보기를 켰습니다.' : '미리보기를 껐습니다.');
}

function applyPreview() {
  $('preview-wrap').hidden = !state.previewOn;
  $('btn-preview').setAttribute('aria-pressed', String(state.previewOn));
  $('btn-preview').textContent = state.previewOn ? '미리보기 끄기' : '미리보기 켜기';
}

function toggleTheater() {
  state.theaterOn = !state.theaterOn;
  document.body.classList.toggle('theater', state.theaterOn);
  if (state.theaterOn) {
    state.previewOn = false;
    applyPreview();
  }
  $('btn-theater').setAttribute('aria-pressed', String(state.theaterOn));
  a11y.announce(state.theaterOn ? '극장 모드입니다. 화면을 어둡게 했습니다.' : '극장 모드를 해제했습니다.');
}

function toggleDebug() {
  state.debugOn = !state.debugOn;
  $('debug').hidden = !state.debugOn;
  $('btn-debug').setAttribute('aria-pressed', String(state.debugOn));
  a11y.announce(state.debugOn ? '테스트 정보를 켰습니다.' : '테스트 정보를 껐습니다.');
}

function updateRoleList() {
  const items = Object.entries(state.roles.map).map(([name, id]) => {
    const preset = tts.presetById(id);
    return `<li>${speakerLabel(name)} → ${preset.label}</li>`;
  });
  $('role-list').innerHTML = items.join('') || '<li>아직 배역이 없습니다.</li>';
}

function renderDebug() {
  $('dbg-fps').textContent = String(state.fps);
  $('dbg-region').textContent = state.activeRegion === 'top' ? '위' : '아래';
  $('dbg-delay').textContent = `${state.speakDelayMs}ms`;
  $('dbg-text').textContent = state.lastSpokenDisplay || '-';
}

function regionLabel(mode) {
  if (mode === 'top') return '위쪽만 봅니다';
  if (mode === 'bottom') return '아래만 봅니다';
  return '아래를 먼저 보고, 없을 때만 위를 봅니다';
}

function onKey(e) {
  if (e.target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
  if (e.code === 'Space') {
    e.preventDefault();
    if (state.running) stop('button');
    else start('camera');
  } else if (e.key === 'Escape' && state.running) {
    stop('button');
  } else if (e.key === 'ArrowUp') {
    changeSpeed(CONFIG.rateStep);
  } else if (e.key === 'ArrowDown') {
    changeSpeed(-CONFIG.rateStep);
  } else if (e.key === 'v' || e.key === 'V') {
    if (state.running) changeVoice();
  }
}

async function keepAwake() {
  try {
    state.wakeLock = await navigator.wakeLock?.request('screen');
    if (state.wakeLock) {
      state.wakeLock.addEventListener('release', () => {
        state.wakeLock = null;
      });
    }
  } catch {
    /* unsupported */
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
  if (document.visibilityState === 'visible' && state.running) {
    await keepAwake();
  }
}

function registerSw() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

boot();
