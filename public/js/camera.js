let stream = null;
let objectUrl = null;

export function els() {
  return {
    video: document.getElementById('camera'),
  };
}

export async function startCamera() {
  await stop();
  const tries = [
    {
      audio: false,
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    },
    { audio: false, video: { facingMode: 'environment' } },
    { audio: false, video: true },
  ];

  let lastError = null;
  for (const constraints of tries) {
    try {
      stream = await navigator.mediaDevices.getUserMedia(constraints);
      break;
    } catch (err) {
      lastError = err;
    }
  }
  if (!stream) {
    throw lastError || new Error('camera-denied');
  }

  const video = els().video;
  video.srcObject = stream;
  video.muted = true;
  video.playsInline = true;
  video.setAttribute('playsinline', '');
  video.setAttribute('webkit-playsinline', '');
  await video.play();
  await waitForFrame(video);
  return { source: 'camera' };
}

export async function startFile(file) {
  await stop();
  const video = els().video;
  objectUrl = URL.createObjectURL(file);
  video.srcObject = null;
  video.src = objectUrl;
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.setAttribute('playsinline', '');
  video.setAttribute('webkit-playsinline', '');
  await video.play();
  await waitForFrame(video);
  return { source: 'file' };
}

export function drawFrame(canvas, maxWidth = 1280) {
  const video = els().video;
  if (video.paused && video.readyState >= 2) {
    video.play().catch(() => {});
  }
  if (!video.videoWidth) return false;
  const scale = Math.min(1, maxWidth / video.videoWidth);
  const w = Math.max(2, Math.round(video.videoWidth * scale));
  const h = Math.max(2, Math.round(video.videoHeight * scale));
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(video, 0, 0, w, h);
  return true;
}

export function hasFrame() {
  const video = els().video;
  return Boolean(video && video.videoWidth && !video.paused);
}

export async function stop() {
  const video = els().video;
  if (stream) {
    for (const track of stream.getTracks()) track.stop();
    stream = null;
  }
  if (video) {
    video.pause();
    video.srcObject = null;
    video.removeAttribute('src');
    video.load();
  }
  if (objectUrl) {
    URL.revokeObjectURL(objectUrl);
    objectUrl = null;
  }
}

function waitForFrame(video) {
  return new Promise((resolve, reject) => {
    if (video.readyState >= 2 && video.videoWidth) {
      resolve();
      return;
    }
    const onReady = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error('video-error'));
    };
    const cleanup = () => {
      video.removeEventListener('loadeddata', onReady);
      video.removeEventListener('error', onError);
    };
    video.addEventListener('loadeddata', onReady, { once: true });
    video.addEventListener('error', onError, { once: true });
  });
}
