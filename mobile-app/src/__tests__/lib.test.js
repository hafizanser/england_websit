import { afterEach, describe, expect, it, vi } from 'vitest';
import { bytes, dateTime, dayLabel, dayLabelLong, isRtl, money, relativeDay, telHref, unitUr } from '../lib/format.js';
import { STATUS_LABEL, TABS, codeLabel, recordNoun, recordPath } from '../config.js';
import { ImageError, checkFile, targetSize } from '../lib/image.js';
import { Api, ApiError, friendly, multipartBoundary, request, setToken, setUnauthorizedHandler, upload } from '../lib/api.js';
import { builtyState } from '../components/Builty.jsx';
import { builtyFileName } from '../lib/builty.js';

describe('format', () => {
  it('formats money, dates and plurals', () => {
    expect(money(12500)).toBe('Rs 12,500');
    expect(dayLabel('2026-11-04')).toBe('4 نومبر 2026');
    expect(dayLabelLong('2026-11-04')).toBe('بدھ، 4 نومبر');
    expect(dayLabel('bad')).toBe('—');
    expect(relativeDay('2026-11-04', '2026-11-04')).toBe('آج');
    expect(relativeDay('2026-11-05', '2026-11-04')).toBe('کل');
    expect(relativeDay('2026-11-03', '2026-11-04')).toBe('گزشتہ کل');
    expect(relativeDay('2026-10-01', '2026-11-04')).toBe('1 اکتوبر 2026');
    expect(dateTime('2026-11-04T05:42:00Z')).toBe('4 نومبر 2026، 10:42 صبح');
    expect(bytes(512)).toBe('512 B');
    expect(bytes(2048)).toBe('2 KB');
    expect(bytes(3 * 1048576)).toBe('3.0 MB');
  });

  it('speaks Urdu: statuses, tabs and units', () => {
    const latin = /[A-Za-z]/;
    Object.values(STATUS_LABEL).forEach((l) => expect(latin.test(l)).toBe(false));
    TABS.forEach((t) => expect(latin.test(t.label)).toBe(false));
    expect(TABS.map((t) => t.label)).toEqual(['آج کے آرڈر', 'کل کے آرڈر', 'پچھلے آرڈرز', 'تمام آرڈر']);
    expect(TABS.map((t) => t.key)).toEqual(['today', 'tomorrow', 'previous', 'all']);
    expect(unitUr('Carton')).toBe('کارٹن');
    expect(unitUr('packet')).toBe('پیکٹ');
    expect(unitUr('')).toBe('عدد');
    expect(unitUr('Tin')).toBe('Tin');
  });

  it('builds safe tel: links', () => {
    expect(telHref('0300-123 4567')).toBe('tel:03001234567');
    expect(telHref('+92 300 1234567')).toBe('tel:+923001234567');
    expect(telHref('')).toBeNull();
    expect(telHref('n/a')).toBeNull();
  });

  it('detects Urdu text for RTL + Nastaliq', () => {
    expect(isRtl('محمد اسلم')).toBe(true);
    expect(isRtl('Daewoo پنڈی')).toBe(true);
    expect(isRtl('Ali Traders')).toBe(false);
  });
});

describe('slip image rules', () => {
  it('downscales to the longest edge and never upscales', () => {
    expect(targetSize(4000, 3000)).toEqual({ width: 2000, height: 1500 });
    expect(targetSize(3000, 4000)).toEqual({ width: 1500, height: 2000 });
    expect(targetSize(1200, 900)).toEqual({ width: 1200, height: 900 });
  });

  it('rejects empty, wrong-type, HEIC and huge files before decoding', () => {
    expect(() => checkFile(new Blob([]))).toThrow(ImageError);
    expect(() => checkFile(new Blob(['x'], { type: 'application/pdf' }))).toThrow(/صرف تصویر/);
    expect(() => checkFile(new Blob(['x'], { type: 'image/heic' }))).toThrow(/HEIC/);
    const big = { size: 41 * 1024 * 1024, type: 'image/jpeg' };
    expect(() => checkFile(big)).toThrow(/بہت بڑی/);
    expect(() => checkFile(new Blob(['x'], { type: 'image/jpeg' }))).not.toThrow();
  });
});

const ok = (data, code = 200) => JSON.stringify({ error: false, message: 'ok', code, data });
const fail = (code, reason, extra = {}) => JSON.stringify({ error: true, message: 'English text', code, data: { reason, ...extra } });

