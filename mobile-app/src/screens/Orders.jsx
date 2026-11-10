import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Api } from '../lib/api.js';
import { ORIGIN_LABEL, PAGE_SIZE, STATUSES, STATUS_LABEL, TABS, recordNoun, recordPath } from '../config.js';
import { cx, dayLabel, dayLabelLong } from '../lib/format.js';
import { AppBar, Button, DateField, EmptyState, ErrorState, FixedBar, Icon, LineQty, Notice, Num, OriginBadge, Sheet, SkeletonCard, Spinner, UText } from '../components/ui.jsx';

const AUTO_REFRESH_MS = 60_000;
import { BuiltyButton } from '../components/Builty.jsx';

// Last result per query, so going back to the list paints instantly while it refreshes.
const cache = new Map();
let savedScroll = { key: null, y: 0 };
// The server's business day, remembered so the header does not flicker while a list reloads.
let lastToday = null;

function useDebounced(value, ms) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

const TAB_EMPTY = {
  today: ['آج کوئی آرڈر نہیں', 'آج کے نئے آرڈر یہاں نظر آئیں گے۔'],
  tomorrow: ['کل کے لیے کوئی آرڈر نہیں', 'جن آرڈرز کی ڈیلیوری کی تاریخ کل کی ہو گی، وہ یہاں نظر آئیں گے۔'],
  previous: ['کوئی پچھلا آرڈر نہیں', 'گزرے ہوئے دنوں کے آرڈر یہاں نظر آئیں گے۔'],
  all: ['ابھی کوئی آرڈر نہیں', 'ویب سائٹ کے آرڈر اور ERP کی سیلز یہاں نظر آئیں گی۔'],
};

