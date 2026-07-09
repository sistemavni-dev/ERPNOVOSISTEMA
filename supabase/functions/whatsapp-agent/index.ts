import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"

console.log("WhatsApp Agent Webhook Initiated")

serve(async (req) => {
  // CORS Headers
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    }})
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const payload = await req.json()
    console.log("Webhook payload received:", JSON.stringify(payload))

    // Validar se é mensagem recebida e não enviada por nós
    const isUpsert = payload.event === "messages.upsert"
    if (!isUpsert) {
      return new Response(JSON.stringify({ message: "Ignore non-upsert event" }), { status: 200 })
    }

    const messageData = payload.data
    const fromMe = messageData.key?.fromMe
    if (fromMe) {
      return new Response(JSON.stringify({ message: "Ignore message sent by the instance itself" }), { status: 200 })
    }

    const remoteJid = messageData.key?.remoteJid || ""
    const cleanCustomerPhone = remoteJid.split('@')[0]
    
    // Capturar o texto da mensagem
    let messageText = ""
    if (messageData.message) {
      messageText = messageData.message.conversation || 
                    messageData.message.extendedTextMessage?.text || 
                    messageData.message.imageMessage?.caption || 
                    "";
    }

    if (!messageText) {
      return new Response(JSON.stringify({ message: "Empty text message" }), { status: 200 })
    }

    const instanceName = payload.instance

    // 1. Localizar o Agente de WhatsApp pelo nome da instância
    const { data: agentConfig, error: agentError } = await supabaseClient
      .from('whatsapp_agents')
      .select('*, tenants(name)')
      .eq('instance_name', instanceName)
      .single()

    if (agentError || !agentConfig || !agentConfig.is_active) {
      console.log("Agent config not found or inactive for instance:", instanceName)
      return new Response(JSON.stringify({ message: "Agent inactive or not configured" }), { status: 200 })
    }

    const tenantId = agentConfig.id
    const tenantName = agentConfig.tenants?.name || "Nossa Loja"
    const features = agentConfig.features || []

    // 2. Coletar dados extras se habilitados (Estoque, Histórico, Reservas)
    let productCatalogText = ""
    let customerOrdersText = ""

    // Buscar dados do cliente se cadastrado pelo telefone
    const { data: customer } = await supabaseClient
      .from('customers')
      .select('*')
      .eq('tenant_id', tenantId)
      .ilike('phone', `%${cleanCustomerPhone}%`)
      .maybeSingle()

    // Se 'sell_products' estiver ativo, buscar produtos
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
      } else {
        productCatalogText = "Não temos produtos em estoque cadastrados no momento."
      }
    }

    // Se 'receive_reservations' ou 'send_receipts' ativo e cliente existir
    if (customer && (features.includes('receive_reservations') || features.includes('send_receipts'))) {
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

    // 3. Montar o Prompt do Gemini
    const systemInstruction = `
Você é o assistente virtual autônomo do WhatsApp da empresa *${tenantName}*. 
Responda sempre em Português do Brasil com tom simpático, prestativo e comercial.
Use a formatação do WhatsApp para destacar palavras (ex: *negrito*, _itálico_). Mantenha as mensagens curtas e objetivas, evitando textos longos demais.

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
Se o cliente pedir expressamente para falar com um humano, ou se a conversa requerer negociação complexa ou reclamações graves, você deve responder confirmando que irá transferi-lo para um atendente e terminar sua mensagem contendo estritamente a tag especial: [TRANSFER_HUMANO].
`;

    // 4. Invocar API do Gemini para gerar a resposta
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY')
    if (!geminiApiKey) {
      console.error("Gemini API Key missing!")
      return new Response(JSON.stringify({ error: "Gemini Key missing" }), { status: 500 })
    }

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${geminiApiKey}`
    
    const geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          { role: "user", parts: [{ text: `Histórico/Mensagem do cliente (${cleanCustomerPhone}): "${messageText}"\n\nInstrução do Sistema:\n${systemInstruction}` }] }
        ]
      })
    })

    if (!geminiResponse.ok) {
      const errText = await geminiResponse.text()
      throw new Error(`Gemini API Error: ${errText}`)
    }

    const geminiData = await geminiResponse.json()
    let responseText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "Desculpe, não consegui processar sua mensagem no momento."

    // 5. Verificar Handoff Humano
    const isHandoffTriggered = responseText.includes("[TRANSFER_HUMANO]")
    if (isHandoffTriggered) {
      // Remove a tag técnica do texto da resposta que vai pro cliente
      responseText = responseText.replace("[TRANSFER_HUMANO]", "").trim()

      if (agentConfig.handoff_enabled) {
        // Atualizar status no banco de dados para pausar o robô temporariamente ou marcar para atendimento
        // Opcional: Atualizar status do agente ou criar alerta na fila
        console.log(`Handoff triggado para o cliente: ${cleanCustomerPhone}`)
      }
    }

    // 6. Enviar Mensagem de Resposta via Evolution API
    const evoUrl = Deno.env.get('EVOLUTION_API_URL')
    const evoKey = Deno.env.get('EVOLUTION_API_KEY')

    if (!evoUrl || !evoKey) {
      console.error("Evolution URL or Key missing in Deno env!")
      return new Response(JSON.stringify({ error: "Evolution Config missing" }), { status: 500 })
    }

    const response = await fetch(`${evoUrl}/message/sendText/${instanceName}`, {
      method: 'POST',
      headers: {
        'apikey': evoKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        number: cleanCustomerPhone,
        options: {
          delay: 1200,
          presence: "composing"
        },
        textMessage: {
          text: responseText
        }
      })
    })

    if (!response.ok) {
      const err = await response.text()
      throw new Error(`Erro Evolution API ao enviar resposta do agente: ${err}`)
    }

    return new Response(
      JSON.stringify({ success: true, responseText }),
      { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
    )

  } catch (error: any) {
    console.error("Erro no processamento do agente:", error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
    )
  }
})
