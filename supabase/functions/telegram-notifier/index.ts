import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"

console.log("Telegram Notifier Started")

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" } })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const payload = await req.json()
    const { sale_id, type, customer_name, customer_phone, cashback_earned, cashback_balance } = payload

    // 1. Fetch sale details to get tenant_id and customer_id
    let tenantId = null
    let customerId = null
    let name = customer_name
    let total_amount = "0.00"
    let tenantName = "Nossa Loja"

    if (sale_id) {
      const { data: saleData } = await supabaseClient
        .from('sales')
        .select('tenant_id, customer_id, total_amount, customers(name, telegram_chat_id), tenants(name)')
        .eq('id', sale_id)
        .single()

      if (saleData) {
        tenantId = saleData.tenant_id
        customerId = saleData.customer_id
        if (!name) name = saleData.customers?.name || "Cliente"
        total_amount = saleData.total_amount
        tenantName = saleData.tenants?.name || tenantName
      }
    }

    if (!customerId) {
      return new Response(JSON.stringify({ message: "Venda sem cliente associado." }), { status: 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } })
    }

    // 2. Lookup telegram_chat_id
    const { data: customerData } = await supabaseClient
      .from('customers')
      .select('telegram_chat_id')
      .eq('id', customerId)
      .single()

    const chatId = customerData?.telegram_chat_id

    if (!chatId) {
      return new Response(JSON.stringify({ message: "Cliente não possui Telegram vinculado (chat_id)." }), { status: 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } })
    }

    // 3. Build message text
    let textMessage = ""

    switch(type) {
      case 'new_online_order':
        textMessage = `Olá ${name}! 👋\nRecebemos o seu pedido na vitrine online da *${tenantName}*.\n\nSua reserva está sendo analisada e avisaremos assim que estiver pronta para retirada!`
        break;
      case 'reservation_approved':
        textMessage = `Seu pedido está aprovado e separado, ${name}! ✅\n\nVenha até a nossa loja (*${tenantName}*) para realizar o pagamento e retirar seus produtos.`
        break;
      case 'sale_completed':
        textMessage = `Pagamento confirmado, ${name}! 🎉\nSua compra no valor de *R$ ${total_amount}* foi concluída com sucesso na *${tenantName}*.\n\nAgradecemos a preferência!`
        break;
      case 'cashback_receipt':
        textMessage = `Obrigado por comprar na *${tenantName}*, ${name}! 🎉\n\nSua compra de R$ ${total_amount} gerou *R$ ${cashback_earned?.toFixed(2)}* de Cashback!\n\nSeu saldo atual para a próxima compra é de: *R$ ${cashback_balance?.toFixed(2)}* 💰`
        break;
      case 'installment_plan':
        {
          const installments = payload.installments || []
          const planText = installments.map((inst: any) => 
            `▫️ ${inst.number}ª Parcela (R$ ${inst.amount.toFixed(2)}) - Vence em: ${new Date(inst.due_date).toLocaleDateString('pt-BR')}`
          ).join('\n')
          
          textMessage = `Olá ${name}! 🎉\nSua compra de *R$ ${total_amount}* foi concluída na *${tenantName}*.\n\nO pagamento foi dividido em *${installments.length}x*.\nSeguem os vencimentos do seu crediário:\n\n${planText}\n\nObrigado pela preferência!`
        }
        break;
      default:
        textMessage = `Olá ${name}! Obrigado pela preferência na *${tenantName}*! Seu recibo de R$ ${total_amount} foi gerado.`
    }

    // 4. Get Agent Config (Bot Token)
    const { data: agentConfig } = await supabaseClient
      .from('telegram_agents')
      .select('bot_token, is_active')
      .eq('id', tenantId)
      .single()

    if (!agentConfig || !agentConfig.is_active || !agentConfig.bot_token) {
      return new Response(JSON.stringify({ error: "Integração Telegram não configurada ou inativa para este tenant." }), { status: 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } })
    }

    // Auto-register webhook to ensure it is always correct
    const webhookUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/telegram-webhook?tenant_id=${tenantId}`
    await fetch(`https://api.telegram.org/bot${agentConfig.bot_token}/setWebhook?url=${encodeURIComponent(webhookUrl)}`)


    // 5. Send Telegram Message
    const response = await fetch(`https://api.telegram.org/bot${agentConfig.bot_token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: textMessage })
    })

    if (!response.ok) {
      throw new Error(`Erro na API do Telegram: ${await response.text()}`)
    }

    return new Response(
      JSON.stringify({ success: true, message: "Notificação Telegram enviada com sucesso." }),
      { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
    )

  } catch (error: any) {
    console.error("Telegram Notifier Error:", error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
    )
  }
})
