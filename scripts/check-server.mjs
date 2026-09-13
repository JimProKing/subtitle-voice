const urls = [
  '/',
  '/health',
  '/css/app.css',
  '/js/app.js',
  '/js/config.js',
  '/js/a11y.js',
  '/js/camera.js',
  '/js/preprocess.js',
  '/js/ocr.js',
  '/js/subtitle.js',
  '/js/tts.js',
  '/js/help.js',
  '/js/settings.js',
  '/manifest.json',
  '/sw.js',
  '/icons/icon.svg',
  '/icons/icon-512.jpg',
  '/vendor/tesseract/tesseract.min.js',
  '/vendor/tesseract/worker.min.js',
  '/vendor/tesseract-core/tesseract-core-simd-lstm.wasm.js',
  '/vendor/tesseract-core/tesseract-core-simd-lstm.wasm',
  '/tessdata/kor.traineddata.gz',
];

let failed = 0;
for (const u of urls) {
  const r = await fetch(`http://localhost:3000${u}`);
  const ok = r.ok;
  if (!ok) failed++;
  const type = r.headers.get('content-type') || '';
  const len = r.headers.get('content-length') || '';
  console.log(`${ok ? 'OK ' : 'BAD'} ${r.status} ${u} ${type} ${len}`);
}

const html = await (await fetch('http://localhost:3000/')).text();
const needles = [
  '자막을 이 칸에 맞추세요',
  'btn-start-camera',
  'lang="ko"',
  '/js/app.js',
  'data-help',
  '괴물',
];
for (const needle of needles) {
  if (!html.includes(needle)) {
    console.log(`MISSING ${needle}`);
    failed++;
  }
}

const health = await (await fetch('http://localhost:3000/health')).json();
console.log('health', JSON.stringify(health));
if (failed) {
  console.error('failed', failed);
  process.exit(1);
}
console.log('all assets ok');
