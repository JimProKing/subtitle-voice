export const CONFIG = {
  analysisFps: 10,
  stableFrames: 2,
  sadStable: 11,
  sadChanged: 22,
  minHangul: 2,
  minConfidence: 18,
  minTextPixels: 0.0004,
  maxTextPixels: 0.55,
  ocrIntervalMs: 450,
  duplicateRatio: 0.84,
  defaultRate: 1.15,
  minRate: 0.8,
  maxRate: 1.8,
  rateStep: 0.05,
  maxQueue: 3,
  unnamedHoldMs: 12000,
  maxOcrWidth: 1000,
  maxSubtitleChars: 48,
  bottomBand: { top: 0.72, height: 0.24, inset: 0.08 },
  topBand: { top: 0.04, height: 0.16, inset: 0.08 },
  storageKey: 'subtitle-voice-v2',
};

export const GENDER = {
  male: { id: 'male', label: '남성' },
  female: { id: 'female', label: '여성' },
  neutral: { id: 'neutral', label: '중성' },
};

export const AGE = {
  child: { id: 'child', label: '아이', rate: 1.08 },
  young: { id: 'young', label: '청년', rate: 1.0 },
  middle: { id: 'middle', label: '중년', rate: 0.94 },
  elder: { id: 'elder', label: '노년', rate: 0.82 },
};

export const CREATURE = {
  human: { id: 'human', label: '사람' },
  monster: { id: 'monster', label: '괴물' },
  animal: { id: 'animal', label: '동물' },
};

export const DEFAULTS = {
  rate: 1.15,
  gender: 'neutral',
  age: 'young',
  creature: 'human',
  regionMode: 'bottom',
  textScale: 1.15,
  previewOn: true,
};

const PITCH_TABLE = {
  male: { child: 0.58, young: 0.22, middle: 0.12, elder: 0.01 },
  female: { child: 1.95, young: 1.55, middle: 1.28, elder: 1.08 },
  neutral: { child: 1.32, young: 0.92, middle: 0.7, elder: 0.42 },
};

export function mixVoice(gender, age, creature) {
  const g = GENDER[gender] || GENDER.neutral;
  const a = AGE[age] || AGE.young;
  const c = CREATURE[creature] || CREATURE.human;
  let pitch = (PITCH_TABLE[g.id] || PITCH_TABLE.neutral)[a.id] ?? 1;
  let rateMul = a.rate || 1;
  if (c.id === 'monster') {
    pitch = Math.max(0.01, pitch * 0.4);
    rateMul *= 0.8;
  } else if (c.id === 'animal') {
    pitch = Math.min(2, pitch * 1.2 + 0.25);
    rateMul *= 1.1;
  }
  return {
    gender: g.id,
    age: a.id,
    creature: c.id,
    pitch: clamp(pitch, 0.01, 2),
    rateMul: clamp(rateMul, 0.7, 1.35),
    label: `${g.label} · ${a.label} · ${c.label}`,
  };
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}
