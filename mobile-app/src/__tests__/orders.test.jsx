import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../lib/api.js';

vi.mock('../lib/api.js', async (orig) => {
  const real = await orig();
  return { ...real, Api: { ...real.Api, orders: vi.fn() } };
});

const { Api } = await import('../lib/api.js');
const { UIProvider } = await import('../state/app.jsx');
const { default: Orders } = await import('../screens/Orders.jsx');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const COUNTS = { today: 2, tomorrow: 1, previous: 0, all: 3 };
const card = (id, code, extra = {}) => ({
  id, code, status: 'pending', customer: { name: `گاہک ${id}`, phone: '03001234567', city: 'لاہور' },
  adda_name: 'نیازی اڈا', items: [{ id: id * 10, name: 'England 5G', unit: 'Carton', qty: 2 }],
  builty: { front: { uploaded: false }, back: { uploaded: false }, uploaded_count: 0, complete: false }, ...extra,
});
// An Accountrix ERP sale shares the lists; its id (1) overlaps a website order's id on purpose.
const erpCard = card(1, 'INV-77', {
  key: 'erp-1', origin: 'erp', status: 'posted', customer: { name: 'ERP گاہک', phone: '03217654321', city: 'ملتان' },
  items: [{ id: 11, name: 'England Today Razor', unit: 'CTN', qty: 2, qty_text: '2 CTN + 24 PCS', bonus: '6 PCS' }],
});
const LISTS = {
  today: [card(1, 'ENG-1001'), card(2, 'ENG-1002', { builty: { front: { uploaded: true }, back: { uploaded: true }, uploaded_count: 2, complete: true } })],
  tomorrow: [card(3, 'ENG-1003')],
  previous: [],
  all: [card(1, 'ENG-1001', { key: 'web-1', origin: 'website' }), erpCard],
};
const reply = (tab) => ({ orders: LISTS[tab], counts: COUNTS, meta: { tab, page: 1, last_page: 1, total: COUNTS[tab], today: '2026-11-05' } });

let host; let root; let location;
function Where() { location = useLocation(); return null; }

async function mount(url = '/') {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root.render(
      <UIProvider>
        <MemoryRouter initialEntries={[url]}>
          <Where />
          <Routes>
            <Route path="/" element={<Orders />} />
            <Route path="*" element={<p id="elsewhere" />} />
          </Routes>
        </MemoryRouter>
      </UIProvider>,
    );
  });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
}

const tabs = () => [...host.querySelectorAll('[role="tab"]')];
const names = () => [...host.querySelectorAll('.ocard__name')].map((n) => n.textContent);
async function click(el) { await act(async () => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); }); await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); }

beforeEach(() => {
  vi.stubGlobal('IntersectionObserver', class { observe() {} disconnect() {} });
  window.scrollTo = vi.fn();
  Api.orders.mockReset();
  Api.orders.mockImplementation(async ({ tab }) => reply(tab));
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.unstubAllGlobals(); });

