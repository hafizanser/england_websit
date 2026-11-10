/*
 * Upload the Builty (cargo receipt) photos of ONE order: front and back.
 *
 * Each side: pick (camera / gallery) → checked + compressed on the phone → preview →
 * replace or remove → save. Saving sends each new side to
 * POST /app/orders/{id}/builty/{side} with the order code; the server refuses a code that
 * does not match the id, so a photo can never land on another order. A side is shown as
 * saved only after the server confirms it; a side that is not re-picked keeps its
 * existing image untouched.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Api } from '../lib/api.js';
import { codeLabel, recordNoun, recordPath } from '../config.js';
import { pushBack } from '../lib/backstack.js';
import { bytes, cx } from '../lib/format.js';
import { ImageError, prepareSlip } from '../lib/image.js';
import { PickCancelled, pickPhoto } from '../lib/native.js';
import { imageSrc } from '../lib/builty.js';
import { useUI } from '../state/app.jsx';
import { AppBar, Button, ErrorState, FixedBar, Icon, Notice, Num, SkeletonCard, Spinner, UText } from '../components/ui.jsx';
import { SIDE_LABEL, builtyState } from '../components/Builty.jsx';

const SIDES = ['front', 'back'];
const empty = () => ({ blob: null, preview: null, busy: false, progress: 0, error: null, done: false });

export default function BuiltyUpload({ origin = 'website' }) {
  const { id } = useParams();
  const loc = useLocation();
  const nav = useNavigate();
  const ui = useUI();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [slots, setSlots] = useState({ front: empty(), back: empty() });
  const [saving, setSaving] = useState(false);
  const slotsRef = useRef(slots);
  slotsRef.current = slots;

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      setOrder((await Api.order(id, undefined, origin)).order);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [id, origin]);
  useEffect(() => { load(); }, [load]);

  // Opened to complete a half-done Builty: bring the missing side into view.
  const scrolled = useRef(false);
  useEffect(() => {
    if (!order || scrolled.current) return;
    scrolled.current = true;
    const st = builtyState(order.builty);
    if (st.kind === 'partial') requestAnimationFrame(() => document.getElementById(`slot-${st.missing[0]}`)?.scrollIntoView({ block: 'center' }));
  }, [order]);

  // Free preview URLs when leaving.
  useEffect(() => () => SIDES.forEach((s) => slotsRef.current[s].preview && URL.revokeObjectURL(slotsRef.current[s].preview)), []);

  const patch = (side, v) => setSlots((all) => ({ ...all, [side]: { ...all[side], ...v } }));
  const pending = SIDES.filter((s) => slots[s].blob && !slots[s].done);
  const code = order?.code || loc.state?.code || '';

  // Back gesture with unsaved photos asks first.
  const leave = useCallback(() => {
    if (saving) return;
    if (SIDES.some((s) => slotsRef.current[s].blob && !slotsRef.current[s].done)) {
      ui.confirm({
        title: 'تصاویر محفوظ نہیں ہوئیں',
        body: `آپ نے جو تصویر منتخب کی ہے وہ ابھی اس ${recordNoun(origin)} کے ساتھ محفوظ نہیں ہوئی۔ کیا بغیر محفوظ کیے واپس جانا ہے؟`,
        okLabel: 'واپس جائیں', danger: true, cancelLabel: 'یہیں رہیں',
        onOk: () => nav(-1),
      });
      return;
    }
    nav(-1);
  }, [saving, ui, nav]);
  useEffect(() => (pending.length || saving ? pushBack(leave) : undefined), [pending.length, saving, leave]);

  async function pick(side, source) {
    patch(side, { error: null });
    let file;
    try {
      file = await pickPhoto(source);
    } catch (e) {
      if (!(e instanceof PickCancelled)) patch(side, { error: e });
      return;
    }
    patch(side, { busy: true });
    try {
      const p = await prepareSlip(file);
      setSlots((all) => {
        if (all[side].preview) URL.revokeObjectURL(all[side].preview);
        return { ...all, [side]: { ...empty(), blob: p.blob, preview: URL.createObjectURL(p.blob) } };
      });
    } catch (e) {
      patch(side, { busy: false, error: e instanceof ImageError ? e : new Error('یہ تصویر نہیں کھل سکی۔ کوئی اور تصویر منتخب کریں۔') });
    }
  }

  function removePick(side) {
    setSlots((all) => {
      if (all[side].preview) URL.revokeObjectURL(all[side].preview);
      return { ...all, [side]: empty() };
    });
  }

  async function save() {
    if (!order || !pending.length) return;
    setSaving(true);
    let latest = order.builty;
    let failed = false;
    for (const side of pending) {
      patch(side, { busy: true, progress: 0, error: null });
      try {
        const r = await Api.uploadBuilty(order.id, order.code, side, slotsRef.current[side].blob, `${order.code}-${side}.jpg`, (p) => patch(side, { progress: p }), origin);
        if (r.order_id !== order.id || !r.builty?.[side]?.uploaded) throw new Error('سرور نے تصویر محفوظ ہونے کی تصدیق نہیں کی۔ دوبارہ کوشش کریں۔');
        latest = r.builty;
        patch(side, { busy: false, done: true, progress: 1 });
      } catch (e) {
        failed = true;
        patch(side, { busy: false, error: e });
      }
    }
    setOrder((o) => ({ ...o, builty: latest }));
    setSaving(false);
    if (failed) return;
    const st = builtyState(latest);
    if (st.kind === 'complete') {
      ui.toast('بلٹی کی دونوں تصاویر محفوظ ہو گئیں ✓', 'ok');
      nav(`${recordPath(origin, order.id)}/builty`, { replace: true, state: { code: order.code } });
    } else {
      ui.toast(`تصویر محفوظ ہو گئی — ${SIDE_LABEL[st.missing[0]]} ابھی باقی ہے`, 'ok');
    }
  }

  return (
    <div className="screen">
      <AppBar back onBack={leave} title="بلٹی کی تصاویر اپلوڈ کریں" sub={code ? <>{codeLabel(origin)} <Num>{code}</Num></> : null} />
      <main className="content content--detail content--action">
        {loading && !order && <div className="olist"><SkeletonCard /><SkeletonCard /></div>}
        {error && !order && <ErrorState error={error} onRetry={load} />}
        {order && (
          <>
            <div className="target">
              <span className="target__ic"><Icon name="receipt" size={20} strokeWidth={2} /></span>
              <div>
                <span>یہ تصاویر صرف اس {recordNoun(origin)} کے ساتھ لگیں گی</span>
                <b><UText>{order.customer.name || 'نام درج نہیں'}</UText></b>
              </div>
              <Num className="target__code">#{order.code}</Num>
            </div>

            {SIDES.map((side) => (
              <Slot key={side} side={side} slot={slots[side]} existing={order.builty?.[side]} disabled={saving}
                onPick={(src) => pick(side, src)} onRemove={() => removePick(side)} />
            ))}

            <Notice tone="info" className="notice--flush">
              JPG، PNG یا WebP · زیادہ سے زیادہ <Num>10 MB</Num> · بڑی تصویر خود چھوٹی ہو جائے گی۔ جو تصویر آپ نہیں بدلیں گے وہ پہلے جیسی رہے گی۔
            </Notice>
          </>
        )}
      </main>
      {order && (
        <FixedBar className="actionbar">
          <Button onClick={save} disabled={!pending.length || saving} busy={saving}>
            {saving ? <><Spinner size={18} /> محفوظ ہو رہی ہیں…</>
              : pending.length ? <><Icon name="upload" size={19} /> {pending.length === 2 ? 'دونوں تصاویر محفوظ کریں' : `${SIDE_LABEL[pending[0]]} محفوظ کریں`}</>
                : 'پہلے تصویر منتخب کریں'}
          </Button>
        </FixedBar>
      )}
    </div>
  );
}

function Slot({ side, slot, existing, disabled, onPick, onRemove }) {
  const hasNew = Boolean(slot.preview);
  const has = hasNew || existing?.uploaded;
  const src = hasNew ? slot.preview : imageSrc(existing);
  return (
    <section id={`slot-${side}`} className={cx('card uslot', slot.done ? 'uslot--done' : hasNew ? 'uslot--new' : existing?.uploaded ? 'uslot--saved' : 'uslot--empty')}>
      <div className="uslot__head">
        <h3><span className="uslot__num"><Icon name={side === 'front' ? 'receipt' : 'note'} size={17} strokeWidth={2.1} /></span> <span>{SIDE_LABEL[side]}<small>{side === 'front' ? 'بلٹی کا سامنے والا رخ' : 'بلٹی کا پچھلا رخ'}</small></span></h3>
        {slot.done ? <span className="tag tag--ok"><Icon name="check" size={13} strokeWidth={3} /> محفوظ ہو گئی</span>
          : hasNew ? <span className="tag tag--warn"><Icon name="upload" size={13} strokeWidth={2.4} /> محفوظ کرنا باقی</span>
            : existing?.uploaded ? <span className="tag tag--ok"><Icon name="check" size={13} strokeWidth={3} /> اپلوڈ ہو چکی</span>
              : <span className="tag tag--pending"><Icon name="clock" size={13} strokeWidth={2.4} /> باقی ہے</span>}
      </div>

      {has ? (
        <figure className="uslot__img">
          <img src={src} alt={SIDE_LABEL[side]} />
          {slot.busy && (
            <div className="uslot__busy">
              <Spinner size={26} />
              {slot.progress > 0 && <span><Num>{Math.round(slot.progress * 100)}%</Num></span>}
              <div className={slot.progress > 0 ? 'progress' : 'progress progress--busy'} role="progressbar"
                aria-valuenow={slot.progress > 0 ? Math.round(slot.progress * 100) : undefined} aria-valuemin={0} aria-valuemax={100}>
                <span style={slot.progress > 0 ? { width: `${Math.max(4, slot.progress * 100)}%` } : undefined} />
              </div>
            </div>
          )}
          {hasNew && !slot.busy && <figcaption><Num>{bytes(slot.blob.size)}</Num> · تصویر صاف پڑھی جا رہی ہے؟</figcaption>}
        </figure>
      ) : slot.busy ? (
        <div className="busybox"><Spinner size={28} /><p>تصویر تیار ہو رہی ہے…</p></div>
      ) : null}

      {!slot.busy && !slot.done && (
        <div className={cx('pickgrid', has && 'pickgrid--compact')}>
          <button type="button" className="pick" disabled={disabled} onClick={() => onPick('camera')}>
            <Icon name="camera" size={has ? 20 : 28} /><span>{has ? 'نئی تصویر کھینچیں' : 'تصویر کھینچیں'}</span>
          </button>
          <button type="button" className="pick" disabled={disabled} onClick={() => onPick('gallery')}>
            <Icon name="image" size={has ? 20 : 28} /><span>{has ? 'گیلری سے بدلیں' : 'گیلری سے لیں'}</span>
          </button>
        </div>
      )}
      {hasNew && !slot.busy && !slot.done && (
        <button type="button" className="linkbtn uslot__undo" disabled={disabled} onClick={onRemove}>
          {existing?.uploaded ? 'یہ تصویر ہٹائیں (پرانی ہی رہے گی)' : 'یہ تصویر ہٹائیں'}
        </button>
      )}
      {slot.error && <p className="form-error" role="alert"><Icon name="alert" size={17} /> <span>{slot.error.message}</span></p>}
    </section>
  );
}
