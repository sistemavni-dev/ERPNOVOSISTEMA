-- Migration for plans, trial, and automated billing via pg_cron

-- 1. Enable pg_cron
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Add trial_start_at to tenants
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS trial_start_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Update existing tenants that don't have trial_start_at but have trial_ends_at
UPDATE tenants SET trial_start_at = trial_ends_at - INTERVAL '7 days' WHERE trial_start_at IS NULL AND trial_ends_at IS NOT NULL;
UPDATE tenants SET trial_start_at = now() WHERE trial_start_at IS NULL;

-- 3. Invoices table
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  due_date DATE NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, paid, cancelled
  billing_month DATE NOT NULL,
  pix_code TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- RLS for invoices
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenants can view their own invoices" ON invoices;
CREATE POLICY "Tenants can view their own invoices" ON invoices FOR SELECT USING (tenant_id = auth.uid());

-- 4. RPC to suspend trial
CREATE OR REPLACE FUNCTION check_and_suspend_trial()
RETURNS void AS $$
BEGIN
  -- We update the auth.uid() tenant if its trial expired
  UPDATE tenants
  SET status = 'suspended'
  WHERE id = auth.uid() 
    AND status = 'active' -- Ou 'trial' (atualmente criamos como 'active' com subscription_status 'trialing')
    AND trial_start_at < now() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Cron Job 1: Generate invoices on the 1st of every month
SELECT cron.schedule('generate_monthly_invoices', '0 0 1 * *', $$
  INSERT INTO invoices (tenant_id, amount, due_date, billing_month, status)
  SELECT 
    id, 
    CASE 
      WHEN plan = 'bronze' THEN 49.90
      WHEN plan = 'prata' THEN 109.90
      WHEN plan = 'ouro' THEN 199.90
      ELSE 49.90
    END,
    CURRENT_DATE + INTERVAL '9 days', -- vencimento dia 10
    DATE_TRUNC('month', CURRENT_DATE),
    'pending'
  FROM tenants
  WHERE status = 'active';
$$);

-- 6. Cron Job 2: Suspend overdue accounts on the 11th of every month
SELECT cron.schedule('suspend_overdue_tenants', '0 0 11 * *', $$
  UPDATE tenants
  SET status = 'suspended'
  WHERE id IN (
    SELECT tenant_id 
    FROM invoices 
    WHERE status = 'pending' 
      AND due_date < CURRENT_DATE
  );
$$);
