import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Api } from '../lib/api.js';
import { DATE_TAB_LABEL, cx, dateTab, dateParts, dateTime, dayLabel, money, pkDay, relativeDay, telHref, timeOnly } from '../lib/format.js';
import { callNumber } from '../lib/native.js';
import { imageSrc } from '../lib/builty.js';
import { useUI } from '../state/app.jsx';
import { codeLabel, recordNoun, recordPath, sourceLabel } from '../config.js';
import { AppBar, Button, DateField, ErrorState, Icon, LineQty, Notice, Num, Sheet, SkeletonCard, Spinner, StatusPill, UText } from '../components/ui.jsx';
import { BuiltyButton, BuiltySides, SIDE_LABEL, SIDE_SHORT, builtyState } from '../components/Builty.jsx';
import '../styles/detail.css';

/*
 * Order / ERP sale details.
 *
 * The hero answers "یہ آرڈر کب کا ہے؟": the date category (آج / کل / پرانا), worked out exactly
 * like the server's tabs — the effective date (delivery date if set, else the order / invoice day)
 * against the server's business today (Asia/Karachi) — then the real order date and time and the
 * exact source (fmcg_orders.source). The stored status is never replaced; it is shown on its own
 * only when it says something beyond "new" (e.g. روانہ / ڈیلیور / منسوخ).
 */

const TAB_ICON = { today: 'today', tomorrow: 'tomorrow', previous: 'history', upcoming: 'calendar' };
const SOURCE_ICON = { website: 'store', admin: 'dashboard', erp: 'receipt' };
/** Statuses that are just the starting state of a record — not worth a badge. */
const QUIET_STATUS = new Set(['pending', 'posted']);

/** Date category chip: آج کا آرڈر / کل کا آرڈر / پرانا آرڈر (/ آنے والا آرڈر after tomorrow). */
export function DateTabChip({ tab, size = 'md', className }) {
  if (!tab) return null;
  return (
    <span className={cx('dtab', `dtab--${tab}`, size === 'sm' && 'dtab--sm', className)} data-testid="date-tab">
      <Icon name={TAB_ICON[tab]} size={size === 'sm' ? 13 : 16} strokeWidth={2.3} />
      <span>{DATE_TAB_LABEL[tab]}</span>
    </span>
  );
}

