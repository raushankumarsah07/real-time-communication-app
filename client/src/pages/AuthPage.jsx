import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { errorMessage } from '../api';

export default function AuthPage({ mode }) {
  const isLogin = mode === 'login';
  const { authenticate } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await authenticate(isLogin ? 'login' : 'register', form);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="aurora aurora-one" />
      <div className="aurora aurora-two" />
      <div className="auth-visual">
        <div className="orbit orbit-one" />
        <div className="orbit orbit-two" />
        <div className="floating-card floating-card-top"><span className="status-dot" /> Live collaboration</div>
        <div className="floating-card floating-card-bottom">4K <span>crystal clear video</span></div>
        <div className="hero-mark"><span className="mark-dot" /><span className="mark-dot" /><span className="mark-dot" /></div>
      </div>
      <div className="auth">
        <div className="eyebrow">THE FUTURE OF MEETINGS</div>
        <h1 className="logo big">meetly<span className="logo-dot">.</span></h1>
        <p className="auth-lede">Meet, share and create together<br />in one beautiful space.</p>
        <div className="feature-row">
          <span>Video</span><span>Whiteboard</span><span>Secure</span>
        </div>
        <form className="card auth-card" onSubmit={submit}>
          <div className="form-heading">
            <h2>{isLogin ? 'Welcome back' : 'Create your space'}</h2>
            <span className="secure-lock">Secure</span>
          </div>
          {!isLogin && (
            <label>Your name
              <input value={form.name} onChange={set('name')} maxLength={50} required autoFocus />
            </label>
          )}
          <label>Email
            <input type="email" value={form.email} onChange={set('email')} required autoFocus={isLogin} />
          </label>
          <label>Password
            <input type="password" value={form.password} onChange={set('password')} required minLength={isLogin ? 1 : 8}
              placeholder={isLogin ? '' : 'At least 8 characters'} />
          </label>
          {error && <p className="error">{error}</p>}
          <button className="btn wide" disabled={busy}>{busy ? 'Please wait…' : isLogin ? 'Enter your workspace' : 'Create my workspace'}</button>
          <p className="muted center">
            {isLogin ? <>New here? <Link to="/register">Create an account</Link></> : <>Have an account? <Link to="/login">Log in</Link></>}
          </p>
        </form>
      </div>
    </div>
  );
}
