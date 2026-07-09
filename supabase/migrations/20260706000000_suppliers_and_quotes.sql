-- ==========================================
-- 1. Criação das Tabelas de Fornecedores e Orçamentos
-- ==========================================

CREATE TABLE IF NOT EXISTS suppliers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    document TEXT,
    email TEXT,
    phone TEXT,
    address TEXT,
    tax_regime TEXT NOT NULL CHECK (tax_regime IN ('Simples Nacional', 'Lucro Presumido', 'Lucro Real')),
    default_tax_rate DECIMAL(5, 2) DEFAULT 6.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS supplier_quotes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'approved', 'rejected')),
    subtotal DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    tax_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS supplier_quote_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    quote_id UUID NOT NULL REFERENCES supplier_quotes(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(10, 2) NOT NULL CHECK (unit_price >= 0),
    tax_rate DECIMAL(5, 2) NOT NULL DEFAULT 0.00 CHECK (tax_rate >= 0),
    tax_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00 CHECK (tax_amount >= 0),
    total_price DECIMAL(10, 2) NOT NULL DEFAULT 0.00 CHECK (total_price >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==========================================
-- 2. Habilitação de RLS (Row Level Security)
-- ==========================================

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_quote_items ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- 3. Políticas de RLS
-- ==========================================

-- Políticas para suppliers
DROP POLICY IF EXISTS "Tenants can manage their suppliers" ON suppliers;
CREATE POLICY "Tenants can manage their suppliers" ON suppliers FOR ALL USING (tenant_id = auth.uid());

-- Políticas para supplier_quotes
DROP POLICY IF EXISTS "Tenants can manage their supplier_quotes" ON supplier_quotes;
CREATE POLICY "Tenants can manage their supplier_quotes" ON supplier_quotes FOR ALL USING (tenant_id = auth.uid());

-- Políticas para supplier_quote_items
DROP POLICY IF EXISTS "Tenants can manage their supplier_quote_items" ON supplier_quote_items;
CREATE POLICY "Tenants can manage their supplier_quote_items" ON supplier_quote_items FOR ALL USING (tenant_id = auth.uid());
