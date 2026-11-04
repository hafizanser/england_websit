import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { Api } from '../lib/api.js';
import { pushBack } from '../lib/backstack.js';
import { bytes, cx, dateTime, dayLabel, dayLabelLong, money, relativeDay, telHref, unitUr } from '../lib/format.js';
import { ImageError, prepareSlip } from '../lib/image.js';
import { PickCancelled, callNumber, pickPhoto, shareOrSave } from '../lib/native.js';
import { useUI } from '../state/app.jsx';
import { STATUS_LABEL } from '../config.js';
import { AppBar, Button, DateField, ErrorState, Icon, Notice, Num, Sheet, SkeletonCard, SlipTick, Spinner, StatusPill, UText } from '../components/ui.jsx';

// Slip images are private: fetched with the token, shown as object URLs, cached per order + version.
const slipCache = new Map();

function useSlipImage(slip) {
  const [state, setState] = useState({ url: null, blob: null, loading: false, error: null });
  const key = slip?.uploaded ? slip.url : null;
  const load = useCallback(async () => {
    if (!key) { setState({ url: null, blob: null, loading: false, error: null }); return; }
    const hit = slipCache.get(key);
    if (hit) { setState({ ...hit, loading: false, error: null }); return; }
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const blob = await Api.slipBlob(key);
      const v = { url: URL.createObjectURL(blob), blob };
      slipCache.set(key, v);
      setState({ ...v, loading: false, error: null });
    } catch (e) {
      setState({ url: null, blob: null, loading: false, error: e });
    }
  }, [key]);
  useEffect(() => { load(); }, [load]);
  return { ...state, reload: load };
}

