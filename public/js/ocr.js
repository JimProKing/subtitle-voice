let worker = null;
let busy = false;
let ready = false;

export function isBusy() {
  return busy;
}

export function isReady() {
  return ready;
}

export async function init(onProgress) {
  if (worker) return;
  const Tesseract = await loadTesseract();
  worker = await Tesseract.createWorker('kor', 1, {
    workerPath: '/vendor/tesseract/worker.min.js',
    corePath: '/vendor/tesseract-core',
    langPath: '/tessdata',
    gzip: true,
    logger: (m) => {
      if (!onProgress) return;
      if (typeof m.progress === 'number') {
        onProgress(m.status || 'loading', m.progress);
      }
    },
  });
  await worker.setParameters({
    tessedit_pageseg_mode: '6',
    preserve_interword_spaces: '1',
  });
  ready = true;
}

export async function recognize(imageCanvas) {
  if (!worker) throw new Error('ocr-not-ready');
  if (busy) return null;
  busy = true;
  try {
    const { data } = await worker.recognize(imageCanvas);
    return {
      text: data.text || '',
      confidence: Number(data.confidence) || 0,
    };
  } finally {
    busy = false;
  }
}

export async function dispose() {
  ready = false;
  if (worker) {
    try {
      await worker.terminate();
    } catch {
      /* ignore */
    }
  }
  worker = null;
  busy = false;
}

async function loadTesseract() {
  if (window.Tesseract) return window.Tesseract;
  await new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = '/vendor/tesseract/tesseract.min.js';
    script.onload = resolve;
    script.onerror = () => reject(new Error('tesseract-load-failed'));
    document.head.appendChild(script);
  });
  return window.Tesseract;
}
