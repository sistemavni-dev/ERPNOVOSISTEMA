import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"

console.log("WhatsApp Webhook Started")

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
    const { sale_id, type, customer_name, customer_phone, cashback_earned, cashback_balance } = payload

    // Caso não venham no payload, busca do banco
    let phone = customer_phone
    let name = customer_name
    let total_amount = "0.00"
    let tenantName = "Nossa Loja"

    if (sale_id) {
      const { data: saleData } = await supabaseClient
        .from('sales')
        .select('total_amount, customers(name, phone), tenants(name)')
        .eq('id', sale_id)
        .single()

      if (saleData) {
        if (!phone) phone = saleData.customers?.phone
        if (!name) name = saleData.customers?.name
        total_amount = saleData.total_amount
        tenantName = saleData.tenants?.name || tenantName
      }
    }

    if (!phone) {
      return new Response(JSON.stringify({ message: "Cliente sem telefone cadastrado." }), { status: 200 })
    }

    // Limpeza de número para API (remover não-numéricos)
    const cleanPhone = phone.replace(/\D/g, '')

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

    // Configurações Evolution API
    const evoUrl = Deno.env.get('EVOLUTION_API_URL')
    const evoKey = Deno.env.get('EVOLUTION_API_KEY')
    const evoInstance = Deno.env.get('EVOLUTION_INSTANCE')

    if (!evoUrl || !evoKey || !evoInstance) {
      console.error("Variáveis da Evolution API não configuradas!")
      return new Response(JSON.stringify({ error: "Configurações de WhatsApp ausentes no backend." }), { status: 500 })
    }

    // Disparo via Evolution API
    const response = await fetch(`${evoUrl}/message/sendText/${evoInstance}`, {
      method: 'POST',
      headers: {
        'apikey': evoKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        number: cleanPhone,
        options: {
          delay: 1500, // Simula digitação por 1,5 segundos
          presence: "composing"
        },
        textMessage: {
          text: textMessage
        }
      })
    })

    if (!response.ok) {
      const err = await response.text()
      throw new Error(`Erro na Evolution API: ${err}`)
    }

    return new Response(
      JSON.stringify({ success: true, message: "Mensagem WhatsApp enviada via Evolution API." }),
      { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
    )

  } catch (error: any) {
    console.error(error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
    )
  }
})