export default function OrderDetail({ origin = 'website' }) {
  const { id } = useParams();
  const loc = useLocation();
  const nav = useNavigate();
  const ui = useUI();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true); else setRefreshing(true);
    setError(null);
    try {
      const r = await Api.order(id, undefined, origin);
      setOrder(r.order);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [id, origin]);
  useEffect(() => { load(); }, [load]);

  const code = order?.code || loc.state?.code || '';
  const goUpload = () => nav(`${recordPath(origin, id)}/builty/upload`, { state: { code } });
  const goView = () => nav(`${recordPath(origin, id)}/builty`, { state: { code } });

  // Mixed ERP invoice: lines of other companies are left out by the ERP feed (only counted).
  const otherLines = order?.origin === 'erp' ? Number(order.erp?.other_company_lines || 0) : 0;
  const tab = order ? dateTab(order.effective_date, order.today) : null;

  return (
    <div className="screen">
      <AppBar back title={origin === 'erp' ? 'ERP سیل کی تفصیل' : 'آرڈر کی تفصیل'} sub={code ? <>{codeLabel(origin)} <Num>{code}</Num></> : null}
        end={
          <button type="button" className="appbar__icon" onClick={() => load(true)} aria-label="تازہ کریں" disabled={refreshing || loading}>
            {refreshing ? <Spinner size={18} /> : <Icon name="refresh" size={20} strokeWidth={2.2} />}
          </button>
        } />

      <main className="content content--detail od">
        {loading && !order && <div className="olist">{[0, 1, 2].map((i) => <SkeletonCard key={i} />)}</div>}
        {error && !order && <ErrorState error={error} onRetry={() => load()} />}
        {error && order && <Notice tone="error" icon="alert">{error.message}</Notice>}
        {order && (
          <>
            <Hero order={order} tab={tab} />

            {order.status === 'cancelled' && (
              <Notice tone="error" icon="alert">یہ {recordNoun(order.origin)} منسوخ ہو چکا ہے۔ ڈیلیوری سے پہلے دفتر سے تصدیق کریں۔</Notice>
            )}

            <CustomerCard order={order} />

            {/* ---- products (quantities only, no prices) ---- */}
            <section className="card od-card">
              <CardHead icon="box" title={`${recordNoun(order.origin)} کا سامان`}
                end={<span className="od-count"><Num>{order.items.length}</Num> چیزیں</span>} />
              <ul className="od-items">
                {order.items.map((it, i) => (
                  <li key={it.id} className="od-item">
                    <span className="od-item__n"><Num>{i + 1}</Num></span>
                    <div className="od-item__main">
                      <UText className="item__name od-item__name">{it.name}</UText>
                      {it.sub && <UText className="od-item__sub">{it.sub}</UText>}
                    </div>
                    <LineQty item={it} className="item__qty od-item__qty" />
                  </li>
                ))}
                {order.items.length === 0 && <li className="muted od-empty">اس {recordNoun(order.origin)} میں کوئی سامان درج نہیں</li>}
              </ul>
              {otherLines > 0 && (
                <p className="od-foot" data-testid="other-lines">
                  <Icon name="info" size={15} /> <span>اس انوائس پر دوسری کمپنیوں کا <Num>{otherLines}</Num> سامان بھی ہے۔ وہ اس ایپ میں نہیں دکھایا گیا۔</span>
                </p>
              )}
            </section>

            {/* ---- delivery: date, Pandi, Adda ---- */}
            <section className="card od-card">
              <CardHead icon="truck" title="ڈیلیوری"
                end={<button type="button" className="chip-btn" onClick={() => setEditOpen(true)}><Icon name="edit" size={16} strokeWidth={2.1} /> <span>تبدیل کریں</span></button>} />
              <dl className="od-facts">
                <Fact icon="calendar" label="ڈیلیوری کی تاریخ">
                  {order.delivery_date
                    ? <b>{relativeDay(order.delivery_date, order.today)} <small className="muted">({dayLabel(order.delivery_date)})</small></b>
                    : <span className="muted">{order.origin === 'erp' ? 'انوائس' : 'آرڈر'} والے دن</span>}
                </Fact>
                <Fact icon="user" label="پنڈی کا نام">{order.pandi_name ? <UText className="strong">{order.pandi_name}</UText> : <span className="muted">ابھی درج نہیں</span>}</Fact>
                <Fact icon="pin" label="اڈے کا نام">{order.adda_name ? <UText className="strong">{order.adda_name}</UText> : <span className="muted">ابھی درج نہیں</span>}</Fact>
              </dl>
              {(order.pandi_from_erp || order.adda_from_erp) && (
                <p className="od-foot"><Icon name="info" size={15} /> <span>پنڈی / اڈے کا نام ERP انوائس سے لیا گیا ہے۔ یہاں بدلیں گے تو صرف اس ایپ میں محفوظ ہو گا، ERP میں نہیں۔</span></p>
              )}
            </section>

            {/* ---- Builty ---- */}
            <BuiltySection builty={order.builty} code={order.code} onUpload={goUpload} onView={goView} />

            {/* ---- amount (+ ERP invoice details) ---- */}
            <section className="card od-card">
              <CardHead icon="cash" title={order.origin === 'erp' ? 'رقم اور انوائس' : 'رقم'} />
              <dl className="od-facts">
                <Fact label={order.origin === 'erp' ? 'پوری انوائس کی رقم' : 'کل رقم'}><b className="od-amount"><Num>{money(order.total)}</Num></b></Fact>
                {order.origin === 'erp' && order.erp?.offline_no && <Fact label="آف لائن نمبر"><Num>{order.erp.offline_no}</Num></Fact>}
                {order.origin === 'erp' && order.erp?.vehicle && <Fact label="گاڑی"><UText>{order.erp.vehicle}</UText></Fact>}
              </dl>
              {otherLines > 0 && (
                <p className="od-foot" data-testid="whole-invoice-total">
                  <Icon name="info" size={15} /> <span>یہ رقم پوری ERP انوائس کی ہے، جس میں دوسری کمپنیوں کا سامان بھی شامل ہے۔ صرف انگلینڈ کے سامان کی رقم ERP سے نہیں آتی۔</span>
                </p>
              )}
            </section>

            {(order.note || order.history?.length > 0) && <HistoryCard order={order} tab={tab} />}
          </>
        )}
      </main>

      {order && (
        <EditDeliverySheet open={editOpen} onClose={() => setEditOpen(false)} order={order}
          onSaved={(o) => { setOrder(o); ui.toast('ڈیلیوری کی معلومات محفوظ ہو گئیں', 'ok'); }} />
      )}
    </div>
  );
}

