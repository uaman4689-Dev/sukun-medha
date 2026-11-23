'use strict';
const toggle=document.querySelector('.menu-toggle'),nav=document.querySelector('.main-nav');
if(toggle&&nav){toggle.addEventListener('click',()=>{const open=nav.classList.toggle('open');toggle.setAttribute('aria-expanded',String(open));});nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{nav.classList.remove('open');toggle.setAttribute('aria-expanded','false');}));}
document.querySelectorAll('a[href^="#"]').forEach(link=>link.addEventListener('click',event=>{const target=document.querySelector(link.getAttribute('href'));if(target){event.preventDefault();target.scrollIntoView({behavior:'smooth',block:'start'});}}));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeUrl=s=>{try{const u=new URL(s,location.href);return ['http:','https:'].includes(u.protocol)?u.href:'#'}catch{return '#'}};
function renderCollection(id,items,type){
 const host=document.getElementById(id);if(!host)return;
 if(!items.length){host.innerHTML='<div class="content-empty">নতুন আয়োজন শিগগিরই আসছে।</div>';return;}
 host.innerHTML=items.slice(-6).reverse().map(x=>{
  const freeCourse=type==='course'&&(x.accessType==='free'||(!x.accessType&&Number(x.price||0)===0&&Number(x.coinPrice||0)===0));
  const meta=type==='course'?(freeCourse?'FREE · সবার জন্য উন্মুক্ত':'৳ '+esc(x.price||0)+' · '+esc(x.coinPrice||0)+' কয়েন'):type==='competition'?'Entry: ৳ '+esc(x.fee||0)+' · '+esc(x.coinPrice||0)+' কয়েন':type==='challenge'?'Entry: ৳ '+esc(x.fee||0)+' · '+esc(x.coinPrice||0)+' কয়েন':type==='gift'?'পুরস্কার: '+esc(x.quantity||''):esc(x.discountText||x.code||'বিশেষ অফার');
  const action=['course','competition','challenge'].includes(type)&&!freeCourse?'<button class="catalog-add" data-add-type="'+type+'" data-add-id="'+esc(x.id)+'">Cart-এ যোগ করুন</button>':'';
  const href=type==='course'?'/course/'+encodeURIComponent(x.id):type==='competition'?'/competition.html?id='+encodeURIComponent(x.id):type==='challenge'?'/challenge.html?id='+encodeURIComponent(x.id):type==='offer'?'/payments':'/member.html';
  return '<article class="catalog-card"><div class="catalog-type">'+({course:'LEARN',competition:'COMPETITION',challenge:'CHALLENGE',gift:'REWARD',offer:'SPECIAL OFFER'}[type])+'</div><h3>'+esc(x.title||x.name||'')+'</h3><p>'+esc(x.description||x.details||'')+'</p><div class="catalog-meta">'+meta+'</div>'+action+'<a href="'+href+'">বিস্তারিত দেখুন ↗</a></article>';
 }).join('');
}
document.addEventListener('click',async e=>{
 const b=e.target.closest('[data-add-type]');if(!b)return;
 const token=localStorage.getItem('sm_member_token');if(!token){location.href='/member.html';return;}
 b.disabled=true;
 try{const r=await fetch('/api/cart',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({type:b.dataset.addType,id:b.dataset.addId})});const d=await r.json();if(!r.ok)throw Error(d.error||'Cart error');b.textContent='Cart-এ যোগ হয়েছে ✓';}
 catch(x){alert(x.message);b.disabled=false;}
});
async function loadHome(){
 try{
  const r=await fetch('/api/public');if(!r.ok)return;const d=await r.json();
  for(const [slot,id] of [['header_strip','adHeader'],['below_quiz','adBelowQuiz']]){
   const host=document.getElementById(id),ad=(d.ads||[]).filter(x=>x.slot===slot).slice(-1)[0];if(!host||!ad)continue;
   const w=Math.max(280,Math.min(1600,Number(ad.width)||1200)),h=Math.max(60,Math.min(500,Number(ad.height)||120));host.hidden=false;
   host.innerHTML='<a class="homepage-ad-link" href="'+safeUrl(ad.link)+'" target="_blank" rel="noopener noreferrer"><img src="'+esc(ad.imageUrl)+'" alt="'+esc(ad.title||'Advertisement')+'" style="width:'+w+'px;height:'+h+'px;max-width:100%"></a>';
  }
  renderCollection('learnList',d.courses||[],'course');renderCollection('competitionList',d.competitions||[],'competition');renderCollection('challengeList',d.challenges||[],'challenge');renderCollection('giftList',d.rewards||[],'gift');renderCollection('offerList',d.offers||[],'offer');
  try{const plans=await fetch('/api/plans').then(x=>x.json()),host=document.getElementById('offerList');if(host&&(plans.packages||[]).length)host.insertAdjacentHTML('beforeend',(plans.packages||[]).map(p=>'<article class="catalog-card"><div class="catalog-type">SUBSCRIPTION / PASS</div><h3>'+esc(p.name)+'</h3><p>'+esc(p.description||'')+'</p><div class="catalog-meta">৳ '+esc(p.display_price??p.price)+' · '+esc(p.duration_days)+' দিন</div><button class="catalog-add" data-add-type="subscription" data-add-id="'+esc(p.id)+'">প্যাকেজ Cart-এ যোগ</button></article>').join(''));}catch(e){console.warn('Plans unavailable',e);}
  const winners=document.getElementById('winnerList');if(winners&&(d.winners||[]).length)winners.innerHTML=d.winners.slice(-6).reverse().map(w=>'<article class="winner-card"><img src="'+esc(w.photo||'https://placehold.co/120x120?text=Winner')+'" alt="'+esc(w.name)+'"><div><span class="winner-position">'+esc(w.position||'বিজয়ী')+'</span><h3>'+esc(w.name)+'</h3><b>'+esc(w.achievement)+'</b><p>'+esc(w.details||'')+'</p><small>'+esc(w.date||'')+'</small></div></article>').join('');
 }catch(e){console.warn('Public content could not be loaded',e);}
}
loadHome();
// Homepage search: filter visible cards across the main discovery sections.
(()=>{const input=document.getElementById('siteSearch');if(!input)return;input.addEventListener('input',()=>{const q=input.value.trim().toLocaleLowerCase('bn');document.querySelectorAll('#competitions .catalog-card,#learn .catalog-card,#challenges .catalog-card,#offers .catalog-card,#winners .winner-card,#quizzes .quiz-categories a').forEach(card=>{card.hidden=!!q&&!card.textContent.toLocaleLowerCase('bn').includes(q)});});})();
