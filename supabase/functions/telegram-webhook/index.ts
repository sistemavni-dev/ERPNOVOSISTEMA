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
    
    let chatId = ""
    let text = ""
    let firstName = "Cliente"
    let isCallback = false
    let callbackData = ""
    let callbackQueryId = ""

    if (payload.callback_query) {
      chatId = payload.callback_query.message.chat.id.toString()
      firstName = payload.callback_query.from.first_name || "Cliente"
      isCallback = true
      callbackData = payload.callback_query.data
      callbackQueryId = payload.callback_query.id
    } else if (payload.message) {
      chatId = payload.message.chat.id.toString()
      text = payload.message.text || ""
      firstName = payload.message.from?.first_name || "Cliente"
    } else {
      return new Response("Not a supported event", { status: 200 })
    }

    // 1. Get Telegram Agent Config
    const { data: agentConfig, error: agentError } = await supabaseClient
      .from('telegram_agents')
      .select('*, tenants(name)')
      .eq('id', tenantId)
      .single()

    if (agentError || !agentConfig || !agentConfig.is_active) {
      return new Response("Agent inactive or not configured", { status: 200 })
    }

    const botToken = agentConfig.bot_token
    const tenantName = agentConfig.tenants?.name || "Nossa Loja"
    const features = agentConfig.features || []

    const sendTelegramMessage = async (msgText: string, replyMarkup: any = null) => {
      const body: any = { chat_id: chatId, text: msgText }
      // Removemos parse_mode: 'Markdown' global para evitar erros de formatação (ex: nomes com underline)
      if (replyMarkup) {
        body.reply_markup = replyMarkup
      }
      const resp = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      if (!resp.ok) {
        const errText = await resp.text()
        console.error("Erro ao enviar mensagem Telegram:", errText)
        throw new Error("Telegram API Error: " + errText)
      }
    }

    const answerCallback = async (cbId: string) => {
      await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callback_query_id: cbId })
      })
    }

    // 2. Find Customer
    let { data: customer } = await supabaseClient
      .from('customers')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('telegram_chat_id', chatId)
      .maybeSingle()

    // 3. Customer Creation Flow (If not registered)
    if (!customer && !isCallback) {
      // Cadastra o cliente automaticamente para que o menu seja liberado de imediato
      const { data: newCustomer, error: insertError } = await supabaseClient
        .from('customers')
        .insert({ tenant_id: tenantId, name: firstName, telegram_chat_id: chatId, cashback_balance: 0 })
        .select()
        .single()
        
      if (!insertError && newCustomer) {
        customer = newCustomer
      } else {
        // Fallback em caso de erro no banco
        customer = { name: firstName, id: "00000000-0000-0000-0000-000000000000" }
      }
    }

    // Se o cliente não foi encontrado e era um callback, ignoramos
    if (!customer) {
      if (isCallback) await answerCallback(callbackQueryId)
      return new Response("No customer", { status: 200 })
    }

    // 4. Send Menu for Greetings or "/start"
    const isGreeting = /^(oi|ola|olá|menu|\/start|bom dia|boa tarde|boa noite)/i.test(text.trim())
    
    if (isGreeting && !isCallback) {
      const inlineKeyboard = {
        inline_keyboard: [
          [
            { text: "🛍️ Ver Produtos", callback_data: "action_catalog" },
            { text: "📦 Meus Pedidos", callback_data: "action_orders" }
          ],
          [
            { text: "💰 Meu Cashback/Carteira", callback_data: "action_cashback" },
            { text: "🤖 Tirar Dúvida com IA", callback_data: "action_ai" }
          ],
          [
            { text: "🧑‍💻 Falar com Atendente", callback_data: "action_human" }
          ]
        ]
      }
      await sendTelegramMessage(`Olá ${customer.name}, bem-vindo(a) ao atendimento da *${tenantName}*! Como posso te ajudar hoje?`, inlineKeyboard)
      return new Response("Menu sent", { status: 200 })
    }

    // 5. Handle Callback Queries
    if (isCallback) {
      await answerCallback(callbackQueryId) // Remove loading spinner

      if (callbackData === 'action_catalog') {
        const { data: products } = await supabaseClient
          .from('products')
          .select('id, name, price, inventory!inner(quantity)')
          .eq('tenant_id', tenantId)
          .gt('inventory.quantity', 0)
          .limit(10)
        
        let msg = "📦 *Nosso Catálogo de Produtos:*\n\n"
        let inlineKeyboard: any = { inline_keyboard: [] }

        if (products && products.length > 0) {
          products.forEach(p => {
            msg += `▫️ *${p.name}* - R$ ${Number(p.price).toFixed(2)}\n`
            inlineKeyboard.inline_keyboard.push([
              { text: `🛒 Reservar ${p.name}`, callback_data: `reserve_${p.id}` }
            ])
          })
          msg += "\nPara confirmar, clique no botão de reserva acima referente ao produto desejado!"
          await sendTelegramMessage(msg, inlineKeyboard)
        } else {
          msg = "No momento não temos produtos cadastrados em estoque."
          await sendTelegramMessage(msg)
        }
        return new Response("Catalog sent", { status: 200 })
      }

      if (callbackData.startsWith('reserve_')) {
        const productId = callbackData.replace('reserve_', '')
        
        const { data: product } = await supabaseClient
          .from('products')
          .select('id, name, price, inventory(id, quantity)')
          .eq('id', productId)
          .eq('tenant_id', tenantId)
          .single()

        const currentStock = product?.inventory?.[0]?.quantity || 0

        if (!product || currentStock <= 0) {
          await sendTelegramMessage("Desculpe, este produto acabou de esgotar!")
          return new Response("Out of stock", { status: 200 })
        }

        if (!customer) {
          await sendTelegramMessage("Erro: Cliente não identificado. Tente mandar um 'Oi' novamente.")
          return new Response("No customer", { status: 200 })
        }

        const payload = {
            tenant_id: tenantId,
            customer_id: customer.id,
            total_amount: product.price,
            discount: 0,
            status: 'awaiting_pickup'
        };

        const { data: saleArray, error: saleError } = await supabaseClient
          .from('sales')
          .insert([payload])
          .select()

        const sale = saleArray?.[0]

        if (saleError || !sale) {
          console.error("Sale Error:", saleError);
          await sendTelegramMessage(`Houve um erro ao processar sua reserva. Tente novamente. (Erro: ${saleError?.message || JSON.stringify(saleError)})`)
          return new Response("Sale Error", { status: 200 })
        }

        await supabaseClient
          .from('sale_items')
          .insert({
            tenant_id: tenantId,
            sale_id: sale.id,
            product_id: product.id,
            quantity: 1,
            unit_price: product.price,
            total_price: product.price
          })

        await supabaseClient
          .from('inventory')
          .update({ quantity: currentStock - 1 })
          .eq('id', product.inventory[0].id)

        await sendTelegramMessage(`✅ *Reserva Confirmada!*\n\nO produto *${product.name}* foi reservado para você (Pedido #${sale.id.slice(0,8)}).\n\nO valor é de R$ ${Number(product.price).toFixed(2)}.\nO pedido está aguardando retirada na loja física!`)
        return new Response("Reserved", { status: 200 })
      }

      if (callbackData === 'action_orders') {
        const { data: sales } = await supabaseClient
          .from('sales')
          .select('id, total_amount, status, created_at')
          .eq('tenant_id', tenantId)
          .eq('customer_id', customer.id)
          .order('created_at', { ascending: false })
          .limit(5)
        
        let msg = "🧾 *Seus Últimos Pedidos:*\n\n"
        if (sales && sales.length > 0) {
          sales.forEach(s => {
            msg += `▫️ Pedido #${s.id.slice(0, 8)} | R$ ${Number(s.total_amount).toFixed(2)} | *${s.status}*\n`
          })
        } else {
          msg = "Você ainda não possui pedidos registrados com a gente."
        }
        await sendTelegramMessage(msg)
        return new Response("Orders sent", { status: 200 })
      }

      if (callbackData === 'action_cashback') {
        const balance = customer.cashback_balance ? Number(customer.cashback_balance).toFixed(2) : "0.00"
        await sendTelegramMessage(`💰 *Sua Carteira de Cashback*\n\nVocê possui *R$ ${balance}* disponíveis para usar na sua próxima compra na ${tenantName}!`)
        return new Response("Cashback sent", { status: 200 })
      }

      if (callbackData === 'action_human') {
        await sendTelegramMessage(`🧑‍💻 Um momento! Já vou transferir você para um de nossos atendentes reais. Aguarde na linha...`)
        return new Response("Handoff sent", { status: 200 })
      }

      if (callbackData === 'action_ai') {
        await sendTelegramMessage(`🤖 Certo! Sou a Inteligência Artificial da loja. Você pode me perguntar sobre nosso horário, endereço, produtos ou qualquer outra dúvida. O que deseja saber?`)
        return new Response("AI prompt sent", { status: 200 })
      }

      return new Response("Callback handled", { status: 200 })
    }

    // 6. Handle Free Text (Gemini AI)
    let productCatalogText = ""
    let customerOrdersText = ""

    if (features.includes('sell_products')) {
      const { data: products } = await supabaseClient
        .from('products')
        .select('name, price, sku, inventory!inner(quantity)')
        .eq('tenant_id', tenantId)
        .gt('inventory.quantity', 0)
        .limit(15)

      if (products && products.length > 0) {
        productCatalogText = "Catálogo de Produtos Disponíveis em Estoque:\n" + products.map(p => 
          `- *${p.name}* | Preço: R$ ${Number(p.price).toFixed(2)} | SKU: ${p.sku || 'Sem SKU'} | Estoque: ${p.inventory?.[0]?.quantity || 0} unidades`
        ).join('\n')
      }
    }

    // Build Gemini Prompt
    const systemInstruction = `
Você é o assistente virtual autônomo do Telegram da empresa *${tenantName}*. 
Responda sempre em Português do Brasil com tom simpático, prestativo e comercial.
Use a formatação do Telegram para destacar palavras (ex: *negrito*, _itálico_). Mantenha as mensagens curtas e objetivas, evitando textos longos demais.

Diretriz Principal da Loja:
"${agentConfig.agent_prompt}"

INFORMAÇÕES DISPONÍVEIS:
${productCatalogText ? `\n--- PRODUTOS ---\n${productCatalogText}\n` : ''}

REGRAS DE CONDUTA E RECURSOS ATIVOS:
4. DIRECIONAMENTO DE ATENDIMENTO HUMANO (HANDOFF):
Se o cliente pedir expressamente para falar com um humano, responda confirmando que irá transferi-lo para um atendente e termine sua mensagem contendo estritamente a tag especial: [TRANSFER_HUMANO].
`;

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY')
    if (!geminiApiKey) {
      console.error("Gemini API Key missing!")
      return new Response("Gemini Key missing", { status: 200 })
    }

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`
    let responseText = ""
    try {
      let geminiResponse;
      let retries = 2; // Tenta até 3 vezes (1 original + 2 retries)
      
      while (retries >= 0) {
        geminiResponse = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              { role: "user", parts: [{ text: `Histórico/Mensagem do cliente: "${text}"\n\nInstrução do Sistema:\n${systemInstruction}` }] }
            ]
          })
        })

        if (geminiResponse.ok || geminiResponse.status !== 503 || retries === 0) {
          break;
        }
        
        // Se deu 503 (High Demand), espera 1.5 segundos e tenta de novo
        await new Promise(r => setTimeout(r, 1500));
        retries--;
      }

      if (!geminiResponse || !geminiResponse.ok) {
        throw new Error(`Gemini API Error: ${await geminiResponse?.text()}`)
      }

      const geminiData = await geminiResponse.json()
      responseText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "Desculpe, não consegui processar sua mensagem no momento."
    } catch (apiError: any) {
      console.error("Gemini Failure:", apiError)
      responseText = "⚠️ Desculpe, ocorreu um erro interno na IA: " + (apiError.message || "Erro desconhecido")
    }

    if (responseText.includes("[TRANSFER_HUMANO]")) {
      responseText = responseText.replace("[TRANSFER_HUMANO]", "").trim()
    }

    await sendTelegramMessage(responseText)

    return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } })

  } catch (error: any) {
    console.error("Erro no processamento do webhook telegram:", error)
    // Retornamos 200 para o Telegram não tentar reenviar a mesma mensagem causando um loop de falhas
    return new Response(JSON.stringify({ error: error.message }), { status: 200 })
  }
})
