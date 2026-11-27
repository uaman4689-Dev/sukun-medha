'use strict';
const toggle=document.querySelector('.menu-toggle'),nav=document.querySelector('.main-nav');
if(toggle&&nav){toggle.addEventListener('click',()=>{const open=nav.classList.toggle('open');toggle.setAttribute('aria-expanded',String(open));});nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{nav.classList.remove('open');toggle.setAttribute('aria-expanded','false');}));}
document.querySelectorAll('a[href^="#"]').forEach(link=>link.addEventListener('click',event=>{const target=document.querySelector(link.getAttribute('href'));if(target){event.preventDefault();target.scrollIntoView({behavior:'smooth',block:'start'});}}));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeUrl=s=>{try{const u=new URL(s,location.href);return ['http:','https:'].includes(u.protocol)?u.href:'#'}catch{return '#'}};
function competitionTimeLeft(c){
 const raw=c.deadline||c.endDate||c.end_date||c.endAt||c.end_at||c.registrationDeadline||'';
 const base='display:block;width:100%;box-sizing:border-box;margin:10px 0 13px;padding:10px 12px;border:1px solid #c8e5d2;border-radius:12px;background:linear-gradient(110deg,#edf8f0,#f8fcf8);color:#145b3c;font-size:13px;font-weight:800;line-height:1.5';
 if(!raw)return '<div class="competition-countdown" style="'+base+'">⏳ শেষ তারিখ নির্ধারিত হয়নি</div>';
 const value=String(raw).trim();
 const end=new Date(/^\d{4}-\d{2}-\d{2}$/.test(value)?value+'T23:59:59+06:00':value).getTime();
 if(!Number.isFinite(end))return '<div class="competition-countdown" style="'+base+'">⏳ শেষ তারিখ পড়া যাচ্ছে না</div>';
 const left=end-Date.now();
 if(left<=0)return '<div class="competition-countdown is-ended" style="'+base+';background:#fff1ed;border-color:#f2d1c7;color:#a33b2e">⌛ প্রতিযোগিতার সময় শেষ</div>';
 const bn=n=>String(n).replace(/\d/g,d=>'০১২৩৪৫৬৭৮৯'[Number(d)]);
 return '<div class="competition-countdown" data-countdown="'+end+'" style="'+base+'">⏳ প্রতিযোগিতা শেষ হতে বাকি: '+formatCompetitionTime(left)+'</div>';
}
function formatCompetitionTime(left){
 const total=Math.max(0,Math.floor(left/1000)),days=Math.floor(total/86400),hours=Math.floor(total%86400/3600),minutes=Math.floor(total%3600/60),seconds=total%60;
 const bn=n=>String(n).replace(/\d/g,d=>'০১২৩৪৫৬৭৮৯'[Number(d)]);
 return (days?bn(days)+' দিন ':'')+bn(hours)+' ঘণ্টা '+bn(minutes)+' মিনিট '+bn(seconds)+' সেকেন্ড';
}
function refreshCompetitionTimers(){
 document.querySelectorAll('[data-countdown]').forEach(el=>{
  const left=Number(el.dataset.countdown)-Date.now();
  if(left<=0){el.textContent='⌛ প্রতিযোগিতার সময় শেষ';el.classList.add('is-ended');return}
  el.textContent='⏳ '+formatCompetitionTime(left)+' বাকি';
 });
}
function renderCollection(id,items,type){
 const host=document.getElementById(id);if(!host)return;
 const seenIds=new Set(),seenTitles=new Set(),unique=[];(items||[]).forEach(x=>{if(type!=='course'){unique.push(x);return}const id=String(x.id||'').trim(),title=String(x.title||x.name||'').trim().toLocaleLowerCase('bn').replace(/\s+/g,' ');if((id&&seenIds.has(id))||(title&&seenTitles.has(title)))return;if(id)seenIds.add(id);if(title)seenTitles.add(title);unique.push(x)});
 if(!unique.length){host.innerHTML='<div class="content-empty">নতুন আয়োজন শিগগিরই আসছে।</div>';return;}
 const visibleItems=type==='competition'?unique:unique.slice(-6),topEntries=type==='competition'?Math.max(0,...visibleItems.map(x=>Number(x.entryCount)||0)):0;host.innerHTML=visibleItems.slice().reverse().map(x=>{
  const freeCourse=type==='course'&&(x.accessType==='free'||(!x.accessType&&Number(x.price||0)===0&&Number(x.coinPrice||0)===0));
  const regular=Number(x.regularPrice??x.price??0),offer=Number(x.offerPrice||0),hasOffer=offer>0&&offer<regular;
  const discountPercent=hasOffer&&regular>0?Math.round((regular-offer)*100/regular):0;
  const meta=type==='course'?(freeCourse?'<span class="course-free-label">FREE · সবার জন্য উন্মুক্ত</span>':(hasOffer?'<span class="course-price-current">৳ '+esc(offer)+'</span> <del class="course-price-old">৳ '+esc(regular)+'</del>':'<span class="course-price-current">৳ '+esc(regular)+'</span>')+(Number(x.coinPrice)>0?' <span class="course-coin-price">· '+esc(x.coinPrice)+' কয়েন</span>':''))
   :type==='competition'?'<div class="competition-fee-row"><div class="competition-fee-cash"><small>💳 ENTRY FEE</small><strong>৳ '+esc(x.fee||0)+'</strong></div><div class="competition-fee-coin"><small>🪙 COIN COST</small><strong>'+esc(x.coinPrice||0)+' Coins</strong></div></div><div class="home-entry-count">👥 মোট Entry: <b>'+Number(x.entryCount||0).toLocaleString('bn-BD')+'</b></div>':type==='challenge'?'Entry: ৳ '+esc(x.fee||0)+' · '+esc(x.coinPrice||0)+' কয়েন':type==='gift'?'পুরস্কার: '+esc(x.quantity||''):esc(x.discountText||x.code||'বিশেষ অফার');
  const href=type==='course'?'/course/'+encodeURIComponent(x.id):type==='competition'?'/competition.html?id='+encodeURIComponent(x.id):type==='challenge'?'/challenge.html?id='+encodeURIComponent(x.id):type==='offer'?'/payments':'/member.html';
  const image=type==='course'?(x.imageUrl||x.image||x.coverImage||x.thumbnail||''):'';
  const imageHtml=type==='course'?'<div class="course-cover-wrap"><a class="course-cover" href="'+href+'" aria-label="'+esc(x.title||'Course')+'">'+(image?'<img src="'+esc(image)+'" alt="'+esc(x.title||'Course')+'" loading="lazy" onerror="this.style.display=\'none\';this.parentElement.classList.add(\'image-missing\')">':'<span class="course-cover-fallback">SUKUN MEDHA</span>')+'</a>'+(discountPercent?'<span class="course-discount-badge">'+discountPercent+'% ছাড়</span>':'')+'</div>':'';
  const description=String(x.description||x.details||'').trim();
  const shortDescription=description.length>105?description.slice(0,102).trim()+'…':description;
  let actions='';
  if(type==='course'){
   const shareButton='<button class="catalog-add course-share-home" type="button" data-course-share="'+esc(x.id)+'">↗ Share</button>';
   actions=freeCourse?'<div class="course-actions"><a class="course-primary" href="'+href+'">কোর্স শুরু করুন ↗</a>'+shareButton+'</div>':'<div class="course-actions"><button class="catalog-add" data-add-type="course" data-add-id="'+esc(x.id)+'">Add to Cart</button><button class="course-buy-now" data-buy-now="course" data-buy-id="'+esc(x.id)+'">Buy Now</button>'+shareButton+'</div>';
  }else if(type==='competition'){
   actions='<div class="course-actions"><a class="course-primary" href="'+href+'" onclick="window.location.assign(this.href);return false;">প্রতিযোগিতায় Entry নিন ↗</a><button class="catalog-add" type="button" data-public-share="'+esc(href)+'" data-share-title="'+esc(x.title||'Competition')+'">↗ Share</button></div>';
  }else if(type==='challenge'&&!freeCourse){
   actions='<button class="catalog-add" data-add-type="challenge" data-add-id="'+esc(x.id)+'">Cart-এ যোগ করুন</button>';
  }
  const prizeHtml=type==='competition'?(()=>{const gifts=x.prizes||[],places=[{n:'১ম স্থান',e:'🏆',c:'#f5ca68',t:'#49300b',tag:'GRAND PRIZE'},{n:'২য় স্থান',e:'🥈',c:'#cbd8e8',t:'#26384a',tag:'SILVER PRIZE'},{n:'৩য় স্থান',e:'🥉',c:'#c98a61',t:'#fff8f1',tag:'BRONZE PRIZE'}];return '<section style="background:radial-gradient(circle at 50% 0%,#294d70,#101f3c 70%);color:#fff;padding:15px;border-radius:15px;margin:0 0 13px;border:1px solid #8ac7f044;box-shadow:0 12px 28px #08152d22"><div style="text-align:center;margin-bottom:12px"><small style="color:#8be6ff;font-size:9px;font-weight:900;letter-spacing:2px">✦ WINNER PODIUM ✦</small><div style="font-size:17px;font-weight:950;letter-spacing:1px;margin-top:3px">🏆 Winner Gifts</div></div><div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;align-items:stretch">'+(gifts.slice(0,3).map((gift,i)=>{const p=places[i];return '<div style="min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:5px;padding:10px 5px;border-radius:11px;background:'+p.c+';color:'+p.t+';border:1px solid #ffffff88;'+(i===0?'transform:translateY(-3px);box-shadow:0 6px 15px #f5ca6840;':'')+'"><span style="font-size:23px">'+p.e+'</span><b style="font-size:11px;line-height:1.3">'+p.n+'</b><span style="font-size:10px;font-weight:800;line-height:1.35;overflow-wrap:anywhere">'+esc(gift)+'</span><small style="font-size:7px;font-weight:950;letter-spacing:.5px;opacity:.8">'+p.tag+'</small></div>'}).join('')||'<div style="grid-column:1/-1;text-align:center;color:#c8d9ef;padding:12px;font-size:12px">পুরস্কার শিগগিরই ঘোষণা হবে</div>')+'</div>'+(gifts.length>3?'<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:9px">'+gifts.slice(3).map((gift,i)=>'<span style="background:#ffffff18;border:1px solid #ffffff30;border-radius:20px;padding:5px 9px;font-size:10px">🎁 '+(i+4)+'তম: '+esc(gift)+'</span>').join('')+'</div>':'')+'</section>'})():'';
  const topEntryBadge=type==='competition'&&Number(x.entryCount||0)>0&&Number(x.entryCount||0)===topEntries?'<div class="home-top-entry">🔥 সবচেয়ে বেশি Entry</div>':'';return '<article class="catalog-card '+(type==='course'?'course-card':type==='competition'?'competition-card':'')+'">'+topEntryBadge+prizeHtml+imageHtml+'<div class="catalog-type">'+({course:'LEARN',competition:'COMPETITION',challenge:'CHALLENGE',gift:'REWARD',offer:'SPECIAL OFFER'}[type])+'</div><h3>'+esc(x.title||x.name||'')+'</h3>'+(type==='competition'?competitionTimeLeft(x):'')+'<p>'+esc(shortDescription)+'</p><div class="catalog-meta">'+meta+'</div>'+actions+(type==='course'?'':'<a href="'+href+'">বিস্তারিত দেখুন ↗</a>')+'</article>';
 }).join('');
}
document.addEventListener('click',async e=>{
 const publicShare=e.target.closest('[data-public-share]');
 if(publicShare){const url=new URL(publicShare.dataset.publicShare,location.origin).href;try{if(navigator.share)await navigator.share({title:publicShare.dataset.shareTitle||'SUKUN MEDHA',text:'এই আয়োজনটি দেখুন — SUKUN MEDHA',url});else if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(url);alert('Share Link কপি হয়েছে। এখন যে কাউকে পাঠাতে পারবেন।')}else prompt('এই Link কপি করে Share করুন',url)}catch(err){if(err.name!=='AbortError')alert('Share করা যায়নি। Link: '+url)}return;}
 const share=e.target.closest('[data-course-share]');
 if(share){
  const token=localStorage.getItem('sm_member_token');
  if(!token){location.href='/member.html';return;}
  const courseId=share.dataset.courseShare,original=share.textContent;
  share.disabled=true;share.textContent='Preparing…';
  try{
   const me=await fetch('/api/me',{headers:{Authorization:'Bearer '+token}}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error||'Login required');return d;});
   const url=new URL('/course/'+encodeURIComponent(courseId),location.origin);
   if(me.user?.referralCode)url.searchParams.set('ref',me.user.referralCode);
   const shareData={title:'SUKUN MEDHA Course',text:'এই Course-টি SUKUN MEDHA-তে দেখুন',url:url.href};
   if(navigator.share){await navigator.share(shareData);}
   else if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(url.href);alert('Course link কপি হয়েছে। এখন বন্ধুদের পাঠিয়ে দিন।');}
   else throw Error('এই Browser-এ Share/Copy সুবিধা নেই।');
   const panel=document.createElement('div');panel.style.cssText='display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:10px;padding:12px;background:#f7f8f4;border:1px solid #dfe8df;border-radius:10px';panel.innerHTML='<b style="width:100%">Share Link জমা দিন</b><input type="url" placeholder="https://facebook.com/..." data-share-proof-link style="flex:1;min-width:190px;padding:9px"><button type="button" class="catalog-add" data-share-proof-submit>Link জমা দিন</button><small style="width:100%">আপনার Share করা Post-এর Link দিন · Admin Approve করলে Coin পাবেন</small>';share.insertAdjacentElement('afterend',panel);panel.querySelector('[data-share-proof-submit]').onclick=async()=>{const proof=panel.querySelector('[data-share-proof-link]').value.trim(),submit=panel.querySelector('[data-share-proof-submit]');if(!proof){alert('Share Post-এর Link পেস্ট করুন।');return;}submit.disabled=true;submit.textContent='জমা হচ্ছে…';try{const response=await fetch('/api/me/courses/'+encodeURIComponent(courseId)+'/share-proof',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({proof})}),result=await response.json();if(!response.ok)throw Error(result.error||'Link জমা হয়নি');share.textContent='✓ Link Submitted';panel.innerHTML='<b>✓ Link জমা হয়েছে। Admin Approve করলে '+Number(result.coins||0)+' Coin পাবেন।</b>';}catch(err){alert(err.message);submit.disabled=false;submit.textContent='আবার জমা দিন';}};
  }catch(err){
   if(err.name==='AbortError'){share.textContent=original;}
   else{alert(err.message);share.textContent=original;}
   share.disabled=false;
  }
  return;
 }
 const buy=e.target.closest('[data-buy-now]');
 const b=buy||e.target.closest('[data-add-type]');if(!b)return;
 const token=localStorage.getItem('sm_member_token');if(!token){location.href='/buy?type='+encodeURIComponent(buy?buy.dataset.buyNow:b.dataset.addType)+'&id='+encodeURIComponent(buy?buy.dataset.buyId:b.dataset.addId)+'&action='+(buy?'buy':'cart');return;}
 b.disabled=true;
 try{
  const type=buy?buy.dataset.buyNow:b.dataset.addType,id=buy?buy.dataset.buyId:b.dataset.addId;
  const r=await fetch('/api/cart',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({type,id})});
  const d=await r.json();if(!r.ok)throw Error(d.error||'Cart error');
  if(buy){location.href='/cart?buyNow=1';return;}
  b.textContent='Cart-এ যোগ হয়েছে ✓';
 }catch(x){alert(x.message);b.disabled=false;}
});
async function loadHome(){
 try{
  const r=await fetch('/api/public');if(!r.ok)return;const d=await r.json();
  for(const [slot,id] of [['header_strip','adHeader'],['below_quiz','adBelowQuiz']]){
   const host=document.getElementById(id),ad=(d.ads||[]).filter(x=>x.slot===slot).slice(-1)[0];if(!host||!ad)continue;
   const w=Math.max(280,Math.min(1600,Number(ad.width)||1200)),h=Math.max(60,Math.min(500,Number(ad.height)||120));host.hidden=false;
   host.innerHTML='<a class="homepage-ad-link" href="'+safeUrl(ad.link)+'" target="_blank" rel="noopener noreferrer"><img src="'+esc(ad.imageUrl)+'" alt="'+esc(ad.title||'Advertisement')+'" style="width:'+w+'px;height:'+h+'px;max-width:100%"></a>';
  }
  const statHost=document.getElementById('homeLiveStats');if(statHost){const taskTotal=await fetch('/api/public/coin-tasks').then(x=>x.ok?x.json():({tasks:[]})).then(x=>(x.tasks||[]).length).catch(()=>0);statHost.innerHTML='<div class="home-stat"><span>📚</span><b>'+Number(d.counts?.books||d.books?.length||0).toLocaleString('bn-BD')+'</b><small>মোট বই</small></div><div class="home-stat"><span>🏆</span><b>'+Number(d.counts?.competitions||d.competitions?.length||0).toLocaleString('bn-BD')+'</b><small>মোট Competition</small></div><div class="home-stat"><span>🎯</span><b>'+Number(taskTotal).toLocaleString('bn-BD')+'</b><small>মোট Task</small></div>';}
  renderCollection('learnList',d.courses||[],'course');renderCollection('competitionList',d.competitions||[],'competition');renderCollection('challengeList',d.challenges||[],'challenge');renderCollection('giftList',d.rewards||[],'gift');renderCollection('offerList',d.offers||[],'offer');
  try{const plans=await fetch('/api/plans').then(x=>x.json()),host=document.getElementById('offerList');if(host&&(plans.packages||[]).length)host.insertAdjacentHTML('beforeend',(plans.packages||[]).map(p=>'<article class="catalog-card"><div class="catalog-type">SUBSCRIPTION / PASS</div><h3>'+esc(p.name)+'</h3><p>'+esc(p.description||'')+'</p><div class="catalog-meta">৳ '+esc(p.display_price??p.price)+' · '+esc(p.duration_days)+' দিন</div><button class="catalog-add" data-add-type="subscription" data-add-id="'+esc(p.id)+'">প্যাকেজ Cart-এ যোগ</button></article>').join(''));}catch(e){console.warn('Plans unavailable',e);}
  const winners=document.getElementById('winnerList');if(winners&&(d.winners||[]).length)winners.innerHTML=d.winners.slice(-6).reverse().map(w=>'<article class="winner-card"><img src="'+esc(w.photo||'https://placehold.co/120x120?text=Winner')+'" alt="'+esc(w.name)+'"><div><span class="winner-position">'+esc(w.position||'বিজয়ী')+'</span><h3>'+esc(w.name)+'</h3><b>'+esc(w.achievement)+'</b><p>'+esc(w.details||'')+'</p><small>'+esc(w.date||'')+'</small></div></article>').join('');
 }catch(e){console.warn('Public content could not be loaded',e);}
}
loadHome();
setInterval(refreshCompetitionTimers,1000);
// Homepage search: filter visible cards across the main discovery sections.
(()=>{const input=document.getElementById('siteSearch');if(!input)return;input.addEventListener('input',()=>{const q=input.value.trim().toLocaleLowerCase('bn');document.querySelectorAll('#competitions .catalog-card,#learn .catalog-card,#challenges .catalog-card,#offers .catalog-card,#winners .winner-card,#quizzes .quiz-categories a').forEach(card=>{card.hidden=!!q&&!card.textContent.toLocaleLowerCase('bn').includes(q)});});})();

