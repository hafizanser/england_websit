import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { ORIGIN_LABEL, STATUS_LABEL } from '../config.js';
import { pushBack } from '../lib/backstack.js';
import { cx, dayLabelLong, isRtl, unitUr } from '../lib/format.js';

// One consistent line-icon set (24px grid, currentColor), like Masoom's Icon.jsx.
const PATHS = {
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.6-3.6" /></>,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  chevronLeft: <path d="M15 5l-7 7 7 7" />,
  chevronRight: <path d="m9 5 7 7-7 7" />,
  phone: <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />,
  pin: <><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></>,
  calendar: <><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>,
  today: <><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" /><circle cx="12" cy="15" r="2.2" fill="currentColor" stroke="none" /></>,
  tomorrow: <><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4M10 15h5m-2-2 2 2-2 2" /></>,
  history: <><path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.6" /><path d="M4 4v4.6h4.6M12 8v4l3 2" /></>,
  list: <><path d="M9 6h11M9 12h11M9 18h11" /><circle cx="4.5" cy="6" r="1.2" fill="currentColor" /><circle cx="4.5" cy="12" r="1.2" fill="currentColor" /><circle cx="4.5" cy="18" r="1.2" fill="currentColor" /></>,
  truck: <><path d="M3 6h11v10H3zM14 9h4l3 3v4h-7z" /><circle cx="7" cy="17.5" r="1.8" /><circle cx="17.5" cy="17.5" r="1.8" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  box: <><path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5z" /><path d="M3.5 7.5 12 12l8.5-4.5M12 12v9" /></>,
  camera: <><path d="M4 8h3l1.5-2.5h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" /><circle cx="12" cy="13" r="3.6" /></>,
  image: <><rect x="3.5" y="4.5" width="17" height="15" rx="2.5" /><circle cx="9" cy="9.5" r="1.8" /><path d="m4 18 5.5-5.5 4 4 2.5-2.5 4.5 4.5" /></>,
  upload: <><path d="M12 16V4M7 9l5-5 5 5" /><path d="M4 16v3a1.5 1.5 0 0 0 1.5 1.5h13A1.5 1.5 0 0 0 20 19v-3" /></>,
  download: <><path d="M12 4v12M7 11l5 5 5-5" /><path d="M4 16v3a1.5 1.5 0 0 0 1.5 1.5h13A1.5 1.5 0 0 0 20 19v-3" /></>,
  share: <><circle cx="18" cy="5.5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="18.5" r="2.5" /><path d="m8.2 10.8 7.6-4M8.2 13.2l7.6 4" /></>,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  filter: <path d="M4 6h16M7 12h10M10 18h4" />,
  refresh: <><path d="M20 11a8 8 0 0 0-14.5-4.5L4 8" /><path d="M4 4v4h4M4 13a8 8 0 0 0 14.5 4.5L20 16" /><path d="M20 20v-4h-4" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" /></>,
  moon: <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z" />,
  lock: <><rect x="5" y="10.5" width="14" height="10" rx="2.5" /><path d="M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3" /><path d="M12 14.5v2.5" /></>,
  eye: <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="3" /></>,
  eyeOff: <><path d="M10.6 5.6A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-2.6 3.4M6.4 6.9C3.9 8.6 2.5 12 2.5 12S6 18.5 12 18.5c1.6 0 3-.4 4.2-1" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2M3 3l18 18" /></>,
  imageUp: <><path d="M20.5 13v5a2.5 2.5 0 0 1-2.5 2.5H6A2.5 2.5 0 0 1 3.5 18V6A2.5 2.5 0 0 1 6 3.5h6" /><path d="m3.8 17.5 5-5 4 4 2-2 5.4 5.2" /><path d="M18 10V3.5M15 6.5l3-3 3 3" /></>,
  checkCircle: <><circle cx="12" cy="12" r="9" /><path d="m8 12.3 2.8 2.8L16.2 9.5" /></>,
  phoneSet: <><rect x="6.5" y="2.5" width="11" height="19" rx="2.5" /><path d="M10.5 18.5h3" /></>,
  logout: <><path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" /><path d="M10 16l-4-4 4-4M6 12h10" /></>,
  edit: <><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="m13.5 6.5 4 4" /></>,
  alert: <><path d="M12 3 2.5 20h19z" /><path d="M12 10v4.5M12 17.5v.01" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5.5M12 7.8v.01" /></>,
  wifi: <><path d="M2.5 9a14 14 0 0 1 19 0M5.5 12.5a9.5 9.5 0 0 1 13 0M8.8 16a5 5 0 0 1 6.4 0" /><path d="M12 19.5v.01" /></>,
  receipt: <><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" /><path d="M9 8h6M9 12h6M9 16h3" /></>,
  zoom: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.6-3.6M11 8v6M8 11h6" /></>,
  cash: <><rect x="2.5" y="6" width="19" height="12" rx="2" /><circle cx="12" cy="12" r="2.6" /><path d="M6 9.5v.01M18 14.5v.01" /></>,
  note: <><path d="M5 3.5h10l4 4v13H5z" /><path d="M15 3.5v4h4M8.5 12h7M8.5 16h5" /></>,
  store: <><path d="M4 9.5 5.5 4h13L20 9.5" /><path d="M4 9.5a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0" /><path d="M5.5 12v8.5h13V12M10 20.5v-5h4v5" /></>,
};

