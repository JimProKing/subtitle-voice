import { mixVoice } from './config.js';

let speaking = false;
let current = null;
let speakToken = 0;
let player = null;
let lastError = '';
const pending = [];
let onChange = () => {};

const SILENCE =
  'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';

export function setOnChange(fn) {
  onChange = fn || (() => {});
}

export function loadVoices() {
  if (window.speechSynthesis) window.speechSynthesis.getVoices();
}

export function unlock() {
  ensurePlayer();
  player.muted = false;
  player.volume = 1;
  player.src = SILENCE;
  const kick = player.play();
  if (kick && kick.catch) kick.catch(() => {});
  try {
    const warm = new SpeechSynthesisUtterance(' ');
    warm.volume = 0;
    warm.lang = 'ko-KR';
    window.speechSynthesis.speak(warm);
    window.speechSynthesis.cancel();
  } catch {
    /* ignore */
  }
}

export function status() {
  return {
    speaking,
    current: current ? current.text : '',
    pending: pending.map((p) => p.text),
    waiting: pending.length,
    error: lastError,
  };
}

export function isSpeaking() {
  return speaking;
}

export function enqueue(text, { gender, age, rate }) {
  const clean = String(text || '').trim();
  if (!clean) return false;
  if (current && same(current.text, clean)) return false;
  if (pending.some((p) => same(p.text, clean))) return false;
  const voice = mixVoice(gender, age);
  const item = {
    text: clean,
    voice,
    rate: Number(rate) || 1.15,
    gender,
    age,
    blob: null,
  };
  item.ready = fetchAudio(item);
  pending.push(item);
  notify();
  pump();
  return true;
}

export function speakSample({ gender, age, rate }) {
  const voice = mixVoice(gender, age);
  const line =
    gender === 'male'
      ? '안녕하세요. 남성 목소리로 읽습니다.'
      : gender === 'female'
        ? '안녕하세요. 여성 목소리로 읽습니다.'
        : '안녕하세요. 이 목소리로 읽습니다.';
  clear();
  const item = {
    text: `${voice.label}. ${line}`,
    voice,
    rate: Number(rate) || 1.15,
    gender,
    age,
    blob: null,
  };
  item.ready = fetchAudio(item);
  pending.push(item);
  pump();
  return describeChoice(voice);
}

export function describeChoice(preset) {
  return `실제 목소리: ${preset.label}`;
}

export function clear() {
  pending.length = 0;
  current = null;
  speaking = false;
  speakToken += 1;
  stopPlayer();
  try {
    window.speechSynthesis.cancel();
  } catch {
    /* ignore */
  }
  notify();
}

function pump() {
  if (speaking || current) return;
  const item = pending.shift();
  if (!item) {
    notify();
    return;
  }
  speakNow(item);
}

async function fetchAudio(item) {
  const gender = item.gender || item.voice.gender;
  const age = item.age || item.voice.age;
  const rate = Number(item.rate) || 1.15;
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), 12000);
  try {
    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: item.text, gender, age, speed: rate }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`tts ${res.status}`);
    const blob = await res.blob();
    if (!blob || blob.size < 200) throw new Error('empty-audio');
    item.blob = blob;
    return blob;
  } finally {
    window.clearTimeout(timer);
  }
}

async function speakNow(item) {
  const my = ++speakToken;
  current = item;
  speaking = true;
  lastError = '';
  notify();
  const rate = Number(item.rate) || 1.15;
  try {
    const blob = item.blob || (await item.ready);
    if (my !== speakToken) return;
    await playBlob(blob, my);
  } catch (err) {
    console.error(err);
    if (my !== speakToken) return;
    lastError = '서버 목소리 실패, 기기 목소리로 읽습니다';
    notify();
    speakDevice(item, my, rate);
  }
}

function playBlob(blob, my) {
  return new Promise((resolve, reject) => {
    ensurePlayer();
    const src = URL.createObjectURL(blob);
    let settled = false;
    const done = (err) => {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(src);
      player.onended = null;
      player.onerror = null;
      if (err) reject(err);
      else resolve();
    };
    player.onended = () => {
      if (my === speakToken) finish();
      done();
    };
    player.onerror = () => done(new Error('play-error'));
    player.muted = false;
    player.volume = 1;
    player.src = src;
    const p = player.play();
    if (p && p.catch) p.catch((e) => done(e));
  });
}

function speakDevice(item, my, rate) {
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(item.text);
    u.lang = 'ko-KR';
    u.rate = Math.max(0.7, Math.min(1.6, rate));
    u.pitch = item.gender === 'male' ? 0.7 : item.gender === 'female' ? 1.2 : 1;
    u.onend = () => {
      if (my !== speakToken) return;
      finish();
    };
    u.onerror = () => {
      if (my !== speakToken) return;
      lastError = '소리를 재생하지 못했습니다';
      finish();
    };
    window.speechSynthesis.speak(u);
  } catch (err) {
    console.error(err);
    lastError = '소리를 재생하지 못했습니다';
    finish();
  }
}

function ensurePlayer() {
  if (player) return;
  player = new Audio();
  player.preload = 'auto';
  player.playsInline = true;
  player.setAttribute('playsinline', '');
  player.setAttribute('webkit-playsinline', '');
}

function stopPlayer() {
  if (!player) return;
  try {
    player.pause();
    player.onended = null;
    player.onerror = null;
  } catch {
    /* ignore */
  }
}

function finish() {
  speaking = false;
  current = null;
  notify();
  pump();
}

function same(a, b) {
  return String(a).replace(/\s+/g, '') === String(b).replace(/\s+/g, '');
}

function notify() {
  onChange(status());
}
