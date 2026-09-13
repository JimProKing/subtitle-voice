export const CONFIG = {
  analysisFps: 10,
  stableFrames: 2,
  sadStable: 11,
  sadChanged: 22,
  minHangul: 2,
  minConfidence: 36,
  minTextPixels: 0.003,
  maxTextPixels: 0.28,
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
  male: { id: 'male', label: '남성', pitch: 0.82 },
  female: { id: 'female', label: '여성', pitch: 1.2 },
  neutral: { id: 'neutral', label: '중성', pitch: 1.0 },
};

export const AGE = {
  child: { id: 'child', label: '아이', pitch: 1.22, rate: 1.06 },
  young: { id: 'young', label: '청년', pitch: 1.0, rate: 1.0 },
  middle: { id: 'middle', label: '중년', pitch: 0.92, rate: 0.97 },
  elder: { id: 'elder', label: '노년', pitch: 0.84, rate: 0.9 },
};

export const CREATURE = {
  human: { id: 'human', label: '사람', pitch: 1.0, rate: 1.0 },
  monster: { id: 'monster', label: '괴물', pitch: 0.6, rate: 0.84 },
  animal: { id: 'animal', label: '동물', pitch: 1.3, rate: 1.08 },
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

export function mixVoice(gender, age, creature) {
  const g = GENDER[gender] || GENDER.neutral;
  const a = AGE[age] || AGE.young;
  const c = CREATURE[creature] || CREATURE.human;
  return {
    pitch: clamp(g.pitch * a.pitch * c.pitch, 0.1, 2),
    rateMul: clamp(a.rate * c.rate, 0.7, 1.35),
    label: `${g.label} · ${a.label} · ${c.label}`,
  };
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}
