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
  storageKey: 'subtitle-voice-v3',
};

export const GENDER = {
  male: { id: 'male', label: '남성' },
  female: { id: 'female', label: '여성' },
  neutral: { id: 'neutral', label: '중성' },
};

export const AGE = {
  child: { id: 'child', label: '아이' },
  young: { id: 'young', label: '청년' },
  middle: { id: 'middle', label: '중년' },
  elder: { id: 'elder', label: '노년' },
};

export const DEFAULTS = {
  rate: 1.15,
  gender: 'male',
  age: 'young',
  regionMode: 'bottom',
  textScale: 1.15,
  previewOn: true,
};

export function mixVoice(gender, age) {
  const g = GENDER[gender] || GENDER.male;
  const a = AGE[age] || AGE.young;
  const engine = g.id === 'male' ? '인준' : g.id === 'female' ? '선희' : '현수';
  return {
    gender: g.id,
    age: a.id,
    label: `${g.label} · ${a.label} · ${engine}`,
  };
}
