export const CONFIG = {
  analysisFps: 10,
  stableFrames: 2,
  sadStable: 11,
  sadChanged: 22,
  minHangul: 4,
  minConfidence: 18,
  minTextPixels: 0.0005,
  maxTextPixels: 0.45,
  ocrIntervalMs: 400,
  duplicateRatio: 0.84,
  defaultRate: 1.15,
  minRate: 0.8,
  maxRate: 1.8,
  rateStep: 0.05,
  maxQueue: 3,
  unnamedHoldMs: 12000,
  maxOcrWidth: 1100,
  maxSubtitleChars: 80,
  bottomBand: { top: 0.62, height: 0.36, inset: 0.04 },
  topBand: { top: 0.04, height: 0.22, inset: 0.06 },
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

const SPEAKER = {
  male: { child: '브라이언', young: '인준', middle: '앤드류', elder: '윌리엄' },
  female: { child: '엠마', young: '선희', middle: '에이바', elder: '세라피나' },
  neutral: { child: '주세페', young: '현수', middle: '레미', elder: '플로리안' },
};

export function mixVoice(gender, age) {
  const g = GENDER[gender] || GENDER.male;
  const a = AGE[age] || AGE.young;
  const speaker = (SPEAKER[g.id] || SPEAKER.male)[a.id] || SPEAKER.male.young;
  return {
    gender: g.id,
    age: a.id,
    label: `${g.label} · ${a.label} · ${speaker}`,
  };
}