export default function Orders() {
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.key === params.get('tab')) ? params.get('tab') : 'today';
  const tabInfo = TABS.find((t) => t.key === tab);
  const tabIndex = TABS.findIndex((t) => t.key === tab);
  // Which way the list slides in when the tab changes (RTL: a tab further left comes in from the left).
  const prevIndex = useRef(tabIndex);
  const [slide, setSlide] = useState('');
  useEffect(() => {
    if (prevIndex.current !== tabIndex) setSlide(tabIndex > prevIndex.current ? 'from-left' : 'from-right');
    prevIndex.current = tabIndex;
  }, [tabIndex]);
  const filters = {
    status: params.get('status') || '',
    builty: params.get('builty') || '',
    origin: params.get('origin') || '',
    from: params.get('from') || '',
    to: params.get('to') || '',
  };
  const [q, setQ] = useState(params.get('q') || '');
  const dq = useDebounced(q.trim(), 350);

  const key = JSON.stringify({ tab, q: dq, ...filters });
  const cached = cache.get(key);
  const [rows, setRows] = useState(cached?.rows || []);
  const [meta, setMeta] = useState(cached?.meta || null);
  const [counts, setCounts] = useState(cached?.counts || null);
  const [loading, setLoading] = useState(!cached);
  const [refreshing, setRefreshing] = useState(false);
  const [more, setMore] = useState(false);
  const [error, setError] = useState(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [erp, setErp] = useState(null); // ERP source status from the last list answer
  const ctrl = useRef(null);
  const sentinel = useRef(null);

  // Keep the search text in the URL (so back from an order restores it).
  useEffect(() => {
    const next = new URLSearchParams(params);
    if (dq) next.set('q', dq); else next.delete('q');
    if (next.toString() !== params.toString()) setParams(next, { replace: true });
  }, [dq]); // eslint-disable-line react-hooks/exhaustive-deps

  const load = useCallback(async (page = 1, mode = 'replace') => {
    ctrl.current?.abort();
    const c = new AbortController();
    ctrl.current = c;
    if (mode === 'replace' && !cache.get(key)) setLoading(true);
    if (mode === 'refresh') setRefreshing(true);
    if (mode === 'more') setMore(true);
    setError(null);
    try {
      const r = await Api.orders({ tab, q: dq, ...filters, page, per_page: PAGE_SIZE }, c.signal);
      setCounts(r.counts);
      setMeta(r.meta);
      setErp(r.sources?.erp || null);
      setRows((prev) => {
        const next = mode === 'more' ? [...prev, ...r.orders.filter((o) => !prev.some((p) => rowKey(p) === rowKey(o)))] : r.orders;
        cache.set(key, { rows: next, meta: r.meta, counts: r.counts });
        return next;
      });
    } catch (e) {
      if (e.message !== 'cancelled') setError(e);
    } finally {
      if (ctrl.current === c) { setLoading(false); setRefreshing(false); setMore(false); }
    }
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const c = cache.get(key);
    setRows(c?.rows || []); setMeta(c?.meta || null); if (c) setCounts(c.counts);
    load(1, c ? 'refresh' : 'replace');
    return () => ctrl.current?.abort();
  }, [key, load]);

  // Restore the scroll position when coming back from an order.
  useEffect(() => {
    if (savedScroll.key === key && cache.get(key)) requestAnimationFrame(() => window.scrollTo(0, savedScroll.y));
    return () => { savedScroll = { key, y: window.scrollY }; };
  }, [key]);

  // Refresh when the app comes back to the foreground.
  useEffect(() => {
    const fn = () => { if (document.visibilityState === 'visible') load(1, 'refresh'); };
    document.addEventListener('visibilitychange', fn);
    return () => document.removeEventListener('visibilitychange', fn);
  }, [load]);

  // New website orders and ERP sales appear on their own: re-check every minute while the
  // app is open and the list is at the top (never while the user is reading further down).
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === 'visible' && window.scrollY < 200 && navigator.onLine !== false) load(1, 'refresh');
    }, AUTO_REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);

  // Load the next page as the list nears its end.
  const hasMore = meta && meta.page < meta.last_page;
  useEffect(() => {
    if (!hasMore || !sentinel.current) return undefined;
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !more && !loading) load((meta?.page || 1) + 1, 'more');
    }, { rootMargin: '400px' });
    io.observe(sentinel.current);
    return () => io.disconnect();
  }, [hasMore, more, loading, meta, load]);

  const listTop = useRef(null);
  function setTab(t) {
    if (t === tab) return;
    const next = new URLSearchParams(params);
    next.set('tab', t);
    setParams(next, { replace: true });
    // Start the new list at its top, but leave the header where it is if it is still on screen.
    const y = listTop.current ? listTop.current.getBoundingClientRect().top + window.scrollY - 76 : 0;
    if (window.scrollY > y) window.scrollTo({ top: Math.max(0, y) });
  }
  const clearFilter = (k) => {
    const next = new URLSearchParams(params);
    next.delete(k);
    setParams(next, { replace: true });
  };

  const activeFilters = ['status', 'builty', 'origin', 'from', 'to'].filter((k) => filters[k]).length;
  if (meta?.today) lastToday = meta.today;
  const today = meta?.today || lastToday;
  const searching = Boolean(dq) || activeFilters > 0;

  return (
    <div className="screen screen--orders has-tabs">
      <AppBar
        className="appbar--home"
        title="انگلینڈ آرڈرز"
        sub="آرڈر اور ڈیلیوری"
        end={
          <>
            <button type="button" className="appbar__icon" onClick={() => load(1, 'refresh')} aria-label="تازہ کریں" disabled={refreshing}>
              {refreshing ? <Spinner size={18} /> : <Icon name="refresh" size={20} strokeWidth={2.2} />}
            </button>
            <button type="button" className="appbar__icon" onClick={() => nav('/account')} aria-label="میرا اکاؤنٹ">
              <Icon name="user" size={21} strokeWidth={2.2} />
            </button>
          </>
        }
      >
        <div className="searchrow">
          <label className="searchbox">
            <Icon name="search" size={20} strokeWidth={2.2} />
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="گاہک کا نام، فون، آرڈر یا انوائس نمبر"
              enterKeyHint="search" aria-label="آرڈر تلاش کریں" dir="auto" />
            {q && <button type="button" className="searchbox__clear" onClick={() => setQ('')} aria-label="تلاش صاف کریں"><Icon name="close" size={16} strokeWidth={2.4} /></button>}
          </label>
          <button type="button" className={cx('filterbtn', activeFilters && 'is-on')} onClick={() => setFilterOpen(true)} aria-label="فلٹر">
            <Icon name="filter" size={22} strokeWidth={2.4} />
            <span>فلٹر</span>
            {activeFilters > 0 && <b className="filterbtn__dot"><Num>{activeFilters}</Num></b>}
          </button>
        </div>
      </AppBar>

      <OrderTabs tab={tab} counts={counts} onChange={setTab} />

      <main className="content" aria-busy={loading}>
        <section className="listhead" ref={listTop} aria-live="polite">
          <div className="listhead__main">
            <h2 className="listhead__title">
              <Icon name={tabInfo.icon} size={19} strokeWidth={2.1} />
              <span>{tabInfo.label}</span>
            </h2>
            <p className="listhead__sub">
              {searching ? 'تلاش / فلٹر کے مطابق' : tab === 'today' && today ? dayLabelLong(today) : tabInfo.hint}
            </p>
          </div>
          <div className="listhead__count" aria-label="آرڈرز کی تعداد">
            <Num>{meta ? meta.total : counts ? counts[tab] : '–'}</Num>
            <span>آرڈر</span>
          </div>
        </section>

        {activeFilters > 0 && (
          <div className="chips">
            {filters.status && <Chip label={`حالت: ${STATUS_LABEL[filters.status]}`} onClear={() => clearFilter('status')} />}
            {filters.builty && <Chip label={BUILTY_FILTER[filters.builty] || 'بلٹی'} onClear={() => clearFilter('builty')} />}
            {filters.origin && <Chip label={`صرف ${ORIGIN_LABEL[filters.origin] || filters.origin}`} onClear={() => clearFilter('origin')} />}
            {filters.from && <Chip label={`${dayLabel(filters.from)} سے`} onClear={() => clearFilter('from')} />}
            {filters.to && <Chip label={`${dayLabel(filters.to)} تک`} onClear={() => clearFilter('to')} />}
          </div>
        )}

        {erp?.enabled && erp.ok === false && (
          <Notice tone="warn" icon="alert">ERP سے رابطہ نہیں ہو سکا — ERP کی نئی سیلز ابھی نظر نہیں آ رہیں۔ ویب سائٹ کے آرڈر اور پہلے سے آئی ہوئی ERP سیلز دکھائی جا رہی ہیں۔</Notice>
        )}
        {loading && rows.length === 0 && <div className="olist">{[0, 1, 2, 3].map((i) => <SkeletonCard key={i} />)}</div>}
        {error && rows.length === 0 && <ErrorState error={error} onRetry={() => load(1)} />}
        {error && rows.length > 0 && (
          <Notice tone="error" icon="alert">
            {error.message}{' '}
            <button type="button" className="linkbtn" onClick={() => load(1, 'refresh')}>دوبارہ کوشش کریں</button>
          </Notice>
        )}
        {!loading && !error && rows.length === 0 && (
          searching
            ? <EmptyState icon="search" title="کوئی آرڈر نہیں ملا" text="کوئی اور نام، فون نمبر یا آرڈر نمبر لکھ کر دیکھیں، یا فلٹر ہٹا دیں۔" />
            : <EmptyState icon="box" title={TAB_EMPTY[tab][0]} text={TAB_EMPTY[tab][1]} />
        )}

        <div className={cx('olist', slide && `olist--${slide}`)} key={tab} onAnimationEnd={() => setSlide('')}>
          {rows.map((o) => (
            <OrderCard key={rowKey(o)} o={o}
              onOpen={() => nav(recordPath(o.origin, o.id), { state: { code: o.code } })}
              onUpload={() => nav(`${recordPath(o.origin, o.id)}/builty/upload`, { state: { code: o.code } })}
              onView={() => nav(`${recordPath(o.origin, o.id)}/builty`, { state: { code: o.code } })} />
          ))}
        </div>
        {hasMore && <div ref={sentinel} className="more">{more ? <><Spinner /> مزید آرڈر لوڈ ہو رہے ہیں…</> : ' '}</div>}
        {meta && !hasMore && rows.length > 0 && <p className="end">بس، یہی تمام آرڈر ہیں</p>}
      </main>

      <BottomTabs tab={tab} counts={counts} onChange={setTab} />

      <FilterSheet open={filterOpen} onClose={() => setFilterOpen(false)} params={params} setParams={setParams} />
    </div>
  );
}