/** "یہ آرڈر کب کا ہے؟" — category, real date + time, number and exact source. */
function Hero({ order, tab }) {
  const erp = order.origin === 'erp';
  const p = dateParts(order.order_date);
  // ERP: the time is when the sale was made in the ERP; show it only when that is the invoice day itself.
  const time = order.placed_at && (!erp || pkDay(order.placed_at) === order.order_date) ? timeOnly(order.placed_at) : null;
  const moved = order.delivery_date && order.delivery_date !== order.order_date;
  const showStatus = order.status && !QUIET_STATUS.has(order.status) && order.status !== 'cancelled';
  return (
    <section className={cx('card od-hero', tab && `od-hero--${tab}`)} aria-label="یہ آرڈر کب کا ہے">
      <div className="od-hero__top">
        <DateTabChip tab={tab} />
        <span className="od-hero__code"><span className="od-hero__codekey">{codeLabel(order.origin)}</span><Num>#{order.code}</Num></span>
      </div>

      <div className="od-when">
        {p ? (
          <>
            <span className="od-when__day">{p.day}</span>
            <span className="od-when__date"><Num>{p.num}</Num> {p.month} <Num>{p.year}</Num></span>
          </>
        ) : <span className="od-when__date muted">{erp ? 'انوائس' : 'آرڈر'} کی تاریخ دستیاب نہیں</span>}
        {time && <span className="od-when__time" data-testid="order-time"><Icon name="clock" size={15} strokeWidth={2.3} /> {time}</span>}
      </div>
      <p className="od-when__cap">{erp ? 'انوائس کی تاریخ' : 'آرڈر کی تاریخ'}{time ? ' اور وقت' : ''}</p>

      {moved && (
        <p className="od-moved" data-testid="moved-delivery">
          <Icon name="truck" size={15} strokeWidth={2.2} />
          <span>ڈیلیوری: <b>{relativeDay(order.delivery_date, order.today)}</b>{relativeDay(order.delivery_date, order.today) !== dayLabel(order.delivery_date) && <> ({dayLabel(order.delivery_date)})</>}</span>
        </p>
      )}

      <div className="od-hero__foot">
        <span className={cx('od-source', `od-source--${order.source || 'unknown'}`)} data-testid="order-source">
          <Icon name={SOURCE_ICON[order.source] || 'info'} size={15} strokeWidth={2.2} />
          <span className="od-source__key">ذریعہ:</span>
          <b><UText>{sourceLabel(order.source)}</UText></b>
        </span>
        {showStatus && <StatusPill status={order.status} size="sm" />}
      </div>
    </section>
  );
}

function CustomerCard({ order }) {
  const tel = telHref(order.customer.phone);
  return (
    <section className="card od-card od-cust">
      <CardHead icon="user" title="گاہک" />
      <div className="od-cust__id">
        <div className="od-cust__who">
          <UText as="h2" className="od-cust__name">{order.customer.name || 'نام درج نہیں'}</UText>
          <span className="od-cust__city"><Icon name="pin" size={14} strokeWidth={2.2} />{order.customer.city ? <UText>{order.customer.city}</UText> : <span className="muted">شہر درج نہیں</span>}</span>
        </div>
      </div>
      <dl className="od-facts">
        <Fact icon="phone" label="فون">{order.customer.phone ? <Num>{order.customer.phone}</Num> : <span className="muted">درج نہیں</span>}</Fact>
        <Fact icon="store" label="پتہ">{order.customer.address ? <UText>{order.customer.address}</UText> : <span className="muted">درج نہیں</span>}</Fact>
      </dl>
      {tel && (
        <a className="btn btn--call od-callbtn" href={tel} onClick={(e) => { e.preventDefault(); callNumber(tel); }}>
          <Icon name="phone" size={19} strokeWidth={2.2} /> <span>گاہک کو کال کریں</span>
        </a>
      )}
    </section>
  );
}

