import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { createWorker } from 'tesseract.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let py = null;
let ready = false;
let starting = null;
const waiters = [];
let tessWorker = null;

function pythonBin() {
  return process.env.OCR_PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
}

function startPython() {
  if (py) return;
  py = spawn(pythonBin(), [path.join(__dirname, 'ocr_worker.py')], {
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  let buf = '';
  py.stdout.setEncoding('utf8');
  py.stdout.on('data', (chunk) => {
    buf += chunk;
    let idx;
    while ((idx = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, idx).trim();
      buf = buf.slice(idx + 1);
      if (!line) continue;
      if (line === 'READY') {
        ready = true;
        console.log('paddleocr ready');
        continue;
      }
      const waiter = waiters.shift();
      if (waiter) waiter.resolve(line);
    }
  });
  py.stderr.setEncoding('utf8');
  py.stderr.on('data', (d) => {
    const s = String(d).trim();
    if (s) console.error('ocr_worker', s.slice(0, 300));
  });
  py.on('exit', (code) => {
    console.error('ocr_worker exit', code);
    py = null;
    ready = false;
    while (waiters.length) waiters.shift().reject(new Error('ocr worker exit'));
  });
}

export async function ensureOcr() {
  if (ready) return true;
  if (!starting) {
    starting = new Promise((resolve) => {
      try {
        startPython();
      } catch (err) {
        console.error(err);
        resolve(false);
        return;
      }
      const t = setTimeout(() => resolve(ready), 180000);
      const iv = setInterval(() => {
        if (ready) {
          clearTimeout(t);
          clearInterval(iv);
          resolve(true);
        }
        if (!py) {
          clearTimeout(t);
          clearInterval(iv);
          resolve(false);
        }
      }, 300);
    }).finally(() => {
      starting = null;
    });
  }
  return starting;
}

export async function readSubtitle(dataUrl) {
  if (await ensureOcr()) {
    const line = await send(dataUrl);
    const parsed = JSON.parse(line);
    if (parsed.ok) {
      const picked = pickCaption(parsed.lines || []);
      return { text: picked.text, confidence: picked.confidence, engine: 'paddle' };
    }
  }
  return tesseractFallback(dataUrl);
}

function pickCaption(lines) {
  const scored = lines
    .map((l) => {
      const hangul = (String(l.text).match(/[\uAC00-\uD7A3]/g) || []).length;
      return { ...l, hangul };
    })
    .filter((l) => {
      if (l.hangul < 2) return false;
      if (/\d+\/\d+/.test(l.text)) return false;
      if (/면장면|구독|좋아요/.test(l.text)) return false;
      return true;
    })
    .sort((a, b) => a.y - b.y);

  if (!scored.length) return { text: '', confidence: 0 };

  const best = scored.reduce((a, b) => (b.hangul > a.hangul ? b : a));
  const cluster = scored
    .filter((l) => Math.abs(l.y - best.y) < 0.16)
    .sort((a, b) => a.y - b.y || (a.x || 0) - (b.x || 0));
  const text = cluster.map((l) => l.text).join(' ');
  const conf = Math.round(100 * (cluster.reduce((s, l) => s + l.conf, 0) / cluster.length));
  return { text, confidence: conf };
}

function send(dataUrl) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('ocr timeout')), 12000);
    waiters.push({
      resolve: (line) => {
        clearTimeout(t);
        resolve(line);
      },
      reject: (err) => {
        clearTimeout(t);
        reject(err);
      },
    });
    py.stdin.write(`${JSON.stringify({ image: dataUrl })}\n`);
  });
}

async function tesseractFallback(dataUrl) {
  if (!tessWorker) {
    tessWorker = await createWorker('kor', 1, {
      langPath: path.join(__dirname, 'public', 'tessdata'),
      gzip: true,
    });
    await tessWorker.setParameters({ tessedit_pageseg_mode: '6' });
  }
  const { data } = await tessWorker.recognize(dataUrl);
  return { text: data.text || '', confidence: Number(data.confidence) || 0, engine: 'tess' };
}
