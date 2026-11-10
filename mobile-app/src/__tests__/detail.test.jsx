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
