import { mixVoice } from './config.js';

let voices = [];
let unlocked = false;
let speaking = false;
let current = null;
let speakToken = 0;
const pending = [];
let onChange = () => {};

export function setOnChange(fn) {
  onChange = fn || (() => {});
}

export function loadVoices() {
  voices = window.speechSynthesis.getVoices() || [];
  return voices;
}

export function voiceReport() {
  loadVoices();
  const ko = voices.filter(isKorean);
  const male = ko.filter((v) => genderOf(v) === 'male');
  const female = ko.filter((v) => genderOf(v) === 'female');
  const local = ko.filter((v) => v.localService);
  return {
    total: voices.length,
    korean: ko.length,
    koreanMale: male.length,
    koreanFemale: female.length,
    koreanLocal: local.length,
    names: ko.map((v) => v.name),
  };
}

export function unlock() {
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
  const line =
    gender === 'male'
      ? '안녕하세요. 낮은 남성 목소리로 읽습니다.'
      : gender === 'female'
        ? '안녕하세요. 높은 여성 목소리로 읽습니다.'
        : '안녕하세요. 이 목소리로 읽습니다.';
  clear();
  speakNow({ text: `${voice.label}. ${line}`, voice, rate });
  return describeChoice(voice);
}

export function describeChoice(preset) {
  loadVoices();
  const picked = chooseEngineVoice(preset.gender);
  const report = voiceReport();
  if (picked.voice) {
    return `실제 엔진: ${picked.voice.name}. 피치 ${preset.pitch.toFixed(2)}`;
  }
  if (report.koreanMale === 0 && preset.gender === 'male') {
    return `이 기기에 남성 한국어 목소리가 없어 피치 ${preset.pitch.toFixed(2)}로 낮춥니다.`;
  }
  return `기본 한국어 엔진, 피치 ${preset.pitch.toFixed(2)}`;
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
  const my = ++speakToken;
  current = item;
  speaking = true;
  notify();
  loadVoices();

  const u = new SpeechSynthesisUtterance(item.text);
  u.lang = 'ko-KR';
  u.rate = clamp(item.rate * (item.voice.rateMul || 1), 0.5, 2);
  u.pitch = clamp(item.voice.pitch, 0.01, 2);

  const picked = chooseEngineVoice(item.voice.gender);
  if (picked.useVoiceObject && picked.voice) u.voice = picked.voice;

  u.onend = () => {
    if (my !== speakToken) return;
    finish();
  };
  u.onerror = () => {
    if (my !== speakToken) return;
    finish();
  };

  window.speechSynthesis.cancel();
  window.setTimeout(() => {
    if (my !== speakToken) return;
    window.speechSynthesis.speak(u);
  }, 50);
}

function finish() {
  speaking = false;
  current = null;
  notify();
  pump();
}

function chooseEngineVoice(gender) {
  const ko = voices.filter(isKorean);
  const localKo = ko.filter((v) => v.localService);
  const match = (list) => list.filter((v) => genderOf(v) === gender);

  const localMatch = match(localKo);
  if (localMatch.length) return { voice: localMatch[0], useVoiceObject: true };

  const anyMatch = match(ko).filter((v) => v.localService !== false);
  if (anyMatch.length) return { voice: anyMatch[0], useVoiceObject: true };

  if (localKo.length) {
    return { voice: localKo[0], useVoiceObject: true };
  }

  return { voice: null, useVoiceObject: false };
}

function isKorean(v) {
  const lang = (v.lang || '').toLowerCase();
  const name = (v.name || '').toLowerCase();
  const uri = (v.voiceURI || '').toLowerCase();
  return (
    lang.startsWith('ko') ||
    name.includes('한국') ||
    name.includes('korean') ||
    name.includes('heami') ||
    name.includes('yuna') ||
    name.includes('injoon') ||
    name.includes('sunhi') ||
    uri.includes('ko-kr')
  );
}

function genderOf(v) {
  const n = `${v.name} ${v.voiceURI} ${v.lang}`.toLowerCase();
  if (
    /injoon|hyunsu|jinho|minho|minjun|woosik|male|man|\b남\b|남성|nm-|tony|david|mark|george|daniel|arthur|matthew|jinho/.test(
      n
    )
  ) {
    return 'male';
  }
  if (
    /yuna|heami|sunhi|sora|nara|yujin|female|woman|\b여\b|여성|nf-|zira|samantha|kyoko/.test(n)
  ) {
    return 'female';
  }
  return 'unknown';
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