describe('api client (app envelope)', () => {
  afterEach(() => { vi.unstubAllGlobals(); setToken(null); setUnauthorizedHandler(null); });

  it('sends the bearer token, drops empty query values and returns data', async () => {
    const fetchMock = vi.fn(async () => new Response(ok({ orders: [{ id: 1 }], meta: {}, counts: {} }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    setToken('abc');
    const r = await Api.orders({ tab: 'today', q: '', status: undefined, page: 2 });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/app\/orders\?tab=today&page=2$/);
    expect(init.headers.Authorization).toBe('Bearer abc');
    expect(r.orders[0].id).toBe(1);
  });

  it('maps data.reason to Urdu, keeps fields, and signs out on 401', async () => {
    const out = vi.fn();
    setUnauthorizedHandler(out);
    vi.stubGlobal('fetch', vi.fn(async () => new Response(fail(401, 'unauthenticated'), { status: 401 })));
    await expect(request('/app/orders')).rejects.toMatchObject({ status: 401, reason: 'unauthenticated', message: 'آپ کا سیشن ختم ہو گیا ہے۔ دوبارہ لاگ اِن کریں۔' });
    expect(out).toHaveBeenCalledOnce();

    vi.stubGlobal('fetch', vi.fn(async () => new Response(fail(422, 'validation_failed', { fields: { pandi_name: 'Too long' } }), { status: 422 })));
    const e = await request('/x').catch((x) => x);
    expect(e).toBeInstanceOf(ApiError);
    expect(e.fields.pandi_name).toBe('پنڈی کا نام 120 حروف سے زیادہ نہیں ہو سکتا۔');
    expect(e.message).toBe('معلومات درست نہیں۔ نشان زدہ خانے چیک کریں۔');

    vi.stubGlobal('fetch', vi.fn(async () => new Response(fail(401, 'invalid_credentials'), { status: 401 })));
    await expect(request('/app/auth/login', { method: 'POST', auth: false })).rejects.toMatchObject({ message: 'یوزر نیم یا پاس ورڈ غلط ہے۔' });

    // A 200 that is not our envelope (captive portal / proxy page) is an error, not success.
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>wifi login</html>', { status: 200 })));
    await expect(request('/app/orders')).rejects.toBeInstanceOf(ApiError);
    // The old website envelope is not mistaken for success either.
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 })));
    await expect(request('/app/orders')).rejects.toBeInstanceOf(ApiError);
  });

  it('says the server is outdated when an /app call gets the website envelope (live 1.1 backend)', async () => {
    const signOut = vi.fn();
    setUnauthorizedHandler(signOut);
    // What englandwaly.com/api answered on 2026-11-05: an old backend with {ok:...} replies and no Builty routes.
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ ok: true, orders: [], counts: {} }), { status: 200 })));
    await expect(request('/app/orders')).rejects.toMatchObject({ reason: 'server_outdated', message: expect.stringContaining('سرور اپ ڈیٹ') });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ ok: false, error: 'The route app/orders/1/builty could not be found.' }), { status: 404 })));
    await expect(request('/app/orders/1/builty')).rejects.toMatchObject({ status: 404, reason: 'server_outdated' });
    expect(signOut).not.toHaveBeenCalled();
    // A 401 from the old server still means "sign in again".
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ ok: false, error: 'Admin authentication required' }), { status: 401 })));
    await expect(request('/app/orders')).rejects.toMatchObject({ status: 401, message: expect.stringContaining('دوبارہ لاگ اِن') });
    expect(signOut).toHaveBeenCalledTimes(1);
    // A 200 that is not JSON at all (captive portal) gets its own message, not the generic one.
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>wifi login</html>', { status: 200 })));
    await expect(request('/app/orders')).rejects.toMatchObject({ reason: 'bad_response', message: expect.stringContaining('درست جواب') });
  });

  it('reports offline when the server cannot be reached', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    await expect(request('/app/orders')).rejects.toMatchObject({ offline: true });
  });

  it('uploads one Builty side with the order code and resolves only on a confirmed save', async () => {
    class FakeXHR {
      constructor() { this.upload = {}; this.headers = {}; FakeXHR.last = this; }
      open(m, u) { this.url = u; }
      setRequestHeader(k, v) { this.headers[k] = v; }
      send(body) {
        this.body = body;
        this.upload.onprogress?.({ lengthComputable: true, loaded: 50, total: 100 });
        this.status = FakeXHR.status;
        this.responseText = FakeXHR.body;
        this.onload();
      }
    }
    vi.stubGlobal('XMLHttpRequest', FakeXHR);
    const progress = vi.fn();

    FakeXHR.status = 201; FakeXHR.body = ok({ order_id: 7, side: 'back', builty: { back: { uploaded: true } } }, 201);
    const r = await Api.uploadBuilty(7, 'ENG-1007', 'back', new Blob(['x'], { type: 'image/jpeg' }), 'ENG-1007-back.jpg', progress);
    expect(FakeXHR.last.url).toMatch(/\/app\/orders\/7\/builty\/back$/);
    expect(FakeXHR.last.body.get('order_code')).toBe('ENG-1007');
    expect(FakeXHR.last.body.get('image')).toBeInstanceOf(Blob);
    expect(r.builty.back.uploaded).toBe(true);
    expect(progress).toHaveBeenCalledWith(0.5);

    FakeXHR.status = 409; FakeXHR.body = fail(409, 'order_mismatch');
    await expect(upload('/app/orders/7/builty/front', new FormData())).rejects.toMatchObject({ status: 409, reason: 'order_mismatch', message: expect.stringContaining('اس آرڈر کی نہیں') });
    FakeXHR.status = 422; FakeXHR.body = fail(422, 'image_too_small', { fields: { image: 'Too small' } });
    await expect(upload('/app/orders/7/builty/front', new FormData())).rejects.toMatchObject({ message: expect.stringContaining('بہت چھوٹی') });
    FakeXHR.status = 200; FakeXHR.body = '<html>proxy page</html>';
    await expect(upload('/app/orders/7/builty/front', new FormData())).rejects.toBeInstanceOf(ApiError);
  });
});

