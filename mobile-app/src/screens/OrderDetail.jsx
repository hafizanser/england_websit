import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Api } from '../lib/api.js';
import { cx, dateTime, dayLabel, dayLabelLong, money, relativeDay, telHref } from '../lib/format.js';
import { callNumber } from '../lib/native.js';
import { imageSrc } from '../lib/builty.js';
import { useUI } from '../state/app.jsx';
import { STATUS_LABEL, codeLabel, recordNoun, recordPath } from '../config.js';
import { AppBar, Button, DateField, ErrorState, Icon, LineQty, Notice, Num, OriginBadge, Sheet, SkeletonCard, Spinner, StatusPill, UText } from '../components/ui.jsx';
import { BuiltyButton, BuiltySides, SIDE_LABEL, SIDE_SHORT, builtyState } from '../components/Builty.jsx';

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

  return (
    <div className="screen">
      <AppBar back title={origin === 'erp' ? 'ERP سیل کی تفصیل' : 'آرڈر کی تفصیل'} sub={code ? <>{origin === 'erp' ? 'انوائس نمبر' : 'آرڈر نمبر'} <Num>{code}</Num></> : null}
        end={
          <button type="button" className="appbar__icon" onClick={() => load(true)} aria-label="تازہ کریں" disabled={refreshing || loading}>
            {refreshing ? <Spinner size={18} /> : <Icon name="refresh" size={20} strokeWidth={2.2} />}
          </button>
        } />

      <main className="content content--detail">
        {loading && !order && <div className="olist">{[0, 1, 2].map((i) => <SkeletonCard key={i} />)}</div>}
        {error && !order && <ErrorState error={error} onRetry={() => load()} />}
        {error && order && <Notice tone="error" icon="alert">{error.message}</Notice>}
        {order && (
          <>
            {/* ---- hero: same placement as the order card ---- */}
            <section className="card dhero">
              <div className="dhero__top">
                <UText as="h2" className="dhero__name">{order.customer.name || 'نام درج نہیں'}</UText>
                <span className="dhero__id"><span className="ocard__key">{order.origin === 'erp' ? 'انوائس نمبر' : 'آرڈر نمبر'}</span><Num>#{order.code}</Num></span>
                <span className="dhero__city">
                  <Icon name="pin" size={14} strokeWidth={2.2} /><span className="ocard__key">شہر:</span>
                  {order.customer.city ? <UText>{order.customer.city}</UText> : <span className="muted">درج نہیں</span>}
                </span>
              </div>
              <div className="dhero__meta">
                <OriginBadge origin={order.origin} />
                <StatusPill status={order.status} />
                <span className="dhero__date"><Icon name="calendar" size={15} strokeWidth={2.1} /> {dayLabelLong(order.order_date)} <Num>{order.order_date?.slice(0, 4)}</Num></span>
              </div>
            </section>

            {/* ---- customer information ---- */}
            <section className="card dcard">
              <div className="dcard__head"><h3><span className="dcard__ic"><Icon name="user" size={17} strokeWidth={2.1} /></span> گاہک کی معلومات</h3></div>
              <dl className="rows">
                <Row icon="pin" label="شہر">{order.customer.city ? <UText>{order.customer.city}</UText> : <span className="muted">درج نہیں</span>}</Row>
                <Row icon="truck" label="اڈے کا نام">{order.adda_name ? <UText>{order.adda_name}</UText> : <span className="muted">ابھی درج نہیں</span>}</Row>
                <Row icon="phone" label="فون">{order.customer.phone ? <Num>{order.customer.phone}</Num> : <span className="muted">درج نہیں</span>}</Row>
                <Row icon="store" label="پتہ">{order.customer.address ? <UText>{order.customer.address}</UText> : <span className="muted">درج نہیں</span>}</Row>
              </dl>
              {telHref(order.customer.phone) && (
                <a className="btn btn--call" href={telHref(order.customer.phone)} onClick={(e) => { e.preventDefault(); callNumber(telHref(order.customer.phone)); }}>
                  <Icon name="phone" size={19} strokeWidth={2.2} /> <span>گاہک کو کال کریں</span>
                </a>
              )}
            </section>

            {/* ---- products (quantities only, no prices) ---- */}
            <section className="card dcard">
              <div className="dcard__head">
                <h3><span className="dcard__ic"><Icon name="box" size={17} strokeWidth={2.1} /></span> {recordNoun(order.origin)} کا سامان</h3>
                <span className="dcard__count"><Num>{order.items.length}</Num> چیزیں</span>
              </div>
              <ul className="items">
                {order.items.map((it) => (
                  <li key={it.id} className="item">
                    <div className="item__main">
                      <UText className="item__name">{it.name}</UText>
                      {it.sub && <UText className="item__sub">{it.sub}</UText>}
                    </div>
                    <LineQty item={it} className="item__qty" />
                  </li>
                ))}
                {order.items.length === 0 && <li className="muted">اس {recordNoun(order.origin)} میں کوئی سامان درج نہیں</li>}
              </ul>
              {otherLines > 0 && (
                <p className="muted dcard__foot" data-testid="other-lines">
                  اس انوائس پر دوسری کمپنیوں کا <Num>{otherLines}</Num> سامان بھی ہے۔ وہ اس ایپ میں نہیں دکھایا گیا۔
                </p>
              )}
            </section>

            {/* ---- Builty ---- */}
            <BuiltySection builty={order.builty} code={order.code} onUpload={goUpload} onView={goView} />

            {/* ---- delivery ---- */}
            <section className="card dcard">
              <div className="dcard__head">
                <h3><span className="dcard__ic"><Icon name="calendar" size={17} strokeWidth={2.1} /></span> ڈیلیوری کی معلومات</h3>
                <button type="button" className="chip-btn" onClick={() => setEditOpen(true)}><Icon name="edit" size={16} strokeWidth={2.1} /> <span>تبدیل کریں</span></button>
              </div>
              <dl className="rows">
                <Row label="ڈیلیوری کی تاریخ">
                  {order.delivery_date ? <b>{relativeDay(order.delivery_date, order.today)} <small className="muted">({dayLabel(order.delivery_date)})</small></b> : <span className="muted">{order.origin === 'erp' ? 'انوائس' : 'آرڈر'} والے دن ({dayLabel(order.order_date)})</span>}
                </Row>
                <Row label="پنڈی کا نام">{order.pandi_name ? <UText className="strong">{order.pandi_name}</UText> : <span className="muted">ابھی درج نہیں</span>}</Row>
                <Row label="اڈے کا نام">{order.adda_name ? <UText className="strong">{order.adda_name}</UText> : <span className="muted">ابھی درج نہیں</span>}</Row>
                <Row label={`${recordNoun(order.origin)} کی حالت`}>{STATUS_LABEL[order.status] || order.status}</Row>
              </dl>
              {(order.pandi_from_erp || order.adda_from_erp) && (
                <p className="muted dcard__foot">پنڈی / اڈے کا نام ERP انوائس سے لیا گیا ہے۔ یہاں بدلیں گے تو صرف اس ایپ میں محفوظ ہو گا، ERP میں نہیں۔</p>
              )}
            </section>

            {/* ---- amount + where the record comes from ---- */}
            <section className="card dcard">
              <div className="dcard__head"><h3><span className="dcard__ic"><Icon name="receipt" size={17} strokeWidth={2.1} /></span> رقم اور ریکارڈ</h3></div>
              <dl className="rows">
                <Row label={order.origin === 'erp' ? 'پوری انوائس کی رقم' : 'کل رقم'}><b><Num>{money(order.total)}</Num></b></Row>
                <Row label="ریکارڈ کہاں سے">{order.origin === 'erp' ? 'Accountrix ERP سیل' : 'انگلینڈ ویب سائٹ / ڈیش بورڈ آرڈر'}</Row>
                {order.origin === 'erp' && order.erp && (
                  <>
                    <Row label="ERP انوائس نمبر"><Num>{order.erp.invoice_no}</Num></Row>
                    {order.erp.offline_no && <Row label="آف لائن نمبر"><Num>{order.erp.offline_no}</Num></Row>}
                    {order.erp.vehicle && <Row label="گاڑی"><UText>{order.erp.vehicle}</UText></Row>}
                  </>
                )}
              </dl>
              {otherLines > 0 && (
                <p className="muted dcard__foot" data-testid="whole-invoice-total">
                  یہ رقم پوری ERP انوائس کی ہے، جس میں دوسری کمپنیوں کا سامان بھی شامل ہے۔ صرف انگلینڈ کے سامان کی رقم ERP سے نہیں آتی۔
                </p>
              )}
            </section>

            {(order.note || order.history?.length > 0) && (
              <section className="card dcard">
                <div className="dcard__head"><h3><span className="dcard__ic"><Icon name="note" size={17} strokeWidth={2.1} /></span> {order.origin === 'erp' ? 'ERP انوائس کا نوٹ' : 'نوٹ اور آرڈر کی کہانی'}</h3></div>
                {order.note && <UText as="p" className="note">{order.note}</UText>}
                {order.history?.length > 0 && (
                  <ol className="timeline">
                    {order.history.map((h, i) => (
                      <li key={i}><StatusPill status={h.status} size="sm" /><span className="muted">{dateTime(h.at)}</span>{h.note && <UText as="em">{h.note}</UText>}</li>
                    ))}
                  </ol>
                )}
              </section>
            )}
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

/** Tapping anywhere on this section opens the Builty viewer (the same screen as the green card button); with no photo yet it opens the upload screen. */
function BuiltySection({ builty, code, onUpload, onView }) {
  const st = builtyState(builty);
  const open = st.kind === 'none' ? onUpload : onView;
  const key = (e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); open(); } };
  const last = [builty?.front?.uploaded_at, builty?.back?.uploaded_at].filter(Boolean).sort().pop();
  return (
    <section className={cx('card dcard bcard', `bcard--${st.kind}`)} role="link" tabIndex={0} onClick={open} onKeyDown={key}
      aria-label={st.kind === 'none' ? 'بلٹی کی تصویر اپلوڈ کریں' : 'بلٹی کی تصاویر دیکھیں'}>
      <div className="dcard__head">
        <h3><span className="dcard__ic"><Icon name="receipt" size={17} strokeWidth={2.1} /></span> بلٹی کی تصاویر</h3>
        <BuiltySides builty={builty} />
      </div>
      <div className="bthumbs">
        {['front', 'back'].map((side) => {
          const b = builty?.[side];
          return b?.uploaded ? (
            <figure key={side} className="bthumb">
              <img src={imageSrc(b)} alt={`${code} — ${SIDE_LABEL[side]}`} loading="lazy" />
              <figcaption className="bthumb__cap"><Icon name="check" size={13} strokeWidth={3} /> <span>{SIDE_SHORT[side]}</span></figcaption>
            </figure>
          ) : (
            <figure key={side} className="bthumb bthumb--empty">
              <Icon name="imageUp" size={26} strokeWidth={1.8} />
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

function Row({ icon, label, children }) {
  return (
    <div className="rows__row">
      <dt>{icon && <Icon name={icon} size={17} />}{label}</dt>
      <dd>{children}</dd>
    </div>
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
