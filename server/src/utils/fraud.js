import FraudEvent from '../models/FraudEvent.js';

const clickHistory = new Map();
const ipCampaignStats = new Map();
const blockedIps = new Set();
const lastLog = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [key, stamps] of clickHistory.entries()) {
    const recent = stamps.filter((t) => now - t < 120000);
    if (recent.length) clickHistory.set(key, recent);
    else clickHistory.delete(key);
  }
}, 60000);

const hostOf = (value) => {
  try {
    return new URL(value).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
};

const shouldPersist = (key) => {
  const prev = lastLog.get(key) || 0;
  if (Date.now() - prev < 15000) return false;
  lastLog.set(key, Date.now());
  return true;
};

async function recordFraud({ io, campaign, ip, reason, clicks, severity, rule }) {
  const key = `${rule}:${ip}:${campaign._id}`;
  if (!shouldPersist(key)) return { blocked: true, logged: false };
  const event = await FraudEvent.create({ campaign: campaign._id, ip, reason, clicks, severity, rule });
  io?.to('admin_channel').emit('fraud_alert', {
    _id: event._id,
    campaign: { _id: campaign._id, name: campaign.name },
    ip,
    reason,
    clicks,
    severity,
    rule,
    resolved: false,
    createdAt: event.createdAt
  });
  io?.emit('fraud_alert', {
    _id: event._id,
    campaign: { _id: campaign._id, name: campaign.name },
    ip,
    reason,
    clicks,
    severity,
    rule,
    resolved: false,
    createdAt: event.createdAt
  });
  return { blocked: true, logged: true, event };
}

export function resetShield() {
  clickHistory.clear();
  ipCampaignStats.clear();
  blockedIps.clear();
  lastLog.clear();
}

export async function inspectEvent({ type, ip, campaign, site, referer, pageUrl, io, selfClick }) {
  const statsKey = `${ip}_${campaign._id}`;
  const stats = ipCampaignStats.get(statsKey) || { impressions: 0, clicks: 0 };

  if (blockedIps.has(ip)) {
    return recordFraud({
      io,
      campaign,
      ip,
      reason: 'Blacklisted bot IP attempted automated ad activity',
      clicks: stats.clicks,
      severity: 'critical',
      rule: 'velocity'
    });
  }

  if (type === 'impression') {
    stats.impressions += 1;
    ipCampaignStats.set(statsKey, stats);
    return { blocked: false };
  }

  const now = Date.now();
  const stamps = (clickHistory.get(statsKey) || []).filter((t) => now - t < 30000);
  stamps.push(now);
  clickHistory.set(statsKey, stamps);
  stats.clicks += 1;
  ipCampaignStats.set(statsKey, stats);

  const last10s = stamps.filter((t) => now - t < 10000).length;
  if (last10s >= 3 || stamps.length >= 6) {
    if (stamps.length >= 8) blockedIps.add(ip);
    return recordFraud({
      io,
      campaign,
      ip,
      reason: `Rapid click velocity: ${last10s} clicks in 10s from the same IP`,
      clicks: last10s,
      severity: last10s >= 5 ? 'critical' : 'high',
      rule: 'velocity'
    });
  }

  if (stats.impressions >= 20 && stats.clicks / stats.impressions > 0.5) {
    blockedIps.add(ip);
    return recordFraud({
      io,
      campaign,
      ip,
      reason: `Unnatural CTR: ${stats.clicks} clicks / ${stats.impressions} impressions (${Math.round((stats.clicks / stats.impressions) * 100)}%) from one IP`,
      clicks: stats.clicks,
      severity: 'high',
      rule: 'ctr'
    });
  }

  const refererHost = hostOf(referer) || hostOf(pageUrl);
  const landingHost = hostOf(campaign.landingPageUrl);
  const dashboardHost = hostOf(process.env.CLIENT_URL || 'http://localhost:5173');
  const siteHost = hostOf(site.url);

  if (selfClick) {
    return recordFraud({
      io,
      campaign,
      ip,
      reason: `Publisher self-click: registered origin ${siteHost || site.url || 'site'} matches the tracking referer`,
      clicks: Math.max(last10s, 1),
      severity: 'high',
      rule: 'self_click'
    });
  }

  if (refererHost && landingHost && refererHost === landingHost) {
    return recordFraud({
      io,
      campaign,
      ip,
      reason: `Self-click: referer ${refererHost} matches campaign landing page`,
      clicks: 1,
      severity: 'medium',
      rule: 'self_click'
    });
  }

  if (refererHost && dashboardHost && refererHost === dashboardHost) {
    return recordFraud({
      io,
      campaign,
      ip,
      reason: `Self-click: click originated from the AdPulse dashboard (${dashboardHost})`,
      clicks: 1,
      severity: 'medium',
      rule: 'self_click'
    });
  }

  // Demo-friendly publisher self-click: Origin header (not the page referer inside the iframe)
  // is unused here. Flag when the click pageUrl host equals the registered publisher host
  // AND the request is sent with data-self=1 from the test harness, or when the publisher
  // host matches referer while the landing page is also the publisher (circular click farm).
  if (refererHost && siteHost && refererHost === siteHost && landingHost && landingHost === siteHost) {
    return recordFraud({
      io,
      campaign,
      ip,
      reason: `Publisher self-click: registered origin ${siteHost} matches referer and landing page`,
      clicks: 1,
      severity: 'high',
      rule: 'self_click'
    });
  }

  return { blocked: false };
}
