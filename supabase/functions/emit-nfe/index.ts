import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"

console.log("Emit NF-e Function Started")

serve(async (req) => {
  // CORS Headers
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    }})
  }

  try {
    // 1. Instanciar Supabase com Service Role para acessar dados protegidos
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 2. Extrair payload da requisição (ID da venda)
    const { sale_id, tenant_id } = await req.json()

    if (!tenant_id) {
      throw new Error("tenant_id é obrigatório.")
    }

    // 2.1 Verificar plano do tenant
    const { data: tenant, error: tenantError } = await supabaseClient
      .from('tenants')
      .select('plan')
      .eq('id', tenant_id)
      .single()
      
    if (tenantError || !tenant) {
      throw new Error("Empresa não encontrada.")
    }
    
    // 2.2 Contar NF-es emitidas no mês atual
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
    
    const { count, error: countError } = await supabaseClient
      .from('sales')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenant_id)
      .eq('nfe_status', 'emitida')
      .gte('created_at', startOfMonth)
      
    if (countError) throw new Error("Erro ao verificar limite mensal de NF-e.")
    
    // Configurado limite original para os planos
    const maxLimit = tenant.plan === 'enterprise' ? 2000 : (tenant.plan === 'ouro' ? 300 : (tenant.plan === 'prata' ? 100 : 0));
    
    if ((count || 0) >= maxLimit) {
      return new Response(
        JSON.stringify({ 
          error: "Limite de emissão de Notas Fiscais atingido.", 
          code: "LIMIT_EXCEEDED" 
        }),
        { status: 403, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
      )
    }

    // 3. Buscar os dados da venda e do certificado A1 do Tenant
    // OBS: Em produção, usar pgcrypto decryption query via RPC (ex: get_decrypted_certificate_password(tenant_id))
    const { data: certData, error: certError } = await supabaseClient
      .from('certificates')
      .select('storage_path, password_encrypted')
      .eq('tenant_id', tenant_id)
      .single()

    if (certError) throw new Error("Certificado A1 não configurado para esta empresa.")

    // 4. Integrar com a API de Mensageria Fiscal (Exemplo: Focus NFe / PlugNotas)
    // Aqui vai a chamada fetch() para a API de NFe enviando o XML e o certificado A1.
    // ...

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Nota fiscal enviada para processamento com sucesso.",
        status: "processing"
      }),
      { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
    )

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
    )
  }
})
