import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';

const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Campaigns = lazy(() => import('./pages/Campaigns'));
const Publisher = lazy(() => import('./pages/Publisher'));
const Admin = lazy(() => import('./pages/Admin'));

function Private({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="grid min-h-screen place-items-center">Loading AdPulse…</div>;
  return user ? children : <Navigate to="/login" />;
}

export default function App() {
  return <Suspense fallback={<div className="grid min-h-screen place-items-center text-slate-500">Loading AdPulse…</div>}>
    <Routes>
      <Route path="/login" element={<Login />} />
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
