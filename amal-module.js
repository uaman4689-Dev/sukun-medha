'use strict';
module.exports=(app,pool,{member,admin})=>{
 let ready;
 const ensure=()=>ready||(ready=pool.query(`
 CREATE TABLE IF NOT EXISTS amal_items(
  id BIGSERIAL PRIMARY KEY,title TEXT NOT NULL,category TEXT NOT NULL DEFAULT 'অন্যান্য',
  unit TEXT NOT NULL DEFAULT 'বার',active BOOLEAN NOT NULL DEFAULT TRUE,sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
 );
 CREATE TABLE IF NOT EXISTS amal_entries(
  id BIGSERIAL PRIMARY KEY,member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  item_id BIGINT NOT NULL REFERENCES amal_items(id) ON DELETE CASCADE,entry_date DATE NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT FALSE,quantity NUMERIC(12,2) NOT NULL DEFAULT 0,
  sadaka_amount NUMERIC(12,2) NOT NULL DEFAULT 0,updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(member_id,item_id,entry_date)
 );
 CREATE INDEX IF NOT EXISTS idx_amal_entries_member_date ON amal_entries(member_id,entry_date DESC);
 CREATE TABLE IF NOT EXISTS amal_challenges(
  id BIGSERIAL PRIMARY KEY,title TEXT NOT NULL,description TEXT NOT NULL DEFAULT '',
  start_date DATE NOT NULL,end_date DATE NOT NULL,target_days INTEGER NOT NULL DEFAULT 7,
  target_category TEXT NOT NULL DEFAULT 'সব আমল',reward_type TEXT NOT NULL DEFAULT 'none',
  reward_value INTEGER NOT NULL DEFAULT 0,reward_label TEXT NOT NULL DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT TRUE,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
 );
 CREATE TABLE IF NOT EXISTS amal_challenge_entries(
  id BIGSERIAL PRIMARY KEY,challenge_id BIGINT NOT NULL REFERENCES amal_challenges(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'Joined',reward_status TEXT NOT NULL DEFAULT 'Pending',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),reviewed_at TIMESTAMPTZ,
  UNIQUE(challenge_id,member_id)
 );
 CREATE INDEX IF NOT EXISTS idx_amal_challenge_member ON amal_challenge_entries(member_id,joined_at DESC);
 `).then(async()=>{
  const defaults=[
   ['পাঁচ ওয়াক্ত নামাজ','ইবাদত','ওয়াক্ত'],['কুরআন তিলাওয়াত','কুরআন','পৃষ্ঠা'],
   ['সকালের যিকির','যিকির','বার'],['সন্ধ্যার যিকির','যিকির','বার'],
   ['দরুদ পাঠ','যিকির','বার'],['ইস্তিগফার','যিকির','বার'],
   ['দোয়া','দোয়া','বার'],['সদকা','সদকা','টাকা']
  ];
  for(let i=0;i<defaults.length;i++){
   const [title,category,unit]=defaults[i];
   await pool.query('INSERT INTO amal_items(title,category,unit,sort_order) SELECT $1,$2,$3,$4 WHERE NOT EXISTS(SELECT 1 FROM amal_items WHERE title=$1)',[title,category,unit,i+1]);
  }
 }).catch(e=>{ready=null;throw e}));
 const fail=(res,e)=>{console.error('Amal tracker:',e);res.status(500).json({error:'তথ্য লোড বা সংরক্ষণ করা যায়নি। আবার চেষ্টা করুন।'})};
 app.get('/api/amal/config',async(req,res)=>{try{await ensure();const [items,challenges]=await Promise.all([
  pool.query('SELECT id,title,category,unit FROM amal_items WHERE active=TRUE ORDER BY sort_order,id'),
  pool.query("SELECT id,title,description,start_date,end_date,target_days,target_category,reward_type,reward_value,reward_label FROM amal_challenges WHERE active=TRUE AND end_date>=(NOW() AT TIME ZONE 'Asia/Dhaka')::date ORDER BY start_date,id")
 ]);res.json({items:items.rows,challenges:challenges.rows})}catch(e){fail(res,e)}});
 app.get('/api/amal/me',member,async(req,res)=>{try{
  await ensure();const month=/^\d{4}-\d{2}$/.test(req.query.month||'')?req.query.month:new Date().toISOString().slice(0,7);
  const from=month+'-01';
  const [items,challenges,joined,rank]=await Promise.all([
   pool.query('SELECT id,title,category,unit FROM amal_items WHERE active=TRUE ORDER BY sort_order,id'),
   pool.query("SELECT id,title,description,start_date,end_date,target_days,target_category,reward_type,reward_value,reward_label FROM amal_challenges WHERE (active=TRUE AND end_date>=(NOW() AT TIME ZONE 'Asia/Dhaka')::date) OR id IN (SELECT challenge_id FROM amal_challenge_entries WHERE member_id=$1) ORDER BY start_date,id",[req.user.id]),
   pool.query('SELECT ce.challenge_id,ce.status,ce.reward_status,c.title AS challenge_title,c.reward_type,c.reward_value,c.reward_label FROM amal_challenge_entries ce JOIN amal_challenges c ON c.id=ce.challenge_id WHERE ce.member_id=$1',[req.user.id]),
   pool.query(`SELECT m.name,COUNT(DISTINCT e.entry_date)::int AS active_days,
    ROUND(100.0*COUNT(*) FILTER(WHERE e.completed)/NULLIF(COUNT(DISTINCT e.entry_date)*(SELECT COUNT(*) FROM amal_items WHERE active=TRUE),0))::int AS score
    FROM amal_entries e JOIN members m ON m.id=e.member_id
    WHERE e.entry_date >= $1::date AND e.entry_date < ($1::date + INTERVAL '1 month')
    GROUP BY m.id,m.name ORDER BY score DESC,active_days DESC LIMIT 10`,[from])
  ]);
  const profile=await pool.query('SELECT name FROM members WHERE id=$1',[req.user.id]);
  const logs=await pool.query("SELECT item_id,TO_CHAR(entry_date,'YYYY-MM-DD') AS entry_date,completed,quantity,sadaka_amount FROM amal_entries WHERE member_id=$1 AND entry_date >= $2::date AND entry_date < ($2::date + INTERVAL '1 month') ORDER BY entry_date,item_id",[req.user.id,from]);
  res.json({month,memberName:profile.rows[0]?.name||'SUKUN MEDHA Member',items:items.rows,entries:logs.rows,challenges:challenges.rows,joined:joined.rows,leaderboard:rank.rows});
 }catch(e){fail(res,e)}});
 app.post('/api/amal/entry',member,async(req,res)=>{try{
  await ensure();const {itemId,date,completed,quantity,sadakaAmount}=req.body||{};
  if(!itemId||!/^\d+$/.test(String(itemId))||!/^\d{4}-\d{2}-\d{2}$/.test(String(date||'')))return res.status(400).json({error:'আমল ও তারিখ নির্বাচন করুন।'});
  const future=await pool.query("SELECT $1::date>(NOW() AT TIME ZONE 'Asia/Dhaka')::date AS future",[date]);if(future.rows[0].future)return res.status(400).json({error:'ভবিষ্যতের তারিখে আমল জমা দেওয়া যাবে না।'});
  const item=await pool.query('SELECT id,category FROM amal_items WHERE id=$1 AND active=TRUE',[itemId]);if(!item.rowCount)return res.status(404).json({error:'আমলটি পাওয়া যায়নি।'});
  const q=Math.max(0,Math.min(1000000,Number(quantity)||0)),sadaka=Math.max(0,Math.min(100000000,Number(sadakaAmount)||0));
  const r=await pool.query(`INSERT INTO amal_entries(member_id,item_id,entry_date,completed,quantity,sadaka_amount)
   VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(member_id,item_id,entry_date)
   DO UPDATE SET completed=EXCLUDED.completed,quantity=EXCLUDED.quantity,sadaka_amount=EXCLUDED.sadaka_amount,updated_at=NOW()
   RETURNING item_id,TO_CHAR(entry_date,'YYYY-MM-DD') AS entry_date,completed,quantity,sadaka_amount`,
   [req.user.id,itemId,date,!!completed,q,sadaka]);
  res.json({entry:r.rows[0]});
 }catch(e){fail(res,e)}});
 app.post('/api/amal/challenges/:id/join',member,async(req,res)=>{try{
  await ensure();const c=await pool.query(`SELECT id FROM amal_challenges WHERE id=$1 AND active=TRUE AND end_date>=(NOW() AT TIME ZONE 'Asia/Dhaka')::date`,[req.params.id]);
  if(!c.rowCount)return res.status(404).json({error:'এই চ্যালেঞ্জে এখন যোগ দেওয়া যাচ্ছে না।'});
  const r=await pool.query('INSERT INTO amal_challenge_entries(challenge_id,member_id) VALUES($1,$2) ON CONFLICT(challenge_id,member_id) DO NOTHING RETURNING id',[req.params.id,req.user.id]);
  res.json({ok:true,joined:true});
 }catch(e){fail(res,e)}});
 app.get('/api/amal/report',member,async(req,res)=>{try{
  await ensure();const month=/^\d{4}-\d{2}$/.test(req.query.month||'')?req.query.month:new Date().toISOString().slice(0,7);
  const r=await pool.query(`SELECT i.title,i.category,COUNT(*) FILTER(WHERE e.completed)::int AS completed_days,
   COALESCE(SUM(e.quantity),0)::numeric AS total_quantity,COALESCE(SUM(e.sadaka_amount),0)::numeric AS sadaka_total
   FROM amal_items i LEFT JOIN amal_entries e ON e.item_id=i.id AND e.member_id=$1 AND TO_CHAR(e.entry_date,'YYYY-MM')=$2
   GROUP BY i.id,i.title,i.category ORDER BY i.sort_order,i.id`,[req.user.id,month]);
  const days=await pool.query(`SELECT TO_CHAR(entry_date,'YYYY-MM-DD') AS day,COUNT(*) FILTER(WHERE completed)::int AS done,COUNT(*)::int AS total
   FROM amal_entries WHERE member_id=$1 AND TO_CHAR(entry_date,'YYYY-MM')=$2 GROUP BY entry_date ORDER BY entry_date`,[req.user.id,month]);
  res.json({month,items:r.rows,days:days.rows});
 }catch(e){fail(res,e)}});
 app.get('/api/admin/amal',admin,async(req,res)=>{try{
  await ensure();const [items,challenges,entries,stats]=await Promise.all([
   pool.query('SELECT * FROM amal_items ORDER BY sort_order,id'),
   pool.query('SELECT * FROM amal_challenges ORDER BY created_at DESC'),
   pool.query(`SELECT ce.id,ce.status,ce.reward_status,ce.joined_at,m.name,m.phone,c.title AS challenge_title,c.reward_type,c.reward_value,c.reward_label
    FROM amal_challenge_entries ce JOIN members m ON m.id=ce.member_id JOIN amal_challenges c ON c.id=ce.challenge_id ORDER BY ce.joined_at DESC LIMIT 250`),
   pool.query(`SELECT COUNT(*)::int AS members,(SELECT COUNT(*)::int FROM amal_entries WHERE entry_date=(NOW() AT TIME ZONE 'Asia/Dhaka')::date) AS today_entries,(SELECT COUNT(*)::int FROM amal_challenge_entries) AS challenge_joins FROM members`)
  ]);res.json({items:items.rows,challenges:challenges.rows,entries:entries.rows,stats:stats.rows[0]});
 }catch(e){fail(res,e)}});
 app.post('/api/admin/amal/items',admin,async(req,res)=>{try{await ensure();const {title,category,unit}=req.body||{};if(!String(title||'').trim())return res.status(400).json({error:'আমলের নাম লিখুন।'});const r=await pool.query('INSERT INTO amal_items(title,category,unit,sort_order) VALUES($1,$2,$3,COALESCE((SELECT MAX(sort_order)+1 FROM amal_items),1)) RETURNING *',[String(title).trim(),String(category||'অন্যান্য').trim(),String(unit||'বার').trim()]);res.json({item:r.rows[0]})}catch(e){fail(res,e)}});
 app.put('/api/admin/amal/items/:id',admin,async(req,res)=>{try{await ensure();const {title,category,unit,active,sortOrder}=req.body||{};const r=await pool.query('UPDATE amal_items SET title=COALESCE($2,title),category=COALESCE($3,category),unit=COALESCE($4,unit),active=COALESCE($5,active),sort_order=COALESCE($6,sort_order) WHERE id=$1 RETURNING *',[req.params.id,title,category,unit,typeof active==='boolean'?active:null,sortOrder]);if(!r.rowCount)return res.sendStatus(404);res.json({item:r.rows[0]})}catch(e){fail(res,e)}});
 app.delete('/api/admin/amal/items/:id',admin,async(req,res)=>{try{await ensure();await pool.query('DELETE FROM amal_items WHERE id=$1',[req.params.id]);res.json({ok:true})}catch(e){fail(res,e)}});
 app.post('/api/admin/amal/challenges',admin,async(req,res)=>{try{await ensure();const b=req.body||{};if(!String(b.title||'').trim()||!b.startDate||!b.endDate)return res.status(400).json({error:'চ্যালেঞ্জের নাম ও সময়সীমা দিন।'});const r=await pool.query(`INSERT INTO amal_challenges(title,description,start_date,end_date,target_days,target_category,reward_type,reward_value,reward_label,active)
 VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,[String(b.title).trim(),String(b.description||''),b.startDate,b.endDate,Math.max(1,Number(b.targetDays)||7),String(b.targetCategory||'সব আমল'),['coins','gift','certificate','none'].includes(b.rewardType)?b.rewardType:'none',Math.max(0,Number(b.rewardValue)||0),String(b.rewardLabel||''),b.active!==false]);res.json({challenge:r.rows[0]})}catch(e){fail(res,e)}});
 app.put('/api/admin/amal/challenges/:id',admin,async(req,res)=>{try{await ensure();const b=req.body||{};const r=await pool.query(`UPDATE amal_challenges SET title=COALESCE($2,title),description=COALESCE($3,description),start_date=COALESCE($4,start_date),end_date=COALESCE($5,end_date),target_days=COALESCE($6,target_days),target_category=COALESCE($7,target_category),reward_type=COALESCE($8,reward_type),reward_value=COALESCE($9,reward_value),reward_label=COALESCE($10,reward_label),active=COALESCE($11,active) WHERE id=$1 RETURNING *`,[req.params.id,b.title,b.description,b.startDate,b.endDate,b.targetDays,b.targetCategory,b.rewardType,b.rewardValue,b.rewardLabel,typeof b.active==='boolean'?b.active:null]);if(!r.rowCount)return res.sendStatus(404);res.json({challenge:r.rows[0]})}catch(e){fail(res,e)}});
 app.delete('/api/admin/amal/challenges/:id',admin,async(req,res)=>{try{await ensure();await pool.query('DELETE FROM amal_challenges WHERE id=$1',[req.params.id]);res.json({ok:true})}catch(e){fail(res,e)}});
 app.post('/api/admin/amal/entries/:id/reward',admin,async(req,res)=>{const c=await pool.connect();try{
  await ensure();await c.query('BEGIN');const q=await c.query(`SELECT ce.*,c.reward_type,c.reward_value,c.reward_label FROM amal_challenge_entries ce JOIN amal_challenges c ON c.id=ce.challenge_id WHERE ce.id=$1 FOR UPDATE OF ce`,[req.params.id]);if(!q.rowCount){await c.query('ROLLBACK');return res.sendStatus(404)}
  const row=q.rows[0];if(row.reward_status==='Approved'){await c.query('ROLLBACK');return res.json({ok:true,alreadyApproved:true})}
  if(row.reward_type==='coins'&&Number(row.reward_value)>0){
   const ref='amal-challenge:'+row.id;const exists=await c.query('SELECT id FROM coin_transactions WHERE reference_id=$1',[ref]);
   if(!exists.rowCount){await c.query('UPDATE members SET coin_balance=coin_balance+$1 WHERE id=$2',[Number(row.reward_value),row.member_id]);await c.query('INSERT INTO coin_transactions(member_id,amount,reason,reference_id) VALUES($1,$2,$3,$4)',[row.member_id,Number(row.reward_value),'আমল চ্যালেঞ্জ পুরস্কার: '+row.reward_label,ref])}
  }
  await c.query("UPDATE amal_challenge_entries SET status='Completed',reward_status='Approved',reviewed_at=NOW() WHERE id=$1",[row.id]);await c.query('COMMIT');res.json({ok:true})
 }catch(e){await c.query('ROLLBACK');fail(res,e)}finally{c.release()}});
};