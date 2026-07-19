-- Migration to add fiscal and NFe fields

-- 1. Tabela products (NCM, CEST, Origem)
ALTER TABLE products ADD COLUMN IF NOT EXISTS ncm TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS cest TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS origin INTEGER DEFAULT 0;

-- 2. Tabela customers (Inscrição Estadual, Endereço Completo, IBGE)
ALTER TABLE customers ADD COLUMN IF NOT EXISTS ie TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS address_street TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS address_number TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS address_district TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS address_zip TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS address_ibge TEXT;

-- 3. Tabela tenants (IE, Regime Tributário, Certificado)
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS ie TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS tax_regime TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS certificate_a1_password TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS certificate_a1_path TEXT;

-- 4. Criar bucket para os certificados (se não existir)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('certificates', 'certificates', false, 5242880, ARRAY['application/x-pkcs12', 'application/pkcs12', 'application/x-x509-ca-cert'])
ON CONFLICT (id) DO UPDATE SET public = false;

-- Politicas RLS para o bucket de certificados
-- Lojista (Tenant) pode enviar seu proprio certificado
DROP POLICY IF EXISTS "Tenants can upload their own certificates" ON storage.objects;
CREATE POLICY "Tenants can upload their own certificates" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'certificates' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Lojista pode ler/deletar seu proprio certificado
DROP POLICY IF EXISTS "Tenants can manage their own certificates" ON storage.objects;
CREATE POLICY "Tenants can manage their own certificates" ON storage.objects
FOR ALL TO authenticated
USING (
  bucket_id = 'certificates' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
