(()=>{'use strict';
const $=s=>document.querySelector(s);
const id=new URLSearchParams(location.search).get('id');
const token=localStorage.getItem('sm_member_token');
const esc=s=>String(s??'').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
async function init(){
 const pub=await fetch('/api/public').then(r=>r.json());
 const competition=(pub.competitions||[]).find(x=>String(x.id)===String(id));
 if(!competition)throw Error('Competition পাওয়া যায়নি।');
 $('#title').textContent=competition.title;
 $('#description').textContent=competition.description||'';
 $('#fee').textContent='Entry Fee: ৳ '+Number(competition.fee||0)+' · '+Number(competition.coinPrice||0)+' Coins';
 const resultResponse=await fetch('/api/competitions/'+encodeURIComponent(id)+'/results');
 const resultData=await resultResponse.json();
 if(!resultResponse.ok)throw Error(resultData.error||'Result load failed');
 if((resultData.results||[]).length){
  $('#results').innerHTML='<table class="result-table"><thead><tr><th>Rank</th><th>Roll</th><th>Name</th><th>Score</th><th>Award</th></tr></thead><tbody>'+resultData.results.map(x=>'<tr><td>'+esc(x.rank)+'</td><td>'+esc(x.roll)+'</td><td>'+esc(x.name)+'</td><td>'+esc(x.score)+'</td><td>'+esc(x.award)+'</td></tr>').join('')+'</tbody></table>';
 }else{$('#results').textContent=resultData.resultStatus==='Published'?'ফলাফল প্রকাশিত হয়েছে।':'এখনো ফলাফল প্রকাশ করা হয়নি।';}
 $('#showQuestions').onclick=async()=>{
  if(!token){location.href='/member.html';return;}
  try{
   const response=await fetch('/api/competitions/'+encodeURIComponent(id)+'/questions',{headers:{Authorization:'Bearer '+token}});
   const data=await response.json();
   if(!response.ok)throw Error(data.error||'প্রশ্ন দেখার Access নেই।');
   $('#questions').innerHTML=(data.questions||[]).map((q,i)=>'<article class="q"><b>'+(i+1)+'. '+esc(q.text)+'</b><p>'+esc(q.type)+' · '+esc(q.marks)+' Marks</p>'+(q.options||[]).map(o=>'<div>• '+esc(o)+'</div>').join('')+'</article>').join('')||'প্রশ্ন এখনো প্রকাশিত হয়নি।';
  }catch(e){$('#questions').textContent=e.message;}
 };
}
init().catch(e=>$('#results').textContent=e.message);
})();