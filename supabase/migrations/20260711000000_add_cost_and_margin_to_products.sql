ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_price numeric(10,2) DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS margin_percentage numeric(10,2) DEFAULT 0;
