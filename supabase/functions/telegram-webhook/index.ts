import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"

console.log("Telegram Webhook Initiated")

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { "Access-Control-Allow-Origin": "*" } })
  }

  try {
    const url = new URL(req.url)
    const tenantId = url.searchParams.get('tenant_id')
    
    if (!tenantId) {
      return new Response("Missing tenant_id", { status: 400 })
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const payload = await req.json()
    console.log("Telegram Webhook payload received:", JSON.stringify(payload))

    // Handle incoming messages
    if (!payload.message) {
      return new Response("Not a message event", { status: 200 })
    }

    const chatId = payload.message.chat.id.toString()
    const text = payload.message.text || ""
    const firstName = payload.message.from?.first_name || "Cliente"

    // 1. Get Telegram Agent Config
    const { data: agentConfig, error: agentError } = await supabaseClient
      .from('telegram_agents')
      .select('*, tenants(name)')
      .eq('id', tenantId)
      .single()

    if (agentError || !agentConfig || !agentConfig.is_active) {
      console.log("Agent config not found or inactive for tenant:", tenantId)
      return new Response("Agent inactive or not configured", { status: 200 })
    }

    const botToken = agentConfig.bot_token
    const tenantName = agentConfig.tenants?.name || "Nossa Loja"
    const features = agentConfig.features || []

    const sendTelegramMessage = async (msgText: string) => {
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: msgText })
      })
    }

    // 2. Find Customer
    let { data: customer } = await supabaseClient
      .from('customers')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('telegram_chat_id', chatId)
      .maybeSingle()

    // 3. Customer Linking Flow
    if (!customer) {
      // Check if user is sending a phone number to link
      const phoneMatch = text.replace(/\D/g, '')
      if (phoneMatch.length >= 10 && phoneMatch.length <= 11) {
        // Link to existing customer or create a new one
        let { data: existingCustomer } = await supabaseClient
          .from('customers')
          .select('*')
          .eq('tenant_id', tenantId)
          .ilike('phone', `%${phoneMatch}%`)
          .maybeSingle()

        if (existingCustomer) {
          await supabaseClient.from('customers').update({ telegram_chat_id: chatId }).eq('id', existingCustomer.id)
          await sendTelegramMessage(`Perfeito, ${firstName}! Seu Telegram foi vinculado à sua conta existente com sucesso. Em que posso te ajudar hoje?`)
        } else {
          const { data: newCustomer, error: insertError } = await supabaseClient
            .from('customers')
            .insert({ tenant_id: tenantId, name: firstName, phone: phoneMatch, telegram_chat_id: chatId, cashback_balance: 0 })
            .select()
            .single()
          
          if (!insertError) {
             await sendTelegramMessage(`Bem-vindo, ${firstName}! Seu cadastro foi realizado com sucesso. Em que posso te ajudar hoje?`)
          }
        }
        return new Response("Customer linked", { status: 200 })
      } else {
        // Ask for phone number
        await sendTelegramMessage(`Olá, ${firstName}! Para podermos vincular sua conta e te dar acesso a comprovantes e descontos, por favor nos envie seu número de telefone/WhatsApp com DDD (ex: 11999999999).`)
        return new Response("Asked for phone", { status: 200 })
      }
    }

    // 4. Data Collection for Gemini
    let productCatalogText = ""
    let customerOrdersText = ""

    if (features.includes('sell_products')) {
      const { data: products } = await supabaseClient
        .from('products')
        .select('name, price, sku, stock_quantity')
        .eq('tenant_id', tenantId)
        .gt('stock_quantity', 0)
        .limit(15)

      if (products && products.length > 0) {
        productCatalogText = "Catálogo de Produtos Disponíveis em Estoque:\n" + products.map(p => 
          `- *${p.name}* | Preço: R$ ${Number(p.price).toFixed(2)} | SKU: ${p.sku || 'Sem SKU'} | Estoque: ${p.stock_quantity} unidades`
        ).join('\n')
      }
    }

    if (features.includes('receive_reservations') || features.includes('send_receipts')) {
      const { data: sales } = await supabaseClient
        .from('sales')
        .select('id, total_amount, status, created_at')
        .eq('tenant_id', tenantId)
        .eq('customer_id', customer.id)
        .order('created_at', { ascending: false })
        .limit(5)

      if (sales && sales.length > 0) {
        customerOrdersText = `Histórico de Pedidos de ${customer.name}:\n` + sales.map(s => 
          `- Pedido #${s.id.slice(0, 8)} | Total: R$ ${Number(s.total_amount).toFixed(2)} | Status: ${s.status} | Data: ${new Date(s.created_at).toLocaleDateString('pt-BR')}`
        ).join('\n')
      }
    }

    // 5. Build Gemini Prompt
    const systemInstruction = `
Você é o assistente virtual autônomo do Telegram da empresa *${tenantName}*. 
Responda sempre em Português do Brasil com tom simpático, prestativo e comercial.
Use a formatação do Telegram para destacar palavras (ex: *negrito*, _itálico_). Mantenha as mensagens curtas e objetivas, evitando textos longos demais.

Diretriz Principal da Loja:
"${agentConfig.agent_prompt}"

INFORMAÇÕES DISPONÍVEIS:
${productCatalogText ? `\n--- PRODUTOS ---\n${productCatalogText}\n` : ''}
${customerOrdersText ? `\n--- HISTÓRICO DE COMPRAS DO CLIENTE ---\n${customerOrdersText}\n` : ''}

REGRAS DE CONDUTA E RECURSOS ATIVOS:
1. Módulo Vendas: ${features.includes('sell_products') ? 'ATIVO. Você pode oferecer produtos do catálogo acima.' : 'INATIVO. Você não vende produtos diretamente.'}
2. Módulo Reservas: ${features.includes('receive_reservations') ? 'ATIVO. Você pode tirar dúvidas sobre reservas.' : 'INATIVO.'}
3. Módulo Comprovantes: ${features.includes('send_receipts') ? 'ATIVO. Você pode consultar compras passadas.' : 'INATIVO.'}

4. DIRECIONAMENTO DE ATENDIMENTO HUMANO (HANDOFF):
Se o cliente pedir expressamente para falar com um humano, responda confirmando que irá transferi-lo para um atendente e termine sua mensagem contendo estritamente a tag especial: [TRANSFER_HUMANO].
`;

    // 6. Invoke Gemini API
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY')
    if (!geminiApiKey) {
      console.error("Gemini API Key missing!")
      return new Response("Gemini Key missing", { status: 500 })
    }

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${geminiApiKey}`
    const geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          { role: "user", parts: [{ text: `Histórico/Mensagem do cliente: "${text}"\n\nInstrução do Sistema:\n${systemInstruction}` }] }
        ]
      })
    })

    if (!geminiResponse.ok) {
      throw new Error(`Gemini API Error: ${await geminiResponse.text()}`)
    }

    const geminiData = await geminiResponse.json()
    let responseText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "Desculpe, não consegui processar sua mensagem no momento."

    // 7. Check Handoff
    if (responseText.includes("[TRANSFER_HUMANO]")) {
      responseText = responseText.replace("[TRANSFER_HUMANO]", "").trim()
      if (agentConfig.handoff_enabled) {
        console.log(`Handoff triggado para o cliente: ${customer.name}`)
      }
    }

    // 8. Send Reply via Telegram
    await sendTelegramMessage(responseText)

    return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } })

  } catch (error: any) {
    console.error("Erro no processamento do webhook telegram:", error)
    return new Response(JSON.stringify({ error: error.message }), { status: 400 })
  }
})
