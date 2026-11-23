'use strict';
module.exports = function mountPayments(app,pool,{member,admin}) {
  const bad=(res,e)=>{console.error(e);res.status(500).json({error:'সার্ভারে সমস্যা হয়েছে।'});};
  app.get('/api/plans',async(req,res)=>{try{
    const p=await pool.query("SELECT * FROM payment_packages WHERE active=true ORDER BY sort_order,id");
    const o=await pool.query("SELECT * FROM payment_offers WHERE active=true AND (starts_at IS NULL OR starts_at<=NOW()) AND (ends_at IS NULL OR ends_at>=NOW()) ORDER BY id DESC");
    const s=await pool.query("SELECT data FROM payment_settings WHERE id=1");
    res.json({packages:p.rows,offers:o.rows,payment:s.rows[0]?.data||{}});
  }catch(e){bad(res,e)}});
  app.get('/api/me/payments',member,async(req,res)=>{try{
    const r=await pool.query('SELECT p.*,s.name package_name FROM payment_requests p LEFT JOIN payment_packages s ON s.id=p.package_id WHERE p.member_id=$1 ORDER BY p.created_at DESC',[req.user.id]);
    const a=await pool.query('SELECT s.*,p.name package_name FROM member_subscriptions s LEFT JOIN payment_packages p ON p.id=s.package_id WHERE s.member_id=$1 ORDER BY s.created_at DESC',[req.user.id]);
    res.json({payments:r.rows,subscriptions:a.rows});
  }catch(e){bad(res,e)}});
  app.post('/api/me/payments',member,async(req,res)=>{try{
    const {packageId,method,transactionId,payerPhone,amount,note,offerCode}=req.body||{};
    if(!packageId||!['bKash','Nagad','Rocket','Bank'].includes(method)||!transactionId||!payerPhone)
      return res.status(400).json({error:'প্যাকেজ, পেমেন্ট মাধ্যম, Transaction ID ও প্রেরকের নম্বর দিন।'});
    const p=await pool.query('SELECT * FROM payment_packages WHERE id=$1 AND active=true',[packageId]);
    if(!p.rowCount)return res.status(404).json({error:'প্যাকেজটি বর্তমানে পাওয়া যাচ্ছে না।'});
    let price=Number(p.rows[0].offer_price??p.rows[0].price);
    const code=String(offerCode||'').trim().toUpperCase();
    if(code){const o=await pool.query("SELECT * FROM payment_offers WHERE upper(code)=upper($1) AND active=true AND (starts_at IS NULL OR starts_at<=NOW()) AND (ends_at IS NULL OR ends_at>=NOW()) ORDER BY id DESC LIMIT 1",[code]);if(!o.rowCount)return res.status(400).json({error:'Coupon code সঠিক নয় অথবা মেয়াদ শেষ।'});const offer=o.rows[0];price=offer.discount_type==='percent'?price*(1-Number(offer.discount_value)/100):price-Number(offer.discount_value);price=Math.max(0,Math.round(price*100)/100);}
    const submitted=Number(amount);
    if(!Number.isFinite(submitted)||submitted!==price)return res.status(400).json({error:'Coupon প্রয়োগের পর সঠিক পরিমাণ ৳'+price+' দিন।'});
    const r=await pool.query('INSERT INTO payment_requests(member_id,package_id,method,transaction_id,payer_phone,amount,note,offer_code) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id,status,created_at',[req.user.id,packageId,method,String(transactionId).trim(),String(payerPhone).trim(),price,String(note||'').slice(0,500),code||null]);
    res.status(201).json({ok:true,payment:r.rows[0],message:'পেমেন্ট তথ্য জমা হয়েছে। Admin যাচাইয়ের পর Access চালু হবে।'});
  }catch(e){if(e.code==='23505')return res.status(409).json({error:'এই Transaction ID আগে জমা হয়েছে।'});bad(res,e)}});
  app.get('/api/admin/payments',admin,async(req,res)=>{try{
    const [p,o,r,s]=await Promise.all([
      pool.query('SELECT * FROM payment_packages ORDER BY sort_order,id'),
      pool.query('SELECT * FROM payment_offers ORDER BY id DESC'),
      pool.query('SELECT r.*,m.name member_name,m.phone member_phone,p.name package_name FROM payment_requests r JOIN members m ON m.id=r.member_id LEFT JOIN payment_packages p ON p.id=r.package_id ORDER BY r.created_at DESC LIMIT 500'),
      pool.query('SELECT data FROM payment_settings WHERE id=1')
    ]);
    res.json({packages:p.rows,offers:o.rows,payments:r.rows,settings:s.rows[0]?.data||{}});
  }catch(e){bad(res,e)}});
  app.post('/api/admin/packages',admin,async(req,res)=>{try{
    const {id,name,description,kind,durationDays,price,offerPrice,features,targetType,targetId,active,sortOrder}=req.body||{};
    if(!name||!['monthly','yearly','custom','exam','competition','book','course'].includes(kind)||!Number.isInteger(Number(durationDays))||Number(durationDays)<1||!Number.isFinite(Number(price))||Number(price)<0)
      return res.status(400).json({error:'প্যাকেজের নাম, ধরন, মেয়াদ ও সঠিক মূল্য দিন।'});
    if(['exam','competition','book','course'].includes(kind)&&!targetId)return res.status(400).json({error:'এই প্যাকেজের জন্য নির্দিষ্ট Exam/Competition/Book/Course ID প্রয়োজন।'});
    const v=[String(name).slice(0,120),String(description||'').slice(0,1000),kind,Number(durationDays),Number(price),offerPrice===''||offerPrice==null?null:Number(offerPrice),JSON.stringify(Array.isArray(features)?features:[]),targetType||kind,targetId||null,active!==false,Number(sortOrder)||0];
    let r;
    if(id)r=await pool.query('UPDATE payment_packages SET name=$1,description=$2,kind=$3,duration_days=$4,price=$5,offer_price=$6,features=$7::jsonb,target_type=$8,target_id=$9,active=$10,sort_order=$11,updated_at=NOW() WHERE id=$12 RETURNING *',[...v,id]);
    else r=await pool.query('INSERT INTO payment_packages(name,description,kind,duration_days,price,offer_price,features,target_type,target_id,active,sort_order) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11) RETURNING *',v);
    res.json({package:r.rows[0]});
  }catch(e){bad(res,e)}});
  app.delete('/api/admin/packages/:id',admin,async(req,res)=>{try{await pool.query('UPDATE payment_packages SET active=false,updated_at=NOW() WHERE id=$1',[req.params.id]);res.json({ok:true})}catch(e){bad(res,e)}});
  app.post('/api/admin/offers',admin,async(req,res)=>{try{
    const {id,title,code,discountType,discountValue,startsAt,endsAt,active,description}=req.body||{};
    if(!title||!['percent','fixed'].includes(discountType)||!Number.isFinite(Number(discountValue))||Number(discountValue)<=0)return res.status(400).json({error:'Offer-এর নাম ও সঠিক Discount দিন।'});
    const vals=[title,code||null,discountType,Number(discountValue),startsAt||null,endsAt||null,active!==false,description||''];
    const r=id?await pool.query('UPDATE payment_offers SET title=$1,code=$2,discount_type=$3,discount_value=$4,starts_at=$5,ends_at=$6,active=$7,description=$8 WHERE id=$9 RETURNING *',[...vals,id]):await pool.query('INSERT INTO payment_offers(title,code,discount_type,discount_value,starts_at,ends_at,active,description) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',vals);
    res.json({offer:r.rows[0]});
  }catch(e){bad(res,e)}});
  app.patch('/api/admin/payments/:id',admin,async(req,res)=>{const c=await pool.connect();try{
    const {status,adminNote}=req.body||{};if(!['Approved','Rejected'].includes(status))return res.status(400).json({error:'সঠিক সিদ্ধান্ত নির্বাচন করুন।'});
    await c.query('BEGIN');
    const q=await c.query('SELECT * FROM payment_requests WHERE id=$1 FOR UPDATE',[req.params.id]);
    if(!q.rowCount){await c.query('ROLLBACK');return res.sendStatus(404)}
    const item=q.rows[0];if(item.status!=='Pending'){await c.query('ROLLBACK');return res.status(409).json({error:'এই পেমেন্টের সিদ্ধান্ত আগেই দেওয়া হয়েছে।'})}
    await c.query('UPDATE payment_requests SET status=$1,admin_note=$2,reviewed_at=NOW() WHERE id=$3',[status,String(adminNote||'').slice(0,500),item.id]);
    if(status==='Approved'){
      const p=await c.query('SELECT * FROM payment_packages WHERE id=$1',[item.package_id]);
      if(!p.rowCount)throw new Error('Package missing');
      const pkg=p.rows[0];
      await c.query("INSERT INTO member_subscriptions(member_id,package_id,source_payment_id,starts_at,expires_at,status,target_type,target_id) VALUES($1,$2,$3,NOW(),NOW()+($4||' days')::interval,'Active',$5,$6)",[item.member_id,pkg.id,item.id,pkg.duration_days,pkg.target_type,pkg.target_id]);
    }
    await c.query('COMMIT');res.json({ok:true,status});
  }catch(e){await c.query('ROLLBACK');bad(res,e)}finally{c.release()}});
  app.put('/api/admin/payment-settings',admin,async(req,res)=>{try{
    const {bkash,nagad,rocket,bank,instructions}=req.body||{};
    const data={bkash:String(bkash||''),nagad:String(nagad||''),rocket:String(rocket||''),bank:String(bank||''),instructions:String(instructions||'').slice(0,1000)};
    await pool.query('UPDATE payment_settings SET data=$1::jsonb,updated_at=NOW() WHERE id=1',[JSON.stringify(data)]);res.json({ok:true});
  }catch(e){bad(res,e)}});
};