/*
 * The same four lists as a bottom navigation bar (thumb reach). Rendered into <body> (FixedBar),
 * so it never moves with page transitions or scrolls with the list. Works with the top tabs:
 * both read and set the same `tab`.
 */
function BottomTabs({ tab, counts, onChange }) {
  return (
    <FixedBar className="tabbar-wrap">
      <nav className="tabbar" aria-label="آرڈر کی فہرستیں (نیچے)">
        {TABS.map((t) => {
          const on = tab === t.key;
          const n = counts ? counts[t.key] : null;
          return (
            <button key={t.key} type="button" aria-current={on ? 'page' : undefined} className={cx('tabbar__tab', on && 'is-active')} onClick={() => onChange(t.key)}>
              <span className="tabbar__icon">
                <Icon name={t.icon} size={22} strokeWidth={on ? 2.2 : 1.9} />
                {n > 0 && <b className="tabbar__count"><Num>{n > 99 ? '99+' : n}</Num></b>}
              </span>
              <span className="tabbar__label">{t.label}</span>
            </button>
          );
        })}
      </nav>
    </FixedBar>
  );
}

/*
 * The order lists as one segmented control, pinned under the header while the list scrolls.
 * RTL: the first tab sits on the right. ←/→ move between tabs like any tab list.
 */
