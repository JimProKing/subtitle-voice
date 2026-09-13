import { CONFIG, DEFAULTS } from './config.js';

export function loadSettings() {
  try {
    const raw = JSON.parse(localStorage.getItem(CONFIG.storageKey) || 'null');
    if (raw && typeof raw === 'object') return { ...DEFAULTS, ...raw };
  } catch {
    /* ignore */
  }
  return { ...DEFAULTS };
}

export function saveSettings(settings) {
  localStorage.setItem(CONFIG.storageKey, JSON.stringify(settings));
}
