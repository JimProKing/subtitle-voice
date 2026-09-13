let busy = false;
let ready = false;

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

export async function recognizeFrame(srcCanvas) {
  if (busy) return null;
  busy = true;
  try {
    const jpeg = frameJpeg(srcCanvas);
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

function frameJpeg(src) {
  const top = Math.round(src.height * 0.34);
  const cropH = Math.max(8, src.height - top);
  const maxW = 560;
  const scale = Math.min(1, maxW / src.width);
  const w = Math.max(2, Math.round(src.width * scale));
  const h = Math.max(2, Math.round(cropH * scale));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  ctx.drawImage(src, 0, top, src.width, cropH, 0, 0, w, h);
  return c.toDataURL('image/jpeg', 0.55);
}
