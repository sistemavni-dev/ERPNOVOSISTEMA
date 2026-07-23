-- Add multitenant whatsapp columns to tenants table
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS whatsapp_instance_name TEXT UNIQUE;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS whatsapp_status TEXT DEFAULT 'disconnected';
