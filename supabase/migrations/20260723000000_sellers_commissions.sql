-- Criação da tabela de vendedores/comissionados
CREATE TABLE IF NOT EXISTS sellers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    commission_percentage DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
    current_level TEXT DEFAULT 'Bronze',
    monthly_target DECIMAL(10, 2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Adiciona a coluna seller_id à tabela sales existente
DO $$ 
BEGIN 
    BEGIN
        ALTER TABLE sales ADD COLUMN seller_id UUID REFERENCES sellers(id) ON DELETE SET NULL;
    EXCEPTION
        WHEN duplicate_column THEN NULL;
    END;
END $$;

-- RLS (Row Level Security)
ALTER TABLE sellers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenants can manage their own sellers" ON sellers;
CREATE POLICY "Tenants can manage their own sellers" ON sellers FOR ALL USING (tenant_id = auth.uid());
