'use strict';
module.exports = function mountPayments(app,pool,{member,admin}) {
  const bad=(res,e)=>{console.error(e);res.status(500).json({error:'সার্ভারে সমস্যা হয়েছে।'});};
  const kinds=['monthly','yearly','custom','exam','competition','book','course'];
  const offerTypes=['coupon','flash_sale','early_bird','upgrade','bundle','special'];
  const round=n=>Math.max(0,Math.round((Number(n)+Number.EPSILON)*100)/100);
  app.get('/api/plans',async(req,res)=>{try{
    const p=await pool.query("SELECT * FROM payment_packages WHERE active=true AND package_status='Published' ORDER BY sort_order,id");
    const o=await pool.query("SELECT o.*,(SELECT COUNT(*)::int FROM payment_requests r WHERE r.applied_offer_id=o.id AND r.status<>'Rejected')+(SELECT COUNT(*)::int FROM shop_orders so WHERE so.applied_offer_id=o.id AND so.payment_status<>'Rejected') AS redeemed FROM payment_offers o WHERE active=true AND (starts_at IS NULL OR starts_at<=NOW()) AND (ends_at IS NULL OR ends_at>=NOW()) ORDER BY id DESC");
    const s=await pool.query("SELECT data FROM payment_settings WHERE id=1");
    const packages=p.rows.map(pkg=>{const base=round(pkg.offer_price==null?pkg.price:pkg.offer_price);const eligible=o.rows.filter(x=>!x.code&&(!Array.isArray(x.member_ids)||!x.member_ids.length)&&x.offer_type!=='upgrade'&&(!x.max_redemptions||Number(x.redeemed)<Number(x.max_redemptions))&&(!Array.isArray(x.package_ids)||!x.package_ids.length||x.package_ids.map(String).includes(String(pkg.id))));let best=null,bestPrice=base;for(const x of eligible){const v=round(x.discount_type==='percent'?base*(1-Number(x.discount_value)/100):base-Number(x.discount_value));if(v<bestPrice){bestPrice=v;best=x;}}return {...pkg,display_price:bestPrice,auto_offer:best?{id:best.id,title:best.title,offer_type:best.offer_type}:null};});
    res.json({packages,offers:o.rows.map(({member_ids,...safe})=>safe),payment:s.rows[0]?.data||{}});
  }catch(e){bad(res,e)}});
  app.get('/api/me/payments',member,async(req,res)=>{try{
    const r=await pool.query('SELECT p.*,s.name package_name FROM payment_requests p LEFT JOIN payment_packages s ON s.id=p.package_id WHERE p.member_id=$1 ORDER BY p.created_at DESC',[req.user.id]);
    const a=await pool.query("SELECT s.*,p.name package_name,p.kind package_kind,p.features FROM member_subscriptions s LEFT JOIN payment_packages p ON p.id=s.package_id WHERE s.member_id=$1 ORDER BY s.created_at DESC",[req.user.id]);
    res.json({payments:r.rows,subscriptions:a.rows.map(x=>({...x,effective_status:x.status==='Active'&&new Date(x.expires_at)<=new Date()?'Expired':x.status}))});
  }catch(e){bad(res,e)}});
  app.get('/api/me/access',member,async(req,res)=>{try{
    const r=await pool.query("SELECT s.id,s.package_id,p.name,p.kind,p.features,p.access_scope,s.target_type,s.target_id,s.starts_at,s.expires_at,CASE WHEN s.status='Active' AND s.starts_at<=NOW() AND s.expires_at>NOW() THEN 'Active' ELSE 'Expired' END AS access_status FROM member_subscriptions s JOIN payment_packages p ON p.id=s.package_id WHERE s.member_id=$1 ORDER BY s.created_at DESC",[req.user.id]);
    res.json({access:r.rows,active:r.rows.filter(x=>x.access_status==='Active')});
  }catch(e){bad(res,e)}});
  app.get('/api/me/access/check',member,async(req,res)=>{try{
    const key=String(req.query.key||'').trim(),type=String(req.query.type||'').trim(),target=String(req.query.id||'').trim();
    if(!key&&!type)return res.status(400).json({error:'Access key অথবা target type দিন।'});
    const r=await pool.query("SELECT EXISTS(SELECT 1 FROM member_subscriptions s JOIN payment_packages p ON p.id=s.package_id WHERE s.member_id=$1 AND s.status='Active' AND s.starts_at<=NOW() AND s.expires_at>NOW() AND ((p.target_type=$2 AND COALESCE(p.target_id,'')=COALESCE($3,'')) OR (p.target_type='membership' AND (p.access_scope->'keys' ? $4 OR p.access_scope->'keys' ? 'all')))) AS allowed",[req.user.id,type,target,key]);
    res.json({allowed:r.rows[0].allowed===true});
  }catch(e){bad(res,e)}});
  app.post('/api/me/payments',member,async(req,res)=>{const c=await pool.connect();try{
    const {packageId,method,transactionId,payerPhone,amount,note,offerCode}=req.body||{};
    if(!packageId||!['bKash','Nagad','Rocket','Bank'].includes(method)||!String(transactionId||'').trim()||!String(payerPhone||'').trim())
      return res.status(400).json({error:'প্যাকেজ, পেমেন্ট মাধ্যম, Transaction ID ও প্রেরকের নম্বর দিন।'});
    await c.query('BEGIN');
    const p=await c.query("SELECT * FROM payment_packages WHERE id=$1 AND active=true AND package_status='Published' FOR UPDATE",[packageId]);
    if(!p.rowCount){await c.query('ROLLBACK');return res.status(404).json({error:'প্যাকেজটি বর্তমানে বিক্রির জন্য নেই।'});}
    const pkg=p.rows[0];
    if(pkg.member_limit){const used=await c.query("SELECT COUNT(*)::int n FROM payment_requests WHERE package_id=$1 AND status<>'Rejected'",[pkg.id]);if(used.rows[0].n>=pkg.member_limit){await c.query('ROLLBACK');return res.status(409).json({error:'এই প্যাকেজের নির্ধারিত সদস্যসীমা পূর্ণ হয়েছে।'});}}
    const original=round(pkg.offer_price==null?pkg.price:pkg.offer_price);
    let price=original,offerId=null,code=String(offerCode||'').trim().toUpperCase();
    if(code){
      const oq=await c.query("SELECT * FROM payment_offers WHERE upper(code)=upper($1) AND active=true AND (starts_at IS NULL OR starts_at<=NOW()) AND (ends_at IS NULL OR ends_at>=NOW()) ORDER BY id DESC LIMIT 1 FOR UPDATE",[code]);
      if(!oq.rowCount){await c.query('ROLLBACK');return res.status(400).json({error:'Coupon code সঠিক নয় অথবা অফারের মেয়াদ শেষ।'});}
      const o=oq.rows[0],allowed=Array.isArray(o.package_ids)?o.package_ids.map(String):[],members=Array.isArray(o.member_ids)?o.member_ids.map(String):[];
      if(allowed.length&&!allowed.includes(String(pkg.id))){await c.query('ROLLBACK');return res.status(400).json({error:'এই Coupon নির্বাচিত প্যাকেজে প্রযোজ্য নয়।'});}if(o.offer_type==='upgrade'){const up=await c.query("SELECT 1 FROM member_subscriptions s JOIN payment_packages p ON p.id=s.package_id WHERE s.member_id=$1 AND s.status='Active' AND s.expires_at>NOW() AND p.kind='monthly' AND s.target_type='membership' LIMIT 1",[req.user.id]);if(pkg.kind!=='yearly'||!up.rowCount){await c.query('ROLLBACK');return res.status(403).json({error:'Upgrade Offer শুধু Active Monthly Member-এর Yearly Package-এ প্রযোজ্য।'});}}
      if(members.length&&!members.includes(String(req.user.id))){await c.query('ROLLBACK');return res.status(403).json({error:'এই Coupon আপনার অ্যাকাউন্টে প্রযোজ্য নয়।'});}
      if(o.max_redemptions){const used=await c.query("SELECT COUNT(*)::int n FROM payment_requests WHERE applied_offer_id=$1 AND status<>'Rejected'",[o.id]);if(used.rows[0].n>=o.max_redemptions){await c.query('ROLLBACK');return res.status(409).json({error:'এই অফারের ব্যবহারসীমা শেষ।'});}}
      price=o.discount_type==='percent'?original*(1-Number(o.discount_value)/100):original-Number(o.discount_value);
      price=round(price);offerId=o.id;
    } else {
      const oq=await c.query("SELECT * FROM payment_offers WHERE code IS NULL AND active=true AND (starts_at IS NULL OR starts_at<=NOW()) AND (ends_at IS NULL OR ends_at>=NOW()) ORDER BY id DESC FOR UPDATE");
      for(const o of oq.rows){const allowed=Array.isArray(o.package_ids)?o.package_ids.map(String):[],members=Array.isArray(o.member_ids)?o.member_ids.map(String):[];if(allowed.length&&!allowed.includes(String(pkg.id)))continue;if(members.length&&!members.includes(String(req.user.id)))continue;if(o.max_redemptions){const used=await c.query("SELECT COUNT(*)::int n FROM payment_requests WHERE applied_offer_id=$1 AND status<>'Rejected'",[o.id]);if(used.rows[0].n>=o.max_redemptions)continue;}const discounted=round(o.discount_type==='percent'?original*(1-Number(o.discount_value)/100):original-Number(o.discount_value));if(discounted<price){price=discounted;offerId=o.id;}}
    }
    const submitted=Number(amount);
    if(!Number.isFinite(submitted)||Math.abs(submitted-price)>0.001){await c.query('ROLLBACK');return res.status(400).json({error:'সঠিক পরিশোধযোগ্য পরিমাণ ৳'+price+' দিন।'});}
    const r=await c.query('INSERT INTO payment_requests(member_id,package_id,method,transaction_id,payer_phone,amount,note,offer_code,applied_offer_id,original_amount) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id,status,created_at,amount',[req.user.id,packageId,method,String(transactionId).trim(),String(payerPhone).trim(),price,String(note||'').slice(0,500),code||null,offerId,original]);
    await c.query('COMMIT');
    res.status(201).json({ok:true,payment:r.rows[0],message:'পেমেন্ট তথ্য জমা হয়েছে। Admin যাচাইয়ের পর Access চালু হবে।'});
  }catch(e){await c.query('ROLLBACK');if(e.code==='23505')return res.status(409).json({error:'এই Transaction ID আগে জমা হয়েছে।'});bad(res,e)}finally{c.release()}});
  app.get('/api/admin/payments',admin,async(req,res)=>{try{
    const [p,o,r,s]=await Promise.all([
      pool.query('SELECT * FROM payment_packages ORDER BY sort_order,id'),
      pool.query("SELECT o.*,(SELECT COUNT(*)::int FROM payment_requests r WHERE r.applied_offer_id=o.id AND r.status<>'Rejected') AS redeemed FROM payment_offers o ORDER BY o.id DESC"),
      pool.query('SELECT r.*,m.name member_name,m.phone member_phone,p.name package_name FROM payment_requests r JOIN members m ON m.id=r.member_id LEFT JOIN payment_packages p ON p.id=r.package_id ORDER BY r.created_at DESC LIMIT 500'),
      pool.query('SELECT data FROM payment_settings WHERE id=1')
    ]);
    res.json({packages:p.rows,offers:o.rows,payments:r.rows,settings:s.rows[0]?.data||{}});
  }catch(e){bad(res,e)}});
  app.post('/api/admin/packages',admin,async(req,res)=>{try{
    const {id,name,description,kind,durationDays,price,offerPrice,features,targetType,targetId,active,sortOrder,packageStatus,accessScope,memberLimit,badge}=req.body||{};
    const status=packageStatus|| (active===false?'Paused':'Published');
    if(!String(name||'').trim()||!kinds.includes(kind)||!Number.isInteger(Number(durationDays))||Number(durationDays)<1||Number(durationDays)>3650||(kind==='monthly'&&Number(durationDays)!==30)||(kind==='yearly'&&Number(durationDays)!==365)||!Number.isFinite(Number(price))||Number(price)<0||(offerPrice!==''&&offerPrice!=null&&(!Number.isFinite(Number(offerPrice))||Number(offerPrice)<0||Number(offerPrice)>Number(price)))||!['Draft','Published','Paused'].includes(status)||(memberLimit!==''&&memberLimit!=null&&(!Number.isInteger(Number(memberLimit))||Number(memberLimit)<1)))
      return res.status(400).json({error:'প্যাকেজের নাম, ধরন, মেয়াদ, মূল্য, সদস্যসীমা ও Status সঠিকভাবে দিন।'});
    if(['exam','competition','book','course'].includes(kind)&&!String(targetId||'').trim())return res.status(400).json({error:'নির্দিষ্ট Exam/Competition/Book/Course ID দিন।'});
    const v=[String(name).trim().slice(0,120),String(description||'').slice(0,1000),kind,Number(durationDays),Number(price),offerPrice===''||offerPrice==null?null:Number(offerPrice),JSON.stringify(Array.isArray(features)?features:[]),targetType||kind,targetId||null,status==='Published',Number(sortOrder)||0,status,JSON.stringify(accessScope&&typeof accessScope==='object'?accessScope:{}),memberLimit===''||memberLimit==null?null:Number(memberLimit),String(badge||'').slice(0,40)];
    let r;
    if(id)r=await pool.query("UPDATE payment_packages SET name=$1,description=$2,kind=$3,duration_days=$4,price=$5,offer_price=$6,features=$7::jsonb,target_type=$8,target_id=$9,active=$10,sort_order=$11,package_status=$12,access_scope=$13::jsonb,member_limit=$14,badge=$15,updated_at=NOW() WHERE id=$16 RETURNING *",[...v,id]);
    else r=await pool.query("INSERT INTO payment_packages(name,description,kind,duration_days,price,offer_price,features,target_type,target_id,active,sort_order,package_status,access_scope,member_limit,badge) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11,$12,$13::jsonb,$14,$15) RETURNING *",v);
    res.json({package:r.rows[0]});
  }catch(e){bad(res,e)}});
  app.patch('/api/admin/packages/:id',admin,async(req,res)=>{try{
    const status=req.body?.packageStatus;
    if(status&&!['Draft','Published','Paused'].includes(status))return res.status(400).json({error:'Status সঠিক নয়।'});
    if(status)await pool.query('UPDATE payment_packages SET package_status=$1,active=$2,updated_at=NOW() WHERE id=$3',[status,status==='Published',req.params.id]);
    else await pool.query('UPDATE payment_packages SET active=$1,package_status=$2,updated_at=NOW() WHERE id=$3',[req.body?.active===true,req.body?.active===true?'Published':'Paused',req.params.id]);
    res.json({ok:true});
  }catch(e){bad(res,e)}});
  app.delete('/api/admin/packages/:id',admin,async(req,res)=>{try{await pool.query("UPDATE payment_packages SET active=false,package_status='Paused',updated_at=NOW() WHERE id=$1",[req.params.id]);res.json({ok:true})}catch(e){bad(res,e)}});
  app.post('/api/admin/offers',admin,async(req,res)=>{try{
    const {id,title,code,discountType,discountValue,startsAt,endsAt,active,description,offerType,maxRedemptions,packageIds,memberIds}=req.body||{};
    const type=offerType||'coupon';
    if(!String(title||'').trim()||!['percent','fixed'].includes(discountType)||!Number.isFinite(Number(discountValue))||Number(discountValue)<=0||(discountType==='percent'&&Number(discountValue)>100)||!offerTypes.includes(type)||((type==='coupon'||type==='upgrade'||(Array.isArray(memberIds)&&memberIds.length>0))&&!String(code||'').trim())||String(code||'').trim().length>40||(startsAt&&(!Number.isFinite(Date.parse(startsAt))))||(endsAt&&(!Number.isFinite(Date.parse(endsAt))))||(startsAt&&endsAt&&new Date(startsAt)>=new Date(endsAt))||(maxRedemptions!==''&&maxRedemptions!=null&&(!Number.isInteger(Number(maxRedemptions))||Number(maxRedemptions)<1)))
      return res.status(400).json({error:'Offer-এর নাম, ধরন, Discount, Coupon ও সময়সীমা সঠিকভাবে দিন।'});
    const vals=[String(title).slice(0,120),String(code||'').trim().toUpperCase()||null,discountType,Number(discountValue),startsAt||null,endsAt||null,active!==false,String(description||'').slice(0,500),type,maxRedemptions===''||maxRedemptions==null?null:Number(maxRedemptions),JSON.stringify(Array.isArray(packageIds)?packageIds:[]),JSON.stringify(Array.isArray(memberIds)?memberIds:[])];
    const r=id?await pool.query('UPDATE payment_offers SET title=$1,code=$2,discount_type=$3,discount_value=$4,starts_at=$5,ends_at=$6,active=$7,description=$8,offer_type=$9,max_redemptions=$10,package_ids=$11::jsonb,member_ids=$12::jsonb WHERE id=$13 RETURNING *',[...vals,id]):await pool.query('INSERT INTO payment_offers(title,code,discount_type,discount_value,starts_at,ends_at,active,description,offer_type,max_redemptions,package_ids,member_ids) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb) RETURNING *',vals);
    res.json({offer:r.rows[0]});
  }catch(e){bad(res,e)}});
  app.patch('/api/admin/offers/:id',admin,async(req,res)=>{try{await pool.query('UPDATE payment_offers SET active=$1 WHERE id=$2',[req.body?.active===true,req.params.id]);res.json({ok:true})}catch(e){bad(res,e)}});
  app.patch('/api/admin/payments/:id',admin,async(req,res)=>{const c=await pool.connect();try{
    const {status,adminNote}=req.body||{};
    if(!['Approved','Rejected'].includes(status))return res.status(400).json({error:'সঠিক সিদ্ধান্ত নির্বাচন করুন।'});
    if(status==='Rejected'&&!String(adminNote||'').trim())return res.status(400).json({error:'Reject করার কারণ লিখতে হবে।'});
    await c.query('BEGIN');
    const q=await c.query('SELECT * FROM payment_requests WHERE id=$1 FOR UPDATE',[req.params.id]);
    if(!q.rowCount){await c.query('ROLLBACK');return res.sendStatus(404)}
    const item=q.rows[0];if(item.status!=='Pending'){await c.query('ROLLBACK');return res.status(409).json({error:'এই পেমেন্টের সিদ্ধান্ত আগেই দেওয়া হয়েছে।'})}
    await c.query('UPDATE payment_requests SET status=$1,admin_note=$2,reviewed_at=NOW() WHERE id=$3',[status,String(adminNote||'').slice(0,500),item.id]);
    if(status==='Approved'){
      const p=await c.query('SELECT * FROM payment_packages WHERE id=$1',[item.package_id]);
      if(!p.rowCount)throw new Error('Package missing');
      const pkg=p.rows[0];
      const current=await c.query("SELECT GREATEST(NOW(),COALESCE(MAX(expires_at),NOW())) AS next_start FROM member_subscriptions WHERE member_id=$1 AND status='Active' AND expires_at>NOW() AND target_type=$2 AND COALESCE(target_id,'')=COALESCE($3,'')",[item.member_id,pkg.target_type,pkg.target_id]);
      await c.query("INSERT INTO member_subscriptions(member_id,package_id,source_payment_id,starts_at,expires_at,status,target_type,target_id) VALUES($1,$2,$3,$4,$4+make_interval(days => $5::int),'Active',$6,$7)",[item.member_id,pkg.id,item.id,current.rows[0].next_start,pkg.duration_days,pkg.target_type,pkg.target_id]);
    }
    await c.query('COMMIT');res.json({ok:true,status});
  }catch(e){await c.query('ROLLBACK');bad(res,e)}finally{c.release()}});
  app.put('/api/admin/payment-settings',admin,async(req,res)=>{try{
    const {bkash,nagad,rocket,bank,instructions}=req.body||{};
    const data={bkash:String(bkash||''),nagad:String(nagad||''),rocket:String(rocket||''),bank:String(bank||''),instructions:String(instructions||'').slice(0,1000)};
    await pool.query('UPDATE payment_settings SET data=$1::jsonb,updated_at=NOW() WHERE id=1',[JSON.stringify(data)]);res.json({ok:true});
  }catch(e){bad(res,e)}});
};