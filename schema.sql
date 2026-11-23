CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE IF NOT EXISTS platform_state(id SMALLINT PRIMARY KEY DEFAULT 1 CHECK(id=1),data JSONB NOT NULL DEFAULT '{"ads":[],"winners":[],"competitions":[],"notices":[],"settings":{"dailyQuizCoins":5,"referralCoins":10}}'::jsonb,updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
INSERT INTO platform_state(id) VALUES(1) ON CONFLICT(id) DO NOTHING;
CREATE TABLE IF NOT EXISTS members(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),name TEXT NOT NULL,phone TEXT NOT NULL UNIQUE,email TEXT UNIQUE,role TEXT NOT NULL DEFAULT 'General',occupation TEXT,password_hash TEXT NOT NULL,referral_code TEXT NOT NULL UNIQUE,coin_balance INTEGER NOT NULL DEFAULT 0 CHECK(coin_balance>=0),status TEXT NOT NULL DEFAULT 'Active',created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS referrals(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),referrer_id UUID NOT NULL REFERENCES members(id),referred_id UUID NOT NULL UNIQUE REFERENCES members(id),status TEXT NOT NULL DEFAULT 'Pending',reward INTEGER NOT NULL DEFAULT 0,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),rewarded_at TIMESTAMPTZ);
CREATE TABLE IF NOT EXISTS coin_transactions(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),member_id UUID NOT NULL REFERENCES members(id),amount INTEGER NOT NULL,reason TEXT NOT NULL,reference_id TEXT,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS quiz_attempts(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),member_id UUID NOT NULL REFERENCES members(id),questions JSONB NOT NULL,completed_at TIMESTAMPTZ,quiz_day DATE NOT NULL DEFAULT CURRENT_DATE,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),UNIQUE(member_id,quiz_day));
ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_coin_member_created ON coin_transactions(member_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id,created_at DESC);

