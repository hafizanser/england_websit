/*
 * Builty photos of ONE order: front and back, full width, tap to zoom.
 * Share (top bar) → Android share sheet with every saved photo.
 * Download (per photo) → Documents/England Orders on the phone.
 * The image URLs are short-lived signed links for this order only; when one has expired
 * (the screen was left open) the links are fetched again automatically.
 */
import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Api } from '../lib/api.js';
import { codeLabel, recordNoun, recordPath } from '../config.js';
import { pushBack } from '../lib/backstack.js';
import { PermissionDenied, builtyFileName, downloadImage, imageSrc, shareImages } from '../lib/builty.js';
import { cx, dateTime } from '../lib/format.js';
import { useUI } from '../state/app.jsx';
import { AppBar, Button, ErrorState, Icon, Notice, Num, SkeletonCard, Spinner } from '../components/ui.jsx';
import { BuiltySides, SIDE_LABEL, builtyState } from '../components/Builty.jsx';

const SIDES = ['front', 'back'];

export default function BuiltyViewer({ origin = 'website' }) {
  const { id } = useParams();
  const loc = useLocation();
  const nav = useNavigate();
  const ui = useUI();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [zoom, setZoom] = useState(null); // side shown full screen

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError(null);
    try {
      setData(await Api.builty(id, undefined, origin));
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [id, origin]);
  useEffect(() => { load(); }, [load]);

  const code = data?.order_code || loc.state?.code || '';
  const builty = data?.builty;
  const saved = SIDES.filter((s) => builty?.[s]?.uploaded);
  const st = builtyState(builty);
  const file = (side) => ({ url: imageSrc(builty[side]), name: builtyFileName(code, side, builty[side].mime) });

  async function share() {
    if (!saved.length) return;
    setSharing(true);
    try {
      await shareImages(saved.map(file), `بلٹی · ${code}`);
    } catch {
      ui.toast('تصاویر شیئر نہیں ہو سکیں۔ انٹرنیٹ چیک کر کے دوبارہ کوشش کریں۔', 'error');
      load(true);
    } finally {
      setSharing(false);
    }
  }

  const upload = () => nav(`${recordPath(origin, id)}/builty/upload`, { state: { code } });

  return (
    <div className="screen screen--viewer">
      <AppBar back title="بلٹی کی تصاویر" sub={code ? <>{codeLabel(origin)} <Num>{code}</Num></> : null}
        end={(
          <button type="button" className="sharebtn" onClick={share} disabled={!saved.length || sharing} aria-label="بلٹی کی تصاویر شیئر کریں">
            {sharing ? <Spinner size={17} /> : <Icon name="share" size={18} strokeWidth={2.2} />}
            <span>شیئر کریں</span>
          </button>
        )} />

      <main className="content content--detail">
        {loading && !data && <div className="olist"><SkeletonCard /><SkeletonCard /></div>}
        {error && !data && <ErrorState error={error} onRetry={() => load()} />}
        {error && data && <Notice tone="error" icon="alert">{error.message}</Notice>}
        {data && (
          <>
            <div className={cx('vstatus', `vstatus--${st.kind}`)}>
              <Icon name={st.kind === 'complete' ? 'check' : 'alert'} size={18} strokeWidth={st.kind === 'complete' ? 3 : 2.2} />
              <span>{st.kind === 'complete' ? 'بلٹی مکمل — دونوں تصاویر لگی ہوئی ہیں' : st.kind === 'partial' ? `بلٹی نامکمل — ${SIDE_LABEL[st.missing[0]]} باقی ہے` : `اس ${recordNoun(origin)} کی بلٹی ابھی نہیں لگی`}</span>
              <BuiltySides builty={builty} />
            </div>

            {SIDES.map((side) => (
              <Photo key={side} side={side} info={builty[side]} code={code}
                onZoom={() => setZoom(side)} onExpired={() => load(true)} onUpload={upload}
                download={() => downloadImage(file(side))} />
            ))}

            {st.kind !== 'complete' && <Button onClick={upload}><Icon name="upload" size={19} /> باقی تصویر اپلوڈ کریں</Button>}
            {st.kind === 'complete' && <Button variant="ghost" onClick={upload}><Icon name="edit" size={18} /> تصویر تبدیل کریں</Button>}
          </>
        )}
      </main>
      {zoom && builty?.[zoom]?.uploaded && <Zoom url={imageSrc(builty[zoom])} label={`${SIDE_LABEL[zoom]} · ${code}`} onClose={() => setZoom(null)} />}
    </div>
  );
}

