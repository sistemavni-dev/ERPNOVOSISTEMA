-- ==========================================
-- Migração: Integração com Telegram Bot API
-- ==========================================

-- Adicionar telegram_chat_id aos clientes
ALTER TABLE customers ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT;

-- Remover tabela antiga de whatsapp
DROP TABLE IF EXISTS whatsapp_agents CASCADE;

-- Criar tabela de agentes do Telegram
CREATE TABLE IF NOT EXISTS telegram_agents (
    id UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
    bot_token TEXT,
    bot_username TEXT,
    is_active BOOLEAN DEFAULT false NOT NULL,
    features TEXT[] DEFAULT '{}'::TEXT[] NOT NULL,
    agent_prompt TEXT DEFAULT 'Você é um assistente virtual atencioso que ajuda a tirar dúvidas sobre nossa loja.' NOT NULL,
    handoff_enabled BOOLEAN DEFAULT true NOT NULL,
    webhook_status TEXT DEFAULT 'disconnected' NOT NULL CHECK (webhook_status IN ('disconnected', 'connected', 'error')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS
ALTER TABLE telegram_agents ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
CREATE POLICY "Tenants can manage their telegram agent config" ON telegram_agents FOR ALL USING (id = auth.uid());