export function Icon({ name, size = 20, className = '', strokeWidth = 1.9, title }) {
  return (
    <svg className={cx('ic', className)} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden={title ? undefined : true} role={title ? 'img' : undefined}>
      {title && <title>{title}</title>}
      {PATHS[name]}
    </svg>
  );
}

/** Latin text, numbers, phones and order codes inside the Urdu UI: system face, left-to-right. */
export function Num({ children, className }) {
  return <bdi className={cx('num', className)} dir="ltr">{children}</bdi>;
}

/** Data that may be Urdu or English (customer names, Pandi, addresses): Nastaliq + RTL when Urdu, otherwise the system face. */
export function UText({ children, as: Tag = 'span', className = '', ...rest }) {
  const rtl = isRtl(children);
  return <Tag dir={rtl ? 'rtl' : 'ltr'} className={cx(className, rtl ? 'ur-data' : 'lat-data')} {...rest}>{children}</Tag>;
}

const STATUS_TONE = { pending: 'new', confirmed: 'received', packed: 'preparing', shipped: 'shipped', delivered: 'done', cancelled: 'cancelled', posted: 'received' };
const STATUS_ICON = { delivered: 'check', cancelled: 'close', shipped: 'truck', packed: 'box', confirmed: 'check', pending: 'clock', posted: 'receipt' };

export function StatusPill({ status, size = 'md' }) {
  return (
    <span className={cx('status', `status--${STATUS_TONE[status] || 'new'}`, size === 'sm' && 'status--sm')}>
      <Icon name={STATUS_ICON[status] || 'clock'} size={size === 'sm' ? 13 : 15} strokeWidth={2.5} />
      <span>{STATUS_LABEL[status] || status || 'نامعلوم'}</span>
    </span>
  );
}

/** Where a record comes from: England website/dashboard order or Accountrix ERP sale. */
export function OriginBadge({ origin, size = 'md' }) {
  const erp = origin === 'erp';
  return (
    <span className={cx('origin', erp ? 'origin--erp' : 'origin--web', size === 'sm' && 'origin--sm')} title={erp ? 'Accountrix ERP سیل' : 'انگلینڈ ویب سائٹ آرڈر'}>
      <Icon name={erp ? 'receipt' : 'store'} size={size === 'sm' ? 12 : 14} strokeWidth={2.4} />
      <span>{ORIGIN_LABEL[erp ? 'erp' : 'website']}</span>
    </span>
  );
}

/**
 * Quantity of one line. Website lines are "qty unit"; ERP lines can mix units
 * ("2 CTN + 24 PCS") and carry a free bonus, both sent ready-made by the server.
 */
export function LineQty({ item, className }) {
  if (item.qty_text) {
    return (
      <span className={className}>
        <Num>{item.qty_text}</Num>
        {item.bonus && <small className="lineqty__bonus"> + <Num>{item.bonus}</Num> بونس</small>}
      </span>
    );
  }
  return <span className={className}><Num>{item.qty}</Num> {unitUr(item.unit)}</span>;
}

/** Green tick only after the server confirmed the slip; amber "باقی ہے" otherwise. */
export function SlipTick({ uploaded, size = 'md', label = true }) {
  return uploaded ? (
    <span className={cx('slip', 'slip--ok', `slip--${size}`)}>
      <span className="slip__tick"><Icon name="check" size={size === 'lg' ? 20 : 15} strokeWidth={3.2} /></span>
      {label && <span>سلپ لگ گئی</span>}
    </span>
  ) : (
    <span className={cx('slip', 'slip--pending', `slip--${size}`)}>
      <span className="slip__clock"><Icon name="clock" size={size === 'lg' ? 18 : 14} strokeWidth={2.4} /></span>
      {label && <span>سلپ باقی ہے</span>}
    </span>
  );
}

export function Spinner({ size = 18 }) {
  return <span className="spinner" style={{ width: size, height: size }} aria-label="لوڈ ہو رہا ہے" />;
}

export function Button({ variant = 'primary', block = true, size, className, children, busy, ...rest }) {
  return (
    <button type="button" className={cx('btn', `btn--${variant}`, !block && 'btn--inline', size === 'sm' && 'btn--sm', className)} aria-busy={busy || undefined} {...rest}>
      {children}
    </button>
  );
}

