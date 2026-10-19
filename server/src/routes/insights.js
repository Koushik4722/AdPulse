import express from 'express';
import Campaign from '../models/Campaign.js';
import Notification from '../models/Notification.js';
import FraudEvent from '../models/FraudEvent.js';
import DailyStat, { utcDateKey } from '../models/DailyStat.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

const lastSevenDates = () => {
  const dates = [];
  for (let i = 6; i >= 0; i -= 1) {
    const day = new Date();
    day.setUTCDate(day.getUTCDate() - i);
    dates.push(utcDateKey(day));
  }
  return dates;
};

const weekday = (date) => new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });

router.get('/dashboard', protect, async (req, res) => {
  try {
    const q = req.user.role === 'advertiser' ? { advertiser: req.user.id } : {};
    const campaigns = await Campaign.find(q);

    const totals = campaigns.reduce(
      (a, c) => ({
        impressions: a.impressions + c.impressions,
        clicks: a.clicks + c.clicks,
        spent: a.spent + c.spent,
        budget: a.budget + c.budget
      }),
      { impressions: 0, clicks: 0, spent: 0, budget: 0 }
    );

    const dates = lastSevenDates();
    const match = { date: { $in: dates } };
    if (req.user.role === 'advertiser') match.advertiser = req.user._id;
    const rows = await DailyStat.aggregate([
      { $match: match },
      { $group: { _id: '$date', impressions: { $sum: '$impressions' }, clicks: { $sum: '$clicks' }, spent: { $sum: '$spent' } } }
    ]);
    const byDate = Object.fromEntries(rows.map((r) => [r._id, r]));
    let series = dates.map((date) => {
      const row = byDate[date] || { impressions: 0, clicks: 0, spent: 0 };
      const imp = row.impressions || 0;
      const clk = row.clicks || 0;
      return {
        day: weekday(date),
        date,
        impressions: imp,
        clicks: clk,
        spent: Number((row.spent || 0).toFixed(2)),
        ctr: imp ? Number(((clk / imp) * 100).toFixed(2)) : 0
      };
    });

    const ctr = totals.impressions ? Number(((totals.clicks / totals.impressions) * 100).toFixed(2)) : 0;
    res.json({ ...totals, ctr, campaigns, series, hasDeliveryData: Boolean(totals.impressions || totals.clicks) });
  } catch (err) {
    console.error('Dashboard insights error:', err);
    res.status(500).json({ message: 'Error retrieving dashboard metrics' });
  }
});

router.get('/notifications', protect, async (req, res) => {
  res.json(await Notification.find({ user: req.user.id }).sort('-createdAt').limit(30));
});

router.patch('/notifications/:id/read', protect, async (req, res) => {
  res.json(await Notification.findOneAndUpdate({ _id: req.params.id, user: req.user.id }, { read: true }, { new: true }));
});

router.patch('/notifications/read-all', protect, async (req, res) => {
  await Notification.updateMany({ user: req.user.id, read: false }, { read: true });
  res.json({ message: 'All notifications marked as read' });
});

router.get('/fraud', protect, async (req, res) => {
  res.json(await FraudEvent.find().populate('campaign', 'name').sort('-createdAt'));
});

