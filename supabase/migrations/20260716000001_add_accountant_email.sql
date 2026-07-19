-- Adiciona a coluna accountant_email na tabela tenants
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS accountant_email TEXT;
