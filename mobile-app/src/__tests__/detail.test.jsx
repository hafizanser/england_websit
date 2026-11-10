import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/api.js', async (orig) => {
  const real = await orig();
  return { ...real, Api: { ...real.Api, order: vi.fn() } };
});

const { Api } = await import('../lib/api.js');
const { UIProvider } = await import('../state/app.jsx');
const { default: OrderDetail } = await import('../screens/OrderDetail.jsx');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const none = { front: { uploaded: false }, back: { uploaded: false }, uploaded_count: 0, complete: false };
const erpSale = (other) => ({
  id: 4, key: 'erp-4', origin: 'erp', code: '4', status: 'posted', source: 'erp', placed_at: '2026-11-06T08:00:00+00:00',
  order_date: '2026-11-06', delivery_date: null, effective_date: '2026-11-06', today: '2026-11-06',
  total: 40100, total_scope: 'whole_invoice', note: null,
  erp: { sale_id: 4, invoice_no: '4', offline_no: null, vehicle: null, remarks: null, pandi_name: null, pandi_phone: null, adda_name: null, other_company_lines: other },
  customer: { name: 'ERP گاہک', phone: '03217654321', address: 'Akbari Mandi', city: 'Multan' },
  items: [{ id: 1, name: 'England Today Razor', unit: 'CTN', qty: 2, qty_text: '2 CTN + 24 PCS', bonus: null }],
  items_count: 1, pandi_name: null, adda_name: null, pandi_from_erp: false, adda_from_erp: false, builty: none, history: [],
});
const webOrder = {
  id: 1, key: 'web-1', origin: 'website', code: 'ENG-1001', status: 'pending', source: 'website', placed_at: '2026-11-06T08:00:00+00:00',
  order_date: '2026-11-06', delivery_date: null, effective_date: '2026-11-06', today: '2026-11-06', total: 5000, total_scope: 'order', note: null,
  customer: { name: 'ویب گاہک', phone: '03001234567', address: 'Shop 1', city: 'Lahore' },
  items: [{ id: 1, name: 'England Classic Razer', unit: 'Carton', qty: 2 }], items_count: 1, pandi_name: null, adda_name: null, builty: none, history: [],
};

let host; let root;
async function mount(url, origin) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root.render(
      <UIProvider>
        <MemoryRouter initialEntries={[url]}>
          <Routes>
            <Route path="/orders/:id" element={<OrderDetail />} />
            <Route path="/erp-sales/:id" element={<OrderDetail origin={origin} />} />
          </Routes>
        </MemoryRouter>
      </UIProvider>,
    );
  });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
}
afterEach(() => { act(() => root.unmount()); host.remove(); Api.order.mockReset(); });

const text = () => host.textContent.replace(/\s+/g, ' ');

describe('ERP sale detail: mixed invoices', () => {
  it('shows only England lines, says other lines were left out, and labels the total as the whole invoice', async () => {
    Api.order.mockResolvedValue({ order: erpSale(2) });
    await mount('/erp-sales/4', 'erp');
    expect(Api.order).toHaveBeenCalledWith('4', undefined, 'erp');
    expect([...host.querySelectorAll('.item__name')].map((n) => n.textContent)).toEqual(['England Today Razor']);
    expect(host.querySelector('[data-testid="other-lines"]').textContent).toContain('دوسری کمپنیوں کا 2 سامان');
    expect(text()).toContain('پوری انوائس کی رقم');
    expect(text()).not.toContain('کل رقم');
    expect(host.querySelector('[data-testid="whole-invoice-total"]').textContent).toContain('صرف انگلینڈ کے سامان کی رقم ERP سے نہیں آتی');
  });

  it('an England-only invoice has no left-out note but still names the total as the invoice total', async () => {
    Api.order.mockResolvedValue({ order: erpSale(0) });
    await mount('/erp-sales/4', 'erp');
    expect(host.querySelector('[data-testid="other-lines"]')).toBeNull();
    expect(host.querySelector('[data-testid="whole-invoice-total"]')).toBeNull();
    expect(text()).toContain('پوری انوائس کی رقم');
  });

  it('a website order keeps "کل رقم"', async () => {
    Api.order.mockResolvedValue({ order: webOrder });
    await mount('/orders/1');
    expect(text()).toContain('کل رقم');
    expect(text()).not.toContain('پوری انوائس کی رقم');
  });
});

describe('ERP sale detail: product units', () => {
  it('shows an ERP line in the unit it was sold in (1 Carton), not its piece total', async () => {
    const sale = erpSale(0);
    sale.items = [
      { id: 1, name: 'England Today Razor', unit: 'Carton', qty: 1, qty_text: '1 Carton', bonus: null },
      { id: 2, name: 'England 5G', unit: 'Box', qty: 2, qty_text: '2 Box', bonus: '2 pcs' },
    ];
    Api.order.mockResolvedValue({ order: sale });
    await mount('/erp-sales/4', 'erp');
    const qty = [...host.querySelectorAll('.item__qty')].map((n) => n.textContent.replace(/\s+/g, ' ').trim());
    expect(qty[0]).toContain('1 Carton');
    expect(qty[1]).toContain('2 Box');
    expect(text()).not.toContain('576');
  });
});

