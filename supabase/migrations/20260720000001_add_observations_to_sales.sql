-- Add observations column to sales table
ALTER TABLE sales ADD COLUMN IF NOT EXISTS observations TEXT;