/** Note + timeline. The opening "new order" entry carries the date category instead of a bare "نیا آرڈر"; later entries keep their real status. */
function HistoryCard({ order, tab }) {
  return (
    <section className="card od-card">
      <CardHead icon="note" title={order.origin === 'erp' ? 'ERP انوائس کا نوٹ' : 'نوٹ اور آرڈر کی کہانی'} />
      {order.note && <UText as="p" className="od-note">{order.note}</UText>}
      {order.history?.length > 0 && (
        <ol className="od-timeline">
          {order.history.map((h, i) => (
            <li key={i} className="od-timeline__item">
              <span className="od-timeline__dot" aria-hidden="true" />
              <div className="od-timeline__body">
                <div className="od-timeline__top">
                  {i === 0 && h.status === 'pending' ? <DateTabChip tab={tab} size="sm" /> : <StatusPill status={h.status} size="sm" />}
                  <span className="od-timeline__at">{dateTime(h.at)}</span>
                </div>
                {h.note && <UText as="p" className="od-timeline__note">{h.note}</UText>}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function CardHead({ icon, title, end }) {
  return (
    <div className="od-head">
      <h3><span className="od-head__ic"><Icon name={icon} size={17} strokeWidth={2.1} /></span> {title}</h3>
      {end}
    </div>
  );
}

function Fact({ icon, label, children }) {
  return (
    <div className="od-fact">
      <dt className="od-fact__k">{icon && <Icon name={icon} size={16} />}<span>{label}</span></dt>
      <dd className="od-fact__v">{children}</dd>
    </div>
  );
}

/** Tapping anywhere on this section opens the Builty viewer (the same screen as the button); with no photo yet it opens the upload screen. */
function BuiltySection({ builty, code, onUpload, onView }) {
  const st = builtyState(builty);
  const open = st.kind === 'none' ? onUpload : onView;
  const key = (e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); open(); } };
  const last = [builty?.front?.uploaded_at, builty?.back?.uploaded_at].filter(Boolean).sort().pop();
  return (
    <section className={cx('card od-card bcard', `bcard--${st.kind}`, st.kind === 'none' && 'od-bcard--none')} role="link" tabIndex={0} onClick={open} onKeyDown={key}
      aria-label={st.kind === 'none' ? 'بلٹی کی تصویر اپلوڈ کریں' : 'بلٹی کی تصاویر دیکھیں'}>
      <CardHead icon="receipt" title="بلٹی" end={<BuiltySides builty={builty} />} />
      <div className="bthumbs od-bthumbs">
        {['front', 'back'].map((side) => {
          const b = builty?.[side];
          return b?.uploaded ? (
            <figure key={side} className="bthumb">
              <img src={imageSrc(b)} alt={`${code} — ${SIDE_LABEL[side]}`} loading="lazy" />
              <figcaption className="bthumb__cap"><Icon name="check" size={13} strokeWidth={3} /> <span>{SIDE_SHORT[side]}</span></figcaption>
            </figure>
          ) : (
            <figure key={side} className="bthumb bthumb--empty od-bthumb--empty">
              <Icon name="imageUp" size={22} strokeWidth={1.9} />
              <span>{SIDE_LABEL[side]}</span>
              <small>ابھی نہیں لگی</small>
            </figure>
          );
        })}
      </div>
      {last && <p className="bcard__meta">آخری بار لگانے کا وقت: {dateTime(last)}</p>}
      <BuiltyButton builty={builty} onUpload={onUpload} onView={onView} />
    </section>
  );
}

function EditDeliverySheet({ open, onClose, order, onSaved }) {
  const ui = useUI();
  const initial = { delivery_date: order.delivery_date || '', pandi_name: order.pandi_name || '', adda_name: order.adda_name || '' };
  const [f, setF] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  useEffect(() => {
    if (open) { setF({ delivery_date: order.delivery_date || '', pandi_name: order.pandi_name || '', adda_name: order.adda_name || '' }); setErr(null); }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const changed = f.delivery_date !== initial.delivery_date || f.pandi_name.trim() !== initial.pandi_name || f.adda_name.trim() !== initial.adda_name;

  // Closing with unsaved typing asks first, so a stray back gesture does not lose it.
  const close = useCallback(() => {
    if (busy) return;
    if (!changed) { onClose(); return; }
    ui.confirm({ title: 'تبدیلیاں محفوظ نہیں ہوئیں', body: 'آپ نے جو لکھا ہے وہ محفوظ نہیں ہوا۔ کیا بغیر محفوظ کیے بند کرنا ہے؟', okLabel: 'بند کریں', danger: true, cancelLabel: 'لکھتے رہیں', onOk: onClose });
  }, [busy, changed, onClose, ui]);

  async function save() {
    setBusy(true); setErr(null);
    try {
      const r = await Api.updateDelivery(order.id, order.code, f, order.origin);
      onSaved(r.order);
      onClose();
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(false);
    }
  }
  const fieldErr = (k) => err?.fields?.[k];
  return (
    <Sheet open={open} onClose={close} title="ڈیلیوری کی معلومات"
      lead={<>{codeLabel(order.origin)} <Num>{order.code}</Num> · <UText>{order.customer.name}</UText></>}
      footer={<>
        <Button onClick={save} disabled={busy || !changed} busy={busy}>{busy ? <><Spinner size={18} /> محفوظ ہو رہا ہے…</> : 'محفوظ کریں'}</Button>
        <Button variant="ghost" onClick={close} disabled={busy}>واپس</Button>
      </>}>
      <Notice tone="info" className="notice--flush">صرف یہ تین چیزیں بدلیں گی۔ سامان، اسٹاک اور {recordNoun(order.origin)} کی حالت پر کوئی اثر نہیں پڑے گا۔</Notice>
      <label className="field">
        <span className="field__label">ڈیلیوری کی تاریخ <small>(خالی چھوڑیں تو {order.origin === 'erp' ? 'انوائس' : 'آرڈر'} والا دن: {dayLabel(order.order_date)})</small></span>
        <span className="input-wrap">
          <DateField value={f.delivery_date} onChange={(v) => setF({ ...f, delivery_date: v })} placeholder={order.origin === 'erp' ? 'انوائس والا دن' : 'آرڈر والا دن'} ariaLabel="ڈیلیوری کی تاریخ" />
          {f.delivery_date && <button type="button" className="input-wrap__btn" onClick={() => setF({ ...f, delivery_date: '' })}>ہٹائیں</button>}
        </span>
        {fieldErr('delivery_date') && <small className="field__error">{fieldErr('delivery_date')}</small>}
      </label>
      <label className="field">
        <span className="field__label">پنڈی کا نام</span>
        <input className="input input--ur" dir="auto" maxLength={120} value={f.pandi_name} placeholder="مثلاً نیازی پنڈی" onChange={(e) => setF({ ...f, pandi_name: e.target.value })} />
        {fieldErr('pandi_name') && <small className="field__error">{fieldErr('pandi_name')}</small>}
      </label>
      <label className="field">
        <span className="field__label">اڈے کا نام</span>
        <input className="input input--ur" dir="auto" maxLength={120} value={f.adda_name} placeholder="مثلاً پیر ودھائی اڈا" onChange={(e) => setF({ ...f, adda_name: e.target.value })} />
        {fieldErr('adda_name') && <small className="field__error">{fieldErr('adda_name')}</small>}
      </label>
      {err && !err.fields && <p className="form-error" role="alert"><Icon name="alert" size={17} /> <span>{err.message}</span></p>}
    </Sheet>
  );
}
