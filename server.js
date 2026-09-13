import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { synthesize } from './tts-engine.js';
import { ensureOcr, readSubtitle } from './ocr-engine.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const APP_VERSION = process.env.APP_VERSION || '16';
const TESSDATA_DIR = path.join(__dirname, 'public', 'tessdata');
const TESSDATA_FILE = path.join(TESSDATA_DIR, 'kor.traineddata.gz');
const TESSDATA_URLS = [
  'https://tessdata.projectnaptha.com/4.0.0/kor.traineddata.gz',
  'https://cdn.jsdelivr.net/gh/naptha/tessdata@gh-pages/4.0.0/kor.traineddata.gz',
];

const app = express();

app.disable('x-powered-by');
app.use(express.json({ limit: '4mb' }));
app.get('/health', (_req, res) => {
  res.json({ ok: true, version: APP_VERSION, tessdata: fs.existsSync(TESSDATA_FILE) });
});
app.get('/version', (_req, res) => {
  res.json({ ok: true, version: APP_VERSION });
});

async function handleTts(req, res) {
  try {
    const src = req.method === 'POST' ? req.body || {} : req.query || {};
    const text = String(src.text || '').trim();
    if (!text) {
      res.status(400).type('text/plain').send('text required');
      return;
    }
    const buf = await synthesize({
      text,
      gender: String(src.gender || 'male'),
      age: String(src.age || 'young'),
      speed: Number(src.speed || src.rate || 1.15),
    });
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-store');
    res.send(buf);
  } catch (err) {
    console.error('tts failed', err);
    res.status(502).type('text/plain').send('tts failed');
  }
}

app.get('/api/tts', handleTts);
app.post('/api/tts', handleTts);

app.post('/api/ocr', async (req, res) => {
  try {
    const image = String(req.body?.image || '');
    if (!image.startsWith('data:image')) {
      res.status(400).json({ ok: false, error: 'image required' });
      return;
    }
    const out = await readSubtitle(image);
    res.json({ ok: true, ...out });
  } catch (err) {
    console.error('ocr failed', err);
    res.status(502).json({ ok: false, error: 'ocr failed' });
  }
});

app.use(
  '/vendor/tesseract',
  express.static(path.join(__dirname, 'node_modules', 'tesseract.js', 'dist'), {
    maxAge: '7d',
    fallthrough: false,
  })
);
app.use(
  '/vendor/tesseract-core',
  express.static(path.join(__dirname, 'node_modules', 'tesseract.js-core'), {
    maxAge: '7d',
    fallthrough: false,
  })
);
app.use(
  '/tessdata',
  express.static(TESSDATA_DIR, {
    maxAge: '365d',
    immutable: true,
    fallthrough: false,
  })
);
app.use(
  express.static(path.join(__dirname, 'public'), {
    etag: true,
    setHeaders(res, filePath) {
      if (/\.(html|js|css)$/i.test(filePath)) {
        res.setHeader('Cache-Control', 'no-cache');
      }
    },
  })
);

app.use((_req, res) => {
  res.status(404).type('text/plain').send('Not found');
});

app.listen(PORT, '0.0.0.0', () => {
  const publicHost = process.env.RAILWAY_PUBLIC_DOMAIN;
  console.log(`자막소리 listening on 0.0.0.0:${PORT}`);
  if (publicHost) console.log(`공개 주소 https://${publicHost}`);
  else console.log('공개 주소 없음: Railway 서비스 Settings → Networking → Generate Domain');
  ensureTessdata().catch((err) => {
    console.warn('한글 OCR 데이터 준비 실패', err);
  });
  ensureOcr().catch((err) => {
    console.warn('PaddleOCR 준비 실패, Tesseract로 대체합니다', err);
  });
});

async function ensureTessdata() {
  await fs.promises.mkdir(TESSDATA_DIR, { recursive: true });
  try {
    const st = await fs.promises.stat(TESSDATA_FILE);
    if (st.size > 1000) return;
  } catch {
    /* download */
  }

  let lastError = null;
  for (const url of TESSDATA_URLS) {
    try {
      console.log(`한글 OCR 데이터 받는 중: ${url}`);
      const res = await fetch(url, { signal: AbortSignal.timeout(60000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 1000) throw new Error('file too small');
      await fs.promises.writeFile(TESSDATA_FILE, buf);
      console.log(`저장 완료 (${buf.length} bytes)`);
      return;
    } catch (err) {
      lastError = err;
    }
  }
  console.warn('한글 OCR 데이터를 받지 못했습니다. 첫 OCR이 실패할 수 있습니다.', lastError);
}
