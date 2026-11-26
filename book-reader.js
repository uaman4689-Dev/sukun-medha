(()=>{'use strict';
const $=s=>document.querySelector(s),id=decodeURIComponent(location.pathname.split('/').filter(Boolean).pop()||''),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let pages=[],book=null,index=0,marks=[],font=18,preview=new URLSearchParams(location.search).get('preview')==='1';
const token=()=>localStorage.getItem('sm_member_token')||'';
const api=async(p,o={})=>{
 const headers={...(o.headers||{})};if(!headers.Authorization&&token())headers.Authorization='Bearer '+token();
 if(o.body&&!(o.body instanceof FormData)&&!headers['Content-Type'])headers['Content-Type']='application/json';
 const r=await fetch('/api'+p,{...o,headers,cache:'no-store'}),d=await r.json().catch(()=>({}));
 if(!r.ok)throw Error(d.error||('সার্ভার থেকে বই লোড হয়নি (HTTP '+r.status+')'));
 return d;
};
function navLinks(){return '<div class="reader-links"><a href="/">⌂ Homepage</a><a href="/member.html">Member ID</a><a href="/my-books">My Books</a><a href="/books">Book Store</a></div>'}
function showError(message){
 const host=document.querySelector('.layout');
 host.innerHTML='<section class="error"><h2>বইটি এখন খোলা যাচ্ছে না</h2><p>'+esc(message)+'</p><p>Member ID-তে Login করা থাকলে আবার চেষ্টা করুন।</p>'+navLinks()+'<p><button id="retryReader">আবার চেষ্টা করুন</button></p></section>';
 $('#retryReader').onclick=()=>location.reload();
}
function render(){
 if(!book||!pages.length){showError('এই বইয়ের Reader Content পাওয়া যায়নি। Admin Panel থেকে PDF আবার Upload করতে হবে।');return}
 const n=pages.length,pct=Math.round((index+1)/n*100);
 $('#title').textContent=book.title||'SUKUN MEDHA Book';$('#author').textContent='লেখক: '+(book.author||'SUKUN MEDHA');
 $('#pageTitle').textContent='পৃষ্ঠা '+(index+1);$('#content').textContent=pages[index]||'এই পৃষ্ঠা খালি।';$('#content').style.fontSize=font+'px';
 $('#pageNo').textContent=(index+1)+' / '+n;$('#progress').style.width=pct+'%';$('#progressText').textContent=preview?'Preview Mode':'Reading Progress · '+pct+'%';
 $('#pageCount').textContent='মোট '+n+' পৃষ্ঠা';$('#prev').disabled=index===0;$('#next').disabled=index>=n-1;
 if(!preview&&token())api('/books/'+encodeURIComponent(id)+'/progress',{method:'PATCH',body:JSON.stringify({pageIndex:index})}).catch(()=>{});
 $('#marks').innerHTML=marks.length?'<b>Saved Bookmarks</b><br>'+marks.map(m=>'<span>পৃষ্ঠা '+(Number(m.page_index)+1)+': '+esc(String(m.quote||'').slice(0,100))+'</span><br>').join(''):'Bookmark এখনো নেই।';
}
async function init(){
 if(!id){showError('বইয়ের ID পাওয়া যায়নি।');return}
 try{
  let d;
  if(preview){const r=await fetch('/api/books/'+encodeURIComponent(id)+'/preview',{cache:'no-store'});d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||'Preview পাওয়া যায়নি (HTTP '+r.status+')');}
  else{if(!token())throw Error('বই পড়তে আগে Member ID-তে Login করুন।');d=await api('/books/'+encodeURIComponent(id)+'/reader');}
  book=d.book;pages=Array.isArray(d.pages)?d.pages.filter(x=>typeof x==='string'&&x.trim()):[];
  if(!pages.length)throw Error('এই বইয়ের PDF Reader Content পাওয়া যায়নি। Admin Panel থেকে PDF আবার Upload করতে হবে।');
  index=Math.min(pages.length-1,Math.max(0,Number(d.progress?.page_index)||0));marks=Array.isArray(d.bookmarks)?d.bookmarks:[];
  if(preview){$('#bookmark').disabled=true;$('#bookmark').textContent='Member Login করে Bookmark করুন'}
  render();
 }catch(e){showError(e.message)}
}
$('#prev').onclick=()=>{if(index>0){index--;render()}};
$('#next').onclick=()=>{if(index<pages.length-1){index++;render()}};
$('#smaller').onclick=()=>{font=Math.max(13,font-1);$('#content').style.fontSize=font+'px'};
$('#larger').onclick=()=>{font=Math.min(28,font+1);$('#content').style.fontSize=font+'px'};
$('#theme').onclick=()=>{const p=$('.paper'),dark=p.dataset.dark!=='1';p.dataset.dark=dark?'1':'0';p.style.background=dark?'#17251f':'';p.style.color=dark?'#e7eee7':'';$('#content').style.color=dark?'#e7eee7':'';$('#pageTitle').style.color=dark?'#e7eee7':''};
$('#bookmark').onclick=async()=>{if(preview){location.href='/member.html';return}const q=String(getSelection()?.toString()||'').trim();if(!q)return alert('আগে একটি লাইন Select করুন।');try{const d=await api('/books/'+encodeURIComponent(id)+'/bookmarks',{method:'POST',body:JSON.stringify({pageIndex:index,quote:q})});marks.unshift(d.bookmark);render();$('#msg').textContent='Bookmark Save হয়েছে।'}catch(e){$('#msg').textContent=e.message}};
init();
})();