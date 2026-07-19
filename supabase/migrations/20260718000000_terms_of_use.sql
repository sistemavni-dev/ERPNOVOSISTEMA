-- Migration to add terms of use and privacy policy tracking for tenants (companies)
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS accepted_terms BOOLEAN DEFAULT FALSE;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS accepted_terms_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS terms_version TEXT DEFAULT 'v1.0';