export function SkeletonCard() {
  return (
    <div className="ocard ocard--skeleton" aria-hidden="true">
      <div className="sk-row"><div className="sk sk--w50 sk--lg" /><div className="sk sk--w25" /></div>
      <div className="sk-row sk-row--end"><div className="sk sk--w20" /></div>
      <div className="sk-block"><div className="sk sk--w80" /><div className="sk sk--w60" /></div>
      <div className="sk sk--btn" />
    </div>
  );
}

/**
 * A bar fixed to the bottom of the phone screen (tab bar, save button). Rendered into
 * <body> so the page-enter animation can never carry it along or make it scroll.
 */
export function FixedBar({ children, className, ...rest }) {
  return createPortal(<div className={cx('fixedbar', className)} {...rest}>{children}</div>, document.body);
}

export function EmptyState({ icon = 'box', title, text, children }) {
  return (
    <div className="empty">
      <span className="empty__icon"><Icon name={icon} size={34} strokeWidth={1.7} /></span>
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {children}
    </div>
  );
}

const ERROR_TITLE = {
  server_outdated: 'سرور اپ ڈیٹ نہیں ہوا',
  server_error: 'سرور میں مسئلہ',
  rate_limited: 'تھوڑا رک جائیں',
};

export function ErrorState({ error, onRetry }) {
  const offline = error?.offline;
  const title = offline ? 'انٹرنیٹ دستیاب نہیں' : (ERROR_TITLE[error?.reason] || 'معلومات نہیں آ سکیں');
  return (
    <div className="empty empty--error" data-reason={error?.reason || undefined}>
      <span className="empty__icon"><Icon name={offline ? 'wifi' : 'alert'} size={34} strokeWidth={1.7} /></span>
      <h3>{title}</h3>
      <p>{error?.message || 'کچھ غلط ہو گیا۔ دوبارہ کوشش کریں۔'}</p>
      {onRetry && <Button block={false} onClick={onRetry}><Icon name="refresh" size={18} /> دوبارہ کوشش کریں</Button>}
    </div>
  );
}

export function Notice({ tone = 'info', icon = 'info', children, className }) {
  return (
    <div className={cx('notice', `notice--${tone}`, className)} role="status">
      <span className="notice__icon"><Icon name={icon} size={17} /></span>
      <span className="notice__body">{children}</span>
    </div>
  );
}

/** Masoom-style gold header: title, optional back disc, optional end slot. */
export function AppBar({ title, sub, back, onBack, end, children, className }) {
  const nav = useNavigate();
  const goBack = onBack || (() => (window.history.length > 1 ? nav(-1) : nav('/', { replace: true })));
  return (
    <header className={cx('appbar', className)}>
      <div className="appbar__row">
        <div className="appbar__titles">
          <h1 className="appbar__title">{title}</h1>
          {sub && <p className="appbar__sub">{sub}</p>}
        </div>
        {end}
        {back && (
          <button type="button" className="appbar__btn" onClick={goBack} aria-label="واپس">
            <Icon name="chevronLeft" size={22} strokeWidth={2.4} />
          </button>
        )}
      </div>
      {children}
    </header>
  );
}

/** Bottom sheet; Escape and the Android back gesture close it. */
export function Sheet({ open, onClose, title, children, footer, lead }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    const popBack = pushBack(() => onClose?.());
    ref.current?.focus();
    return () => { document.removeEventListener('keydown', onKey); popBack(); };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="sheet-wrap" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref}>
        <div className="sheet__grabber" />
        <div className="sheet__titlebar">
          <h3>{title}</h3>
          <button type="button" className="icon-btn icon-btn--soft" onClick={onClose} aria-label="بند کریں"><Icon name="close" size={20} strokeWidth={2.2} /></button>
        </div>
        {lead && <p className="sheet__lead">{lead}</p>}
        <div className="sheet__body">{children}</div>
        {footer && <div className="sheet__foot">{footer}</div>}
      </div>
    </div>
  );
}

/**
 * Date picker that shows the chosen date in Urdu ("بدھ، 4 نومبر 2026") instead of the
 * browser's English "mm/dd/yyyy". The real <input type=date> sits on top, invisible,
 * so a tap still opens the phone's own calendar.
 */
export function DateField({ value, onChange, placeholder = 'تاریخ منتخب کریں', ariaLabel }) {
  return (
    <span className={cx('datefield', value && 'has-value')}>
      <Icon name="calendar" size={19} />
      <span className="datefield__text">{value ? <>{dayLabelLong(value)} <Num>{value.slice(0, 4)}</Num></> : placeholder}</span>
      <input type="date" value={value || ''} aria-label={ariaLabel || placeholder} onChange={(e) => onChange(e.target.value)}
        onClick={(e) => { try { e.currentTarget.showPicker?.(); } catch { /* the native tap still opens it */ } }} />
    </span>
  );
}
