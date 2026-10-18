import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';

const Login = lazy(() => import('./pages/Login'));
const Onboarding = lazy(() => import('./pages/Onboarding'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Campaigns = lazy(() => import('./pages/Campaigns'));
const Publisher = lazy(() => import('./pages/Publisher'));
const Admin = lazy(() => import('./pages/Admin'));

function Private({ children }) {
  const { user, loading, isSignedIn, profileRequired, authError } = useAuth();
  if (loading) return <div className="grid min-h-screen place-items-center">Loading AdPulse…</div>;
  if (!isSignedIn) return <Navigate to="/login" replace />;
  if (profileRequired) return <Navigate to="/onboarding" replace />;
  if (authError) return <div className="grid min-h-screen place-items-center p-6"><div className="card max-w-lg"><h1 className="font-bold">Couldn’t load your profile</h1><p className="mt-2 text-sm text-slate-600">{authError}</p><button className="btn mt-4" onClick={() => window.location.reload()}>Try again</button></div></div>;
  return user ? children : <div className="grid min-h-screen place-items-center">Loading AdPulse…</div>;
}

function OnboardingRoute({ children }) {
  const { user, loading, isSignedIn, profileRequired } = useAuth();
  if (loading) return <div className="grid min-h-screen place-items-center">Loading AdPulse…</div>;
  if (!isSignedIn) return <Navigate to="/login" replace />;
  if (user) return <Navigate to="/" replace />;
  return profileRequired ? children : <div className="grid min-h-screen place-items-center">Preparing your profile…</div>;
}

export default function App() {
  return <Suspense fallback={<div className="grid min-h-screen place-items-center text-slate-500">Loading AdPulse…</div>}>
    <Routes>
      <Route path="/login/*" element={<Login />} />
      <Route path="/sign-up/*" element={<Login mode="sign-up" />} />
      <Route path="/onboarding" element={<OnboardingRoute><Onboarding /></OnboardingRoute>} />
      <Route element={<Private><Layout /></Private>}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/campaigns" element={<Campaigns />} />
        <Route path="/publisher" element={<Publisher />} />
        <Route path="/admin" element={<Admin />} />
      </Route>
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  </Suspense>;
}