function Photo({ side, info, code, onZoom, onExpired, onUpload, download }) {
  const ui = useUI();
  const [state, setState] = useState('loading'); // loading | ok | error
  const [busy, setBusy] = useState(false);
  const [retried, setRetried] = useState(false);
  const src = imageSrc(info);
  useEffect(() => { setState('loading'); }, [src]);

  if (!info?.uploaded) {
    return (
      <section className="card vphoto vphoto--missing">
        <h3>{SIDE_LABEL[side]}</h3>
        <div className="vphoto__empty">
          <Icon name="image" size={34} />
          <p>یہ تصویر ابھی نہیں لگی</p>
          <Button size="sm" variant="soft" block={false} onClick={onUpload}><Icon name="camera" size={17} /> تصویر لگائیں</Button>
        </div>
      </section>
    );
  }

  async function save() {
    setBusy(true);
    try {
      const r = await download();
      ui.toast(`تصویر محفوظ ہو گئی: ${r.where}`, 'ok');
    } catch (e) {
      if (e instanceof PermissionDenied) ui.toast('فائل محفوظ کرنے کی اجازت نہیں ملی۔ فون کی سیٹنگز میں اسٹوریج کی اجازت دیں۔', 'error');
      else { ui.toast('تصویر ڈاؤن لوڈ نہیں ہو سکی۔ دوبارہ کوشش کریں۔', 'error'); onExpired(); }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card vphoto">
      <div className="vphoto__head">
        <h3><Icon name="check" size={15} strokeWidth={3} /> {SIDE_LABEL[side]}</h3>
        {info.uploaded_at && <span className="muted">{dateTime(info.uploaded_at)}</span>}
      </div>
      <button type="button" className="vphoto__img" onClick={state === 'ok' ? onZoom : undefined} aria-label={`${SIDE_LABEL[side]} بڑی کر کے دیکھیں`}>
        {state !== 'error' && (
          <img src={src} alt={`${code} — ${SIDE_LABEL[side]}`} className={state === 'ok' ? 'is-loaded' : ''}
            onLoad={() => setState('ok')}
            onError={() => { setState('error'); if (!retried) { setRetried(true); onExpired(); } }} />
        )}
        {state === 'loading' && <span className="vphoto__spin"><Spinner size={26} /></span>}
        {state === 'error' && <span className="vphoto__msg"><Icon name="alert" size={22} /> تصویر نہیں کھل سکی</span>}
        {state === 'ok' && <span className="vphoto__zoom"><Icon name="zoom" size={16} strokeWidth={2.2} /> بڑا کریں</span>}
      </button>
      {state === 'error'
        ? <Button variant="ghost" size="sm" onClick={() => { setRetried(false); onExpired(); }}><Icon name="refresh" size={17} /> دوبارہ کوشش کریں</Button>
        : <Button variant="soft" size="sm" onClick={save} disabled={busy || state !== 'ok'} busy={busy}>
          {busy ? <><Spinner size={16} /> ڈاؤن لوڈ ہو رہی ہے…</> : <><Icon name="download" size={18} /> ڈاؤن لوڈ کریں</>}
        </Button>}
    </section>
  );
}

function Zoom({ url, label, onClose }) {
  const [z, setZ] = useState(1);
  useEffect(() => {
    const pop = pushBack(onClose);
    const k = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', k);
    return () => { document.removeEventListener('keydown', k); pop(); };
  }, [onClose]);
  return (
    <div className="viewer" role="dialog" aria-modal="true" aria-label={label}>
      <div className="viewer__bar">
        <button type="button" className="viewer__btn" onClick={onClose} aria-label="بند کریں"><Icon name="close" size={22} strokeWidth={2.2} /></button>
        <strong>{label}</strong>
        <button type="button" className="viewer__btn" onClick={() => setZ((v) => (v >= 3 ? 1 : v + 1))} aria-label="بڑا کریں"><Icon name="zoom" size={22} /></button>
      </div>
      <div className="viewer__body" onDoubleClick={() => setZ((v) => (v >= 3 ? 1 : v + 1))}>
        <img src={url} alt={label} style={{ width: `${z * 100}%`, maxWidth: z === 1 ? '100%' : 'none' }} />
      </div>
      <p className="viewer__hint">بڑا کرنے کے لیے دو بار ٹیپ کریں</p>
    </div>
  );
}
