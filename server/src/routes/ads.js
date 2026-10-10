import express from 'express';
import Campaign from '../models/Campaign.js';
import PublisherSite from '../models/PublisherSite.js';

const router = express.Router();
const adServerUrl = () => (process.env.AD_SERVER_URL || `http://localhost:${process.env.PORT || 5000}`).replace(/\/$/, '');
const publicCors = (req, res, next) => { res.set('Access-Control-Allow-Origin', '*'); res.set('Access-Control-Allow-Headers', 'Content-Type'); if(req.method==='OPTIONS') return res.status(204).end(); next(); };
router.use(publicCors);

router.get('/adpulse.js', publicCors, (req, res) => {
  res.type('application/javascript').send(`(function(){
    var script=document.currentScript; if(!script)return;
    var siteId=script.getAttribute('data-site'); var api='${adServerUrl()}/api/ads';
    if(!siteId)return;
    fetch(api+'/serve?site='+encodeURIComponent(siteId)).then(function(r){return r.ok?r.json():null}).then(function(ad){
      if(!ad)return; var frame=document.createElement('a'); frame.href=ad.landingPageUrl||'#'; frame.target='_blank'; frame.rel='noopener sponsored';
      frame.style.cssText='display:block;max-width:100%;overflow:hidden;border-radius:8px;text-decoration:none;background:#f8fafc';
      var image=document.createElement('img'); image.src=ad.imageUrl; image.alt=ad.name||'Advertisement'; image.style.cssText='display:block;max-width:100%;height:auto';
      frame.appendChild(image); script.insertAdjacentElement('afterend',frame);
      fetch(api+'/track',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({site:siteId,campaign:ad.id,type:'impression'})});
      frame.addEventListener('click',function(){fetch(api+'/track',{method:'POST',keepalive:true,headers:{'Content-Type':'application/json'},body:JSON.stringify({site:siteId,campaign:ad.id,type:'click'})});});
    }).catch(function(){});
  })();`);
});

router.get('/serve', publicCors, async (req, res) => {
  const site = await PublisherSite.findOne({_id:req.query.site,status:'approved'});
  if (!site) return res.status(404).end();
  const campaign = await Campaign.findOne({status:'active',imageUrl:{$exists:true,$ne:''},$expr:{$lt:['$spent','$budget']}}).sort('createdAt');
  if (!campaign) return res.status(204).end();
  res.json({id:campaign.id,name:campaign.name,imageUrl:campaign.imageUrl,landingPageUrl:campaign.landingPageUrl});
});

router.post('/track', publicCors, express.json(), async (req, res) => {
  const {site:siteId,campaign:campaignId,type} = req.body;
  if (!['impression','click'].includes(type)) return res.status(400).end();
  const [site,campaign] = await Promise.all([PublisherSite.findOne({_id:siteId,status:'approved'}),Campaign.findOne({_id:campaignId,status:'active'})]);
  if (!site || !campaign) return res.status(404).end();
  if (type==='impression') { campaign.impressions += 1; site.impressions += 1; if (campaign.bidType==='CPM') { const cost=campaign.bidAmount/1000; campaign.spent += cost; site.earnings += cost*0.7; } }
  if (type==='click') { campaign.clicks += 1; site.clicks += 1; if (campaign.bidType==='CPC') { campaign.spent += campaign.bidAmount; site.earnings += campaign.bidAmount*0.7; } }
  if (campaign.spent >= campaign.budget) campaign.status='completed';
  await Promise.all([campaign.save(),site.save()]);
  req.app.get('io').emit('metric',{campaign:campaign.id,site:site.id,type});
  res.status(204).end();
});

export default router;
