let busy = false;
let ready = false;
let pending = null;
const hold = document.createElement('canvas');

export function isBusy() {
  return busy;
}

export function isReady() {
  return ready;
}

export async function init(onProgress) {
  ready = true;
  if (onProgress) onProgress('ready', 1);
}

export function holdFrame(srcCanvas) {
  copyFrame(srcCanvas);
}

export async function recognizeFrame(srcCanvas) {
  if (busy) {
    copyFrame(srcCanvas);
    return null;
  }
  busy = true;
  try {
    const frame = pending || srcCanvas;
    pending = null;
    const jpeg = frameJpeg(frame);
    const res = await fetch('/api/ocr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: jpeg }),
    });
    if (!res.ok) throw new Error(`ocr ${res.status}`);
    const data = await res.json();
    return {
      text: data.text || '',
      confidence: Number(data.confidence) || 0,
      engine: data.engine || '',
    };
  } finally {
    busy = false;
  }
}

function copyFrame(src) {
  if (hold.width !== src.width) hold.width = src.width;
  if (hold.height !== src.height) hold.height = src.height;
  hold.getContext('2d').drawImage(src, 0, 0);
  pending = hold;
}

function frameJpeg(src) {
  const top = Math.round(src.height * 0.34);
  const cropH = Math.max(8, src.height - top);
  const maxW = 480;
  const scale = Math.min(1, maxW / src.width);
  const w = Math.max(2, Math.round(src.width * scale));
  const h = Math.max(2, Math.round(cropH * scale));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  c.getContext('2d').drawImage(src, 0, top, src.width, cropH, 0, 0, w, h);
  return c.toDataURL('image/jpeg', 0.5);
}
