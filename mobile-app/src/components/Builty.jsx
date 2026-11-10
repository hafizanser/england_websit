/*
 * Builty (cargo receipt) status + action button, shared by the order card and the order detail.
 *
 *   none     → brown   "بلٹی کی تصویر اپلوڈ کریں"               → upload screen
 *   partial  → amber   "بلٹی نامکمل — <side> کی تصویر باقی ہے"   → upload screen (to add the missing side)
 *   complete → green   ✓ "بلٹی کی تصاویر دیکھیں"                 → viewer
 * The click never reaches the card (stopPropagation), so it opens only these screens.
 */
import { cx } from '../lib/format.js';
import { Icon } from './ui.jsx';

export const SIDE_LABEL = { front: 'سامنے کی تصویر', back: 'پیچھے کی تصویر' };
export const SIDE_SHORT = { front: 'سامنے', back: 'پیچھے' };

export function builtyState(b) {
  const front = Boolean(b?.front?.uploaded);
  const back = Boolean(b?.back?.uploaded);
  if (front && back) return { kind: 'complete', missing: [] };
  if (front || back) return { kind: 'partial', missing: [front ? 'back' : 'front'] };
  return { kind: 'none', missing: ['front', 'back'] };
}

export function BuiltyButton({ builty, onUpload, onView, className }) {
  const s = builtyState(builty);
  const click = (fn) => (e) => { e.stopPropagation(); fn(); };
  const stopKeys = (e) => e.stopPropagation();
  if (s.kind === 'complete') {
    return (
      <button type="button" className={cx('bbtn bbtn--done', className)} onClick={click(onView)} onKeyDown={stopKeys}>
        <Icon name="checkCircle" size={22} strokeWidth={2.3} className="bbtn__ic" />
        <span className="bbtn__label">بلٹی کی تصاویر دیکھیں</span>
      </button>
    );
  }
  if (s.kind === 'partial') {
    return (
      <button type="button" className={cx('bbtn bbtn--partial', className)} onClick={click(onUpload)} onKeyDown={stopKeys}>
        <Icon name="alert" size={20} strokeWidth={2.2} className="bbtn__ic" />
        <span className="bbtn__label">بلٹی نامکمل — {SIDE_LABEL[s.missing[0]]} باقی ہے</span>
      </button>
    );
  }
  return (
    <button type="button" className={cx('bbtn bbtn--todo', className)} onClick={click(onUpload)} onKeyDown={stopKeys}>
      <Icon name="imageUp" size={21} strokeWidth={2.1} className="bbtn__ic" />
      <span className="bbtn__label">بلٹی کی تصویر اپلوڈ کریں</span>
    </button>
  );
}

/** Two small pills: سامنے ✓ / پیچھے ✓ */
export function BuiltySides({ builty }) {
  return (
    <span className="bsides">
      {['front', 'back'].map((side) => {
        const ok = Boolean(builty?.[side]?.uploaded);
        return (
          <span key={side} className={cx('bside', ok ? 'bside--ok' : 'bside--no')}>
            <Icon name={ok ? 'check' : 'clock'} size={13} strokeWidth={ok ? 3 : 2.4} />
            <span>{SIDE_SHORT[side]}</span>
          </span>
        );
      })}
    </span>
  );
}
