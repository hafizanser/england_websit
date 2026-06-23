// ---------------------------------------------------------------------------
// API client
// ---------------------------------------------------------------------------
// A thin simulated-backend layer. Every call returns a Promise that resolves
// after a small, realistic delay so the UI exercises real loading / error /
// empty states. Swap `request()` for `fetch()` against your PHP/Node API later
// without touching any component — the service signatures stay the same.
// ---------------------------------------------------------------------------

const LATENCY = [220, 520] // ms range

function delay(min, max) {
  // deterministic-ish jitter without Math.random (kept simple + SSR-safe)
  const span = max - min
  const t = min + ((Date.now() % 100) / 100) * span
  return new Promise((res) => setTimeout(res, t))
}

// Simulate a request. Pass `{ fail: true }` to exercise error handling.
export async function request(resolver, { fail = false } = {}) {
  await delay(LATENCY[0], LATENCY[1])
  if (fail) {
    const err = new Error('Network se rabta nahi ho saka. Dobara koshish karein.')
    err.code = 'NETWORK'
    throw err
  }
  return typeof resolver === 'function' ? resolver() : resolver
}

// Deep-clone so callers never mutate the in-memory "database".
export function clone(value) {
  return JSON.parse(JSON.stringify(value))
}
