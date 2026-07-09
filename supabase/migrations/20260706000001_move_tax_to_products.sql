-- ==========================================
-- Migração: Mover Regime Tributário do Fornecedor para o Produto
-- ==========================================

-- 1. Alterações na tabela suppliers (remover enquadramento)
ALTER TABLE suppliers DROP COLUMN IF EXISTS tax_regime;
ALTER TABLE suppliers DROP COLUMN IF EXISTS default_tax_rate;

-- 2. Alterações na tabela products (adicionar enquadramento)
ALTER TABLE products ADD COLUMN IF NOT EXISTS tax_regime TEXT DEFAULT 'Simples Nacional' CHECK (tax_regime IN ('Simples Nacional', 'Lucro Presumido', 'Lucro Real'));
ALTER TABLE products ADD COLUMN IF NOT EXISTS default_tax_rate DECIMAL(5, 2) DEFAULT 6.00;
