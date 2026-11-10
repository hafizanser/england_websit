import { useRef } from 'react';
import { useAuth, useTheme, useUI } from '../state/app.jsx';
import { API_BASE, APP_VERSION } from '../config.js';
import { cx } from '../lib/format.js';
import { AppBar, Icon, Num } from '../components/ui.jsx';

const THEMES = [
  ['light', 'روشن', 'sun'],
  ['dark', 'گہرا', 'moon'],
  ['system', 'فون کے مطابق', 'phoneSet'],
];

export default function Account() {
  const { user, logout } = useAuth();
  const { mode, choose } = useTheme();
  const ui = useUI();
  const leaving = useRef(false);

  const signOut = () => {
    if (leaving.current) return;
    ui.confirm({
      title: 'لاگ آؤٹ کریں؟',
      body: 'کیا آپ واقعی اس فون سے لاگ آؤٹ کرنا چاہتے ہیں؟ دوبارہ استعمال کے لیے یوزر نیم اور پاس ورڈ لکھنا ہو گا۔',
      okLabel: 'لاگ آؤٹ',
      danger: true,
      onOk: async () => {
        leaving.current = true;
        ui.toast('لاگ آؤٹ ہو رہا ہے…');
        try { await logout(); } finally { leaving.current = false; }
        ui.toast('لاگ آؤٹ ہو گیا');
      },
    });
  };

  return (
    <div className="screen">
      <AppBar back title="میرا اکاؤنٹ" />
      <main className="content">
        <div className="profile">
          <span className="profile__badge"><img src="./icon-192.png" alt="" /></span>
          <h2 className="profile__name"><Num>{user?.username || '—'}</Num></h2>
          <p className="profile__role">انگلینڈ آرڈر ٹیم · ایڈمن</p>
        </div>

        <section className="card dcard">
          <div className="dcard__head"><h3><span className="dcard__ic"><Icon name="sun" size={17} strokeWidth={2.1} /></span> ایپ کا رنگ</h3></div>
          <div className="choices choices--3">
            {THEMES.map(([v, l, ic]) => (
              <button key={v} type="button" className={cx('choice choice--tile', mode === v && 'is-on')} onClick={() => choose(v)} aria-pressed={mode === v}>
                <Icon name={ic} size={22} /><span>{l}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="card dcard">
          <div className="dcard__head"><h3><span className="dcard__ic"><Icon name="info" size={17} strokeWidth={2.1} /></span> ایپ کے بارے میں</h3></div>
          <dl className="rows">
            <div className="rows__row"><dt>ورژن</dt><dd><Num>{APP_VERSION}</Num></dd></div>
            <div className="rows__row"><dt>سرور</dt><dd>{API_BASE ? <Num>{API_BASE.replace(/^https?:\/\//, '')}</Num> : 'مقامی سرور'}</dd></div>
          </dl>
          <p className="muted small">یہ ایپ صرف آرڈر دیکھنے، ڈیلیوری کی معلومات لکھنے اور بلٹی کی تصاویر لگانے کے لیے ہے۔ آرڈر کا سامان اور اسٹاک یہاں سے تبدیل نہیں ہوتے۔</p>
        </section>

        <div className="gutter">
          <button type="button" className="btn btn--outline-danger" onClick={signOut}>
            <Icon name="logout" size={20} /> لاگ آؤٹ
          </button>
        </div>
      </main>
    </div>
  );
}
