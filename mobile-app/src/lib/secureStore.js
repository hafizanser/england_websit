/*
 * Where the sign-in token lives. On Android, Capacitor Preferences writes to the app's
 * private SharedPreferences (not WebView localStorage, which is readable on a rooted
 * phone and swept into backups). In a browser (npm run dev) it falls back to localStorage.
 * Same approach as the Masoom app.
 */
const PREFIX = 'eo.';
let pluginPromise;

// Keep the plugin wrapped in an object: Capacitor's proxy answers `then` as a bridge
// call, so resolving a promise with it directly would hang.
function preferences() {
  pluginPromise ??= import('@capacitor/preferences')
    .then((m) => ({ api: isNative() ? m?.Preferences ?? null : null }))
    .catch(() => ({ api: null }));
  return pluginPromise;
}

export function isNative() {
  try {
    return Boolean(window.Capacitor?.isNativePlatform?.());
  } catch {
    return false;
  }
}

const local = {
  get: (k) => { try { return localStorage.getItem(PREFIX + k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(PREFIX + k, v); } catch { /* storage off: session only */ } },
  remove: (k) => { try { localStorage.removeItem(PREFIX + k); } catch { /* nothing to clear */ } },
};

export async function readSecure(key) {
  const { api } = await preferences();
  if (api) {
    try {
      const { value } = await api.get({ key: PREFIX + key });
      return value ?? null;
    } catch { /* fall back */ }
  }
  return local.get(key);
}

export async function writeSecure(key, value) {
  const { api } = await preferences();
  if (api) {
    try {
      await api.set({ key: PREFIX + key, value });
      local.remove(key);
      return;
    } catch { /* fall back */ }
  }
  local.set(key, value);
}

export async function removeSecure(key) {
  const { api } = await preferences();
  if (api) {
    try { await api.remove({ key: PREFIX + key }); } catch { /* still clear the web copy */ }
  }
  local.remove(key);
}
