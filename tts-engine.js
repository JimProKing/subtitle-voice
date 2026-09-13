import { EdgeTTS } from '@andresaya/edge-tts';

export const VOICE_MAP = {
  male: {
    child: { id: 'en-US-BrianMultilingualNeural', name: '브라이언' },
    young: { id: 'ko-KR-InJoonNeural', name: '인준' },
    middle: { id: 'en-US-AndrewMultilingualNeural', name: '앤드류' },
    elder: { id: 'en-AU-WilliamMultilingualNeural', name: '윌리엄' },
  },
  female: {
    child: { id: 'en-US-EmmaMultilingualNeural', name: '엠마' },
    young: { id: 'ko-KR-SunHiNeural', name: '선희' },
    middle: { id: 'en-US-AvaMultilingualNeural', name: '에이바' },
    elder: { id: 'de-DE-SeraphinaMultilingualNeural', name: '세라피나' },
  },
  neutral: {
    child: { id: 'it-IT-GiuseppeMultilingualNeural', name: '주세페' },
    young: { id: 'ko-KR-HyunsuNeural', name: '현수' },
    middle: { id: 'fr-FR-RemyMultilingualNeural', name: '레미' },
    elder: { id: 'de-DE-FlorianMultilingualNeural', name: '플로리안' },
  },
};

const GENDER_LABEL = { male: '남성', female: '여성', neutral: '중성' };
const AGE_LABEL = { child: '아이', young: '청년', middle: '중년', elder: '노년' };

const cache = new Map();
const CACHE_MAX = 40;

export function pickVoice(gender = 'male', age = 'young') {
  const g = VOICE_MAP[gender] ? gender : 'male';
  const a = VOICE_MAP[g][age] ? age : 'young';
  return { gender: g, age: a, ...VOICE_MAP[g][a] };
}

export function voiceLabel(gender, age) {
  const v = pickVoice(gender, age);
  return `${GENDER_LABEL[v.gender]} · ${AGE_LABEL[v.age]} · ${v.name}`;
}

export async function synthesize({ text, gender = 'male', age = 'young', speed = 1.15 }) {
  const clean = String(text || '').trim().slice(0, 180);
  if (!clean) throw new Error('empty');
  const picked = pickVoice(gender, age);
  const spd = Number(speed) || 1.15;
  const key = `${picked.id}|${spd.toFixed(2)}|${clean}`;
  if (cache.has(key)) return cache.get(key);

  const rateN = Math.max(-40, Math.min(80, Math.round((spd - 1) * 100)));
  const tts = new EdgeTTS();
  await tts.synthesize(clean, picked.id, {
    rate: `${rateN >= 0 ? '+' : ''}${rateN}%`,
    pitch: '+0Hz',
  });
  const buf = tts.toBuffer();
  if (!buf || buf.length < 200) throw new Error('no-audio');
  cache.set(key, buf);
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
  return buf;
}
