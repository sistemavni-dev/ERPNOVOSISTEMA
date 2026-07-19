-- Migration to add NFe fields to the sales table

ALTER TABLE sales ADD COLUMN IF NOT EXISTS nfe_status TEXT DEFAULT 'pendente';
-- Valores possiveis: 'pendente', 'processando', 'emitida', 'rejeitada'

ALTER TABLE sales ADD COLUMN IF NOT EXISTS nfe_chave TEXT;
-- string de 44 digitos

ALTER TABLE sales ADD COLUMN IF NOT EXISTS nfe_link_danfe TEXT;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS nfe_link_xml TEXT;
