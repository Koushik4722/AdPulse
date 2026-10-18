import { useEffect, useState } from 'react';
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';

const Card = ({ label, value, sub }) => (
  <div className="card">
    <p className="text-sm text-slate-500">{label}</p>
    <p className="mt-2 text-2xl font-bold">{value}</p>
    {sub && <p className="mt-1 text-xs text-emerald-600">{sub}</p>}
  </div>
);

const userId = (user) => String(user?._id || user?.id || '');

function AiInsights({ role }) {
  const [insight, setInsight] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const generate = async () => {
    setBusy(true); setError('');
    try { const { data: result } = await api.post('/insights/ai-summary'); setInsight(result); }
    catch (e) { setError(e.response?.data?.message || 'Could not generate insights. Please try again.'); }
    finally { setBusy(false); }
  };
  return (
    <section className="card mt-6 border-indigo-100 bg-gradient-to-br from-white to-indigo-50/70" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">AdPulse intelligence</p><h3 className="mt-1 text-lg font-semibold">AI performance coach</h3><p className="mt-1 text-sm text-slate-500">Evidence-based observations and next steps from your recent campaign data.</p></div>
        <button className="btn" disabled={busy} onClick={generate}>{busy ? 'Analyzing…' : insight ? 'Refresh insights' : 'Analyze performance'}</button>
      </div>
      {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {insight && <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl bg-white/80 p-4 lg:col-span-1"><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Summary</p><p className="mt-2 text-sm leading-6 text-slate-700">{insight.summary}</p><p className="mt-3 text-xs text-slate-400">{insight.source === 'ai-assisted' ? 'AI-assisted · based on your data' : 'Metrics-based insight'} · last 7 days vs previous 7</p></div>
        <div className="rounded-xl bg-white/80 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">What stands out</p>{insight.observations?.length ? <ul className="mt-2 space-y-2 text-sm text-slate-700">{insight.observations.map((item, i) => <li key={i}>• {item}</li>)}</ul> : <p className="mt-2 text-sm text-slate-500">No unusual trend detected.</p>}</div>
        <div className="rounded-xl bg-white/80 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Suggested next steps</p><ol className="mt-2 space-y-2 text-sm text-slate-700">{insight.actions?.map((item, i) => <li key={i}><span className="mr-2 font-semibold text-indigo-600">{i + 1}.</span>{item}</li>)}</ol></div>
      </div>}
      {!insight && !busy && !error && <p className="mt-4 text-sm text-slate-500">Generate an analysis when you’re ready. It compares the last two weeks and won’t invent a trend when the data is sparse.</p>}
    </section>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { metric, live } = useSocket();
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    setLoadError('');
    api.get(user.role === 'publisher' ? '/publisher/summary' : '/insights/dashboard')
      .then((r) => setData(r.data))
      .catch(() => setLoadError('We could not load your dashboard data. Check your connection and try again.'));
  }, [user.role]);

  useEffect(() => {
    if (!data || !metric) return;
    const uid = userId(user);
    const relevant =
      user.role === 'admin' ||
      (user.role === 'advertiser' && metric.advertiserId === uid) ||
      (user.role === 'publisher' && metric.publisherId === uid);
    if (!relevant) return;

    setData((current) => {
      if (!current) return current;
      const addImp = metric.type === 'impression' ? 1 : 0;
      const addClk = metric.type === 'click' ? 1 : 0;
      const impressions = (current.impressions || 0) + addImp;
      const clicks = (current.clicks || 0) + addClk;
      const spent = (current.spent || 0) + (metric.deltaSpent || 0);
      const earnings = (current.earnings || 0) + (metric.deltaEarnings || 0);
      const series = Array.isArray(current.series)
        ? current.series.map((row, i) =>
            i === current.series.length - 1
              ? {
                  ...row,
                  impressions: (row.impressions || 0) + addImp,
                  clicks: (row.clicks || 0) + addClk,
                  spent: Number(((row.spent || 0) + (metric.deltaSpent || 0)).toFixed(2)),
                  ctr: (row.impressions || 0) + addImp
                    ? Number((((row.clicks || 0) + addClk) / ((row.impressions || 0) + addImp)) * 100).toFixed
                      ? Number(((((row.clicks || 0) + addClk) / ((row.impressions || 0) + addImp)) * 100).toFixed(2))
                      : 0
                    : 0
                }
              : row
          )
        : current.series;
      return {
        ...current,
        impressions,
        clicks,
        spent,
        earnings,
        series,
        ctr: impressions ? Number(((clicks / impressions) * 100).toFixed(2)) : 0
      };
    });
  }, [metric]);

  if (!data && loadError) return <div className="card"><p role="alert" className="text-sm text-red-700">{loadError}</p><button className="btn mt-4" onClick={() => { setData(null); setLoadError(''); api.get(user.role === 'publisher' ? '/publisher/summary' : '/insights/dashboard').then((r) => setData(r.data)).catch(() => setLoadError('We could not load your dashboard data. Check your connection and try again.')); }}>Try again</button></div>;
  if (!data) return <p>Loading analytics…</p>;

  if (user.role === 'publisher') {
    return (
      <>
        <h2 className="section-title">Publisher performance</h2>
        <div className="grid gap-4 md:grid-cols-4">
          <Card label="Total revenue" value={`₹${Number(data.earnings || 0).toLocaleString()}`} />
          <Card label="Approved sites" value={data.activeAds || 0} sub={live ? 'Live socket connected' : undefined} />
          <Card label="Impressions" value={(data.impressions || 0).toLocaleString()} />
          <Card label="CTR" value={`${data.ctr}%`} />
        </div>
        <div className="card mt-6">
          <h3 className="font-semibold">Your active sites</h3>
          {(data.sites || []).map((s) => (
            <p className="mt-3 text-sm" key={s._id}>
              {s.name} <span className="text-slate-400">{s.url}</span>
            </p>
          ))}
        </div>
        <AiInsights role={user.role} />
      </>
    );
  }

  return (
    <>
      <h2 className="section-title">Performance overview</h2>
      <div className="grid gap-4 md:grid-cols-4">
        <Card label="Impressions" value={(data.impressions || 0).toLocaleString()} sub={live ? 'Live this week' : 'This week'} />
        <Card label="Clicks" value={(data.clicks || 0).toLocaleString()} />
        <Card label="CTR" value={`${data.ctr}%`} />
        <Card label="Spent" value={`₹${Number(data.spent || 0).toLocaleString()}`} />
      </div>
      <div className="card mt-6 h-80">
        <h3 className="font-semibold">Weekly campaign delivery</h3>
        <ResponsiveContainer width="100%" height="90%">
          <LineChart data={data.series}>
            <XAxis dataKey="day" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="impressions" stroke="#5b5bf7" strokeWidth={3} />
            <Line type="monotone" dataKey="clicks" stroke="#10b981" strokeWidth={3} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <AiInsights role={user.role} />
    </>
  );
}
