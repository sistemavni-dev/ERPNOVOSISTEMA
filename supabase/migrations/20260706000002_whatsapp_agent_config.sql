-- ==========================================
-- Migração: Configurações do Agente de WhatsApp IA
-- ==========================================

CREATE TABLE IF NOT EXISTS whatsapp_agents (
    id UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
    whatsapp_number TEXT NOT NULL,
    is_active BOOLEAN DEFAULT false NOT NULL,
    features TEXT[] DEFAULT '{}'::TEXT[] NOT NULL,
    agent_prompt TEXT DEFAULT 'Você é um assistente virtual atencioso que ajuda a tirar dúvidas sobre nossa loja.' NOT NULL,
    handoff_enabled BOOLEAN DEFAULT true NOT NULL,
    instance_name TEXT,
    instance_status TEXT DEFAULT 'disconnected' NOT NULL CHECK (instance_status IN ('disconnected', 'connected', 'connecting')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS
ALTER TABLE whatsapp_agents ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
DROP POLICY IF EXISTS "Tenants can manage their whatsapp agent config" ON whatsapp_agents;
CREATE POLICY "Tenants can manage their whatsapp agent config" ON whatsapp_agents FOR ALL USING (id = auth.uid());