describe('Order detail: when is this order from, and where did it come from', () => {
  // placed 2026-11-10 14:09 UTC = 7:09 رات in Karachi; server business today = 2026-11-10.
  const base = { ...webOrder, code: 'ENG-1024', placed_at: '2026-11-10T14:09:00+00:00', order_date: '2026-11-10', effective_date: '2026-11-10', today: '2026-11-10',
    history: [{ status: 'pending', note: 'Order admin dashboard se banaya gaya', at: '2026-11-10T14:09:00+00:00' }] };
  const chip = () => host.querySelector('[data-testid="date-tab"]').textContent.trim();
  const chips = () => [...host.querySelectorAll('[data-testid="date-tab"]')].map((n) => n.textContent.trim());

  it('today: "آج کا آرڈر", real date and Karachi time (19:09 → 7:09 رات), never "نیا آرڈر"', async () => {
    Api.order.mockResolvedValue({ order: { ...base, source: 'admin' } });
    await mount('/orders/24');
    expect(chip()).toBe('آج کا آرڈر');
    expect(text()).toContain('منگل');
    expect(text()).toContain('10 نومبر 2026');
    expect(host.querySelector('[data-testid="order-time"]').textContent).toContain('7:09 رات');
    expect(text()).not.toContain('نیا آرڈر');
    expect(text()).not.toContain('ریکارڈ کہاں سے');
    expect(text()).not.toContain('آرڈر کی حالت');
    // the opening timeline entry carries the date category too
    expect(chips()).toEqual(['آج کا آرڈر', 'آج کا آرڈر']);
  });

  it('tomorrow: a delivery date of tomorrow puts it in the Tomorrow tab → "کل کا آرڈر"', async () => {
    Api.order.mockResolvedValue({ order: { ...base, delivery_date: '2026-11-11', effective_date: '2026-11-11' } });
    await mount('/orders/24');
    expect(chip()).toBe('کل کا آرڈر');
    // the order date itself stays the real one; the delivery move is spelled out
    expect(text()).toContain('10 نومبر 2026');
    expect(host.querySelector('[data-testid="moved-delivery"]').textContent).toContain('کل');
  });

  it('previous: an older order → "پرانا آرڈر"', async () => {
    Api.order.mockResolvedValue({ order: { ...base, placed_at: '2026-11-03T05:30:00+00:00', order_date: '2026-11-03', effective_date: '2026-11-03' } });
    await mount('/orders/24');
    expect(chip()).toBe('پرانا آرڈر');
    expect(text()).toContain('3 نومبر 2026');
    expect(host.querySelector('[data-testid="order-time"]').textContent).toContain('10:30 صبح');
  });

  it('uses the Karachi business day: 20:30 UTC on the 9th is the 10th in Pakistan', async () => {
    Api.order.mockResolvedValue({ order: { ...base, placed_at: '2026-11-09T20:30:00+00:00', order_date: '2026-11-10', effective_date: '2026-11-10' } });
    await mount('/orders/24');
    expect(chip()).toBe('آج کا آرڈر');
    expect(host.querySelector('[data-testid="order-time"]').textContent).toContain('1:30 صبح');
  });

  it.each([
    ['website', 'انگلینڈ ویب سائٹ'],
    ['admin', 'ڈیش بورڈ'],
    ['', 'ذریعہ دستیاب نہیں'],
    ['something-new', 'ذریعہ دستیاب نہیں'],
  ])('source "%s" is shown as "%s"', async (source, label) => {
    Api.order.mockResolvedValue({ order: { ...base, source } });
    await mount('/orders/24');
    expect(host.querySelector('[data-testid="order-source"]').textContent).toContain(label);
  });

  it('an ERP sale names Accountrix ERP as its source', async () => {
    Api.order.mockResolvedValue({ order: erpSale(0) });
    await mount('/erp-sales/4', 'erp');
    expect(host.querySelector('[data-testid="order-source"]').textContent).toContain('Accountrix ERP');
    expect(chip()).toBe('آج کا آرڈر');
  });

  it('keeps the real status: a shipped order still says روانہ, a cancelled one warns; later timeline steps keep their status', async () => {
    Api.order.mockResolvedValue({ order: { ...base, status: 'shipped', history: [...base.history, { status: 'shipped', note: null, at: '2026-11-10T15:00:00+00:00' }] } });
    await mount('/orders/24');
    expect(text()).toContain('روانہ ہو گیا');
    act(() => root.unmount()); host.remove();
    Api.order.mockResolvedValue({ order: { ...base, status: 'cancelled' } });
    await mount('/orders/24');
    expect(text()).toContain('منسوخ ہو چکا ہے');
  });

  it('missing date or time is never filled in with "now"', async () => {
    Api.order.mockResolvedValue({ order: { ...base, placed_at: null, order_date: null, effective_date: null, history: [] } });
    await mount('/orders/24');
    expect(host.querySelector('[data-testid="date-tab"]')).toBeNull();
    expect(host.querySelector('[data-testid="order-time"]')).toBeNull();
    expect(text()).toContain('آرڈر کی تاریخ دستیاب نہیں');
  });

  it('keeps customer, phone, city, Pandi/Adda and quantities; never shows item prices', async () => {
    Api.order.mockResolvedValue({ order: { ...base, pandi_name: 'نیازی پنڈی', adda_name: 'پیر ودھائی اڈا', items: [{ id: 1, name: 'England Tissue 480 pcs 3 Ply', sub: '10 Bundle / 80 Box', unit: 'Carton', qty: 3, price: 999 }] } });
    await mount('/orders/24');
    expect(text()).toContain('ویب گاہک');
    expect(text()).toContain('03001234567');
    expect(text()).toContain('Lahore');
    expect(text()).toContain('نیازی پنڈی');
    expect(text()).toContain('پیر ودھائی اڈا');
    expect(host.querySelector('.item__qty').textContent).toContain('3');
    expect(text()).not.toContain('999');
    expect(host.querySelector('a.btn--call').getAttribute('href')).toBe('tel:03001234567');
  });
});
