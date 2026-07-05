-- Habilita extensão para gerar UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- 1. Criação das Tabelas (Ignora se já existir)
-- ==========================================

CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    store_slug TEXT UNIQUE,
    store_description TEXT,
    whatsapp_number TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('active', 'pending', 'inactive')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    sku TEXT,
    image_url TEXT,
    min_stock INTEGER DEFAULT 0,
    stock_quantity INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    document TEXT,
    email TEXT,
    phone TEXT,
    cashback_balance DECIMAL(10, 2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS sales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    total_amount DECIMAL(10, 2) NOT NULL,
    discount DECIMAL(10, 2) DEFAULT 0.00,
    status TEXT NOT NULL CHECK (status IN ('paid', 'pending', 'pending_online', 'awaiting_pickup', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS sale_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL,
    total_price DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS financial_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    sale_id UUID REFERENCES sales(id) ON DELETE SET NULL,
    type TEXT NOT NULL CHECK (type IN ('receivable', 'payable')),
    amount DECIMAL(10, 2) NOT NULL,
    due_date DATE DEFAULT CURRENT_DATE,
    status TEXT NOT NULL CHECK (status IN ('paid', 'pending', 'cancelled', 'pending_online')),
    category TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);


-- ==========================================
-- 2. Atualização de Colunas que possam faltar
-- ==========================================
-- Se você criou a tabela manual antes, as colunas abaixo podem não existir, então vamos forçar a criação:
DO $$ 
BEGIN 
    BEGIN
        ALTER TABLE products ADD COLUMN stock_quantity INTEGER DEFAULT 0;
    EXCEPTION
        WHEN duplicate_column THEN NULL;
    END;
END $$;


-- ==========================================
-- 3. Funções RPC
-- ==========================================

CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role') = 'super_admin';
END;
$$;


-- ==========================================
-- 4. Row Level Security (RLS) e Políticas
-- ==========================================

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_transactions ENABLE ROW LEVEL SECURITY;

-- Limpa as políticas antigas para evitar erro de duplicação
DROP POLICY IF EXISTS "Public can read active tenants" ON tenants;
DROP POLICY IF EXISTS "Tenants can manage their own profile" ON tenants;
CREATE POLICY "Public can read active tenants" ON tenants FOR SELECT USING (status = 'active');
CREATE POLICY "Tenants can manage their own profile" ON tenants FOR ALL USING (id = auth.uid());

DROP POLICY IF EXISTS "Public can view products" ON products;
DROP POLICY IF EXISTS "Tenants can manage their products" ON products;
CREATE POLICY "Public can view products" ON products FOR SELECT USING (true);
CREATE POLICY "Tenants can manage their products" ON products FOR ALL USING (tenant_id = auth.uid());

DROP POLICY IF EXISTS "Tenants can manage inventory" ON inventory;
CREATE POLICY "Tenants can manage inventory" ON inventory FOR ALL USING (
    EXISTS (
        SELECT 1 FROM products p 
        WHERE p.id = inventory.product_id AND p.tenant_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Public can insert customer for online order" ON customers;
DROP POLICY IF EXISTS "Tenants can manage their customers" ON customers;
CREATE POLICY "Public can insert customer for online order" ON customers FOR INSERT WITH CHECK (true);
CREATE POLICY "Tenants can manage their customers" ON customers FOR ALL USING (tenant_id = auth.uid());

DROP POLICY IF EXISTS "Public can insert online orders" ON sales;
DROP POLICY IF EXISTS "Tenants can manage their sales" ON sales;
CREATE POLICY "Public can insert online orders" ON sales FOR INSERT WITH CHECK (true);
CREATE POLICY "Tenants can manage their sales" ON sales FOR ALL USING (tenant_id = auth.uid());

DROP POLICY IF EXISTS "Public can insert sale items" ON sale_items;
DROP POLICY IF EXISTS "Tenants can manage sale items" ON sale_items;
CREATE POLICY "Public can insert sale items" ON sale_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Tenants can manage sale items" ON sale_items FOR ALL USING (tenant_id = auth.uid());

DROP POLICY IF EXISTS "Tenants can manage their finances" ON financial_transactions;
CREATE POLICY "Tenants can manage their finances" ON financial_transactions FOR ALL USING (tenant_id = auth.uid());
