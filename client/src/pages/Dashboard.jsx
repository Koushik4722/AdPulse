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

export default function Dashboard() {
  const { user } = useAuth();
  const { metric, live } = useSocket();
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get(user.role === 'publisher' ? '/publisher/summary' : '/insights/dashboard').then((r) => setData(r.data));
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

  if (!data) return <p>Loading analytics…</p>;

  if (user.role === 'publisher') {
    return (
      <>
        <h2 className="section-title">Publisher performance</h2>
        <div className="grid gap-4 md:grid-cols-4">
          <Card label="Today's revenue" value={`₹${Math.round((data.earnings || 0) / 30)}`} />
          <Card label="Total revenue" value={`₹${Number(data.earnings || 0).toLocaleString()}`} sub={live ? 'Live socket connected' : undefined} />
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
      <div className="card mt-6">
        <h3 className="font-semibold">AI analytics summary</h3>
        <p className="mt-2 text-sm text-slate-600">
          Your CTR is {data.ctr}% across {(data.impressions || 0).toLocaleString()} impressions. Test fresh creatives and
          focus spend on the audience segments generating the most clicks.
        </p>
      </div>
    </>
  );
}
