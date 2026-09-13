import { mixVoice } from './config.js';

let voices = [];
let unlocked = false;
let speaking = false;
let current = null;
const pending = [];
let onChange = () => {};

export function setOnChange(fn) {
  onChange = fn || (() => {});
}

export function loadVoices() {
  voices = window.speechSynthesis.getVoices();
}

export function unlock() {
  if (unlocked) return;
  loadVoices();
  const warm = new SpeechSynthesisUtterance(' ');
  warm.volume = 0;
  warm.lang = 'ko-KR';
  window.speechSynthesis.speak(warm);
  window.speechSynthesis.cancel();
  unlocked = true;
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

export function enqueue(text, { gender, age, creature, rate }) {
  const clean = String(text || '').trim();
  if (!clean) return false;
  if (current && same(current.text, clean)) return false;
  if (pending.some((p) => same(p.text, clean))) return false;

  const voice = mixVoice(gender, age, creature);
  const item = { text: clean, voice, rate };
  pending.push(item);
  while (pending.length > 2) pending.shift();
  notify();
  pump();
  return true;
}

export function speakSample({ gender, age, creature, rate }) {
  const voice = mixVoice(gender, age, creature);
  clear();
  speakNow({ text: `${voice.label}로 읽습니다.`, voice, rate });
}

export function clear() {
  pending.length = 0;
  current = null;
  speaking = false;
  window.speechSynthesis.cancel();
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

function speakNow(item) {
  current = item;
  speaking = true;
  notify();
  const u = new SpeechSynthesisUtterance(item.text);
  u.lang = 'ko-KR';
  u.rate = clamp(item.rate * (item.voice.rateMul || 1), 0.5, 2);
  u.pitch = clamp(item.voice.pitch, 0.1, 2);
  const voice = pickKoreanVoice();
  if (voice) u.voice = voice;
  u.onend = finish;
  u.onerror = finish;
  window.speechSynthesis.speak(u);
}

function finish() {
  speaking = false;
  current = null;
  notify();
  pump();
}

function pickKoreanVoice() {
  const kos = voices.filter((v) => {
    const lang = (v.lang || '').toLowerCase();
    const name = (v.name || '').toLowerCase();
    return lang.startsWith('ko') || name.includes('한국') || name.includes('korean') || name.includes('heami') || name.includes('yuna');
  });
  return kos[0] || voices.find((v) => v.default) || voices[0] || null;
}

function same(a, b) {
  return String(a).replace(/\s+/g, '') === String(b).replace(/\s+/g, '');
}

function notify() {
  onChange(status());
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

if (typeof window !== 'undefined' && window.speechSynthesis) {
  loadVoices();
  window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
  window.setInterval(() => {
    if (speaking && window.speechSynthesis.paused) window.speechSynthesis.resume();
  }, 7000);
}
