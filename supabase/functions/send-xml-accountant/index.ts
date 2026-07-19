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

    // Validate user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const tenantId = user.id

    // Fetch tenant's accountant email
    const { data: tenant } = await supabaseClient
      .from('tenants')
      .select('accountant_email')
      .eq('id', tenantId)
      .single()

    if (!tenant || !tenant.accountant_email) {
      return new Response(JSON.stringify({ 
        error: 'E-mail do contador não configurado. Por favor, acesse as Configurações e cadastre o e-mail do seu contador.' 
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // AQUI ENTRARIA A LÓGICA REAL:
    // 1. Buscar os XMLs de notas fiscais do período (ex: mês anterior)
    // 2. Compactar em um arquivo ZIP
    // 3. Enviar um e-mail para tenant.accountant_email usando SendGrid, AWS SES ou Resend.
    // Como não há API de e-mail configurada no MVP, simulamos o envio.

    // Delay simulado de processamento
    await new Promise(resolve => setTimeout(resolve, 1500))

    return new Response(JSON.stringify({ 
      success: true, 
      message: `Simulação concluída! No sistema real, os XMLs seriam enviados para: ${tenant.accountant_email}`
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error: any) {
    console.error(error)
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