describe('native Builty upload (CapacitorHttp)', () => {
  it('sends a multipart Content-Type with a boundary on Android, never in the browser', async () => {
    const { Capacitor } = await import('@capacitor/core');
    class FakeXHR {
      constructor() { this.upload = {}; this.headers = {}; FakeXHR.last = this; }
      open(m, u) { this.url = u; }
      setRequestHeader(k, v) { this.headers[k] = v; }
      send(body) { this.body = body; this.status = 201; this.responseText = JSON.stringify({ error: false, message: 'ok', code: 201, data: { side: 'front' } }); this.onload(); }
    }
    vi.stubGlobal('XMLHttpRequest', FakeXHR);
    const spy = vi.spyOn(Capacitor, 'isNativePlatform');

    spy.mockReturnValue(true);
    await Api.uploadBuilty(19, 'TEST-003', 'front', new Blob(['x'], { type: 'image/jpeg' }), 'TEST-003-front.jpg');
    expect(FakeXHR.last.headers['Content-Type']).toMatch(/^multipart\/form-data; boundary=EnglandOrders[0-9a-f]{24}$/);
    expect(FakeXHR.last.body.get('order_code')).toBe('TEST-003');

    spy.mockReturnValue(false);
    await Api.uploadBuilty(19, 'TEST-003', 'front', new Blob(['x'], { type: 'image/jpeg' }), 'TEST-003-front.jpg');
    expect(FakeXHR.last.headers['Content-Type']).toBeUndefined();

    expect(multipartBoundary()).not.toBe(multipartBoundary());
    spy.mockRestore();
  });
});

describe('builty helpers', () => {
  it('derives none / partial / complete', () => {
    expect(builtyState(undefined)).toEqual({ kind: 'none', missing: ['front', 'back'] });
    expect(builtyState({ front: { uploaded: true }, back: { uploaded: false } })).toEqual({ kind: 'partial', missing: ['back'] });
    expect(builtyState({ front: { uploaded: false }, back: { uploaded: true } })).toEqual({ kind: 'partial', missing: ['front'] });
    expect(builtyState({ front: { uploaded: true }, back: { uploaded: true } }).kind).toBe('complete');
  });

  it('names downloaded files safely per order and side', () => {
    expect(builtyFileName('ENG-1001', 'front', 'image/jpeg')).toBe('ENG-1001-builty-front.jpg');
    expect(builtyFileName('ENG/../1001', 'back', 'image/png')).toBe('ENG1001-builty-back.png');
    expect(builtyFileName('', 'back', undefined)).toBe('order-builty-back.jpg');
  });
});

describe('website orders vs ERP sales wording and paths', () => {
  it('names the number and the record by origin', () => {
    expect(codeLabel('erp')).toBe('انوائس نمبر');
    expect(codeLabel('website')).toBe('آرڈر نمبر');
    expect(recordNoun('erp')).toBe('سیل');
    expect(recordNoun('website')).toBe('آرڈر');
    expect(recordPath('erp', 7)).toBe('/erp-sales/7');
    expect(recordPath('website', 7)).toBe('/orders/7');
  });
  it('says an ERP sale (not an order) was not found', () => {
    const body = { error: true, code: 404, data: { reason: 'order_not_found' } };
    expect(friendly(404, body, '/app/erp-sales/5')).toBe('یہ ERP سیل نہیں ملی۔ ہو سکتا ہے ERP میں حذف ہو گئی ہو۔');
    expect(friendly(404, body, '/app/orders/5')).toBe('یہ آرڈر نہیں ملا۔');
  });
});

describe('date category (mirrors the server tabs)', () => {
  it('today / tomorrow / previous / upcoming against the server business day', async () => {
    const { dateTab, DATE_TAB_LABEL } = await import('../lib/format.js');
    expect(dateTab('2026-11-10', '2026-11-10')).toBe('today');
    expect(dateTab('2026-11-11', '2026-11-10')).toBe('tomorrow');
    expect(dateTab('2026-11-09', '2026-11-10')).toBe('previous');
    expect(dateTab('2026-10-31', '2026-11-01')).toBe('previous');
    expect(dateTab('2026-12-01', '2026-11-30')).toBe('tomorrow');
    expect(dateTab('2026-11-13', '2026-11-10')).toBe('upcoming');
    expect(dateTab(null, '2026-11-10')).toBeNull();
    expect(dateTab('2026-11-10', undefined)).toBeNull();
    expect(DATE_TAB_LABEL.today).toBe('آج کا آرڈر');
    expect(DATE_TAB_LABEL.tomorrow).toBe('کل کا آرڈر');
    expect(DATE_TAB_LABEL.previous).toBe('پرانا آرڈر');
  });
});
