const COUNTRY_ALIASES = {
  in: ['in', 'india', 'ind'],
  us: ['us', 'usa', 'united states', 'america'],
  gb: ['gb', 'uk', 'united kingdom', 'britain', 'england'],
  ae: ['ae', 'uae', 'united arab emirates', 'dubai'],
  au: ['au', 'australia'],
  ca: ['ca', 'canada'],
  sg: ['sg', 'singapore']
};

const canonCountry = (value) => {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw || ['all', 'global', 'worldwide'].includes(raw)) return '';
  for (const [code, aliases] of Object.entries(COUNTRY_ALIASES)) {
    if (aliases.includes(raw)) return code;
  }
  return raw;
};

const overlap = (campaignKeywords = [], pageKeywords = []) => {
  const a = campaignKeywords.map((k) => String(k).toLowerCase().trim()).filter(Boolean);
  const b = pageKeywords.map((k) => String(k).toLowerCase().trim()).filter(Boolean);
  if (!a.length || !b.length) return 0;
  return a.filter((k) => b.some((p) => p.includes(k) || k.includes(p))).length;
};

/**
 * Rank an eligible campaign by eCPM (effective cost per thousand impressions).
 * CPM  → eCPM = bidAmount
 * CPC  → eCPM = bidAmount × CTR × 1000  (2% default CTR before history exists)
 */
export function scoreCampaign(campaign, { country, keywords = [], age } = {}) {
  const impressions = campaign.impressions || 0;
  const clicks = campaign.clicks || 0;
  const ctr = impressions > 0 ? clicks / impressions : 0.02;
  const ecpm = campaign.bidType === 'CPM' ? campaign.bidAmount : campaign.bidAmount * ctr * 1000;

  let multiplier = 1;

  const target = canonCountry(campaign.targetCountry);
  const viewer = canonCountry(country);
  if (target && viewer) {
    multiplier *= target === viewer ? 1.5 : 0.35;
  }

  const hits = overlap(campaign.keywords, keywords);
  if (hits) multiplier *= 1 + Math.min(hits, 3) * 0.15;

  const min = campaign.targetAge?.min;
  const max = campaign.targetAge?.max;
  if (Number.isFinite(age) && (min || max)) {
    const lo = min ?? 0;
    const hi = max ?? 100;
    multiplier *= age >= lo && age <= hi ? 1.2 : 0.25;
  }

  return { campaign, ecpm, ctr, score: ecpm * multiplier };
}

export function pickWinner(campaigns, ctx) {
  const ranked = campaigns.map((c) => scoreCampaign(c, ctx)).sort((a, b) => b.score - a.score);
  return ranked[0] || null;
}
