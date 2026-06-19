// src/pages/AuthPage.jsx
import { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext.jsx';
import { api } from '../lib/api.js';

export default function AuthPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ username:'', alias:'', email:'', password:'' });
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  // Admin invite handling
  const [inviteToken, setInviteToken] = useState(null);
  const [inviteEmail, setInviteEmail] = useState(null);
  const [inviteError, setInviteError] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('adminInvite');
    if (!token) return;
    setInviteToken(token);
    setMode('register');
    api.validateInvite(token)
      .then(res => {
        setInviteEmail(res.email);
        setForm(f => ({ ...f, email: res.email }));
      })
      .catch(e => setInviteError(e.message || 'This invite is not valid'));
  }, []);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault(); setErr(''); setLoading(true);
    try {
      if (mode === 'login') {
        await login(form.username, form.password);
      } else {
        const payload = { ...form };
        if (inviteToken) payload.adminInviteToken = inviteToken;
        await register(payload);
        // clear the invite token from the URL after success
        if (inviteToken) window.history.replaceState({}, '', '/');
      }
    } catch (ex) { setErr(ex.message); }
    finally { setLoading(false); }
  }

  const isAdminInvite = !!inviteToken && !inviteError;

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-logo">⚽</div>
        <div className="auth-title">KickBet</div>
        <div className="auth-sub">FIFA Match Betting Platform</div>

        {/* Admin invite banner */}
        {isAdminInvite && (
          <div style={{background:'#e8f5ed',border:'1px solid #b2dfca',borderRadius:8,padding:'10px 12px',marginBottom:16,fontSize:13,color:'#1a7a3c'}}>
            🛡️ <strong>Admin invitation</strong><br/>
            <span style={{fontSize:12,color:'#555'}}>
              You're creating an admin account for <strong>{inviteEmail}</strong>. Fill in the rest to continue.
            </span>
          </div>
        )}
        {inviteError && (
          <div style={{background:'#fceaea',border:'1px solid #f5c6c6',borderRadius:8,padding:'10px 12px',marginBottom:16,fontSize:13,color:'#c0392b'}}>
            ⚠ {inviteError}. You can still register as a regular user below.
          </div>
        )}

        <form onSubmit={submit}>
          <div className="field"><label>Username</label>
            <input value={form.username} onChange={set('username')} placeholder="Enter username" required />
          </div>

          {mode === 'register' && <>
            <div className="field"><label>Alias <span style={{color:'#aaa',fontWeight:400}}>(shown to others)</span></label>
              <input value={form.alias} onChange={set('alias')} placeholder="e.g. GhostStriker" />
            </div>
            <div className="field"><label>Email {isAdminInvite && <span style={{color:'#1a7a3c'}}>(locked to invite)</span>}</label>
              <input type="email" value={form.email} onChange={set('email')} placeholder="Your email" required
                readOnly={isAdminInvite}
                style={isAdminInvite ? {background:'#f0f0f0',color:'#888'} : {}} />
            </div>
          </>}

          <div className="field"><label>Password</label>
            <input type="password" value={form.password} onChange={set('password')} placeholder="Password" required />
          </div>

          {err && <div style={{color:'#c0392b',fontSize:13,marginBottom:10}}>{err}</div>}

          <button className="btn btn-green btn-full" disabled={loading}>
            {loading ? 'Please wait…'
              : mode === 'login' ? 'Sign in'
              : isAdminInvite ? '🛡️ Create admin account'
              : 'Create account'}
          </button>
        </form>

        {!isAdminInvite && (
          <span className="toggle-link" onClick={() => { setMode(m => m === 'login' ? 'register' : 'login'); setErr(''); }}>
            {mode === 'login' ? 'New here? Create an account' : 'Already have an account? Sign in'}
          </span>
        )}
      </div>
    </div>
  );
}
