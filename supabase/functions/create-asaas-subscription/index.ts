import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function safeJson(res: Response) {
  if (!res.ok || res.redirected) return null
  try {
    return await res.json()
  } catch {
    return null
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Não autorizado: token de autenticação ausente." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: {
            Authorization: authHeader,
          }
        }
      }
    )

    const { tenantId, name, email, document, phone, plan, paymentMethod } = await req.json()

    if (!tenantId || !name || !email || !document || !plan) {
      return new Response(
        JSON.stringify({ error: "Parâmetros obrigatórios ausentes." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    let asaasUrl = (Deno.env.get('ASAAS_API_URL') || 'https://sandbox.asaas.com/v3').trim()
    if (asaasUrl.endsWith('/')) {
      asaasUrl = asaasUrl.slice(0, -1)
    }
    if (asaasUrl.endsWith('/customers')) {
      asaasUrl = asaasUrl.slice(0, -10)
    }
    if (!asaasUrl.includes('/v3')) {
      asaasUrl = `${asaasUrl}/v3`
    }
    console.log("Asaas base API URL normalized to:", asaasUrl)
    const asaasKey = Deno.env.get('ASAAS_API_KEY')

    if (!asaasKey) {
      throw new Error("ASAAS_API_KEY não configurada no Supabase.")
    }

    // 1. Procurar por cliente existente com CPF/CNPJ
    const cleanDoc = document.replace(/\D/g, '')
    let customerId = ''
    
    const searchRes = await fetch(`${asaasUrl}/customers?cpfCnpj=${cleanDoc}`, {
      headers: { 'access_token': asaasKey }
    })
    
    const searchData = await safeJson(searchRes)
    if (searchData && searchData.data && searchData.data.length > 0) {
      customerId = searchData.data[0].id
    }

    // 2. Criar cliente caso não exista
    if (!customerId) {
      const createCustRes = await fetch(`${asaasUrl}/customers`, {
        method: 'POST',
        headers: {
          'access_token': asaasKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name,
          email,
          cpfCnpj: cleanDoc,
          phone: phone || undefined
        })
      })

      if (!createCustRes.ok || createCustRes.redirected) {
        let errText = ""
        if (createCustRes.redirected) {
          errText = `Requisição redirecionada para ${createCustRes.url}. Verifique se a sua chave ASAAS_API_KEY ou a URL estão corretas no Supabase.`
        } else {
          try {
            const cloneRes = createCustRes.clone()
            const errData = await cloneRes.json()
            if (errData.errors && errData.errors.length > 0) {
              errText = errData.errors.map((e: any) => e.description).join(", ")
            } else {
              errText = JSON.stringify(errData)
            }
          } catch {
            const rawText = await createCustRes.text()
            errText = rawText || "Sem resposta detalhada do servidor."
          }
        }
        throw new Error(`Erro ao criar cliente no Asaas (Código ${createCustRes.status}): ${errText}`)
      }

      const newCust = await safeJson(createCustRes)
      if (newCust && newCust.id) {
        customerId = newCust.id
      } else {
        throw new Error("Erro ao interpretar dados do cliente criado no Asaas.")
      }
    }

    // 3. Definir valor do plano
    const value = plan === 'ouro' ? 119.90 : 59.90
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const nextDueDate = tomorrow.toISOString().split('T')[0]

    // Define billingType do Asaas
    let billingType = 'PIX'
    if (paymentMethod === 'card') {
      billingType = 'CREDIT_CARD'
    } else if (paymentMethod === 'boleto') {
      billingType = 'BOLETO'
    }

    // 4. Criar Assinatura (Subscription) recorrente
    const subRes = await fetch(`${asaasUrl}/subscriptions`, {
      method: 'POST',
      headers: {
        'access_token': asaasKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        customer: customerId,
        billingType,
        value,
        nextDueDate,
        cycle: 'MONTHLY',
        description: `Assinatura NexERP - Plano ${plan.toUpperCase()}`
      })
    })

    if (!subRes.ok || subRes.redirected) {
      let errText = ""
      if (subRes.redirected) {
        errText = `Requisição redirecionada para ${subRes.url}. Verifique se a sua chave ASAAS_API_KEY ou a URL estão corretas no Supabase.`
      } else {
        try {
          const cloneRes = subRes.clone()
          const errData = await cloneRes.json()
          if (errData.errors && errData.errors.length > 0) {
            errText = errData.errors.map((e: any) => e.description).join(", ")
          } else {
            errText = JSON.stringify(errData)
          }
        } catch {
          const rawText = await subRes.text()
          errText = rawText || "Sem resposta detalhada do servidor."
        }
      }
      throw new Error(`Erro ao criar assinatura no Asaas (Código ${subRes.status}): ${errText}`)
    }

    const subData = await safeJson(subRes)
    if (!subData || !subData.id) {
      throw new Error("Erro ao interpretar dados da assinatura criada no Asaas.")
    }
    const subscriptionId = subData.id

    // 5. Buscar a cobrança gerada para obter QR Code, Chave PIX ou dados do Boleto/Cartão
    const paymentsRes = await fetch(`${asaasUrl}/payments?subscription=${subscriptionId}`, {
      headers: { 'access_token': asaasKey }
    })

    let pixCode = ''
    let pixQrCodeImage = ''
    let invoiceUrl = ''

    const paymentsData = await safeJson(paymentsRes)
    if (paymentsData && paymentsData.data && paymentsData.data.length > 0) {
      const paymentId = paymentsData.data[0].id
      invoiceUrl = paymentsData.data[0].invoiceUrl

      // Gerar QR Code PIX apenas se for PIX
      if (billingType === 'PIX') {
        const pixRes = await fetch(`${asaasUrl}/payments/${paymentId}/pixQrCode`, {
          headers: { 'access_token': asaasKey }
        })

        const pixData = await safeJson(pixRes)
        if (pixData) {
          pixCode = pixData.payload
          pixQrCodeImage = pixData.encodedImage
        }
      }
    }

    // 6. Atualizar Tenant no Supabase
    const { error: dbError } = await supabaseClient
      .from('tenants')
      .update({
        asaas_customer_id: customerId,
        asaas_subscription_id: subscriptionId,
        subscription_status: 'pending',
        status: 'pending',
        plan: plan
      })
      .eq('id', tenantId)

    if (dbError) {
      throw new Error(`Erro ao atualizar tenant no banco: ${dbError.message}`)
    }

    return new Response(
      JSON.stringify({
        success: true,
        subscriptionId,
        pixCode,
        pixQrCodeImage,
        invoiceUrl
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )

  } catch (error: any) {
    console.error(error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})
