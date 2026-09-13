import { CONFIG } from './config.js';

let lastSpokenNorm = '';
let lastSpokenAt = 0;
const recent = [];

export function parse(raw, confidence) {
  if (confidence < CONFIG.minConfidence) return null;
  const cleaned = clean(raw);
  if (!cleaned) return null;
  if (!isKoreanSubtitle(cleaned)) return null;

  const named = cleaned.match(/^([가-힣A-Za-z]{1,10})\s*[:：]\s*(.+)$/);
  if (named) {
    const speakText = clean(named[2]);
    if (!speakText || !isKoreanSubtitle(speakText)) return null;
    return { speaker: named[1], speakText, display: cleaned };
  }
  return { speaker: null, speakText: cleaned, display: cleaned };
}

export function isDuplicate(text) {
  const n = normalizeCompare(text);
  if (!n) return true;
  return recent.some((r) => similarity(n, r) >= CONFIG.duplicateRatio);
}

export function remember(text) {
  lastSpokenNorm = normalizeCompare(text);
  lastSpokenAt = Date.now();
  if (lastSpokenNorm && !recent.includes(lastSpokenNorm)) recent.push(lastSpokenNorm);
  if (recent.length > 8) recent.shift();
}

export function markGap() {
  lastSpokenNorm = '';
  lastSpokenAt = 0;
  recent.length = 0;
}

export function lastAge() {
  return lastSpokenAt ? Date.now() - lastSpokenAt : Infinity;
}

export function clean(raw) {
  const text = String(raw || '')
    .normalize('NFC')
    .replace(/[♪♫♬♩♭♮♥♡★☆※■□▲▼●○◎◇♥]/g, ' ')
    .replace(/\([^)]{0,16}\)/g, ' ')
    .replace(/\[[^\]]{0,16}\]/g, ' ')
    .replace(/\{[^}]{0,16}\}/g, ' ')
    .replace(/[\u1100-\u11FF\u3130-\u318F]/g, ' ')
    .replace(/[^\uAC00-\uD7A3a-zA-Z0-9?!,.\s:'"…·~\-：]/g, ' ')
    .replace(/[|｜]/g, ' ')
    .replace(/\s*\n+\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return mergeSplitHangul(text);
}

function mergeSplitHangul(text) {
  const parts = text.split(' ');
  const out = [];
  let buf = '';
  for (const part of parts) {
    if (/^[\uAC00-\uD7A3]$/.test(part)) {
      buf += part;
      continue;
    }
    if (buf) {
      out.push(buf);
      buf = '';
    }
    if (part) out.push(part);
  }
  if (buf) out.push(buf);
  return out.join(' ');
}

function isKoreanSubtitle(text) {
  const hangul = (text.match(/[\uAC00-\uD7A3]/g) || []).length;
  const letters = (text.match(/[\uAC00-\uD7A3a-zA-Z]/g) || []).length;
  if (hangul < CONFIG.minHangul) return false;
  if (letters && hangul / letters < 0.65) return false;
  if (hangul > CONFIG.maxSubtitleChars) return false;
  if (/^[~\-_.…·\s]+$/.test(text)) return false;
  return true;
}

function normalizeCompare(text) {
  return clean(text)
    .replace(/[\s"'.,!?·…~\-：:]/g, '')
    .toLowerCase();
}

function similarity(a, b) {
  if (a === b) return 1;
  const dist = levenshtein(a, b);
  return 1 - dist / Math.max(a.length, b.length);
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const row = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) row[j] = j;
  for (let i = 1; i <= a.length; i++) {
    let prev = i - 1;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + cost);
      prev = tmp;
    }
  }
  return row[b.length];
}
