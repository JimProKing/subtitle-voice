import { createWorker } from 'tesseract.js';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const worker = await createWorker('kor', 1, {
  langPath: path.join(root, 'public', 'tessdata'),
  gzip: true,
});
await worker.setParameters({ tessedit_pageseg_mode: '6' });

const files = ['sample-sub.png', 'sample-sub-prep.png', 'sample-sub-bw.png'];
let ok = false;
for (const file of files) {
  const image = path.join(root, 'scripts', file);
  const { data } = await worker.recognize(image);
  const text = (data.text || '').replace(/\s+/g, ' ').trim();
  const hangul = (text.match(/[\uAC00-\uD7A3]/g) || []).join('');
  console.log(file, '=>', text, '| conf', Math.round(data.confidence));
  if (hangul.includes('이제') || hangul.includes('출발') || hangul.includes('해야')) ok = true;
}
await worker.terminate();
if (!ok) {
  console.error('korean subtitle not recognized');
  process.exit(1);
}
console.log('ocr sample ok');
