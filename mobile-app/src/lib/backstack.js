/*
 * Android back gesture, the Masoom way: whatever is open on top (dialog, viewer, sheet)
 * closes first; only when nothing is open does back leave the screen.
 * Each open layer registers a handler; the newest one answers the press.
 */
const stack = [];

export function pushBack(handler) {
  const entry = { handler };
  stack.push(entry);
  return () => {
    const i = stack.indexOf(entry);
    if (i >= 0) stack.splice(i, 1);
  };
}

/** Returns true when an open layer handled the press. */
export function handleBack() {
  const top = stack[stack.length - 1];
  if (!top) return false;
  top.handler();
  return true;
}

export const hasOpenLayer = () => stack.length > 0;
