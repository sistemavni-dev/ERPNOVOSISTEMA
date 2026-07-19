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
    const payload = await req.json()
    console.log("Webhook Asaas recebido:", payload.event)

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Eventos do Asaas
    const eventType = payload.event
    const payment = payload.payment

    if (!payment || !payment.customer) {
      return new Response(JSON.stringify({ message: "Payload inválido" }), { status: 400, headers: corsHeaders })
    }

    const asaasCustomerId = payment.customer

    // Busca o tenant correspondente
    const { data: tenant, error: tenantError } = await supabaseClient
      .from('tenants')
      .select('id, subscription_status, overdue_since')
      .eq('asaas_customer_id', asaasCustomerId)
      .single()

    if (tenantError || !tenant) {
      console.error("Tenant não encontrado para o asaas_customer_id:", asaasCustomerId)
      return new Response(JSON.stringify({ message: "Tenant não encontrado" }), { status: 404, headers: corsHeaders })
    }

    if (eventType === 'PAYMENT_RECEIVED' || eventType === 'PAYMENT_CONFIRMED') {
      // Pagamento aprovado: Renova o status para active e limpa a inadimplência
      await supabaseClient
        .from('tenants')
        .update({ 
          subscription_status: 'active',
          status: 'active',
          overdue_since: null
        })
        .eq('id', tenant.id)
      
      console.log(`Assinatura renovada/ativada para o tenant ${tenant.id}`)
    } 
    else if (eventType === 'PAYMENT_OVERDUE') {
      // Pagamento atrasado: Marca como overdue e salva a data se não existir
      await supabaseClient
        .from('tenants')
        .update({ 
          subscription_status: 'overdue',
          overdue_since: tenant.overdue_since || new Date().toISOString()
        })
        .eq('id', tenant.id)
        
      console.log(`Tenant ${tenant.id} marcado como inadimplente (OVERDUE)`)
    }

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: corsHeaders })
  } catch (error: any) {
    console.error("Erro no Asaas Webhook:", error)
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})
