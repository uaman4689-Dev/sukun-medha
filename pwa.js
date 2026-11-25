(()=>{'use strict';
let deferred=null;
const installed=()=>window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true;
const isIOS=/iphone|ipad|ipod/i.test(navigator.userAgent||'');
function addStyles(){if(document.getElementById('sm-app-ui-style'))return;const s=document.createElement('style');s.id='sm-app-ui-style';s.textContent=`
/* App-only responsive layer. Desktop/tablet layout is intentionally untouched. */
#sm-mobile-install{display:none}
#sm-mobile-nav{display:none}
@media(max-width:760px){
 body.sm-app-mode{padding-bottom:calc(78px + env(safe-area-inset-bottom));background:#f4f7f2;-webkit-tap-highlight-color:transparent}
 body.sm-app-mode main{min-width:0}
 body.sm-app-mode .container,body.sm-app-mode .wrap,body.sm-app-mode .ce-wrap,body.sm-app-mode .reader-layout,body.sm-app-mode .amal-wrap{width:auto;max-width:none;margin-left:0;margin-right:0;padding-left:15px;padding-right:15px}
 body.sm-app-mode .site-header{height:auto;min-height:60px;position:sticky;top:0;z-index:100;background:rgba(255,255,255,.96);backdrop-filter:blur(14px)}
 body.sm-app-mode .nav-wrap{min-height:60px;height:auto;padding-top:8px;padding-bottom:8px;gap:8px}
 body.sm-app-mode .brand-mark{width:36px;height:36px;border-radius:11px}
 body.sm-app-mode .brand b{font-size:13px}
 body.sm-app-mode .brand small{font-size:7px}
 body.sm-app-mode .main-nav{display:none!important}
 body.sm-app-mode .menu-toggle{display:none!important}
 body.sm-app-mode .nav-login{padding:9px 11px;font-size:11px;border-radius:10px}
 body.sm-app-mode .app-install-notice{padding:8px 0}
 body.sm-app-mode .app-install-inner{padding-left:15px;padding-right:15px;align-items:center}
 body.sm-app-mode .app-install-icon{width:34px;height:34px}
 body.sm-app-mode .app-install-copy b{font-size:12px}
 body.sm-app-mode .app-install-copy small{font-size:9px;max-width:180px}
 body.sm-app-mode .app-install-btn{padding:9px 11px;font-size:10px}
 body.sm-app-mode .hero{min-height:0;padding:34px 0 22px}
 body.sm-app-mode .hero-grid{display:block;min-height:0}
 body.sm-app-mode .hero-copy{padding:0}
 body.sm-app-mode .hero h1{font-size:clamp(29px,8vw,39px);line-height:1.28;letter-spacing:-.6px;margin:12px 0}
 body.sm-app-mode .hero-lead{font-size:13px;line-height:1.75;margin-bottom:18px}
 body.sm-app-mode .eyebrow{font-size:9px;margin-bottom:12px}
 body.sm-app-mode .hero-art,body.sm-app-mode .hero-proof,body.sm-app-mode .hero-bottom,body.sm-app-mode .hero-glow{display:none!important}
 body.sm-app-mode .hero-actions{display:grid;grid-template-columns:1fr 1fr;gap:9px}
 body.sm-app-mode .hero-actions .btn{justify-content:center;padding:12px 8px;font-size:12px;gap:6px}
 body.sm-app-mode .quick-grid{grid-template-columns:1fr 1fr;padding:10px 0}
 body.sm-app-mode .quick-grid>div{padding:11px 8px;border:0;gap:9px}
 body.sm-app-mode .quick-grid>div:first-child{padding-left:8px}
 body.sm-app-mode .quick-icon{width:36px;height:36px;flex:0 0 36px;font-size:19px}
 body.sm-app-mode .quick-grid b{font-size:12px}
 body.sm-app-mode .quick-grid small{font-size:9px}
 body.sm-app-mode .section{padding:38px 0}
 body.sm-app-mode .section-heading{align-items:flex-start;gap:10px;margin-bottom:17px}
 body.sm-app-mode .section-heading h2,body.sm-app-mode .achievement h2,body.sm-app-mode .final-cta h2{font-size:24px;line-height:1.35;margin:5px 0}
 body.sm-app-mode .section-heading p{font-size:11px;line-height:1.6}
 body.sm-app-mode .section-kicker{font-size:8px}
 body.sm-app-mode .text-link{font-size:10px;white-space:nowrap}
 body.sm-app-mode .program-grid,body.sm-app-mode .catalog-grid,body.sm-app-mode .winner-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
 body.sm-app-mode .program-card,body.sm-app-mode .catalog-card{min-height:0;padding:14px;border-radius:14px}
 body.sm-app-mode .program-card h3,body.sm-app-mode .catalog-card h3{font-size:15px;line-height:1.4}
 body.sm-app-mode .program-card p,body.sm-app-mode .catalog-card p{font-size:11px;line-height:1.6}
 body.sm-app-mode #learnList{grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}
 body.sm-app-mode #learnList .course-card{padding:9px;min-width:0}
 body.sm-app-mode #learnList .course-card h3{font-size:13px;min-height:0}
 body.sm-app-mode #learnList .course-card p{font-size:10px;min-height:0}
 body.sm-app-mode #learnList .course-actions{grid-template-columns:1fr;gap:6px}
 body.sm-app-mode #learnList .course-actions>*{width:100%;min-height:38px}
 body.sm-app-mode .amal-home-card{padding:14px;border-radius:14px}
 body.sm-app-mode .amal-home-copy b{font-size:15px}
 body.sm-app-mode .amal-home-copy em{font-size:10px}
 body.sm-app-mode .amal-home-icon{width:43px;height:43px;flex-basis:43px;font-size:22px}
 body.sm-app-mode .site-footer{padding:28px 0 20px}
 body.sm-app-mode .footer-inner{display:grid;gap:12px}
 body.sm-app-mode .footer-inner p{font-size:11px;line-height:1.7}
 /* Member dashboard */
 body.sm-app-mode .member-page{padding:12px 0 25px;min-height:0}
 body.sm-app-mode .member-card{display:block;border-radius:17px;box-shadow:0 8px 28px #0a3c3010}
 body.sm-app-mode .member-card>.intro{padding:20px 17px}
 body.sm-app-mode .member-card>.intro h1{font-size:23px;margin:7px 0}
 body.sm-app-mode .member-card>.intro p,body.sm-app-mode .member-card>.intro li{font-size:11px;line-height:1.65}
 body.sm-app-mode .member-card>.content{padding:14px}
 body.sm-app-mode .profile-shell{padding:17px;border-radius:16px;margin:5px 0 14px}
 body.sm-app-mode .profile-top{gap:11px}
 body.sm-app-mode .profile-avatar{width:50px;height:50px;flex-basis:50px;border-radius:15px;font-size:20px}
 body.sm-app-mode .profile-meta h2{font-size:18px}
 body.sm-app-mode .profile-meta p{font-size:10px}
 body.sm-app-mode .profile-actions{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:13px}
 body.sm-app-mode .profile-action{padding:10px 7px;font-size:11px;text-align:center}
 body.sm-app-mode .balance-panel{gap:8px;margin-top:13px}
 body.sm-app-mode .balance-tile{padding:11px;border-radius:11px}
 body.sm-app-mode .balance-tile small{font-size:10px}
 body.sm-app-mode .balance-tile strong{font-size:20px}
 body.sm-app-mode .metrics{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
 body.sm-app-mode .metrics div,body.sm-app-mode .box{padding:12px;border-radius:12px}
 body.sm-app-mode .box{margin:10px 0}
 body.sm-app-mode .member-accordion summary{font-size:13px;padding:13px 10px}
 body.sm-app-mode .accordion-content{font-size:12px}
 body.sm-app-mode .form{grid-template-columns:1fr;gap:10px}
 body.sm-app-mode .form label{font-size:12px}
 body.sm-app-mode input,body.sm-app-mode select,body.sm-app-mode textarea{font-size:16px!important;min-height:43px;max-width:100%}
 body.sm-app-mode button,body.sm-app-mode .btn,body.sm-app-mode .profile-action{touch-action:manipulation}
 body.sm-app-mode .refrow{flex-direction:column}
 body.sm-app-mode .refrow button{min-height:42px}
 body.sm-app-mode .member-hub-panel,body.sm-app-mode .member-hub-panel .hub-panel-head{min-width:0}
 body.sm-app-mode .hub-course-grid,body.sm-app-mode .hub-exam-grid{grid-template-columns:1fr 1fr;gap:9px}
 /* Competition and exam */
 body.sm-app-mode .wrap,body.sm-app-mode .ce-wrap{padding-top:15px;padding-bottom:20px}
 body.sm-app-mode .panel{padding:15px;border-radius:15px;margin:11px 0}
 body.sm-app-mode .competition-title{font-size:25px}
 body.sm-app-mode .hero-prize{padding:20px 13px;border-radius:18px}
 body.sm-app-mode .prize-heading{margin-bottom:17px}
 body.sm-app-mode .prize-heading h2{font-size:23px;letter-spacing:1px}
 body.sm-app-mode .podium-grid{grid-template-columns:1fr;grid-template-areas:"first" "second" "third";gap:9px}
 body.sm-app-mode .podium-card,body.sm-app-mode .podium-card.first,body.sm-app-mode .podium-card.second,body.sm-app-mode .podium-card.third{min-height:0;padding:17px 12px;border-radius:15px}
 body.sm-app-mode .ce-hero{padding:22px 17px;border-radius:17px}
 body.sm-app-mode .ce-hero h1{font-size:26px}
 body.sm-app-mode .ce-hero p{font-size:12px;line-height:1.7}
 body.sm-app-mode .ce-actions{display:grid;grid-template-columns:1fr 1fr}
 body.sm-app-mode .ce-actions a{font-size:11px;text-align:center;padding:11px 7px}
 body.sm-app-mode .ce-tabs{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin:15px 0}
 body.sm-app-mode .ce-tabs button{font-size:11px;padding:10px 5px}
 body.sm-app-mode .ce-grid{grid-template-columns:1fr 1fr;gap:9px}
 body.sm-app-mode .ce-card{padding:13px;border-radius:13px;min-width:0}
 body.sm-app-mode .ce-card h3{font-size:14px}
 body.sm-app-mode .ce-card p{font-size:10px;line-height:1.6}
 body.sm-app-mode .ce-btn{font-size:11px;padding:10px 6px}
 /* Course reader */
 body.sm-app-mode .reader-head{padding:10px 15px}
 body.sm-app-mode .reader-layout{display:flex;flex-direction:column;gap:11px;margin-top:12px}
 body.sm-app-mode .reader-side{position:static;height:auto;max-height:none;padding:14px;border-radius:13px}
 body.sm-app-mode .chapter-list{grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}
 body.sm-app-mode .chapter-list button{font-size:11px;padding:10px}
 body.sm-app-mode .reader-paper{min-height:0;padding:18px 15px;border-radius:14px}
 body.sm-app-mode .lesson-content{font-size:15px;line-height:1.9;min-height:120px}
 body.sm-app-mode .chapter-pdf iframe{height:65vh}
 body.sm-app-mode .reader-actions{display:grid;grid-template-columns:1fr 1fr;gap:7px}
 body.sm-app-mode .reader-btn{font-size:11px;padding:11px 7px}
 body.sm-app-mode .reader-bottom{gap:7px}
 body.sm-app-mode .reader-bottom button{font-size:11px;padding:10px 7px}
 /* Cart, payment and forms */
 body.sm-app-mode .cart-wrap,body.sm-app-mode .wrap{max-width:none}
 body.sm-app-mode .line{flex-direction:row;align-items:center;padding:12px 0;gap:8px}
 body.sm-app-mode .total{font-size:19px}
 body.sm-app-mode .success-actions{display:grid;grid-template-columns:1fr}
 body.sm-app-mode .success-actions a{text-align:center}
 /* Amal tracker */
 body.sm-app-mode .amal-top{position:sticky;top:0;z-index:100}
 body.sm-app-mode .amal-toprow{padding:9px 0}
 body.sm-app-mode .amal-toplinks{display:none}
 body.sm-app-mode .amal-hero{padding:22px 16px;border-radius:17px}
 body.sm-app-mode .amal-hero-grid{display:flex;align-items:center;gap:10px}
 body.sm-app-mode .amal-hero h1{font-size:23px;line-height:1.3}
 body.sm-app-mode .amal-hero p{font-size:11px;line-height:1.6}
 body.sm-app-mode .amal-ring{width:74px;height:74px;flex:0 0 74px}
 body.sm-app-mode .amal-summary{grid-template-columns:1fr 1fr;gap:8px}
 body.sm-app-mode .amal-layout{display:flex;flex-direction:column;gap:10px}
 body.sm-app-mode .amal-panel{padding:14px;border-radius:14px}
 body.sm-app-mode .amal-panel-head{gap:8px;align-items:flex-start}
 body.sm-app-mode .amal-panel h2{font-size:17px}
 body.sm-app-mode .amal-actions{display:grid;grid-template-columns:1fr 1fr;gap:7px}
 body.sm-app-mode .amal-btn{font-size:11px;padding:10px 7px}
 body.sm-app-mode .amal-calendar{gap:4px}
 body.sm-app-mode .amal-day{min-height:38px}
 /* Shared usability */
 body.sm-app-mode .btn,body.sm-app-mode button{min-height:40px}
 body.sm-app-mode .task-modal{padding:10px}
 body.sm-app-mode .task-modal-panel{max-height:84dvh;border-radius:16px;padding:20px 15px}
 body.sm-app-mode table{display:block;max-width:100%;overflow-x:auto}
 body.sm-app-mode img,body.sm-app-mode video,body.sm-app-mode iframe{max-width:100%}
 #sm-mobile-nav{position:fixed;z-index:9999;left:9px;right:9px;bottom:calc(7px + env(safe-area-inset-bottom));display:grid;grid-template-columns:repeat(4,1fr);gap:3px;padding:6px;background:rgba(7,61,58,.97);border:1px solid #ffffff24;border-radius:17px;box-shadow:0 10px 35px #001b1a35;backdrop-filter:blur(16px)}
 #sm-mobile-nav a{display:grid;justify-items:center;gap:2px;padding:6px 2px;border-radius:10px;color:#d8e6df;text-decoration:none;font:600 10px 'Hind Siliguri',sans-serif}
 #sm-mobile-nav a span{font-size:17px;line-height:1.1}
 #sm-mobile-nav a[aria-current=page]{background:#ffffff18;color:#f0d99c}
 #sm-mobile-nav a:active{transform:scale(.97)}
}
@media(max-width:380px){
 body.sm-app-mode .program-grid,body.sm-app-mode .catalog-grid,body.sm-app-mode .ce-grid,body.sm-app-mode .hub-course-grid,body.sm-app-mode .hub-exam-grid{grid-template-columns:1fr}
 body.sm-app-mode #learnList{grid-template-columns:1fr}
 body.sm-app-mode .profile-actions{grid-template-columns:1fr 1fr}
}
`;document.head.appendChild(s)}
function installBar(){let bar=document.getElementById('appInstallNotice');if(!bar){bar=document.createElement('section');bar.id='sm-mobile-install';bar.innerHTML='<div class="sm-install-copy">SUKUN MEDHA App<small>ইনস্টল করুন · মোবাইলে সহজে ব্যবহার করুন</small></div><button type="button" id="smInstallAction">Install App ↓</button>';document.body.insertBefore(bar,document.body.firstChild)}const btn=document.getElementById('appInstallButton')||document.getElementById('smInstallAction');if(installed()){if(btn){btn.textContent='ইনস্টল হয়েছে ✓';btn.disabled=true}return}if(btn)btn.addEventListener('click',async()=>{if(deferred){const promptEvent=deferred;deferred=null;await promptEvent.prompt();const choice=await promptEvent.userChoice;if(choice?.outcome==='accepted'){btn.textContent='ইনস্টল হচ্ছে…';btn.disabled=true}else{btn.textContent='Install App ↓'}return}if(isIOS){alert('iPhone-এ Safari-এর Share আইকনে চাপ দিয়ে Add to Home Screen নির্বাচন করতে হয়।');return}alert('এই মুহূর্তে Chrome/Edge সরাসরি Install prompt দেয়নি। Chrome/Edge-এ সাইটটি আপডেট করে আবার খুলুন; সাইটটি Installযোগ্য হলে এই Install App বাটন থেকেই অ্যাপ ইনস্টল হবে।')})}
function mobileNav(){if(document.getElementById('sm-mobile-nav'))return;const path=location.pathname;const links=[['⌂','হোম','/'],['♙','মেম্বার','/member.html'],['☪','আমল','/amal.html'],['🏆','প্রতিযোগিতা','/#competitions']];const nav=document.createElement('nav');nav.id='sm-mobile-nav';nav.setAttribute('aria-label','Mobile navigation');nav.innerHTML=links.map(([icon,label,url])=>'<a href="'+url+'" '+(((url==='/'&&path==='/')||(url==='/#competitions'&&path==='/')||(url!=='/'&&url!=='/#competitions'&&path.startsWith(url)))?'aria-current="page"':'')+'><span>'+icon+'</span>'+label+'</a>').join('');document.body.appendChild(nav)}
function setup(){addStyles();document.body.classList.add('sm-app-mode');installBar();mobileNav();if('serviceWorker'in navigator){navigator.serviceWorker.register('/sw.js').then(reg=>reg.update().catch(()=>{})).catch(()=>{})}}
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferred=e;const b=document.getElementById('appInstallButton')||document.getElementById('smInstallAction');if(b)b.textContent='Install App ↓'});
window.addEventListener('appinstalled',()=>{deferred=null;const b=document.getElementById('appInstallButton')||document.getElementById('smInstallAction');if(b){b.textContent='ইনস্টল হয়েছে ✓';b.disabled=true}});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});else setup();
})();