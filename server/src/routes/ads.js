import express from 'express';
import Campaign from '../models/Campaign.js';
import PublisherSite from '../models/PublisherSite.js';
import { bumpDailyStat } from '../models/DailyStat.js';
import { pickWinner } from '../utils/auction.js';
import { inspectEvent, resetShield } from '../utils/fraud.js';

const router = express.Router();
const adServerUrl = () => (process.env.AD_SERVER_URL || `http://localhost:${process.env.PORT || 5000}`).replace(/\/$/, '');
const publicCors = (req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
};
router.use(publicCors);

router.get('/adpulse.js', publicCors, (req, res) => {
  res.type('application/javascript').send(`(function(){
    var script=document.currentScript; if(!script)return;
    var siteId=script.getAttribute('data-site'); var api='${adServerUrl()}/api/ads';
    if(!siteId)return;
    var country=((navigator.language||'').split('-')[1]||'');
    var keywords=document.title||'';
    var page=location.href||'';
    fetch(api+'/serve?site='+encodeURIComponent(siteId)+'&country='+encodeURIComponent(country)+'&keywords='+encodeURIComponent(keywords)+'&age='+encodeURIComponent(script.getAttribute('data-age')||'')).then(function(r){return r.ok?r.json():null}).then(function(ad){
      if(!ad)return; var frame=document.createElement('a'); frame.href=ad.landingPageUrl||'#'; frame.target='_blank'; frame.rel='noopener sponsored';
      frame.style.cssText='display:block;max-width:100%;overflow:hidden;border-radius:8px;text-decoration:none;background:#f8fafc';
      var image=document.createElement('img'); image.src=ad.imageUrl; image.alt=ad.name||'Advertisement'; image.style.cssText='display:block;max-width:100%;height:auto';
      frame.appendChild(image); script.insertAdjacentElement('afterend',frame);
      var payload=function(type){return JSON.stringify({site:siteId,campaign:ad.id,type:type,page:page,keywords:keywords})};
      fetch(api+'/track',{method:'POST',headers:{'Content-Type':'application/json'},body:payload('impression')});
      frame.addEventListener('click',function(){fetch(api+'/track',{method:'POST',keepalive:true,headers:{'Content-Type':'application/json'},body:payload('click')});});
    }).catch(function(){});
  })();`);
});

router.get('/serve', publicCors, async (req, res) => {
  try {
    const site = await PublisherSite.findOne({ _id: req.query.site, status: 'approved' });
    if (!site) return res.status(404).json({ message: 'Site not found or not approved' });

    const campaigns = await Campaign.find({
      status: 'active',
      imageUrl: { $exists: true, $ne: '' },
      $expr: { $lt: ['$spent', '$budget'] }
    });
    if (!campaigns.length) return res.status(204).end();

    const keywords = String(req.query.keywords || '')
      .split(/[\s,|]+/)
      .map((k) => k.trim())
      .filter(Boolean);
    const age = req.query.age ? Number(req.query.age) : undefined;
    const winner = pickWinner(campaigns, {
      country: req.query.country || req.headers['cf-ipcountry'] || '',
      keywords,
      age: Number.isFinite(age) ? age : undefined
    });
    if (!winner) return res.status(204).end();

    const { campaign: winning, ecpm } = winner;
    res.json({
      id: winning.id,
      name: winning.name,
      imageUrl: winning.imageUrl,
      landingPageUrl: winning.landingPageUrl,
      bidType: winning.bidType,
      ecpm: Number(ecpm.toFixed(4))
    });
  } catch (err) {
    console.error('Ad serve error:', err);
    res.status(500).json({ message: 'Ad server error' });
  }
});

router.post('/track', publicCors, async (req, res) => {
  try {
    const { site: siteId, campaign: campaignId, type, page, selfClick } = req.body;
    if (!['impression', 'click'].includes(type)) return res.status(400).end();

    const clientIp = (req.headers['x-forwarded-for']?.split(',')[0] || req.socket?.remoteAddress || '127.0.0.1').trim();
    const [site, campaign] = await Promise.all([
      PublisherSite.findOne({ _id: siteId, status: 'approved' }),
      Campaign.findOne({ _id: campaignId, status: 'active' })
    ]);
    if (!site || !campaign) return res.status(404).end();

    const verdict = await inspectEvent({
      type,
      ip: clientIp,
      campaign,
      site,
      referer: req.get('referer') || req.get('origin') || '',
      pageUrl: page,
      io: req.app.get('io'),
      selfClick: Boolean(selfClick)
    });

    if (verdict.blocked) {
      return res.status(429).json({
        status: 'blocked',
        reason: 'AdPulse Shield detected suspicious click activity'
      });
    }

    let deltaSpent = 0;
    let deltaEarnings = 0;
    if (type === 'click') {
      campaign.clicks += 1;
      site.clicks += 1;
      if (campaign.bidType === 'CPC') {
        deltaSpent = campaign.bidAmount;
        deltaEarnings = campaign.bidAmount * 0.7;
      }
    } else {
      campaign.impressions += 1;
      site.impressions += 1;
      if (campaign.bidType === 'CPM') {
        deltaSpent = campaign.bidAmount / 1000;
        deltaEarnings = deltaSpent * 0.7;
      }
    }

    campaign.spent += deltaSpent;
    site.earnings += deltaEarnings;
    if (campaign.spent >= campaign.budget) campaign.status = 'completed';

    await Promise.all([
      campaign.save(),
      site.save(),
      bumpDailyStat({
        campaign,
        site,
        impressions: type === 'impression' ? 1 : 0,
        clicks: type === 'click' ? 1 : 0,
        spent: deltaSpent,
        earnings: deltaEarnings
      })
    ]);

    req.app.get('io')?.emit('metric', {
      campaign: campaign.id,
      site: site.id,
      type,
      impressions: campaign.impressions,
      clicks: campaign.clicks,
      spent: campaign.spent,
      earnings: site.earnings,
      deltaSpent,
      deltaEarnings,
      advertiserId: String(campaign.advertiser),
      publisherId: String(site.publisher)
    });

    res.status(204).end();
  } catch (err) {
    console.error('Track error:', err);
    res.status(500).json({ message: 'Error processing ad event' });
  }
});

router.post('/shield/reset', (req, res) => {
  resetShield();
  res.json({ message: 'AdPulse Shield rate-limit cache and IP blocklist reset' });
});

export default router;
