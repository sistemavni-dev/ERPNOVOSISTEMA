-- Remover a constraint atual (se existir)
ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_status_check;

-- Adicionar a nova constraint contemplando 'quote'
ALTER TABLE sales ADD CONSTRAINT sales_status_check 
CHECK (status IN ('paid', 'pending', 'pending_online', 'awaiting_pickup', 'cancelled', 'quote'));