/* Public Daily Coin Tasks */
(()=>{const $=s=>document.querySelector(s),escTask=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));let currentTask=null,publicTasks=[];
function taskCard(t){const done=!!t.submission,shareUrl='/?task='+encodeURIComponent(t.id)+'#coinTasks';return '<article class="catalog-card public-task-card"><div class="catalog-type">'+(t.task_type==='course_share'?'COURSE SHARE CHALLENGE':'DAILY COIN TASK')+'</div><h3>'+escTask(t.title)+'</h3><p>'+escTask(t.description)+'</p><div class="catalog-meta">✦ '+Number(t.coin_reward||0)+' Coins · '+(t.proof_required?'প্রমাণ জমা দিতে হবে':'নিয়ম পড়ে অংশ নিন')+'</div><div class="home-entry-count">👥 মোট Entry: <b>'+Number(t.entry_count||0).toLocaleString('bn-BD')+'</b></div>'+(done?'<p class="task-submitted-state">'+'আজ জমা হয়েছে · আগামীকাল আবার জমা দিতে পারবেন'+' · '+escTask(t.submission.status)+'</p>':'')+'<div class="course-actions"><button class="task-open-btn" type="button" data-public-task="'+escTask(t.id)+'">'+(done?'জমার অবস্থা দেখুন':'নিয়ম দেখুন / অংশ নিন ↗')+'</button><button class="catalog-add" type="button" data-public-share="'+shareUrl+'" data-share-title="'+escTask(t.title)+'">↗ Share</button></div></article>'}
async function loadPublicTasks(){const host=$('#publicTaskList');if(!host)return;try{const r=await fetch('/api/public/coin-tasks',{cache:'no-store'});if(!r.ok)throw Error('Tasks unavailable');const d=await r.json(),tasks=d.tasks||[],token=localStorage.getItem('sm_member_token');publicTasks=tasks;if(token){try{const mr=await fetch('/api/me/engagement',{headers:{Authorization:'Bearer '+token},cache:'no-store'});if(mr.ok){const md=await mr.json(),mine=new Map((md.tasks||[]).map(x=>[String(x.id),x.submission]));tasks.forEach(t=>{t.submission=mine.get(String(t.id))||null})}}catch{}}const maxTaskEntries=Math.max(0,...tasks.map(t=>Number(t.entry_count)||0));tasks.forEach(t=>{t.isTopEntry=Number(t.entry_count||0)>0&&Number(t.entry_count||0)===maxTaskEntries});host.innerHTML=tasks.length?tasks.slice().reverse().map(t=>taskCard(t).replace('<article class="catalog-card public-task-card">','<article class="catalog-card public-task-card">'+(t.isTopEntry?'<div class="home-top-entry">🔥 সবচেয়ে বেশি Entry</div>':''))).join():'<div class="content-empty">এখন কোনো Task প্রকাশিত নেই। নতুন Task প্রকাশিত হলে এখানে দেখা যাবে।</div>';const sharedId=new URLSearchParams(location.search).get('task');if(sharedId){const shared=tasks.find(x=>String(x.id)===String(sharedId));if(shared){openTask(shared);$('#taskModal')?.scrollIntoView({behavior:'smooth',block:'center'});}}}catch(e){host.innerHTML='<div class="content-empty">Task এখন লোড করা যাচ্ছে না।</div>';console.warn(e)}}
function openTask(t){currentTask=t;$('#taskModalType').textContent=t.task_type==='course_share'?'COURSE SHARE CHALLENGE':'DAILY COIN TASK';$('#taskModalTitle').textContent=t.title;$('#taskModalDescription').textContent=t.description||'';$('#taskModalRules').textContent=t.rules||'এই Task-এর জন্য আলাদা নিয়ম দেওয়া হয়নি। বিবরণ অনুযায়ী কাজ সম্পন্ন করুন।';$('#taskModalReward').textContent='Reward: '+Number(t.coin_reward||0)+' Coins';const link=$('#taskFacebookLink');link.hidden=!t.facebook_url;if(t.facebook_url)link.href=t.facebook_url;$('#taskModalMessage').textContent=t.submission?'আজকের Task জমা সম্পন্ন। আগামীকাল আবার নতুন লিংক জমা দিতে পারবেন। '+(t.submission.status==='Approved'?'Admin Approve করেছেন—'+Number(t.coin_reward||0)+' Coin আপনার Balance-এ যোগ হয়েছে।':t.submission.status==='Rejected'?'আজকের আবেদন Reject হয়েছে। আগামীকাল আবার জমা দিতে পারবেন.':'Admin যাচাই করছেন। Approve হলে '+Number(t.coin_reward||0)+' Coin যোগ হবে।') :'আজকের Task এখনো জমা হয়নি। কাজের লিংক জমা দিলে Admin যাচাই করবেন। Approve হলে নির্ধারিত Coin যোগ হবে।';const submit=$('#taskSubmit');submit.disabled=!!t.submission;submit.textContent=t.submission?'আজ জমা হয়েছে ✓':'কাজ জমা দিন';$('#taskModal').hidden=false;document.body.classList.add('task-modal-open')}
function closeTask(){const modal=$('#taskModal');if(modal)modal.hidden=true;document.body.classList.remove('task-modal-open');currentTask=null}
document.addEventListener('click',async e=>{const card=e.target.closest('[data-public-task]');if(card){try{const t=publicTasks.find(x=>String(x.id)===card.dataset.publicTask);if(t){const token=localStorage.getItem('sm_member_token');if(token){const mr=await fetch('/api/me/engagement',{headers:{Authorization:'Bearer '+token},cache:'no-store'});if(mr.ok){const md=await mr.json(),mine=(md.tasks||[]).find(x=>String(x.id)===String(t.id));t.submission=mine?.submission||null}}openTask(t)}}catch(x){console.warn(x)}return}if(e.target.closest('[data-task-close]')){closeTask();return}});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeTask()});
const submit=$('#taskSubmit');if(submit)submit.addEventListener('click',async()=>{if(!currentTask)return;const token=localStorage.getItem('sm_member_token');if(!token){location.href='/member.html';return}if(currentTask.submission)return;let proof='';if(currentTask.proof_required){proof=prompt('কাজের প্রমাণ, Screenshot link বা প্রয়োজনীয় তথ্য দিন:')||'';if(!proof.trim())return}else{proof=prompt('কাজের প্রমাণ/লিংক (ঐচ্ছিক):')||''}submit.disabled=true;try{const endpoint=currentTask.task_type==='course_share'?'/api/me/courses/'+encodeURIComponent(currentTask.course_id)+'/share-proof':'/api/me/tasks/'+encodeURIComponent(currentTask.id)+'/submit';const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({proof})}),d=await r.json();if(!r.ok)throw Error(d.error||'জমা দেওয়া যায়নি');currentTask.submission={status:d.submission?.status||'Pending'};$('#taskModalMessage').textContent='আজকের Task সফলভাবে জমা হয়েছে। একই দিনে দ্বিতীয়বার জমা দেওয়া যাবে না। আগামীকাল আবার নতুন লিংক জমা দিতে পারবেন। Admin Approve করলে '+Number(currentTask.coin_reward||0)+' Coin আপনার Balance-এ যোগ হবে।';submit.textContent='জমা হয়েছে ✓';await loadPublicTasks()}catch(x){$('#taskModalMessage').textContent=x.message;submit.disabled=false}});
loadPublicTasks();
})();;