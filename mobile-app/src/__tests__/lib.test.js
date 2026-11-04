import { afterEach, describe, expect, it, vi } from 'vitest';
import { bytes, dateTime, dayLabel, dayLabelLong, isRtl, money, relativeDay, telHref, unitUr } from '../lib/format.js';
import { STATUS_LABEL, TABS } from '../config.js';
import { ImageError, checkFile, targetSize } from '../lib/image.js';
import { Api, ApiError, request, setToken, setUnauthorizedHandler, upload } from '../lib/api.js';

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
    expect(TABS.map((t) => t.label)).toEqual(['آج کے آرڈر', 'کل کے آرڈر', 'پچھلے آرڈر', 'تمام آرڈر']);
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

describe('api client', () => {
  afterEach(() => { vi.unstubAllGlobals(); setToken(null); setUnauthorizedHandler(null); });

  it('sends the bearer token and drops empty query values', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true, data: [] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    setToken('abc');
    await Api.orders({ tab: 'today', q: '', status: undefined, page: 2 });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/app\/orders\?tab=today&page=2$/);
    expect(init.headers.Authorization).toBe('Bearer abc');
  });

  it('turns server errors into friendly ApiErrors and signs out on 401', async () => {
    const out = vi.fn();
    setUnauthorizedHandler(out);
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ ok: false, error: 'Unauthenticated.' }), { status: 401 })));
    await expect(request('/app/orders')).rejects.toMatchObject({ status: 401, message: 'آپ کا سیشن ختم ہو گیا ہے۔ دوبارہ لاگ اِن کریں۔' });
    expect(out).toHaveBeenCalledOnce();

    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ ok: false, error: 'Bad', fields: { pandi_name: 'Too long' } }), { status: 422 })));
    const e = await request('/x').catch((x) => x);
    expect(e).toBeInstanceOf(ApiError);
    expect(e.fields.pandi_name).toBe('پنڈی کا نام 120 حروف سے زیادہ نہیں ہو سکتا۔');
    expect(e.message).toBe('معلومات درست نہیں۔ نشان زدہ خانے چیک کریں۔');

    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ ok: false, error: 'Wrong username or password.' }), { status: 401 })));
    await expect(request('/app/auth/login', { method: 'POST', auth: false })).rejects.toMatchObject({ message: 'یوزر نیم یا پاس ورڈ غلط ہے۔' });
  });

  it('reports offline when the server cannot be reached', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    await expect(request('/app/orders')).rejects.toMatchObject({ offline: true });
  });

  it('upload resolves only on a confirmed 2xx save', async () => {
    class FakeXHR {
      constructor() { this.upload = {}; this.headers = {}; FakeXHR.last = this; }
      open(m, u) { this.url = u; }
      setRequestHeader(k, v) { this.headers[k] = v; }
      send() {
        this.upload.onprogress?.({ lengthComputable: true, loaded: 50, total: 100 });
        this.status = FakeXHR.status;
        this.responseText = FakeXHR.body;
        this.onload();
      }
    }
    vi.stubGlobal('XMLHttpRequest', FakeXHR);
    const progress = vi.fn();

    FakeXHR.status = 201; FakeXHR.body = JSON.stringify({ ok: true, order: { id: 7, slip: { uploaded: true } } });
    const r = await upload('/app/orders/7/slip', new FormData(), { onProgress: progress });
    expect(r.order.slip.uploaded).toBe(true);
    expect(progress).toHaveBeenCalledWith(0.5);

    FakeXHR.status = 409; FakeXHR.body = JSON.stringify({ ok: false, error: 'This slip is for a different order.' });
    await expect(upload('/app/orders/7/slip', new FormData())).rejects.toMatchObject({ status: 409, message: expect.stringContaining('یہ سلپ اس آرڈر کی نہیں') });

    FakeXHR.status = 200; FakeXHR.body = '<html>proxy page</html>';
    await expect(upload('/app/orders/7/slip', new FormData())).rejects.toBeInstanceOf(ApiError);
  });
});
