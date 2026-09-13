import { mixVoice } from './config.js';

let speaking = false;
let current = null;
let speakToken = 0;
let player = null;
const pending = [];
let onChange = () => {};

export function setOnChange(fn) {
  onChange = fn || (() => {});
}

export function loadVoices() {}

export function unlock() {
  /* audio element plays after user gesture */
}

export function status() {
  return {
    speaking,
    current: current ? current.text : '',
    pending: pending.map((p) => p.text),
    waiting: pending.length,
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
  pending.push({ text: clean, voice, rate, gender, age });
  while (pending.length > 2) pending.shift();
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
  speakNow({ text: `${voice.label}. ${line}`, voice, rate, gender, age });
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

async function speakNow(item) {
  const my = ++speakToken;
  current = item;
  speaking = true;
  notify();
  try {
    const url = `/api/tts?text=${encodeURIComponent(item.text)}&gender=${encodeURIComponent(item.gender || item.voice.gender)}&age=${encodeURIComponent(item.age || item.voice.age)}&speed=${encodeURIComponent(item.rate)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`tts ${res.status}`);
    const blob = await res.blob();
    if (my !== speakToken) return;
    const src = URL.createObjectURL(blob);
    stopPlayer();
    player = new Audio(src);
    player.onended = () => {
      URL.revokeObjectURL(src);
      if (my !== speakToken) return;
      finish();
    };
    player.onerror = () => {
      URL.revokeObjectURL(src);
      if (my !== speakToken) return;
      finish();
    };
    await player.play();
  } catch (err) {
    console.error(err);
    if (my !== speakToken) return;
    finish();
  }
}

function stopPlayer() {
  if (!player) return;
  try {
    player.pause();
    player.removeAttribute('src');
    player.load();
  } catch {
    /* ignore */
  }
  player = null;
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
