import { CONFIG, VOICE_PRESETS } from './config.js';

let voices = [];
let speaking = false;
let unlocked = false;

export function presetById(id) {
  return VOICE_PRESETS.find((p) => p.id === id) || VOICE_PRESETS[CONFIG.defaultVoiceId - 1];
}

export function listPresets() {
  return VOICE_PRESETS;
}

export function isSpeaking() {
  return speaking;
}

export function loadVoices() {
  voices = window.speechSynthesis.getVoices();
}

export function koreanVoiceCount() {
  return voices.filter(isKoreanVoice).length;
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

export function cancel() {
  window.speechSynthesis.cancel();
  speaking = false;
}

export function speak(text, { preset, rate }) {
  cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'ko-KR';
  u.rate = clamp(rate * (preset.rateMul || 1), 0.5, 2);
  u.pitch = clamp(preset.pitch, 0.1, 2);
  const voice = pickVoice(preset.id);
  if (voice) u.voice = voice;
  u.onstart = () => {
    speaking = true;
  };
  u.onend = () => {
    speaking = false;
  };
  u.onerror = () => {
    speaking = false;
  };
  window.speechSynthesis.speak(u);
}

export function speakSample(preset, rate) {
  speak(`${preset.label}로 읽습니다.`, { preset, rate });
}

function pickVoice(presetId) {
  const kos = voices.filter(isKoreanVoice);
  if (kos.length >= 2) return kos[(presetId - 1) % kos.length];
  if (kos.length === 1) return kos[0];
  return voices.find((v) => v.default) || voices[0] || null;
}

function isKoreanVoice(v) {
  const lang = (v.lang || '').toLowerCase();
  const name = (v.name || '').toLowerCase();
  return lang.startsWith('ko') || name.includes('한국') || name.includes('korean') || name.includes('heami') || name.includes('yuna');
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

if (typeof window !== 'undefined' && window.speechSynthesis) {
  loadVoices();
  window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
  window.setInterval(() => {
    if (speaking && window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }
  }, 7000);
}
