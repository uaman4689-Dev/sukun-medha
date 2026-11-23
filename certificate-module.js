'use strict';
const crypto=require('crypto');
module.exports=function mountCertificates(app,pool,{member,admin}){
 const fail=(res,e)=>{console.error('Certificate API:',e);res.status(500).json({error:'সার্ভারে সমস্যা হয়েছে।'});};
 const serial=()=> 'SM-'+new Date().getFullYear()+'-'+crypto.randomBytes(4).toString('hex').toUpperCase();
 app.get('/api/me/certificates',member,async(req,res)=>{try{const r=await pool.query('SELECT id,serial,recipient_name,exam_title,achievement,score,grade,issue_date,created_at FROM certificate_records WHERE member_id=$1 AND status=$2 ORDER BY created_at DESC',[req.user.id,'Issued']);res.json(r.rows)}catch(e){fail(res,e)}});
 app.get('/api/certificates/:serial',async(req,res)=>{try{const r=await pool.query("SELECT serial,recipient_name,exam_title,achievement,score,grade,issue_date,issuer_name,issuer_title,organization,status FROM certificate_records WHERE upper(serial)=upper($1)",[req.params.serial]);if(!r.rowCount)return res.status(404).json({error:'Certificate পাওয়া যায়নি।'});res.json(r.rows[0])}catch(e){fail(res,e)}});
 app.get('/api/admin/certificates',admin,async(req,res)=>{try{const r=await pool.query('SELECT id,serial,recipient_name,recipient_phone,recipient_email,exam_title,achievement,score,grade,issue_date,issuer_name,issuer_title,status,created_at FROM certificate_records ORDER BY created_at DESC LIMIT 500');res.json(r.rows)}catch(e){fail(res,e)}});
 app.post('/api/admin/certificates',admin,async(req,res)=>{try{
  const b=req.body||{},name=String(b.recipientName||'').trim(),exam=String(b.examTitle||'').trim();
  if(!name||!exam)return res.status(400).json({error:'প্রাপকের নাম ও পরীক্ষার নাম অবশ্যই দিন।'});
  const issueDate=b.issueDate||new Date().toISOString().slice(0,10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(issueDate))return res.status(400).json({error:'সঠিক তারিখ দিন।'});
  let memberId=null;
  if(b.recipientPhone){const m=await pool.query('SELECT id FROM members WHERE phone=$1 LIMIT 1',[String(b.recipientPhone).trim()]);if(m.rowCount)memberId=m.rows[0].id}
  let code;for(let i=0;i<4;i++){code=serial();try{const r=await pool.query("INSERT INTO certificate_records(serial,member_id,recipient_name,recipient_phone,recipient_email,exam_title,achievement,score,grade,issue_date,issuer_name,issuer_title,organization,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'Issued') RETURNING id,serial,recipient_name,exam_title,issue_date,status",[code,memberId,name,b.recipientPhone||null,b.recipientEmail||null,exam,String(b.achievement||'সফলভাবে পরীক্ষা সম্পন্ন করেছেন').slice(0,250),String(b.score||'').slice(0,60),String(b.grade||'').slice(0,60),issueDate,String(b.issuerName||'SUKUN MEDHA').slice(0,120),String(b.issuerTitle||'Authorized Signatory').slice(0,120),String(b.organization||'SUKUN MEDHA').slice(0,120)]);return res.status(201).json({certificate:r.rows[0]})}catch(e){if(e.code!=='23505')throw e}}
  return res.status(500).json({error:'Certificate Number তৈরি করা যায়নি।'});
 }catch(e){fail(res,e)}});
 app.patch('/api/admin/certificates/:id/revoke',admin,async(req,res)=>{try{const r=await pool.query("UPDATE certificate_records SET status='Revoked' WHERE id=$1 RETURNING serial,status",[req.params.id]);if(!r.rowCount)return res.sendStatus(404);res.json(r.rows[0])}catch(e){fail(res,e)}});
};
