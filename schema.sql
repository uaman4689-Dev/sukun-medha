CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE IF NOT EXISTS platform_state(id SMALLINT PRIMARY KEY DEFAULT 1 CHECK(id=1),data JSONB NOT NULL DEFAULT '{"ads":[],"winners":[],"competitions":[],"notices":[],"settings":{"dailyQuizCoins":5,"referralCoins":10}}'::jsonb,updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
INSERT INTO platform_state(id) VALUES(1) ON CONFLICT(id) DO NOTHING;
CREATE TABLE IF NOT EXISTS members(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),name TEXT NOT NULL,phone TEXT NOT NULL UNIQUE,email TEXT UNIQUE,role TEXT NOT NULL DEFAULT 'General',occupation TEXT,password_hash TEXT NOT NULL,referral_code TEXT NOT NULL UNIQUE,coin_balance INTEGER NOT NULL DEFAULT 0 CHECK(coin_balance>=0),status TEXT NOT NULL DEFAULT 'Active',created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS referrals(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),referrer_id UUID NOT NULL REFERENCES members(id),referred_id UUID NOT NULL UNIQUE REFERENCES members(id),status TEXT NOT NULL DEFAULT 'Pending',reward INTEGER NOT NULL DEFAULT 0,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),rewarded_at TIMESTAMPTZ);
CREATE TABLE IF NOT EXISTS coin_transactions(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),member_id UUID NOT NULL REFERENCES members(id),amount INTEGER NOT NULL,reason TEXT NOT NULL,reference_id TEXT,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS quiz_attempts(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),member_id UUID NOT NULL REFERENCES members(id),questions JSONB NOT NULL,completed_at TIMESTAMPTZ,quiz_day DATE NOT NULL DEFAULT CURRENT_DATE,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),UNIQUE(member_id,quiz_day));
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
CREATE TABLE IF NOT EXISTS payment_settings(id SMALLINT PRIMARY KEY DEFAULT 1 CHECK(id=1),data JSONB NOT NULL DEFAULT '{}'::jsonb,updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
INSERT INTO payment_settings(id) VALUES(1) ON CONFLICT(id) DO NOTHING;

ALTER TABLE payment_requests ADD COLUMN IF NOT EXISTS offer_code TEXT;
