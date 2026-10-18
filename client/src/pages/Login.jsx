import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';

export default function Login() {
  const { login, setUser } = useAuth();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const [mode, setMode] = useState(params.has('reset') ? 'reset' : 'login');
  const [form, setForm] = useState({ email: '', password: '', confirmPassword: '', name: '', role: 'advertiser', company: '' });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [previewLink, setPreviewLink] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const register = mode === 'register';
  const forgot = mode === 'forgot';
  const reset = mode === 'reset';

  useEffect(() => {
    const token = params.get('verify');
    if (!token) return;
    setBusy(true);
    api.post('/auth/verify-email/confirm', { token })
      .then(({ data }) => {
        localStorage.setItem('token', data.token);
        setUser(data.user);
        nav('/', { replace: true });
      })
      .catch((e) => {
        setError(e.response?.data?.message || 'That verification link is invalid or expired.');
        setMode('login');
      })
      .finally(() => setBusy(false));
  }, []);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    setPreviewLink('');
    try {
      if (register) {
        const { data } = await api.post('/auth/register', form);
        setMode('login');
        setNotice(data.message);
        setPreviewLink(data.previewLink || '');
      } else if (forgot) {
        const { data } = await api.post('/auth/forgot-password', { email: form.email });
        setNotice(data.message);
        setPreviewLink(data.previewLink || '');
      } else if (reset) {
        if (form.password !== form.confirmPassword) throw new Error('Passwords do not match.');
        const { data } = await api.post('/auth/reset-password', { token: params.get('reset'), password: form.password });
        setNotice(data.message);
        setMode('login');
        setParams({}, { replace: true });
      } else {
        await login(form);
        nav('/');
      }
    } catch (e) {
      const message = e.message === 'Passwords do not match.' ? e.message : (e.response?.data?.message || 'Unable to continue. Please try again.');
      setError(message);
      if (e.response?.data?.verificationRequired) setNotice('Your account needs demo verification. Generate a one-time link to continue.');
    } finally {
      setBusy(false);
    }
  };

  const generateVerificationLink = async () => {
    setBusy(true); setError(''); setNotice(''); setPreviewLink('');
    try {
      const { data } = await api.post('/auth/verify-email/link', { email: form.email });
      setNotice(data.message); setPreviewLink(data.previewLink || '');
    } catch (e) { setError(e.response?.data?.message || 'Could not send a verification link.'); }
    finally { setBusy(false); }
  };

  const heading = register ? 'Create your account' : forgot ? 'Reset your password' : reset ? 'Choose a new password' : 'Welcome back';
  const description = register ? 'Join as an advertiser or publisher.' : forgot ? (import.meta.env.PROD ? 'Password recovery for this free demo is handled by the project administrator.' : 'Generate a one-time local reset link for your account.') : reset ? 'Choose a new password for your AdPulse account.' : 'Sign in to continue to your AdPulse workspace.';

  return (
    <div className="grid min-h-screen bg-slate-950 lg:grid-cols-2">
      <section className="hidden bg-brand p-14 text-white lg:block">
        <p className="text-3xl font-bold">adpulse</p>
        <div className="mt-40"><h1 className="text-5xl font-bold leading-tight">Campaigns that make every impression count.</h1><p className="mt-6 max-w-md text-lg text-indigo-100">Plan, launch, monitor and optimize your digital advertising from one focused workspace.</p></div>
      </section>
      <section className="grid place-items-center p-5 sm:p-8">
        <form onSubmit={submit} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl sm:p-8">
          <h2 className="text-2xl font-bold">{heading}</h2>
          <p className="mt-2 text-sm text-slate-500">{description}</p>
          {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</p>}
          {notice && <p role="status" className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
          {previewLink && <a className="mt-3 inline-block break-all text-sm font-semibold text-brand underline" href={previewLink}>{register ? 'Open one-time demo verification link' : forgot ? 'Open one-time demo reset link' : 'Open one-time demo link'}</a>}
          {register && <>
            <label>Full name<input required minLength="2" autoComplete="name" value={form.name} onChange={(e) => set('name', e.target.value)} /></label>
            <label>Company <span className="text-slate-400">(optional)</span><input autoComplete="organization" value={form.company} onChange={(e) => set('company', e.target.value)} /></label>
            <label>Account type<select value={form.role} onChange={(e) => set('role', e.target.value)}><option value="advertiser">Advertiser</option><option value="publisher">Publisher</option></select></label>
          </>}
          {!reset && !(forgot && import.meta.env.PROD) && <label>Email address<input required type="email" autoComplete="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="you@example.com" /></label>}
          {!forgot && <label>{register || reset ? 'Password' : 'Password'}<input required minLength={register || reset ? 8 : undefined} type="password" autoComplete={register || reset ? 'new-password' : 'current-password'} value={form.password} onChange={(e) => set('password', e.target.value)} placeholder={register || reset ? 'At least 8 characters' : 'Enter your password'} /></label>}
          {reset && <label>Confirm password<input required minLength="8" type="password" autoComplete="new-password" value={form.confirmPassword} onChange={(e) => set('confirmPassword', e.target.value)} /></label>}
          {forgot && import.meta.env.PROD && <p className="mt-5 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">No email provider is configured, so the deployed demo cannot safely send a password-reset link. Contact the project administrator for help.</p>}
          {!(forgot && import.meta.env.PROD) && <button disabled={busy} className="btn mt-5 w-full">{busy ? 'Please wait…' : register ? 'Create account' : forgot ? 'Generate reset link' : reset ? 'Update password' : 'Sign in'}</button>}
          {!register && !forgot && !reset && <button type="button" onClick={() => { setMode('forgot'); setError(''); setNotice(''); }} className="mt-4 w-full text-sm text-slate-600 hover:text-brand">Forgot password?</button>}
          {!register && !forgot && !reset && notice.includes('needs demo verification') && <button type="button" disabled={busy} onClick={generateVerificationLink} className="mt-3 w-full text-sm font-semibold text-brand">Generate a new demo verification link</button>}
          <button type="button" onClick={() => { setMode(register ? 'login' : 'register'); setError(''); setNotice(''); setPreviewLink(''); }} className="mt-5 w-full text-sm font-medium text-brand">{register ? 'Already registered? Sign in' : 'Need an account? Register'}</button>
          {(forgot || reset) && <button type="button" onClick={() => { setMode('login'); setError(''); setNotice(''); if (reset) setParams({}, { replace: true }); }} className="mt-3 w-full text-sm text-slate-600">Back to sign in</button>}
        </form>
      </section>
    </div>
  );
}
