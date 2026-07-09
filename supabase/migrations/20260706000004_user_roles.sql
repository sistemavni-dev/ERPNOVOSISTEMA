-- Migration: Add role column to tenants table
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'admin' CHECK (role IN ('admin', 'manager', 'cashier'));
