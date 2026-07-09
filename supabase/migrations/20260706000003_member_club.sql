-- Migration: Add is_club_member to customers table
ALTER TABLE customers ADD COLUMN IF NOT EXISTS is_club_member BOOLEAN DEFAULT FALSE;