// AI Campaign Assistant: Groq LLaMA 3.3 70B with smart contextual fallback
router.post('/assistant', protect, async (req, res) => {
  const prompt = (req.body.prompt || '').trim();
  if (!prompt) return res.status(400).json({ message: 'Please provide a campaign idea or prompt' });
  if (prompt.length > 500) return res.status(400).json({ message: 'Keep your campaign idea under 500 characters.' });

  // 1. Live Groq LLM API if key is configured
  if (process.env.GROQ_API_KEY) {
    try {
      const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            {
              role: 'system',
              content: `You are an expert digital advertising strategist and copywriter for AdPulse Ad Network.
Analyze the user's campaign goal or business prompt and generate a high-performing digital ad campaign brief.
Respond strictly with valid JSON with these exact fields:
- "title": A punchy, high-converting campaign title (max 50 chars)
- "headlines": Array of exactly 3 high-converting ad headline variants (strings)
- "description": Compelling ad copy/description (1-2 sentences, max 160 chars)
- "cta": Short call-to-action (e.g. "Book tickets now")
- "targetAudience": Specific demographic description (e.g. "Tech professionals aged 22-40 in urban hubs")
- "targetAge": Object with integer "min" and "max" age brackets
- "keywords": Array of 4-6 specific search/interest keywords (strings)
- "estimatedCTR": Estimated CTR string (e.g. "3.6%")
- "recommendation": 1-2 strategic optimization tips for bidding and creative design
- "suggestedBid": Suggested CPC bid in INR as number (e.g. 12)
- "bidType": Either "CPC" or "CPM"
Do not output markdown code blocks. Output plain JSON only.`
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.7,
          response_format: { type: 'json_object' }
        })
      });

      if (groqRes.ok) {
        const groqData = await groqRes.json();
        const content = groqData.choices?.[0]?.message?.content;
        if (content) {
          try {
            return res.json({ ...JSON.parse(content), source: 'groq-ai' });
          } catch {
            /* fall through to contextual engine */
          }
        }
      }
    } catch (err) {
      console.warn('Groq AI generation fallback to contextual engine:', err.message);
    }
  }

  // 2. Intelligent Contextual Engine (Offline / Fallback)
  const p = prompt.toLowerCase();
  let category = 'general';
  if (/sport|cricket|football|fitness|gym|marathon|match|tournament/i.test(p)) category = 'sports';
  else if (/tech|app|software|saas|ai|code|developer|cloud|gadget/i.test(p)) category = 'tech';
  else if (/shop|fashion|clothes|shoes|store|ecommerce|sale|discount/i.test(p)) category = 'ecommerce';
  else if (/food|restaurant|cafe|coffee|burger|pizza|catering|dine/i.test(p)) category = 'food';
  else if (/course|education|learn|university|college|class|study|tuition/i.test(p)) category = 'education';

  const strategies = {
    sports: {
      title: `Championship Rush: ${prompt.slice(0, 30)}`,
      headlines: ['Don’t miss the final whistle', 'Tickets that put you closer to the action', 'Your season starts with one click'],
      description: `Catch every live moment! Get tickets and exclusive passes now for ${prompt}.`,
      cta: 'Book tickets now',
      targetAudience: 'Sports enthusiasts & active adults aged 18–40 in major metros',
      targetAge: { min: 18, max: 40 },
      keywords: ['live match', 'tournament passes', 'sports tickets', 'fan zone', 'athletics'],
      estimatedCTR: '3.4%',
      recommendation: 'Use dynamic countdown creatives in the final 48 hours; allocate 60% of budget during match weekends.',
      suggestedBid: 10,
      bidType: 'CPC'
    },
    tech: {
      title: `Innovate Faster: ${prompt.slice(0, 30)}`,
      headlines: ['Ship faster with fewer tools', 'The stack your team actually finishes with', 'Cut busywork. Keep the insight.'],
      description: `Streamline your workflow with next-gen tools. Experience seamless efficiency with ${prompt}.`,
      cta: 'Start free trial',
      targetAudience: 'Developers, IT leaders, and tech early adopters aged 21–45',
      targetAge: { min: 21, max: 45 },
      keywords: ['developer tools', 'cloud platform', 'saas automation', 'ai solutions', 'productivity'],
      estimatedCTR: '2.8%',
      recommendation: 'Target desktop placements during working hours (9 AM - 6 PM); test interactive demo banners.',
      suggestedBid: 15,
      bidType: 'CPC'
    },
    ecommerce: {
      title: `Limited Edition: ${prompt.slice(0, 30)}`,
      headlines: ['Selling out faster than restocks', 'Looks new. Priced like a steal.', 'Your cart called. It wants this.'],
      description: `Upgrade your style with exclusive deals on ${prompt}. Shop trending picks before stocks run out!`,
      cta: 'Shop the drop',
      targetAudience: 'Online shoppers, trend-seekers, and young adults aged 18–35',
      targetAge: { min: 18, max: 35 },
      keywords: ['flash sale', 'online shopping', 'trending styles', 'discount code', 'free delivery'],
      estimatedCTR: '3.8%',
      recommendation: 'Feature high-contrast product imagery with a prominent "Shop Now" call to action; test CPC with CPM retargeting.',
      suggestedBid: 8,
      bidType: 'CPC'
    },
    food: {
      title: `Taste Perfection: ${prompt.slice(0, 30)}`,
      headlines: ['Hungry in 20 minutes, not 2 hours', 'Chef-level flavour. Delivery-level easy.', 'Tonight’s cravings, solved.'],
      description: `Craving something delicious? Order fresh meals and special treats from ${prompt} today.`,
      cta: 'Order now',
      targetAudience: 'Local foodies and families aged 20–50 within 15km delivery radius',
      targetAge: { min: 20, max: 50 },
      keywords: ['food delivery', 'gourmet dining', 'chef special', 'weekend brunch', 'takeaway deal'],
      estimatedCTR: '4.1%',
      recommendation: 'Concentrate bidding between 11:30 AM–2:00 PM and 6:30 PM–10:00 PM; use high-res mouth-watering visuals.',
      suggestedBid: 7,
      bidType: 'CPC'
    },
    education: {
      title: `Advance Your Career: ${prompt.slice(0, 30)}`,
      headlines: ['Skills that show up on your resume', 'Learn tonight. Interview next month.', 'Stop scrolling. Start a syllabus.'],
      description: `Master high-demand skills with accredited training for ${prompt}. Enroll today to claim early-bird pricing!`,
      cta: 'Enroll today',
      targetAudience: 'Students, graduates, and professionals seeking career upskilling aged 19–35',
      targetAge: { min: 19, max: 35 },
      keywords: ['online certification', 'career boot camp', 'degree programs', 'practical training', 'mentorship'],
      estimatedCTR: '2.9%',
      recommendation: 'Highlight alumni success metrics and placement assistance; use lead-generation landing pages with quick forms.',
      suggestedBid: 12,
      bidType: 'CPC'
    },
    general: {
      title: `Growth Accelerator: ${prompt.slice(0, 30)}`,
      headlines: ['The offer your audience already wants', 'From first glance to first conversion', 'Make every impression count'],
      description: `Discover how ${prompt} delivers unmatched value. Get started today with our introductory offer.`,
      cta: 'Get started',
      targetAudience: 'Broad digital audience aged 22–50 interested in new products & services',
      targetAge: { min: 22, max: 50 },
      keywords: ['brand discovery', 'market leader', 'special promotion', 'premium service', 'top rated'],
      estimatedCTR: '2.6%',
      recommendation: 'A/B test 2 visual banner concepts; reserve 20% of total budget for re-engaging clicked visitors.',
      suggestedBid: 10,
      bidType: 'CPC'
    }
  };

  res.json({ ...strategies[category], source: 'offline-template' });
});

