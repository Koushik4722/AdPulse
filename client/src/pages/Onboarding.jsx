import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Onboarding() {
  const { createProfile } = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState('advertiser');
  const [company, setCompany] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true); setError('');
    try {
      await createProfile({ role, company });
      navigate('/', { replace: true });
    } catch (e) {
      setError(e.response?.data?.message || 'Could not finish setting up your profile. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return <div className="grid min-h-screen place-items-center bg-slate-50 p-5">
    <form onSubmit={submit} className="card w-full max-w-lg">
      <p className="text-sm font-semibold uppercase tracking-wider text-indigo-600">One last step</p>
      <h1 className="mt-2 text-2xl font-bold">Set up your AdPulse profile</h1>
      <p className="mt-2 text-slate-600">Choose how you’ll use AdPulse. Your account is secured by Clerk.</p>
      {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <label className="mt-5">I am a
        <select value={role} onChange={(event) => setRole(event.target.value)}>
          <option value="advertiser">Advertiser</option>
          <option value="publisher">Publisher</option>
        </select>
      </label>
      <label>Company <span className="text-slate-400">(optional)</span>
        <input maxLength="120" value={company} onChange={(event) => setCompany(event.target.value)} placeholder="Your company or website name" />
      </label>
      <button className="btn mt-5 w-full" disabled={busy}>{busy ? 'Setting up…' : 'Continue to AdPulse'}</button>
      <p className="mt-4 text-xs leading-5 text-slate-500">Administrator access is assigned only to emails configured by the project owner; it can’t be selected here.</p>
    </form>
  </div>;
}