export default function OrderDetail() {
  const { id } = useParams();
  const loc = useLocation();
  const ui = useUI();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [upload, setUpload] = useState(null); // null | 'camera' | 'gallery' — the sheet opens on the picked photo
  const [viewer, setViewer] = useState(false);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true); else setRefreshing(true);
    setError(null);
    try {
      const r = await Api.order(id);
      setOrder(r.order);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const slipImg = useSlipImage(order?.slip);
  const code = order?.code || loc.state?.code || '';

  function startUpload(source) {
    if (order?.slip.uploaded) {
      ui.confirm({
        title: 'سلپ تبدیل کریں؟',
        body: `آرڈر ${order.code} کے ساتھ پہلے سے سلپ لگی ہوئی ہے۔ نئی سلپ محفوظ ہونے پر پرانی سلپ ہٹ جائے گی۔`,
        okLabel: 'ہاں، تبدیل کریں',
        onOk: () => setUpload(source),
      });
    } else {
      setUpload(source);
    }
  }

  return (
    <div className="screen">
      <AppBar back title="آرڈر کی تفصیل" sub={code ? <>آرڈر نمبر <Num>{code}</Num></> : null}
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
            {/* ---- customer ---- */}
            <section className="card dcard dcard--hero">
              <div className="dhero__top">
                <span className="dhero__code">آرڈر نمبر <Num>{order.code}</Num></span>
                <StatusPill status={order.status} />
              </div>
              <UText as="h2" className="dhero__name">{order.customer.name || 'نام درج نہیں'}</UText>
              {telHref(order.customer.phone) ? (
                <a className="btn btn--call" href={telHref(order.customer.phone)} onClick={(e) => { e.preventDefault(); callNumber(telHref(order.customer.phone)); }}>
                  <Icon name="phone" size={20} strokeWidth={2.2} /> <span>کال کریں</span> <Num>{order.customer.phone}</Num>
                </a>
              ) : <p className="muted">اس گاہک کا فون نمبر درج نہیں</p>}
              <dl className="rows">
                <Row icon="pin" label="پتہ">{order.customer.address ? <UText>{order.customer.address}</UText> : <span className="muted">درج نہیں</span>}</Row>
                <Row icon="store" label="شہر">{order.customer.city ? <UText>{order.customer.city}</UText> : <span className="muted">درج نہیں</span>}</Row>
                <Row icon="calendar" label="آرڈر کی تاریخ">{dayLabelLong(order.order_date)} <Num>{order.order_date?.slice(0, 4)}</Num></Row>
              </dl>
            </section>

            {/* ---- delivery ---- */}
            <section className="card dcard">
              <div className="dcard__head">
                <h3><Icon name="truck" size={20} /> ڈیلیوری کی معلومات</h3>
                <button type="button" className="chip-btn" onClick={() => setEditOpen(true)}><Icon name="edit" size={17} /> تبدیل کریں</button>
              </div>
              <dl className="rows">
                <Row label="ڈیلیوری کی تاریخ">
                  {order.delivery_date ? <b>{relativeDay(order.delivery_date, order.today)} <small className="muted">({dayLabel(order.delivery_date)})</small></b> : <span className="muted">آرڈر والے دن ({dayLabel(order.order_date)})</span>}
                </Row>
                <Row label="پنڈی کا نام">{order.pandi_name ? <UText className="strong">{order.pandi_name}</UText> : <span className="muted">ابھی درج نہیں</span>}</Row>
                <Row label="اڈے کا نام">{order.adda_name ? <UText className="strong">{order.adda_name}</UText> : <span className="muted">ابھی درج نہیں</span>}</Row>
                <Row label="آرڈر کی حالت">{STATUS_LABEL[order.status] || order.status}</Row>
              </dl>
            </section>

            {/* ---- Pandi slip ---- */}
            <section className={cx('card dcard slipcard', order.slip.uploaded ? 'slipcard--ok' : 'slipcard--pending')}>
              <div className="dcard__head">
                <h3><Icon name="receipt" size={20} /> پنڈی سلپ</h3>
                <SlipTick uploaded={order.slip.uploaded} />
              </div>
              {order.slip.uploaded ? (
                <>
                  <button type="button" className="slipthumb" onClick={() => slipImg.url && setViewer(true)} aria-label="سلپ بڑی کر کے دیکھیں" disabled={!slipImg.url}>
                    {slipImg.url ? <img src={slipImg.url} alt={`آرڈر ${order.code} کی پنڈی سلپ`} />
                      : slipImg.error ? <span className="slipthumb__msg">سلپ کی تصویر نہیں کھل سکی</span> : <Spinner size={26} />}
                    {slipImg.url && <span className="slipthumb__zoom"><Icon name="zoom" size={20} strokeWidth={2.2} /> بڑا کر کے دیکھیں</span>}
                  </button>
                  {slipImg.error && <Button variant="ghost" size="sm" onClick={slipImg.reload}><Icon name="refresh" size={17} /> دوبارہ کوشش کریں</Button>}
                  <p className="slipcard__meta">
                    لگانے کا وقت: {dateTime(order.slip.uploaded_at)} · <Num>{bytes(order.slip.size)}</Num>
                  </p>
                  <div className="btnrow">
                    <Button variant="soft" disabled={!slipImg.blob} onClick={() => share(slipImg.blob, order.code, ui)}><Icon name="download" size={19} /> سلپ محفوظ یا شیئر کریں</Button>
                    <Button variant="ghost" onClick={() => startUpload('choose')}><Icon name="camera" size={19} /> سلپ تبدیل کریں</Button>
                  </div>
                </>
              ) : (
                <>
                  <p className="slipcard__empty">اس آرڈر کی پنڈی سلپ ابھی نہیں لگی۔ سلپ کی تصویر کھینچیں یا گیلری سے منتخب کریں۔</p>
                  <div className="pickgrid">
                    <button type="button" className="pick" onClick={() => startUpload('camera')}><Icon name="camera" size={30} /><span>تصویر کھینچیں</span></button>
                    <button type="button" className="pick" onClick={() => startUpload('gallery')}><Icon name="image" size={30} /><span>گیلری سے لیں</span></button>
                  </div>
                </>
              )}
            </section>

            {/* ---- products ---- */}
            <section className="card dcard">
              <div className="dcard__head">
                <h3><Icon name="box" size={20} /> سامان</h3>
                <span className="muted"><Num>{order.items.length}</Num> چیزیں</span>
              </div>
              <ul className="items">
                {order.items.map((it) => (
                  <li key={it.id} className="item">
                    <div className="item__main">
                      <UText className="item__name">{it.name}</UText>
                      {it.sub && <UText className="item__sub">{it.sub}</UText>}
                      <span className="item__qty">
                        <b className="item__badge"><Num>{it.qty}</Num> {unitUr(it.unit)}</b>
                        <span className="muted">× <Num>{money(it.unit_price)}</Num></span>
                      </span>
                    </div>
                    <div className="item__total">
                      {Number(it.discount) > 0 && <s><Num>{money(it.line_total)}</Num></s>}
                      <Num>{money(it.net_total ?? it.line_total)}</Num>
                    </div>
                  </li>
                ))}
              </ul>
              <dl className="totals">
                <div><dt>سامان کی رقم</dt><dd><Num>{money(order.totals.subtotal)}</Num></dd></div>
                {Number(order.totals.item_discount) > 0 && <div><dt>رعایت</dt><dd>− <Num>{money(order.totals.item_discount)}</Num></dd></div>}
                {Number(order.totals.promo_discount) > 0 && <div><dt>کوپن رعایت {order.totals.promo_code && <Num>({order.totals.promo_code})</Num>}</dt><dd>− <Num>{money(order.totals.promo_discount)}</Num></dd></div>}
                <div><dt>ڈیلیوری چارجز</dt><dd>{Number(order.totals.delivery) > 0 ? <Num>{money(order.totals.delivery)}</Num> : 'مفت'}</dd></div>
                <div className="totals__grand"><dt>کل رقم</dt><dd><Num>{money(order.totals.total)}</Num></dd></div>
              </dl>
            </section>

            {/* ---- payment ---- */}
            <section className="card dcard">
              <div className="dcard__head"><h3><Icon name="cash" size={20} /> ادائیگی</h3></div>
              {order.payment
                ? <dl className="rows">{Object.entries(order.payment).map(([k, v]) => <Row key={k} label={k}><Num>{String(v)}</Num></Row>)}</dl>
                : <p className="muted">ویب سائٹ پر اس آرڈر کی کوئی ادائیگی درج نہیں — رقم ڈیلیوری پر نقد وصول ہو گی۔</p>}
            </section>

            {(order.note || order.history?.length > 0) && (
              <section className="card dcard">
                <div className="dcard__head"><h3><Icon name="note" size={20} /> نوٹ اور آرڈر کی کہانی</h3></div>
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
        <>
          <EditDeliverySheet open={editOpen} onClose={() => setEditOpen(false)} order={order}
            onSaved={(o) => { setOrder(o); ui.toast('ڈیلیوری کی معلومات محفوظ ہو گئیں', 'ok'); }} />
          <UploadSheet source={upload} onClose={() => setUpload(null)} order={order}
            onUploaded={(o) => { setOrder(o); ui.toast('پنڈی سلپ محفوظ ہو گئی ✓', 'ok'); }} />
          {viewer && slipImg.url && <SlipViewer url={slipImg.url} code={order.code} onClose={() => setViewer(false)} onShare={() => share(slipImg.blob, order.code, ui)} />}
        </>
      )}
    </div>
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

async function share(blob, code, ui) {
  if (!blob) return;
  try {
    const r = await shareOrSave(blob, `pandi-slip-${code}.jpg`);
    if (r === 'downloaded') ui.toast('سلپ ڈاؤن لوڈ ہو گئی', 'ok');
  } catch (e) {
    if (!/cancel/i.test(String(e?.message))) ui.toast('سلپ محفوظ یا شیئر نہیں ہو سکی', 'error');
  }
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
      const r = await Api.updateDelivery(order.id, order.code, f);
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
      lead={<>آرڈر نمبر <Num>{order.code}</Num> · <UText>{order.customer.name}</UText></>}
      footer={<>
        <Button onClick={save} disabled={busy || !changed} busy={busy}>{busy ? <><Spinner size={18} /> محفوظ ہو رہا ہے…</> : 'محفوظ کریں'}</Button>
        <Button variant="ghost" onClick={close} disabled={busy}>واپس</Button>
      </>}>
      <Notice tone="info" className="notice--flush">صرف یہ تین چیزیں بدلیں گی۔ سامان، رقم، اسٹاک اور آرڈر کی حالت پر کوئی اثر نہیں پڑے گا۔</Notice>
      <label className="field">
        <span className="field__label">ڈیلیوری کی تاریخ <small>(خالی چھوڑیں تو آرڈر والا دن: {dayLabel(order.order_date)})</small></span>
        <span className="input-wrap">
          <DateField value={f.delivery_date} onChange={(v) => setF({ ...f, delivery_date: v })} placeholder="آرڈر والا دن" ariaLabel="ڈیلیوری کی تاریخ" />
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

/*
 * Pick → preview → save. The photo is pinned to the order shown on screen: its id in
 * the URL and its code in the body; the server refuses (409) when they disagree.
 * The green tick appears only after the server answers that the slip is saved.
 */
function UploadSheet({ source, onClose, order, onUploaded }) {
  const ui = useUI();
  const open = Boolean(source);
  const [step, setStep] = useState('choose'); // choose → preparing → preview → uploading
  const [prepared, setPrepared] = useState(null);
  const [preview, setPreview] = useState(null);
  const [progress, setProgress] = useState(0);
  const [err, setErr] = useState(null);
  const orderRef = useRef(order);
  orderRef.current = order;

  const pick = useCallback(async (src) => {
    setErr(null);
    let file;
    try {
      file = await pickPhoto(src);
    } catch (e) {
      if (e instanceof PickCancelled) { setStep((s) => s); return; }
      setErr(e); return;
    }
    setStep('preparing');
    try {
      const p = await prepareSlip(file);
      setPrepared(p);
      setPreview((old) => { if (old) URL.revokeObjectURL(old); return URL.createObjectURL(p.blob); });
      setStep('preview');
    } catch (e) {
      setErr(e instanceof ImageError ? e : new Error('یہ تصویر نہیں کھل سکی۔ کوئی اور تصویر منتخب کریں۔'));
      setStep('choose');
    }
  }, []);

  // Opening with "camera" / "gallery" goes straight to that picker (one tap fewer).
  useEffect(() => {
    if (!open) return;
    setStep('choose'); setPrepared(null); setProgress(0); setErr(null);
    setPreview((old) => { if (old) URL.revokeObjectURL(old); return null; });
    if (source === 'camera' || source === 'gallery') pick(source);
  }, [open, source, pick]);

  async function send() {
    const target = orderRef.current;
    setStep('uploading'); setProgress(0); setErr(null);
    try {
      const r = await Api.uploadSlip(target.id, target.code, prepared.blob, `${target.code}.jpg`, setProgress);
      if (!r?.order?.slip?.uploaded || r.order.id !== target.id) throw new Error('سرور نے سلپ محفوظ ہونے کی تصدیق نہیں کی۔ دوبارہ کوشش کریں۔');
      onUploaded(r.order);
      onClose();
    } catch (e) {
      setErr(e);
      setStep('preview');
    }
  }

  const busy = step === 'uploading' || step === 'preparing';
  const close = () => {
    if (busy) return;
    if (step === 'preview') {
      ui.confirm({ title: 'سلپ محفوظ نہیں ہوئی', body: 'یہ تصویر ابھی آرڈر کے ساتھ نہیں لگی۔ کیا بغیر محفوظ کیے بند کرنا ہے؟', okLabel: 'بند کریں', danger: true, cancelLabel: 'واپس جائیں', onOk: onClose });
      return;
    }
    onClose();
  };

  return (
    <Sheet open={open} onClose={close} title={order.slip.uploaded ? 'پنڈی سلپ تبدیل کریں' : 'پنڈی سلپ لگائیں'}
      footer={step === 'preview' || step === 'uploading' ? <>
        <Button onClick={send} disabled={busy} busy={busy}>
          {step === 'uploading' ? <><Spinner size={18} /> بھیجی جا رہی ہے… <Num>{Math.round(progress * 100)}%</Num></> : err ? 'دوبارہ کوشش کریں' : 'سلپ محفوظ کریں'}
        </Button>
        <Button variant="ghost" disabled={busy} onClick={() => { setStep('choose'); setPrepared(null); }}>دوسری تصویر</Button>
      </> : null}>
      <div className="target">
        <Icon name="receipt" size={22} />
        <div>
          <span>یہ سلپ اس آرڈر کے ساتھ لگے گی:</span>
          <b>آرڈر نمبر <Num>{order.code}</Num> · <UText>{order.customer.name}</UText></b>
        </div>
      </div>
      {order.slip.uploaded && step === 'choose' && <p className="sheet__hint">نئی سلپ محفوظ ہونے تک پرانی سلپ اپنی جگہ رہے گی۔</p>}
      {step === 'choose' && (
        <div className="pickgrid">
          <button type="button" className="pick" onClick={() => pick('camera')}><Icon name="camera" size={30} /><span>تصویر کھینچیں</span></button>
          <button type="button" className="pick" onClick={() => pick('gallery')}><Icon name="image" size={30} /><span>گیلری سے لیں</span></button>
        </div>
      )}
      {step === 'preparing' && <div className="busybox"><Spinner size={30} /><p>تصویر تیار ہو رہی ہے…</p></div>}
      {(step === 'preview' || step === 'uploading') && preview && (
        <figure className="preview">
          <img src={preview} alt="سلپ کی تصویر" />
          <figcaption>تصویر چیک کر لیں کہ سلپ صاف پڑھی جا رہی ہے · <Num>{bytes(prepared.blob.size)}</Num></figcaption>
          {step === 'uploading' && <div className="progress" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${Math.max(4, progress * 100)}%` }} /></div>}
        </figure>
      )}
      {err && <p className="form-error" role="alert"><Icon name="alert" size={17} /> <span>{err.message}{step === 'preview' ? ' سلپ ابھی باقی ہے۔' : ''}</span></p>}
    </Sheet>
  );
}

function SlipViewer({ url, code, onClose, onShare }) {
  const [zoom, setZoom] = useState(1);
  useEffect(() => {
    const popBack = pushBack(onClose);
    const k = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', k);
    return () => { document.removeEventListener('keydown', k); popBack(); };
  }, [onClose]);
  return (
    <div className="viewer" role="dialog" aria-modal="true" aria-label={`آرڈر ${code} کی پنڈی سلپ`}>
      <div className="viewer__bar">
        <button type="button" className="viewer__btn" onClick={onClose} aria-label="بند کریں"><Icon name="close" size={22} strokeWidth={2.2} /></button>
        <strong>پنڈی سلپ · <Num>{code}</Num></strong>
        <button type="button" className="viewer__btn" onClick={() => setZoom((z) => (z >= 3 ? 1 : z + 1))} aria-label="بڑا کریں"><Icon name="zoom" size={22} /></button>
        <button type="button" className="viewer__btn" onClick={onShare} aria-label="محفوظ / شیئر کریں"><Icon name="download" size={22} /></button>
      </div>
      <div className="viewer__body" onDoubleClick={() => setZoom((z) => (z >= 3 ? 1 : z + 1))}>
        <img src={url} alt={`آرڈر ${code} کی پنڈی سلپ`} style={{ width: `${zoom * 100}%`, maxWidth: zoom === 1 ? '100%' : 'none' }} />
      </div>
      <p className="viewer__hint">بڑا کرنے کے لیے دو بار ٹیپ کریں</p>
    </div>
  );
}
