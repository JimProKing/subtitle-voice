import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const TESSDATA_DIR = path.join(__dirname, 'public', 'tessdata');
const TESSDATA_FILE = path.join(TESSDATA_DIR, 'kor.traineddata.gz');
const TESSDATA_URLS = [
  'https://tessdata.projectnaptha.com/4.0.0/kor.traineddata.gz',
  'https://cdn.jsdelivr.net/gh/naptha/tessdata@gh-pages/4.0.0/kor.traineddata.gz',
];

const app = express();

app.disable('x-powered-by');
app.get('/health', (_req, res) => {
  res.json({ ok: true, tessdata: fs.existsSync(TESSDATA_FILE) });
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
    maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0,
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
