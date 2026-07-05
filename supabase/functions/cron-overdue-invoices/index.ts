import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"

console.log("Cron Overdue Invoices Started")

serve(async (req) => {
  // Security check to ensure it's called by Supabase cron/auth header
  const authHeader = req.headers.get('Authorization')
  if (authHeader !== `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Configurações Evolution API
    const evoUrl = Deno.env.get('EVOLUTION_API_URL')
    const evoKey = Deno.env.get('EVOLUTION_API_KEY')
    const evoInstance = Deno.env.get('EVOLUTION_INSTANCE')

    if (!evoUrl || !evoKey || !evoInstance) {
      throw new Error("Variáveis da Evolution API não configuradas!")
    }

    // 1. Fetch overdue invoices from all active tenants
    const { data: invoices, error } = await supabaseClient
      .from('financial_transactions')
      .select(`
        id, amount, due_date,
        tenants(name),
        sales(
          customers(name, phone)
        )
      `)
      .eq('type', 'receivable')
      .eq('status', 'pending')
      .lt('due_date', new Date().toISOString().split('T')[0]) // strictly less than today

    if (error) throw error

    // 2. Loop through and send WhatsApp message via Evolution API
    let sentCount = 0
    for (const invoice of invoices || []) {
      const customer = invoice.sales?.customers
      const tenantName = invoice.tenants?.name || "Nossa Loja"
      
      if (customer?.phone) {
        const cleanPhone = customer.phone.replace(/\D/g, '')
        const textMessage = `Olá ${customer.name}! 👋\n\nNotamos que você possui uma fatura em aberto no valor de *R$ ${invoice.amount}* (vencida em ${new Date(invoice.due_date).toLocaleDateString('pt-BR')}) com a *${tenantName}*.\n\nPor favor, entre em contato conosco para regularizar ou desconsidere caso já tenha efetuado o pagamento!`

        const response = await fetch(`${evoUrl}/message/sendText/${evoInstance}`, {
          method: 'POST',
          headers: {
            'apikey': evoKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            number: cleanPhone,
            options: {
              delay: 1500, // Simula digitação
              presence: "composing"
            },
            textMessage: {
              text: textMessage
            }
          })
        })

        if (response.ok) {
          console.log(`Mensagem de cobrança enviada para ${customer.name} (Telefone: ${customer.phone})`)
          sentCount++
        } else {
          console.error(`Falha ao enviar cobrança para ${customer.phone}`, await response.text())
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, messages_sent: sentCount }),
      { headers: { "Content-Type": "application/json" } }
    )

  } catch (error: any) {
    console.error(error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
})
