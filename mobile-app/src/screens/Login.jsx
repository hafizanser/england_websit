import { useState } from 'react';
import { useAuth } from '../state/app.jsx';
import { Button, Icon, Notice, Num, Spinner } from '../components/ui.jsx';
import { API_BASE, APP_VERSION } from '../config.js';

export default function Login() {
  const { login, expired } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    if (!username.trim() || !password) { setError('یوزر نیم اور پاس ورڈ دونوں لکھیں۔'); return; }
    setBusy(true); setError('');
    try {
      await login(username.trim(), password);
    } catch (err) {
      setError(err.message || 'لاگ اِن نہیں ہو سکا۔ دوبارہ کوشش کریں۔');
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <div className="login__hero">
        <span className="login__logo"><img src="./icon-192.png" alt="England" /></span>
        <h1>انگلینڈ آرڈرز</h1>
        <p>آرڈر، ڈیلیوری اور پنڈی سلپ — ٹیم کے لیے</p>
      </div>

      <form className="card login__card" onSubmit={submit} noValidate>
        <h2>لاگ اِن کریں</h2>
        {expired && <Notice tone="warn" icon="clock" className="notice--flush">آپ کا سیشن ختم ہو گیا تھا۔ دوبارہ لاگ اِن کریں۔</Notice>}
        <label className="field">
          <span className="field__label">یوزر نیم</span>
          <input className="input" autoComplete="username" autoCapitalize="none" spellCheck={false} value={username} dir="ltr"
            onChange={(e) => setUsername(e.target.value)} disabled={busy} />
        </label>
        <label className="field">
          <span className="field__label">پاس ورڈ</span>
          <span className="input-wrap">
            <input className="input" type={show ? 'text' : 'password'} autoComplete="current-password" value={password} dir="ltr"
              onChange={(e) => setPassword(e.target.value)} disabled={busy} />
            <button type="button" className="input-wrap__btn" onClick={() => setShow((s) => !s)}>{show ? 'چھپائیں' : 'دکھائیں'}</button>
          </span>
        </label>
        {error && <p className="form-error" role="alert"><Icon name="alert" size={17} /> <span>{error}</span></p>}
        <Button type="submit" disabled={busy} busy={busy} className="login__submit">
          {busy ? <><Spinner size={18} /> لاگ اِن ہو رہا ہے…</> : 'لاگ اِن کریں'}
        </Button>
        <p className="login__hint">یہ ایپ صرف انگلینڈ ٹیم کے لیے ہے۔ وہی یوزر نیم اور پاس ورڈ لکھیں جو ویب سائٹ کے ایڈمن پینل میں استعمال کرتے ہیں۔</p>
      </form>

      <p className="login__ver">ورژن <Num>{APP_VERSION}</Num>{API_BASE ? <> · <Num>{API_BASE.replace(/^https?:\/\//, '')}</Num></> : <> · مقامی سرور</>}</p>
    </div>
  );
}
