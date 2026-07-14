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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const tenantId = user.id

    const { data: tenant } = await supabaseClient
      .from('tenants')
      .select('plan, subscription_status, trial_ends_at')
      .eq('id', tenantId)
      .single()

    const trialEnds = tenant?.trial_ends_at ? new Date(tenant.trial_ends_at) : null
    const isTrialExpired = trialEnds ? trialEnds < new Date() : false
    const hasOuroAccess = tenant?.plan === 'ouro' || (tenant?.subscription_status === 'trialing' && !isTrialExpired)

    if (!hasOuroAccess) {
      return new Response(JSON.stringify({ error: 'Funcionalidade exclusiva do Plano Ouro.' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Busca configurações do Telegram Bot
    const { data: agent } = await supabaseClient
      .from('telegram_agents')
      .select('bot_token, is_active')
      .eq('id', tenantId)
      .single()

    if (!agent || !agent.is_active || !agent.bot_token) {
      return new Response(JSON.stringify({ error: 'O Telegram Bot não está configurado ou ativo no painel.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { target_customers, text } = await req.json()

    // target_customers deve ser uma lista de telegram_chat_id
    if (!Array.isArray(target_customers) || target_customers.length === 0 || !text) {
      return new Response(JSON.stringify({ error: 'Dados inválidos. Envie a lista de clientes com Telegram e o texto da campanha.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    let successCount = 0
    let errorCount = 0

    const MAX_TARGETS = 50
    const targets = target_customers.slice(0, MAX_TARGETS)

    for (const chatId of targets) {
      if (!chatId) continue;

      try {
        const response = await fetch(`https://api.telegram.org/bot${agent.bot_token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text: text })
        })

        if (response.ok) {
          successCount++
        } else {
          errorCount++
        }
      } catch (err) {
        errorCount++
      }
      
      // Delay to avoid hitting rate limits
      await new Promise(r => setTimeout(r, 50))
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: `Campanha processada. ${successCount} enviados com sucesso, ${errorCount} erros.`
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error: any) {
    console.error(error)
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
