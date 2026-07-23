import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { phone, message, tenant_id } = await req.json()

    if (!phone || !message) {
      return new Response(JSON.stringify({ error: "Telefone e mensagem são obrigatórios" }), { 
        status: 400, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      })
    }

    const apiUrl = Deno.env.get('EVOLUTION_API_URL')
    const apiKey = Deno.env.get('EVOLUTION_API_KEY')
    
    let instanceName = Deno.env.get('EVOLUTION_INSTANCE_NAME') || 'NexERP'

    // Busca a instância do tenant se o tenant_id for informado
    if (tenant_id) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY') ?? ''
      
      const supabase = createClient(supabaseUrl, supabaseServiceKey)
      
      const { data: tenantData } = await supabase
        .from('tenants')
        .select('whatsapp_instance_name, whatsapp_status')
        .eq('id', tenant_id)
        .single()
        
      if (tenantData && tenantData.whatsapp_status === 'connected' && tenantData.whatsapp_instance_name) {
        instanceName = tenantData.whatsapp_instance_name
      } else {
        console.warn(`[Send-WhatsApp] Tenant ${tenant_id} não possui WhatsApp conectado. Tentando via instância global/padrão.`)
      }
    }

    if (!apiUrl || !apiKey) {
      console.error("Credenciais da Evolution API não configuradas no Supabase.")
      return new Response(JSON.stringify({ error: "Serviço de WhatsApp indisponível no momento." }), { 
        status: 503, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      })
    }

    // Tratamento do Número (Igual ao que estava no frontend)
    let cleanPhone = phone.replace(/\D/g, '')
    if (cleanPhone.length >= 10 && !cleanPhone.startsWith('55')) {
      cleanPhone = '55' + cleanPhone
    }

    // Garante que a URL base não tenha barra no final e adiciona a instância
    const baseUrl = apiUrl.replace(/\/$/, '')
    const url = `${baseUrl}/message/sendText/${instanceName}`

    const payload = {
      number: cleanPhone,
      text: message, // Obrigatório na v2
      options: {
        delay: 1200,
        presence: "composing"
      },
      textMessage: { // Compatibilidade com v1
        text: message
      }
    }

    console.log(`[Send-WhatsApp] Disparando para ${cleanPhone} via ${url}`)

    // Faz a chamada de rede a partir do Backend (sem bloqueio de CORS/Mixed Content)
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey
      },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      const err = await response.text()
      console.error(`[Evolution API - ERRO] Status: ${response.status}`, err)
      return new Response(JSON.stringify({ error: `Falha na Evolution API: ${response.status}` }), { 
        status: response.status, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      })
    }

    const data = await response.json()
    console.log(`[Send-WhatsApp] Sucesso!`, data)

    return new Response(JSON.stringify({ success: true, data }), { 
      status: 200, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    })

  } catch (error: any) {
    console.error("[Send-WhatsApp - ERRO CRÍTICO]", error)
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    })
  }
})
