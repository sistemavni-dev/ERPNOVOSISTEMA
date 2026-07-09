-- Adiciona campos de período de teste e integração Asaas na tabela tenants
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP WITH TIME ZONE DEFAULT (timezone('utc'::text, now()) + interval '7 days');
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS asaas_customer_id TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS asaas_subscription_id TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'trialing';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'prata';
