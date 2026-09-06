const polite = () => document.getElementById('live-polite');
const assertive = () => document.getElementById('live-assertive');

export function announce(message, mode = 'polite') {
  const el = mode === 'assertive' ? assertive() : polite();
  if (!el) return;
  el.textContent = '';
  window.setTimeout(() => {
    el.textContent = message;
  }, 40);
}

export function vibrate(pattern = 20) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* ignore */
  }
}

export function setStatus(text) {
  const el = document.getElementById('status');
  if (el) el.textContent = text;
}
