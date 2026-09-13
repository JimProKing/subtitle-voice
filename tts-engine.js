import { EdgeTTS } from '@andresaya/edge-tts';

const VOICES = {
  male: 'ko-KR-InJoonNeural',
  female: 'ko-KR-SunHiNeural',
  neutral: 'ko-KR-HyunsuNeural',
};

const AGE = {
  child: { pitch: '+35Hz', rate: 18 },
  young: { pitch: '+0Hz', rate: 0 },
  middle: { pitch: '-12Hz', rate: -10 },
  elder: { pitch: '-28Hz', rate: -22 },
};

const cache = new Map();
const CACHE_MAX = 40;

export function voiceLabel(gender, age) {
  const g = gender === 'male' ? '남성' : gender === 'female' ? '여성' : '중성';
  const a = AGE[age] ? { child: '아이', young: '청년', middle: '중년', elder: '노년' }[age] : '청년';
  const engine = gender === 'male' ? '인준' : gender === 'female' ? '선희' : '현수';
  return `${g} · ${a} · ${engine}`;
}

export async function synthesize({ text, gender = 'male', age = 'young', speed = 1.15 }) {
  const clean = String(text || '').trim().slice(0, 180);
  if (!clean) throw new Error('empty');
  const g = VOICES[gender] ? gender : 'neutral';
  const a = AGE[age] ? age : 'young';
  const spd = Number(speed) || 1.15;
  const key = `${g}|${a}|${spd.toFixed(2)}|${clean}`;
  if (cache.has(key)) return cache.get(key);

  const rateN = Math.max(-50, Math.min(80, AGE[a].rate + Math.round((spd - 1) * 100)));
  const rate = `${rateN >= 0 ? '+' : ''}${rateN}%`;
  const tts = new EdgeTTS();
  await tts.synthesize(clean, VOICES[g], {
    rate,
    pitch: AGE[a].pitch,
  });
  const buf = tts.toBuffer();
  if (!buf || buf.length < 200) throw new Error('no-audio');
  cache.set(key, buf);
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
  return buf;
}
