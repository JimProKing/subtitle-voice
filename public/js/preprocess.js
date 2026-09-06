import { CONFIG } from './config.js';

const work = {
  crop: null,
  binary: null,
};

function canvas(store, w, h) {
  if (!work[store]) work[store] = document.createElement('canvas');
  const c = work[store];
  if (c.width !== w) c.width = w;
  if (c.height !== h) c.height = h;
  return c;
}

export function bandRect(width, height, which) {
  const band = which === 'top' ? CONFIG.topBand : CONFIG.bottomBand;
  const x = Math.round(width * band.inset);
  const y = Math.round(height * band.top);
  const w = Math.max(8, Math.round(width * (1 - band.inset * 2)));
  const h = Math.max(8, Math.round(height * band.height));
  return { x, y, w, h: Math.min(h, height - y) };
}

export function prepare(srcCanvas, which) {
  const band = bandRect(srcCanvas.width, srcCanvas.height, which);
  const scale = Math.min(2.2, Math.max(1, CONFIG.maxOcrWidth / band.w));
  const dw = Math.max(8, Math.round(band.w * scale));
  const dh = Math.max(8, Math.round(band.h * scale));

  const crop = canvas('crop', dw, dh);
  const cctx = crop.getContext('2d', { willReadFrequently: true });
  cctx.imageSmoothingEnabled = true;
  cctx.imageSmoothingQuality = 'high';
  cctx.drawImage(srcCanvas, band.x, band.y, band.w, band.h, 0, 0, dw, dh);

  const image = cctx.getImageData(0, 0, dw, dh);
  const { bin, textPx } = toBinary(image);
  const closed = morphClose(bin, dw, dh);
  const ratio = textPx / (dw * dh);
  const fingerprint = fingerprintOf(closed, dw, dh);
  const empty = ratio < CONFIG.minTextPixels || ratio > CONFIG.maxTextPixels;

  const boxed = empty ? null : cropToGlyphs(closed, dw, dh);
  const out = canvas('binary', boxed ? boxed.w : dw, boxed ? boxed.h : dh);
  const octx = out.getContext('2d', { willReadFrequently: true });
  paintBlackOnWhite(octx, boxed ? boxed.bin : closed, out.width, out.height);

  return {
    canvas: out,
    fingerprint,
    empty,
    ratio,
    region: which,
    band,
  };
}

export function sad(a, b) {
  if (!a || !b || a.length !== b.length) return 255;
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += Math.abs(a[i] - b[i]);
  return sum / a.length;
}

function toBinary(image) {
  const { data, width, height } = image;
  const lum = new Uint8Array(width * height);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    lum[p] = (data[i] * 77 + data[i + 1] * 150 + data[i + 2] * 29) >> 8;
  }

  const bin = new Uint8Array(width * height);
  let textPx = 0;
  for (let y = 2; y < height - 2; y++) {
    for (let x = 2; x < width - 2; x++) {
      const p = y * width + x;
      const v = lum[p];
      if (v < 176) continue;
      let dark = false;
      scan: for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          if (lum[(y + dy) * width + (x + dx)] < 72) {
            dark = true;
            break scan;
          }
        }
      }
      if (v >= 205 || dark) {
        bin[p] = 1;
        textPx++;
      }
    }
  }

  if (textPx / (width * height) < CONFIG.minTextPixels) {
    textPx = 0;
    bin.fill(0);
    for (let p = 0; p < lum.length; p++) {
      if (lum[p] >= 200) {
        bin[p] = 1;
        textPx++;
      }
    }
  }

  return { bin, textPx, lum };
}

function morphClose(bin, w, h) {
  return erode(dilate(bin, w, h), w, h);
}

function dilate(bin, w, h) {
  const out = new Uint8Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      let on = 0;
      for (let dy = -1; dy <= 1 && !on; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (bin[(y + dy) * w + (x + dx)]) {
            on = 1;
            break;
          }
        }
      }
      out[y * w + x] = on;
    }
  }
  return out;
}

function erode(bin, w, h) {
  const out = new Uint8Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      let on = 1;
      for (let dy = -1; dy <= 1 && on; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!bin[(y + dy) * w + (x + dx)]) {
            on = 0;
            break;
          }
        }
      }
      out[y * w + x] = on;
    }
  }
  return out;
}

function cropToGlyphs(bin, w, h) {
  let minX = w;
  let minY = h;
  let maxX = 0;
  let maxY = 0;
  let count = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!bin[y * w + x]) continue;
      count++;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (count < 12) return null;
  const pad = 10;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(w - 1, maxX + pad);
  maxY = Math.min(h - 1, maxY + pad);
  const cw = maxX - minX + 1;
  const ch = maxY - minY + 1;
  if (cw < 12 || ch < 8) return null;
  const cropped = new Uint8Array(cw * ch);
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      cropped[y * cw + x] = bin[(minY + y) * w + (minX + x)];
    }
  }
  return { bin: cropped, w: cw, h: ch };
}

function paintBlackOnWhite(ctx, bin, w, h) {
  const img = ctx.createImageData(w, h);
  const d = img.data;
  for (let p = 0, i = 0; p < bin.length; p++, i += 4) {
    const v = bin[p] ? 0 : 255;
    d[i] = v;
    d[i + 1] = v;
    d[i + 2] = v;
    d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

function fingerprintOf(bin, w, h, cols = 64, rows = 16) {
  const fp = new Uint8Array(cols * rows);
  const cw = w / cols;
  const ch = h / rows;
  for (let ry = 0; ry < rows; ry++) {
    for (let rx = 0; rx < cols; rx++) {
      const x0 = Math.floor(rx * cw);
      const y0 = Math.floor(ry * ch);
      const x1 = Math.max(x0 + 1, Math.floor((rx + 1) * cw));
      const y1 = Math.max(y0 + 1, Math.floor((ry + 1) * ch));
      let sum = 0;
      let n = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          sum += bin[y * w + x];
          n++;
        }
      }
      fp[ry * cols + rx] = n ? Math.round((sum / n) * 255) : 0;
    }
  }
  return fp;
}

export function drawGuides(overlay, src, regionMode, activeRegion) {
  const w = src.width;
  const h = src.height;
  if (overlay.width !== w) overlay.width = w;
  if (overlay.height !== h) overlay.height = h;
  const ctx = overlay.getContext('2d');
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.38)';
  ctx.fillRect(0, 0, w, h);

  const bands = [];
  if (regionMode === 'auto') bands.push('bottom', 'top');
  else bands.push(regionMode);

  for (const which of bands) {
    const b = bandRect(w, h, which);
    ctx.clearRect(b.x, b.y, b.w, b.h);
    const primary = which === (activeRegion || 'bottom');
    ctx.strokeStyle = primary ? '#ffd400' : 'rgba(255, 212, 0, 0.45)';
    ctx.lineWidth = primary ? 4 : 2;
    ctx.setLineDash(primary ? [] : [8, 8]);
    ctx.strokeRect(b.x + 2, b.y + 2, b.w - 4, b.h - 4);
  }
  ctx.setLineDash([]);
}