CREATE TABLE IF NOT EXISTS payment_packages(
 id BIGSERIAL PRIMARY KEY,name TEXT NOT NULL,description TEXT,kind TEXT NOT NULL,duration_days INTEGER NOT NULL CHECK(duration_days>0),
 price NUMERIC(12,2) NOT NULL CHECK(price>=0),offer_price NUMERIC(12,2),features JSONB NOT NULL DEFAULT '[]'::jsonb,
 target_type TEXT NOT NULL DEFAULT 'membership',target_id TEXT,active BOOLEAN NOT NULL DEFAULT TRUE,sort_order INTEGER NOT NULL DEFAULT 0,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS payment_offers(
 id BIGSERIAL PRIMARY KEY,title TEXT NOT NULL,code TEXT,discount_type TEXT NOT NULL,discount_value NUMERIC(12,2) NOT NULL,
 starts_at TIMESTAMPTZ,ends_at TIMESTAMPTZ,active BOOLEAN NOT NULL DEFAULT TRUE,description TEXT,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS payment_requests(
 id BIGSERIAL PRIMARY KEY,member_id UUID NOT NULL REFERENCES members(id),package_id BIGINT NOT NULL REFERENCES payment_packages(id),
 method TEXT NOT NULL,transaction_id TEXT NOT NULL UNIQUE,payer_phone TEXT NOT NULL,amount NUMERIC(12,2) NOT NULL,note TEXT,
 status TEXT NOT NULL DEFAULT 'Pending',admin_note TEXT,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),reviewed_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS member_subscriptions(
 id BIGSERIAL PRIMARY KEY,member_id UUID NOT NULL REFERENCES members(id),package_id BIGINT NOT NULL REFERENCES payment_packages(id),
 source_payment_id BIGINT NOT NULL UNIQUE REFERENCES payment_requests(id),starts_at TIMESTAMPTZ NOT NULL,expires_at TIMESTAMPTZ NOT NULL,
 status TEXT NOT NULL DEFAULT 'Active',target_type TEXT NOT NULL,target_id TEXT,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE member_subscriptions ALTER COLUMN source_payment_id DROP NOT NULL;
CREATE TABLE IF NOT EXISTS payment_settings(id SMALLINT PRIMARY KEY DEFAULT 1 CHECK(id=1),data JSONB NOT NULL DEFAULT '{}'::jsonb,updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
INSERT INTO payment_settings(id) VALUES(1) ON CONFLICT(id) DO NOTHING;

ALTER TABLE payment_requests ADD COLUMN IF NOT EXISTS offer_code TEXT;

CREATE TABLE IF NOT EXISTS certificate_records(
 id BIGSERIAL PRIMARY KEY,serial TEXT NOT NULL UNIQUE,member_id UUID REFERENCES members(id) ON DELETE SET NULL,
 recipient_name TEXT NOT NULL,recipient_phone TEXT,recipient_email TEXT,exam_title TEXT NOT NULL,
 achievement TEXT NOT NULL DEFAULT 'সফলভাবে পরীক্ষা সম্পন্ন করেছেন',score TEXT,grade TEXT,
 issue_date DATE NOT NULL DEFAULT CURRENT_DATE,issuer_name TEXT NOT NULL DEFAULT 'SUKUN MEDHA',
 issuer_title TEXT NOT NULL DEFAULT 'Authorized Signatory',organization TEXT NOT NULL DEFAULT 'SUKUN MEDHA',
 status TEXT NOT NULL DEFAULT 'Issued' CHECK(status IN ('Issued','Revoked')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_certificate_member ON certificate_records(member_id,created_at DESC);


CREATE TABLE IF NOT EXISTS exam_papers(
 id BIGSERIAL PRIMARY KEY,title TEXT NOT NULL,category TEXT NOT NULL,subject TEXT NOT NULL,
 full_marks NUMERIC(10,2) NOT NULL,duration TEXT,instructions TEXT,
 sections JSONB NOT NULL DEFAULT '[]'::jsonb,status TEXT NOT NULL DEFAULT 'Draft' CHECK(status IN ('Draft','Published')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_exam_papers_status_created ON exam_papers(status,created_at DESC);
CREATE TABLE IF NOT EXISTS exam_result_sheets(
 id BIGSERIAL PRIMARY KEY,exam_title TEXT NOT NULL,category TEXT NOT NULL,exam_date DATE,
 subjects JSONB NOT NULL DEFAULT '[]'::jsonb,students JSONB NOT NULL DEFAULT '[]'::jsonb,note TEXT,
 status TEXT NOT NULL DEFAULT 'Draft' CHECK(status IN ('Draft','Published')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_exam_results_status_created ON exam_result_sheets(status,created_at DESC);

ALTER TABLE payment_packages ADD COLUMN IF NOT EXISTS package_status TEXT NOT NULL DEFAULT 'Published';
ALTER TABLE payment_packages ADD COLUMN IF NOT EXISTS access_scope JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE payment_packages ADD COLUMN IF NOT EXISTS member_limit INTEGER;
ALTER TABLE payment_packages ADD COLUMN IF NOT EXISTS badge TEXT;
ALTER TABLE payment_offers ADD COLUMN IF NOT EXISTS offer_type TEXT NOT NULL DEFAULT 'coupon';
ALTER TABLE payment_offers ADD COLUMN IF NOT EXISTS max_redemptions INTEGER;
ALTER TABLE payment_offers ADD COLUMN IF NOT EXISTS package_ids JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE payment_offers ADD COLUMN IF NOT EXISTS member_ids JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE payment_requests ADD COLUMN IF NOT EXISTS applied_offer_id BIGINT REFERENCES payment_offers(id);
ALTER TABLE payment_requests ADD COLUMN IF NOT EXISTS original_amount NUMERIC(12,2);
CREATE INDEX IF NOT EXISTS idx_payment_packages_status ON payment_packages(package_status,active);
CREATE INDEX IF NOT EXISTS idx_payment_requests_offer ON payment_requests(applied_offer_id,status);

CREATE TABLE IF NOT EXISTS member_cart_items(
 id BIGSERIAL PRIMARY KEY,member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
 item_type TEXT NOT NULL,item_id TEXT NOT NULL,quantity INTEGER NOT NULL DEFAULT 1 CHECK(quantity BETWEEN 1 AND 20),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),UNIQUE(member_id,item_type,item_id)
);
CREATE TABLE IF NOT EXISTS shop_orders(
 id BIGSERIAL PRIMARY KEY,member_id UUID NOT NULL REFERENCES members(id),subtotal NUMERIC(12,2) NOT NULL,
 discount NUMERIC(12,2) NOT NULL DEFAULT 0,total NUMERIC(12,2) NOT NULL,coin_total INTEGER NOT NULL DEFAULT 0,
 payment_method TEXT,payment_status TEXT NOT NULL DEFAULT 'Pending',order_status TEXT NOT NULL DEFAULT 'Pending',
 coupon_code TEXT,admin_note TEXT,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),reviewed_at TIMESTAMPTZ
);
ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS applied_offer_id BIGINT REFERENCES payment_offers(id);
CREATE TABLE IF NOT EXISTS shop_order_items(
 id BIGSERIAL PRIMARY KEY,order_id BIGINT NOT NULL REFERENCES shop_orders(id) ON DELETE CASCADE,
 item_type TEXT NOT NULL,item_id TEXT NOT NULL,title TEXT NOT NULL,quantity INTEGER NOT NULL,
 unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,unit_coins INTEGER NOT NULL DEFAULT 0,
 access_days INTEGER,metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE TABLE IF NOT EXISTS shop_order_payments(
 id BIGSERIAL PRIMARY KEY,order_id BIGINT NOT NULL REFERENCES shop_orders(id),member_id UUID NOT NULL REFERENCES members(id),
 method TEXT NOT NULL,transaction_id TEXT NOT NULL UNIQUE,payer_phone TEXT NOT NULL,amount NUMERIC(12,2) NOT NULL,
 status TEXT NOT NULL DEFAULT 'Pending',admin_note TEXT,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),reviewed_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS member_entitlements(
 id BIGSERIAL PRIMARY KEY,member_id UUID NOT NULL REFERENCES members(id),item_type TEXT NOT NULL,item_id TEXT NOT NULL,
 order_id BIGINT REFERENCES shop_orders(id),starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),expires_at TIMESTAMPTZ,
 status TEXT NOT NULL DEFAULT 'Active',created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cart_member ON member_cart_items(member_id);
CREATE INDEX IF NOT EXISTS idx_shop_orders_member ON shop_orders(member_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_entitlements_member ON member_entitlements(member_id,item_type,item_id,expires_at);

CREATE TABLE IF NOT EXISTS member_rewards(
 id BIGSERIAL PRIMARY KEY,member_id UUID NOT NULL REFERENCES members(id),reward_title TEXT NOT NULL,
 description TEXT,competition_id TEXT,status TEXT NOT NULL DEFAULT 'Awarded',awarded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_member_rewards_member ON member_rewards(member_id,awarded_at DESC);

CREATE TABLE IF NOT EXISTS event_entries(
 id BIGSERIAL PRIMARY KEY,member_id UUID NOT NULL REFERENCES members(id),event_type TEXT NOT NULL CHECK(event_type IN ('competition','challenge')),
 event_id TEXT NOT NULL,order_id BIGINT REFERENCES shop_orders(id),status TEXT NOT NULL DEFAULT 'Confirmed',
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),UNIQUE(member_id,event_type,event_id)
);
CREATE INDEX IF NOT EXISTS idx_event_entries_event ON event_entries(event_type,event_id,created_at DESC);

CREATE TABLE IF NOT EXISTS online_exam_attempts(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
 competition_id TEXT NOT NULL,
 attempt_no INTEGER NOT NULL DEFAULT 1,
 questions JSONB NOT NULL DEFAULT '[]'::jsonb,
 duration_seconds INTEGER NOT NULL CHECK(duration_seconds>0),
 started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 expires_at TIMESTAMPTZ NOT NULL,
 answers JSONB NOT NULL DEFAULT '{}'::jsonb,
 objective_score NUMERIC(10,2) NOT NULL DEFAULT 0,
 written_max NUMERIC(10,2) NOT NULL DEFAULT 0,
 written_score NUMERIC(10,2) NOT NULL DEFAULT 0,
 written_answers JSONB NOT NULL DEFAULT '[]'::jsonb,
 status TEXT NOT NULL DEFAULT 'In Progress' CHECK(status IN ('In Progress','Pending Evaluation','Graded')),
 submitted_at TIMESTAMPTZ,
 graded_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE(member_id,competition_id,attempt_no)
);
CREATE INDEX IF NOT EXISTS idx_online_attempt_comp ON online_exam_attempts(competition_id,status,started_at DESC);
CREATE INDEX IF NOT EXISTS idx_online_attempt_member ON online_exam_attempts(member_id,competition_id,attempt_no DESC);

CREATE TABLE IF NOT EXISTS coin_cashout_settings(
 id SMALLINT PRIMARY KEY DEFAULT 1 CHECK(id=1),
 data JSONB NOT NULL DEFAULT '{"enabled":false,"minimumCoins":1000,"coinsPerTaka":0,"note":"ক্যাশআউট আবেদন Admin যাচাই করে ম্যানুয়ালি পেমেন্ট করবেন।"}'::jsonb,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO coin_cashout_settings(id) VALUES(1) ON CONFLICT(id) DO NOTHING;
CREATE TABLE IF NOT EXISTS coin_cashout_requests(
 id BIGSERIAL PRIMARY KEY,
 member_id UUID NOT NULL REFERENCES members(id),
 coins INTEGER NOT NULL CHECK(coins>0),
 amount_taka NUMERIC(12,2) NOT NULL CHECK(amount_taka>0),
 coins_per_taka INTEGER NOT NULL CHECK(coins_per_taka>0),
 payout_method TEXT NOT NULL CHECK(payout_method IN ('bKash','Nagad','Rocket')),
 payout_phone TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'Pending' CHECK(status IN ('Pending','Paid','Rejected')),
 admin_note TEXT,
 payout_reference TEXT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 reviewed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_coin_cashout_status_created ON coin_cashout_requests(status,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_coin_cashout_member ON coin_cashout_requests(member_id,created_at DESC);


CREATE TABLE IF NOT EXISTS coin_engagement_settings(id SMALLINT PRIMARY KEY DEFAULT 1 CHECK(id=1),data JSONB NOT NULL DEFAULT '{"competitionShareCoins":5,"shareDailyLimit":10,"streakRewards":{"3":10,"7":30,"14":75,"30":200},"referralCoins":10}'::jsonb,updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
INSERT INTO coin_engagement_settings(id) VALUES(1) ON CONFLICT(id) DO NOTHING;
CREATE TABLE IF NOT EXISTS coin_competition_shares(id BIGSERIAL PRIMARY KEY,member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,competition_id TEXT NOT NULL,coins INTEGER NOT NULL DEFAULT 0,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),UNIQUE(member_id,competition_id));
CREATE INDEX IF NOT EXISTS idx_coin_share_member_date ON coin_competition_shares(member_id,created_at DESC);
CREATE TABLE IF NOT EXISTS coin_streak_claims(id BIGSERIAL PRIMARY KEY,member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,claim_day DATE NOT NULL DEFAULT CURRENT_DATE,streak_days INTEGER NOT NULL,coins INTEGER NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),UNIQUE(member_id,claim_day));
CREATE TABLE IF NOT EXISTS coin_tasks(id BIGSERIAL PRIMARY KEY,title TEXT NOT NULL,description TEXT NOT NULL,coin_reward INTEGER NOT NULL CHECK(coin_reward>0),proof_required BOOLEAN NOT NULL DEFAULT TRUE,active BOOLEAN NOT NULL DEFAULT TRUE,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS coin_task_submissions(id BIGSERIAL PRIMARY KEY,member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,task_id BIGINT NOT NULL REFERENCES coin_tasks(id),proof TEXT,status TEXT NOT NULL DEFAULT 'Pending' CHECK(status IN ('Pending','Approved','Rejected')),admin_note TEXT,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),reviewed_at TIMESTAMPTZ,UNIQUE(member_id,task_id));
CREATE INDEX IF NOT EXISTS idx_coin_task_submissions_status ON coin_task_submissions(status,created_at DESC);

-- Public Daily / Special coin tasks
ALTER TABLE coin_tasks ADD COLUMN IF NOT EXISTS task_type TEXT NOT NULL DEFAULT 'special';
ALTER TABLE coin_tasks ADD COLUMN IF NOT EXISTS facebook_url TEXT;
ALTER TABLE coin_tasks ADD COLUMN IF NOT EXISTS rules TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_coin_tasks_public ON coin_tasks(active,task_type,created_at DESC);


CREATE TABLE IF NOT EXISTS member_course_progress(
 member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
 course_id TEXT NOT NULL,
 lesson_index INTEGER NOT NULL DEFAULT 0,
 completed_lessons JSONB NOT NULL DEFAULT '[]'::jsonb,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 PRIMARY KEY(member_id,course_id)
);
CREATE TABLE IF NOT EXISTS member_course_bookmarks(
 id BIGSERIAL PRIMARY KEY,
 member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
 course_id TEXT NOT NULL,
 lesson_index INTEGER NOT NULL DEFAULT 0,
 lesson_title TEXT NOT NULL DEFAULT '',
 quote TEXT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_course_bookmarks_member ON member_course_bookmarks(member_id,created_at DESC);


-- One-time member reward for sharing each published course
CREATE TABLE IF NOT EXISTS coin_course_shares(
 id BIGSERIAL PRIMARY KEY,
 member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
 course_id TEXT NOT NULL,
 coins INTEGER NOT NULL DEFAULT 0 CHECK(coins>=0),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE(member_id,course_id)
);
CREATE INDEX IF NOT EXISTS idx_coin_course_shares_member ON coin_course_shares(member_id,created_at DESC);
