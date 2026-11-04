import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Api } from '../lib/api.js';
import { PAGE_SIZE, STATUSES, STATUS_LABEL, TABS } from '../config.js';
import { cx, dayLabel, dayLabelLong, relativeDay } from '../lib/format.js';
import { AppBar, Button, DateField, EmptyState, ErrorState, Icon, Notice, Num, Sheet, SkeletonCard, SlipTick, Spinner, StatusPill, UText } from '../components/ui.jsx';

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
  all: ['ابھی کوئی آرڈر نہیں', 'نئے آرڈر آتے ہی یہاں نظر آئیں گے۔'],
};

export default function Orders() {
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.key === params.get('tab')) ? params.get('tab') : 'today';
  const tabInfo = TABS.find((t) => t.key === tab);
  const filters = {
    status: params.get('status') || '',
    slip: params.get('slip') || '',
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
      setRows((prev) => {
        const next = mode === 'more' ? [...prev, ...r.data.filter((o) => !prev.some((p) => p.id === o.id))] : r.data;
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

  function setTab(t) {
    const next = new URLSearchParams(params);
    next.set('tab', t);
    setParams(next, { replace: true });
    window.scrollTo({ top: 0 });
  }
  const clearFilter = (k) => {
    const next = new URLSearchParams(params);
    next.delete(k);
    setParams(next, { replace: true });
  };

  const activeFilters = ['status', 'slip', 'from', 'to'].filter((k) => filters[k]).length;
  if (meta?.today) lastToday = meta.today;
  const today = meta?.today || lastToday;
  const searching = Boolean(dq) || activeFilters > 0;

  return (
    <div className="screen has-tabs">
      <AppBar
        className="appbar--home"
        title="انگلینڈ آرڈرز"
        sub={today ? <>آج: {dayLabelLong(today)}</> : 'آرڈر اور ڈیلیوری'}
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
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="گاہک کا نام، فون یا آرڈر نمبر"
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

      <main className="content" aria-busy={loading}>
        <section className="summary">
          <div className="summary__main">
            <h2 className="summary__title">{tabInfo.label}</h2>
            <p className="summary__sub">
              {searching ? 'تلاش / فلٹر کے مطابق' : tab === 'today' ? (today ? dayLabelLong(today) : 'آج کی ڈیلیوری') : tab === 'tomorrow' ? 'اگلے دن کی ڈیلیوری' : tab === 'previous' ? 'گزرے ہوئے دن' : 'ہر تاریخ کے آرڈر'}
            </p>
          </div>
          <div className="summary__count">
            <Num>{meta ? meta.total : counts ? counts[tab] : '–'}</Num>
            <span>آرڈر</span>
          </div>
        </section>

        {activeFilters > 0 && (
          <div className="chips">
            {filters.status && <Chip label={`حالت: ${STATUS_LABEL[filters.status]}`} onClear={() => clearFilter('status')} />}
            {filters.slip && <Chip label={filters.slip === 'uploaded' ? 'سلپ لگ گئی' : 'سلپ باقی ہے'} onClear={() => clearFilter('slip')} />}
            {filters.from && <Chip label={`${dayLabel(filters.from)} سے`} onClear={() => clearFilter('from')} />}
            {filters.to && <Chip label={`${dayLabel(filters.to)} تک`} onClear={() => clearFilter('to')} />}
          </div>
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

        <div className="olist">
          {rows.map((o) => <OrderCard key={o.id} o={o} today={today} onOpen={() => nav(`/orders/${o.id}`, { state: { code: o.code } })} />)}
        </div>
        {hasMore && <div ref={sentinel} className="more">{more ? <><Spinner /> مزید آرڈر لوڈ ہو رہے ہیں…</> : ' '}</div>}
        {meta && !hasMore && rows.length > 0 && <p className="end">بس، یہی تمام آرڈر ہیں</p>}
      </main>

      <nav className="tabbar" role="tablist" aria-label="آرڈر کی فہرستیں">
        {TABS.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={cx('tabbar__tab', tab === t.key && 'is-active')} onClick={() => setTab(t.key)}>
            <span className="tabbar__icon">
              <Icon name={t.icon} size={24} strokeWidth={tab === t.key ? 2.4 : 2.1} />
              <b className="tabbar__count"><Num>{counts ? counts[t.key] : '·'}</Num></b>
            </span>
            <span className="tabbar__label">{t.label}</span>
          </button>
        ))}
      </nav>

      <FilterSheet open={filterOpen} onClose={() => setFilterOpen(false)} params={params} setParams={setParams} />
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

function OrderCard({ o, onOpen, today }) {
  const date = o.effective_date;
  return (
    <button type="button" className={cx('ocard', o.slip.uploaded ? 'ocard--ok' : 'ocard--pending')} onClick={onOpen}>
      <div className="ocard__top">
        <div className="ocard__who">
          <UText className="ocard__name">{o.customer.name || 'نام درج نہیں'}</UText>
          <span className="ocard__code">آرڈر نمبر <Num>{o.code}</Num></span>
        </div>
        <SlipTick uploaded={o.slip.uploaded} size="lg" label={false} />
      </div>

      <div className="ocard__grid">
        <span className="ocard__cell">
          <Icon name="phone" size={16} />
          {o.customer.phone ? <Num>{o.customer.phone}</Num> : <span className="muted">فون نمبر نہیں</span>}
        </span>
        <span className="ocard__cell">
          <Icon name="calendar" size={16} />
          <span>ڈیلیوری: <b>{relativeDay(date, today)}</b></span>
        </span>
        <span className="ocard__cell">
          <Icon name="truck" size={16} />
          {o.pandi_name ? <span>پنڈی: <UText>{o.pandi_name}</UText></span> : <span className="muted">پنڈی ابھی درج نہیں</span>}
        </span>
      </div>

      <div className="ocard__foot">
        <StatusPill status={o.status} size="sm" />
        <SlipTick uploaded={o.slip.uploaded} />
      </div>
    </button>
  );
}

function FilterSheet({ open, onClose, params, setParams }) {
  const [f, setF] = useState({});
  useEffect(() => {
    if (open) setF({ status: params.get('status') || '', slip: params.get('slip') || '', from: params.get('from') || '', to: params.get('to') || '' });
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
        <Button variant="ghost" onClick={() => setF({ status: '', slip: '', from: '', to: '' })}>سب صاف کریں</Button>
      </>}>
      <p className="sheet__label">آرڈر کی حالت</p>
      <div className="choices">
        {['', ...STATUSES].map((s) => (
          <button key={s || 'all'} type="button" className={cx('choice', f.status === s && 'is-on')} onClick={() => setF({ ...f, status: s })}>{s ? STATUS_LABEL[s] : 'سب'}</button>
        ))}
      </div>
      <p className="sheet__label">پنڈی سلپ</p>
      <div className="choices">
        {[['', 'سب'], ['uploaded', 'سلپ لگ گئی'], ['pending', 'سلپ باقی ہے']].map(([v, l]) => (
          <button key={l} type="button" className={cx('choice', f.slip === v && 'is-on')} onClick={() => setF({ ...f, slip: v })}>{l}</button>
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