router.post('/ai-summary', protect, async (req, res) => {
  try {
    const now = new Date();
    const dates = Array.from({ length: 14 }, (_, index) => {
      const day = new Date(now);
      day.setUTCDate(day.getUTCDate() - (13 - index));
      return utcDateKey(day);
    });
    const recentDates = dates.slice(7);
    const previousDates = dates.slice(0, 7);
    const match = { date: { $in: dates } };
    if (req.user.role === 'advertiser') match.advertiser = req.user._id;
    if (req.user.role === 'publisher') match.publisher = req.user._id;
    const [rows, campaigns] = await Promise.all([
      DailyStat.aggregate([
        { $match: match },
        { $group: {
          _id: '$date', impressions: { $sum: '$impressions' }, clicks: { $sum: '$clicks' },
          spent: { $sum: '$spent' }, earnings: { $sum: '$earnings' }
        } }
      ]),
      req.user.role === 'publisher'
        ? Promise.resolve([])
        : Campaign.find(req.user.role === 'advertiser' ? { advertiser: req.user._id } : {}).select('name status impressions clicks spent budget').limit(8).lean()
    ]);
    const grouped = Object.fromEntries(rows.map((row) => [row._id, row]));
    const totals = (keys) => keys.reduce((result, date) => {
      const row = grouped[date] || {};
      result.impressions += row.impressions || 0;
      result.clicks += row.clicks || 0;
      result.spent += row.spent || 0;
      result.earnings += row.earnings || 0;
      return result;
    }, { impressions: 0, clicks: 0, spent: 0, earnings: 0 });
    const current = totals(recentDates);
    const previous = totals(previousDates);
    const metrics = {
      period: 'last 7 days compared with the preceding 7 days',
      current,
      previous,
      currentCtrPercent: current.impressions ? Number((current.clicks / current.impressions * 100).toFixed(2)) : 0,
      previousCtrPercent: previous.impressions ? Number((previous.clicks / previous.impressions * 100).toFixed(2)) : 0,
      campaigns: campaigns.map((campaign) => ({
        name: campaign.name, status: campaign.status, impressions: campaign.impressions,
        clicks: campaign.clicks, ctrPercent: campaign.impressions ? Number((campaign.clicks / campaign.impressions * 100).toFixed(2)) : 0,
        spent: campaign.spent, remainingBudget: Math.max(0, campaign.budget - campaign.spent)
      }))
    };

    let insight;
    let usedAi = false;
    if (process.env.GROQ_API_KEY && (current.impressions || previous.impressions || campaigns.length)) {
      try {
        const aiResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile', temperature: 0.3, response_format: { type: 'json_object' },
            messages: [
              { role: 'system', content: 'You are AdPulse analytics coach. Use only supplied metrics; do not invent causes, audiences, or performance facts. If volume is too low, say so. Give a short useful summary, up to two evidence-based observations, and up to three concrete next steps. Return JSON: {"summary": string, "observations": string[], "actions": string[]}. Keep the advice ethical and do not recommend targeting sensitive traits.' },
              { role: 'user', content: JSON.stringify({ role: req.user.role, metrics }) }
            ]
          }),
          signal: AbortSignal.timeout(15000)
        });
        if (aiResponse.ok) {
          const payload = await aiResponse.json();
          insight = JSON.parse(payload.choices?.[0]?.message?.content || 'null');
          if (!insight || typeof insight.summary !== 'string' || !Array.isArray(insight.observations) || !Array.isArray(insight.actions)) insight = null;
          else usedAi = true;
        }
      } catch (error) {
        console.warn('AI analytics fallback:', error.message);
      }
    }

    if (!insight) {
      const ctrChange = current.impressions && previous.impressions
        ? Number((metrics.currentCtrPercent - metrics.previousCtrPercent).toFixed(2)) : null;
      const observations = [];
      const actions = [];
      if (!current.impressions && !previous.impressions) {
        insight = {
          summary: 'There is not enough delivery data yet to identify a performance trend.',
          observations: ['No impressions or clicks were recorded in the last 14 days.'],
          actions: ['Launch or activate a campaign, then return after it has received impressions to get data-based recommendations.']
        };
      } else {
        if (ctrChange !== null) observations.push(`CTR ${ctrChange >= 0 ? 'increased' : 'decreased'} by ${Math.abs(ctrChange).toFixed(2)} percentage points versus the previous 7 days.`);
        else observations.push('There is not enough activity in both weeks for a like-for-like CTR comparison.');
        if (current.impressions && !current.clicks) observations.push('Your campaigns received impressions but no clicks this week.');
        if (req.user.role === 'publisher') actions.push('Review approved site placements and keep the ad tag active on your highest-traffic pages.');
        else if (current.impressions && !current.clicks) actions.push('Review the creative and landing page relevance before increasing bids.');
        if (current.impressions && current.clicks) actions.push('Compare campaign CTRs and test a fresh creative on lower-performing campaigns.');
        if (!actions.length) actions.push('Keep collecting delivery data and review this summary again next week.');
        insight = {
          summary: `${current.impressions.toLocaleString()} impressions and ${current.clicks.toLocaleString()} clicks were recorded in the last 7 days.`,
          observations, actions
        };
      }
    }
    res.json({ ...insight, generatedAt: new Date(), source: usedAi ? 'ai-assisted' : 'metrics-based', metrics });
  } catch (error) {
    console.error('AI summary error:', error);
    res.status(500).json({ message: 'Unable to generate analytics insights right now.' });
  }
});

router.get('/report', protect, async (req, res) => {
  const q = req.user.role === 'advertiser' ? { advertiser: req.user.id } : {};
  const campaigns = await Campaign.find(q);
  const t = campaigns.reduce((a, c) => ({ impressions: a.impressions + c.impressions, clicks: a.clicks + c.clicks, spent: a.spent + c.spent }), { impressions: 0, clicks: 0, spent: 0 });
  res.json({
    generatedAt: new Date(),
    ...t,
    ctr: t.impressions ? Number(((t.clicks / t.impressions) * 100).toFixed(2)) : 0,
    cpc: t.clicks ? Number((t.spent / t.clicks).toFixed(2)) : 0,
    campaigns
  });
});

export default router;