function OrderTabs({ tab, counts, onChange }) {
  const index = TABS.findIndex((t) => t.key === tab);
  const refs = useRef([]);
  function onKey(e) {
    const step = e.key === 'ArrowLeft' ? 1 : e.key === 'ArrowRight' ? -1 : 0; // RTL
    if (!step) return;
    e.preventDefault();
    const next = (index + step + TABS.length) % TABS.length;
    onChange(TABS[next].key);
    refs.current[next]?.focus();
  }
  return (
    <div className="segbar">
      <nav className="seg" role="tablist" aria-label="آرڈر کی فہرستیں" style={{ '--seg-i': index, '--seg-n': TABS.length }} onKeyDown={onKey}>
        <span className="seg__thumb" aria-hidden="true" />
        {TABS.map((t, i) => {
          const on = t.key === tab;
          const n = counts ? counts[t.key] : null;
          return (
            <button key={t.key} ref={(el) => { refs.current[i] = el; }} type="button" role="tab" aria-selected={on} tabIndex={on ? 0 : -1}
              className={cx('seg__tab', on && 'is-active')} onClick={() => onChange(t.key)}>
              <Icon name={t.icon} size={18} strokeWidth={on ? 2.3 : 2} className="seg__icon" />
              <span className="seg__label"><span className="seg__full">{t.label}</span><span className="seg__short">{t.short}</span></span>
              {n !== null && n !== undefined && <b className={cx('seg__count', n === 0 && 'is-zero')}><Num>{n > 99 ? '99+' : n}</Num></b>}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

function Chip({ label, onClear }) {
  return (
    <button type="button" className="chip" onClick={onClear} aria-label={`${label} — ہٹائیں`}>
      <span>{label}</span><Icon name="close" size={14} strokeWidth={2.6} />
    </button>
  );
}

const BUILTY_FILTER = { uploaded: 'بلٹی مکمل', partial: 'بلٹی نامکمل', pending: 'بلٹی باقی ہے' };

/** Website order ids and ERP sale ids overlap; the server's `key` (web-1 / erp-1) is unique. */
const rowKey = (o) => o.key || `${o.origin === 'erp' ? 'erp' : 'web'}-${o.id}`;

/*
 * One customer's order — placement is fixed by the team:
 *   row 1: customer name (right) ......... order number (left)
 *   row 2:                                  city (left, under the order number)
 *   products: every item with its quantity and unit (no prices)
 *   Adda name, then phone
 *   Builty button (full width) — the only part that does not open the order.
 */
function OrderCard({ o, onOpen, onUpload, onView }) {
  const items = o.items || [];
  const key = (e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onOpen(); } };
  return (
    <article className="ocard" role="link" tabIndex={0} onClick={onOpen} onKeyDown={key}
      aria-label={`${o.origin === 'erp' ? 'انوائس' : 'آرڈر'} ${o.code} — ${o.customer.name || ''}`}>
      <header className="ocard__top">
        <UText as="h3" className="ocard__name">{o.customer.name || 'نام درج نہیں'}</UText>
        <span className="ocard__id">
          <span className="ocard__key">{o.origin === 'erp' ? 'انوائس نمبر' : 'آرڈر نمبر'}</span>
          <Num>#{o.code}</Num>
          <OriginBadge origin={o.origin} size="sm" />
        </span>
        <span className="ocard__city">
          <Icon name="pin" size={14} strokeWidth={2.2} />
          <span className="ocard__key">شہر:</span>
          {o.customer.city ? <UText className="ocard__cityname">{o.customer.city}</UText> : <span className="muted">درج نہیں</span>}
        </span>
      </header>

      <section className="ocard__sec">
        <h4 className="ocard__label"><Icon name="box" size={15} strokeWidth={2.1} /> {recordNoun(o.origin)} کا سامان <span className="ocard__count"><Num>{items.length}</Num></span></h4>
        {items.length ? (
          <ul className="ocard__items">
            {items.map((it) => (
              <li key={it.id}>
                <UText className="ocard__item">{it.name}</UText>
                <LineQty item={it} className="ocard__qty" />
              </li>
            ))}
          </ul>
        ) : <p className="muted ocard__none">اس {recordNoun(o.origin)} میں کوئی سامان درج نہیں</p>}
      </section>

      <dl className="ocard__sec ocard__info">
        <div>
          <dt><Icon name="truck" size={15} strokeWidth={2.1} /> اڈے کا نام:</dt>
          <dd>{o.adda_name ? <UText>{o.adda_name}</UText> : <span className="muted">ابھی درج نہیں</span>}</dd>
        </div>
        <div>
          <dt><Icon name="phone" size={15} strokeWidth={2.1} /> فون:</dt>
          <dd>{o.customer.phone ? <Num>{o.customer.phone}</Num> : <span className="muted">درج نہیں</span>}</dd>
        </div>
      </dl>

      <BuiltyButton builty={o.builty} onUpload={onUpload} onView={onView} />
    </article>
  );
}

function FilterSheet({ open, onClose, params, setParams }) {
  const [f, setF] = useState({});
  useEffect(() => {
    if (open) setF({ status: params.get('status') || '', builty: params.get('builty') || '', origin: params.get('origin') || '', from: params.get('from') || '', to: params.get('to') || '' });
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const bad = f.from && f.to && f.from > f.to;
  function apply() {
    const next = new URLSearchParams(params);
    Object.entries(f).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    setParams(next, { replace: true });
    onClose();
  }
  return (
    <Sheet open={open} onClose={onClose} title="آرڈر فلٹر کریں"
      footer={<>
        <Button onClick={apply} disabled={bad}>آرڈر دکھائیں</Button>
        <Button variant="ghost" onClick={() => setF({ status: '', builty: '', origin: '', from: '', to: '' })}>سب صاف کریں</Button>
      </>}>
      <p className="sheet__label">آرڈر کی حالت</p>
      <div className="choices">
        {['', ...STATUSES].map((s) => (
          <button key={s || 'all'} type="button" className={cx('choice', f.status === s && 'is-on')} onClick={() => setF({ ...f, status: s })}>{s ? STATUS_LABEL[s] : 'سب'}</button>
        ))}
      </div>
      <p className="sheet__label">آرڈر کہاں سے آیا</p>
      <div className="choices">
        {[['', 'سب'], ['website', 'ویب سائٹ کے آرڈر'], ['erp', 'ERP کی سیلز']].map(([v, l]) => (
          <button key={l} type="button" className={cx('choice', f.origin === v && 'is-on')} onClick={() => setF({ ...f, origin: v })}>{l}</button>
        ))}
      </div>
      <p className="sheet__label">بلٹی کی تصاویر</p>
      <div className="choices">
        {[['', 'سب'], ['uploaded', BUILTY_FILTER.uploaded], ['partial', BUILTY_FILTER.partial], ['pending', BUILTY_FILTER.pending]].map(([v, l]) => (
          <button key={l} type="button" className={cx('choice', f.builty === v && 'is-on')} onClick={() => setF({ ...f, builty: v })}>{l}</button>
        ))}
      </div>
      <p className="sheet__label">ڈیلیوری کی تاریخ</p>
      <div className="daterow">
        <label className="field"><span className="field__label">اس تاریخ سے</span><DateField value={f.from} onChange={(v) => setF({ ...f, from: v })} ariaLabel="اس تاریخ سے" /></label>
        <label className="field"><span className="field__label">اس تاریخ تک</span><DateField value={f.to} onChange={(v) => setF({ ...f, to: v })} ariaLabel="اس تاریخ تک" /></label>
      </div>
      {bad && <p className="form-error"><Icon name="alert" size={16} /> <span>پہلی تاریخ دوسری تاریخ سے پہلے کی ہونی چاہیے۔</span></p>}
    </Sheet>
  );
}