describe('Orders screen navigation', () => {
  it('shows the four order tabs at the top with counts, and the same four in the bottom bar', async () => {
    await mount();
    expect(tabs().map((t) => t.querySelector('.seg__full').textContent)).toEqual(['آج کے آرڈر', 'کل کے آرڈر', 'پچھلے آرڈرز', 'تمام آرڈر']);
    expect(tabs().map((t) => t.querySelector('.seg__count')?.textContent)).toEqual(['2', '1', '0', '3']);
    expect(tabs()[0].getAttribute('aria-selected')).toBe('true');
    expect(host.querySelector('.segbar')).not.toBeNull();
    const bottom = [...document.querySelectorAll('.tabbar .tabbar__tab')];
    expect(bottom.map((b) => b.querySelector('.tabbar__label').textContent)).toEqual(['آج کے آرڈر', 'کل کے آرڈر', 'پچھلے آرڈرز', 'تمام آرڈر']);
    expect(bottom[0].getAttribute('aria-current')).toBe('page');
    expect(Api.orders).toHaveBeenCalledWith(expect.objectContaining({ tab: 'today', page: 1 }), expect.anything());
    expect(names()).toEqual(['گاہک 1', 'گاہک 2']);
  });

  it('switches lists from the bottom bar and keeps the top tabs in step', async () => {
    await mount();
    const bottom = () => [...document.querySelectorAll('.tabbar .tabbar__tab')];
    await click(bottom()[3]);
    expect(Api.orders).toHaveBeenLastCalledWith(expect.objectContaining({ tab: 'all' }), expect.anything());
    expect(tabs()[3].getAttribute('aria-selected')).toBe('true');
    expect(bottom()[3].getAttribute('aria-current')).toBe('page');
    await click(tabs()[1]);
    expect(bottom()[1].getAttribute('aria-current')).toBe('page');
    expect(bottom().filter((b) => b.getAttribute('aria-current')).length).toBe(1);
  });

  it('loads the right list for each tab and marks the selected one', async () => {
    await mount();
    await click(tabs()[1]);
    expect(location.search).toContain('tab=tomorrow');
    expect(Api.orders).toHaveBeenLastCalledWith(expect.objectContaining({ tab: 'tomorrow' }), expect.anything());
    expect(tabs()[1].getAttribute('aria-selected')).toBe('true');
    expect(host.querySelector('.listhead__title').textContent).toContain('کل کے آرڈر');
    expect(names()).toEqual(['گاہک 3']);
    expect(host.querySelector('.olist').className).toContain('olist--from-left');

    await click(tabs()[2]);
    expect(Api.orders).toHaveBeenLastCalledWith(expect.objectContaining({ tab: 'previous' }), expect.anything());
    expect(names()).toEqual([]);
    expect(host.querySelector('.empty h3').textContent).toBe('کوئی پچھلا آرڈر نہیں');

    await click(tabs()[0]);
    expect(names()).toEqual(['گاہک 1', 'گاہک 2']);
    expect(host.querySelector('.olist').className).toContain('olist--from-right');
  });

  it('lists ERP sales next to website orders, marked as ERP, and opens the ERP sale', async () => {
    await mount('/?tab=all');
    expect(Api.orders).toHaveBeenLastCalledWith(expect.objectContaining({ tab: 'all' }), expect.anything());
    const cards = host.querySelectorAll('.ocard');
    expect(cards.length).toBe(2); // same numeric id, different records — both shown
    expect(cards[0].querySelector('.origin').textContent).toBe('ویب سائٹ');
    expect(cards[1].querySelector('.origin').textContent).toBe('ERP');
    expect(cards[1].querySelector('.ocard__id').textContent).toContain('انوائس نمبر');
    expect(cards[1].querySelector('.ocard__qty').textContent).toContain('2 CTN + 24 PCS');
    expect(cards[1].querySelector('.ocard__qty').textContent).toContain('6 PCS');
    await click(cards[1].querySelector('.ocard__items'));
    expect(location.pathname).toBe('/erp-sales/1');
  });

  it('opens the ERP sale Builty from its own button', async () => {
    await mount('/?tab=all');
    await click(host.querySelectorAll('.ocard')[1].querySelector('.bbtn'));
    expect(location.pathname).toBe('/erp-sales/1/builty/upload');
  });

  it('says when the ERP cannot be reached but keeps the list', async () => {
    Api.orders.mockImplementation(async ({ tab }) => ({ ...reply(tab), sources: { erp: { enabled: true, ok: false, error: 'erp_unreachable' } } }));
    await mount();
    expect(host.querySelector('.notice--warn').textContent).toContain('ERP سے رابطہ نہیں ہو سکا');
    expect(names()).toEqual(['گاہک 1', 'گاہک 2']);
  });

  it('opens an order from the card, but the Builty button only opens Builty', async () => {
    await mount();
    await click(host.querySelectorAll('.ocard')[1].querySelector('.bbtn'));
    expect(location.pathname).toBe('/orders/2/builty');
  });

  it('opens order details when the card itself is tapped', async () => {
    await mount();
    await click(host.querySelectorAll('.ocard')[0].querySelector('.ocard__items'));
    expect(location.pathname).toBe('/orders/1');
  });

  it('keeps the card layout: order number and city on the left, name on the right, no prices', async () => {
    await mount();
    const top = host.querySelector('.ocard__top');
    expect([...top.children].map((c) => c.className.split(' ')[0])).toEqual(['ocard__name', 'ocard__id', 'ocard__city']);
    expect(host.querySelector('.ocard').textContent).not.toMatch(/Rs|روپے/);
    const ocard = host.querySelector('.ocard');
    const order = [...ocard.children].map((c) => c.className.split(' ')[0]);
    expect(order).toEqual(['ocard__top', 'ocard__sec', 'ocard__sec', 'bbtn']);
  });

  it('explains an outdated server instead of "something went wrong"', async () => {
    Api.orders.mockRejectedValue(new ApiError('سرور پر ابھی پرانا سسٹم چل رہا ہے', 200, { reason: 'server_outdated' }));
    await mount('/?status=confirmed'); // a list not loaded before, so nothing cached to fall back on
    expect(host.querySelector('.empty--error h3').textContent).toBe('سرور اپ ڈیٹ نہیں ہوا');
    expect(host.querySelector('.empty--error p').textContent).toContain('پرانا سسٹم');
  });

  it('switches tabs with the arrow keys (RTL: ← goes to the next tab)', async () => {
    await mount();
    await act(async () => { tabs()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })); });
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    expect(location.search).toContain('tab=tomorrow');
  });

  it('re-checks the list every minute while open at the top, so new orders and ERP sales appear on their own', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    try {
      await mount('/?tab=all');
      const before = Api.orders.mock.calls.length;
      Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
      LISTS.all = [...LISTS.all, card(9, 'ENG-1009', { key: 'web-9', origin: 'website' })];
      await act(async () => { vi.advanceTimersByTime(60_000); });
      await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
      expect(Api.orders.mock.calls.length).toBe(before + 1);
      expect(names()).toContain('گاہک 9');
      // Reading further down the list: no automatic reload that would jump the list.
      Object.defineProperty(window, 'scrollY', { value: 900, configurable: true });
      await act(async () => { vi.advanceTimersByTime(60_000); });
      expect(Api.orders.mock.calls.length).toBe(before + 1);
    } finally {
      LISTS.all = LISTS.all.filter((o) => o.code !== 'ENG-1009');
      Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
      vi.useRealTimers();
    }
  });

  it('labels an ERP card by its invoice number for screen readers', async () => {
    await mount('/?tab=all');
    const labels = [...host.querySelectorAll('.ocard')].map((c) => c.getAttribute('aria-label'));
    expect(labels).toContain('انوائس INV-77 — ERP گاہک');
    expect(labels).toContain('آرڈر ENG-1001 — گاہک 1');
  });
});
