import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "../../lib/supabase"
import { Button } from "../../components/ui/button"
import { Input } from "../../components/ui/input"
import { Card, CardTitle, CardDescription } from "../../components/ui/card"
import { ShoppingCart, Search, Plus, Minus, Trash, CheckCircle, FileText, User, Printer, ArrowLeft, Package, ChevronUp, QrCode, Copy, MessageCircle, AlertTriangle, Lock } from "lucide-react"
import { ThemeToggle } from "../../components/ThemeToggle"

interface Product {
  id: string
  name: string
  price: number
  sku: string
  image_url?: string
  stock_quantity?: number
}

interface CartItem extends Product {
  cartQuantity: number
}

interface Customer {
  id: string
  name: string
  cashback_balance: number
  phone: string
}

export default function POS() {
  const [products, setProducts] = useState<Product[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [tenant, setTenant] = useState<any>(null)
  const [cart, setCart] = useState<CartItem[]>([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [emitNfe, setEmitNfe] = useState(false)
  const [sendWhatsapp, setSendWhatsapp] = useState(false)
  const [showNfeLimitModal, setShowNfeLimitModal] = useState(false)
  
  // Novos estados
  const [selectedCustomer, setSelectedCustomer] = useState<string>("")
  const [discountInput, setDiscountInput] = useState<string>("")
  const [cashbackInput, setCashbackInput] = useState<string>("")
  const [receivedAmountInput, setReceivedAmountInput] = useState<string>("")
  const [addChangeToWallet, setAddChangeToWallet] = useState<boolean>(false)
  const [receiptData, setReceiptData] = useState<any>(null)
  const [showPixModal, setShowPixModal] = useState<boolean>(false)
  const [pixPayload, setPixPayload] = useState<string>("")
  
  // Estados de Pagamento
  const [paymentMethod, setPaymentMethod] = useState("money")
  const [installmentPlan, setInstallmentPlan] = useState("1")
  
  // Mobile Cart State
  const [isCartOpen, setIsCartOpen] = useState(false)

  const navigate = useNavigate()

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: tenantData } = await supabase.from('tenants').select('*').eq('id', user.id).single()
      setTenant(tenantData)
    }
    
    fetchProducts()
    fetchCustomers()
  }

  const fetchProducts = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('products').select('*').eq('tenant_id', user.id).limit(20)
    setProducts(data || [])
  }

  const fetchCustomers = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('customers').select('*').eq('tenant_id', user.id).limit(50)
    setCustomers(data || [])
  }

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id)
      if (existing) {
        return prev.map((item) =>
          item.id === product.id ? { ...item, cartQuantity: item.cartQuantity + 1 } : item
        )
      }
      return [...prev, { ...product, cartQuantity: 1 }]
    })
  }

  const updateQuantity = (id: string, delta: number) => {
    setCart((prev) => prev.map(item => {
      if (item.id === id) {
        const newQ = item.cartQuantity + delta
        return newQ > 0 ? { ...item, cartQuantity: newQ } : item
      }
      return item
    }))
  }

  const removeFromCart = (id: string) => {
    setCart((prev) => prev.filter(item => item.id !== id))
  }

  const subtotal = cart.reduce((acc, item) => acc + (item.price * item.cartQuantity), 0)
  const discountAmount = parseFloat(discountInput) || 0

  const customerInfo = selectedCustomer ? customers.find(c => c.id === selectedCustomer) : null
  const customerBalance = customerInfo?.cashback_balance || 0

  const amountBeforeCashback = Math.max(0, subtotal - discountAmount)
  const cashbackDeducted = Math.min(amountBeforeCashback, customerBalance)
  const totalAmount = Math.max(0, amountBeforeCashback - cashbackDeducted)

  const handleQuote = async () => {
    if (cart.length === 0) return
    await proceedToCheckout(true)
  }

  const handleCheckout = async () => {
    if (cart.length === 0) return
    
    // Trava de segurança para Fiado
    if (paymentMethod === 'installments' && !selectedCustomer) {
      alert("Para vender a Prazo (Fiado), é obrigatório selecionar um cliente cadastrado!")
      return
    }

    if (paymentMethod === 'pix') {
      // Gera o código do PIX dinâmico
      const payload = `00020101021226580014br.gov.bcb.pix0136d4677761-fa89-4d6c-bd10-38827725916a5204000053039865405${totalAmount.toFixed(2)}5802BR5910NEXERP ERP6009SAO PAULO62070503***6304E85C`
      setPixPayload(payload)
      setShowPixModal(true)
    } else {
      await proceedToCheckout(false)
    }
  }

  const proceedToCheckout = async (isQuote = false) => {
    setLoading(true)

    // Validação de limite de NF-e para o plano atual
    if (emitNfe && !isQuote) {
      const plan = tenant?.plan;
      const limit = plan === 'enterprise' ? 2000 : (plan === 'ouro' ? 300 : (plan === 'prata' ? 100 : 0));
      
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0,0,0,0);
      
      const { count } = await supabase
        .from('sales')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenant.id)
        .gte('created_at', startOfMonth.toISOString())
        .eq('nfe_status', 'emitida');

      if (count !== null && count >= limit) {
        alert(`Atenção: Você atingiu o limite de emissões de NF-e do seu plano (${limit}/mês). Faça um upgrade para continuar emitindo.`);
        setLoading(false);
        return;
      }
    }

    // 1. Criar a venda base
    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .insert([{ 
        tenant_id: tenant.id,
        total_amount: totalAmount, 
        status: isQuote ? 'quote' : (paymentMethod === 'installments' ? 'pending' : 'paid'), 
        customer_id: selectedCustomer || null,
        discount: discountAmount
      }])
      .select()
      .single()

    if (saleError || !sale) {
      alert("Erro ao finalizar venda. Erro: " + (saleError?.message || ''))
      setLoading(false)
      return
    }

    // 2. Inserir itens
    const saleItems = cart.map(item => ({
      tenant_id: tenant.id,
      sale_id: sale.id,
      product_id: item.id,
      quantity: item.cartQuantity,
      unit_price: item.price,
      total_price: item.price * item.cartQuantity
    }))
    await supabase.from('sale_items').insert(saleItems)

    // 3. Lógica Financeira (À Vista vs A Prazo)
    let generatedInstallments: any[] = []
    
    if (!isQuote) {
      if (paymentMethod === 'installments') {
        const numInstallments = parseInt(installmentPlan)
        const installmentAmount = totalAmount / numInstallments
        const transactions = []
        
        for (let i = 1; i <= numInstallments; i++) {
          const dueDate = new Date()
          dueDate.setDate(dueDate.getDate() + (30 * i))
          
          const instDateStr = dueDate.toISOString().split('T')[0]
          
          transactions.push({
            tenant_id: tenant.id,
            sale_id: sale.id,
            type: 'receivable',
            amount: installmentAmount,
            due_date: instDateStr,
            status: 'pending', // Fica pendente no caixa!
            category: `Parcela ${i}/${numInstallments} - PDV (A Prazo)`
          })
          
          generatedInstallments.push({
            number: i,
            amount: installmentAmount,
            due_date: instDateStr
          })
        }
        
        await supabase.from('financial_transactions').insert(transactions)
      } else {
        // Venda à vista (Dinheiro, PIX, Cartão) - Já entra liquidada
        await supabase.from('financial_transactions').insert([{
           tenant_id: tenant.id,
           sale_id: sale.id,
           type: 'receivable',
           amount: totalAmount,
           due_date: new Date().toISOString().split('T')[0],
           status: 'paid', // Liquidada!
           category: `Venda à Vista PDV - ${paymentMethod.toUpperCase()}`
        }])
      }
    }

    // 4. Lógica de Cashback (Manual do operador) + Adicionar Troco ao Saldo - Deduzir saldo usado
    let cashbackEarned = parseFloat(cashbackInput) || 0
    const receivedAmount = parseFloat(receivedAmountInput) || 0
    const changeAmount = receivedAmount > totalAmount ? receivedAmount - totalAmount : 0
    const changeToAddToWallet = (paymentMethod === 'money' && addChangeToWallet && selectedCustomer) ? changeAmount : 0
    
    let totalCashbackToAdd = cashbackEarned + changeToAddToWallet - cashbackDeducted
    let updatedCustomerInfo = null
    
    if (selectedCustomer) {
      updatedCustomerInfo = customers.find(c => c.id === selectedCustomer)
      
      if (updatedCustomerInfo && !isQuote) {
        const newBalance = Math.max(0, (updatedCustomerInfo.cashback_balance || 0) + totalCashbackToAdd)
        await supabase.from('customers')
          .update({ cashback_balance: newBalance })
          .eq('id', selectedCustomer)
      }
    }

    // 5. Integrações Extras (NFe, WhatsApp)
    if (emitNfe && !isQuote) {
      try {
        const { data, error } = await supabase.functions.invoke('emit-nfe', { body: { sale_id: sale.id, tenant_id: tenant.id } })
        if (error || (data && data.error)) {
          const errCode = data?.code || error?.message
          if (errCode === 'LIMIT_EXCEEDED' || (data?.error && data.error.includes('Limite'))) {
            setShowNfeLimitModal(true)
          } else {
            console.error("Erro ao emitir NFe:", data?.error || error)
          }
        }
      } catch (err) {
        console.error("Exceção ao chamar emit-nfe:", err)
      }
    }

    if (updatedCustomerInfo && updatedCustomerInfo.phone && !isQuote) {
      // Se for a prazo, manda o Carnê, senão manda recibo com cashback
      const webhookPayload = paymentMethod === 'installments' 
        ? {
            type: 'installment_plan',
            sale_id: sale.id, 
            customer_name: updatedCustomerInfo.name,
            customer_phone: updatedCustomerInfo.phone,
            installments: generatedInstallments
          }
        : {
            type: 'cashback_receipt',
            sale_id: sale.id, 
            customer_name: updatedCustomerInfo.name,
            customer_phone: updatedCustomerInfo.phone,
            cashback_earned: cashbackEarned + changeToAddToWallet,
            cashback_balance: Math.max(0, (updatedCustomerInfo.cashback_balance || 0) + totalCashbackToAdd)
          }

      supabase.functions.invoke('telegram-notifier', { body: webhookPayload }).catch(console.error)
      
      if (sendWhatsapp) {
        const greetings = ["Olá", "Oi", "Tudo bem", "Como vai"];
        const randomGreeting = greetings[Math.floor(Math.random() * greetings.length)];
        const message = `${randomGreeting}, ${updatedCustomerInfo.name}! 🚀 Seu comprovante de compra na loja ${tenant.name || 'nossa loja'} no valor de R$ ${totalAmount.toFixed(2)} já está disponível. Agradecemos a preferência e volte sempre!`;
        
        supabase.functions.invoke('send-whatsapp', { 
          body: { 
            phone: updatedCustomerInfo.phone, 
            message,
            tenant_id: tenant.id
          } 
        }).catch(console.error)
      }
    }

    // 6. Preparar Recibo Não Fiscal / Orçamento
    setReceiptData({
      isQuote,
      tenant,
      saleId: sale.id.slice(0, 8),
      date: new Date().toLocaleString('pt-BR'),
      items: [...cart],
      subtotal,
      discount: discountAmount,
      total: totalAmount,
      customer: updatedCustomerInfo?.name || "Consumidor Final",
      paymentMethod,
      installments: generatedInstallments,
      cashbackEarned: cashbackEarned + changeToAddToWallet,
      cashbackDeducted,
      receivedAmount,
      changeAmount,
      changeAddedToWallet: changeToAddToWallet
    })

    // Atualiza a lista local de clientes para refletir o saldo novo imediatamente
    fetchCustomers()

    setSuccess(true)
    setCart([])
    setEmitNfe(false)
    setSendWhatsapp(false)
    setDiscountInput("")
    setCashbackInput("")
    setReceivedAmountInput("")
    setAddChangeToWallet(false)
    setSelectedCustomer("")
    setPaymentMethod("money")
    setInstallmentPlan("1")
    setLoading(false)
  }

  const filteredProducts = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.sku?.includes(search))

  const isOverdue = tenant?.subscription_status === 'overdue'
  const overdueSince = tenant?.overdue_since ? new Date(tenant.overdue_since) : null
  const daysOverdue = overdueSince ? Math.floor((new Date().getTime() - overdueSince.getTime()) / (1000 * 3600 * 24)) : 0
  const isBlocked = isOverdue && daysOverdue > 3

  if (isBlocked) {
    return (
      <div className="flex flex-col h-screen bg-background text-foreground items-center justify-center p-6 text-center">
        <Lock className="w-16 h-16 text-destructive mb-4" />
        <h1 className="text-3xl font-bold mb-2">Acesso Bloqueado</h1>
        <p className="text-muted-foreground mb-6 max-w-md">Sua assinatura está inativa ou com o pagamento pendente há mais de 3 dias. Por favor, regularize sua situação para continuar usando o PDV.</p>
        <Button onClick={() => navigate('/plans')} className="font-bold">Regularizar Assinatura</Button>
      </div>
    )
  }

  return (
    <>
      {isOverdue && !isBlocked && (
        <div className="w-full bg-destructive text-destructive-foreground text-center py-2 px-4 z-[200] font-medium flex items-center justify-center gap-2 shadow-lg">
          <AlertTriangle className="w-5 h-5" />
          Aviso: O seu pagamento está atrasado. O sistema será bloqueado em {3 - daysOverdue} dia(s). 
          <Button variant="outline" size="sm" className="ml-4 h-7 text-xs bg-white text-destructive border-none hover:bg-zinc-100" onClick={() => navigate('/plans')}>Regularizar Agora</Button>
        </div>
      )}
      <div className={`flex flex-col md:flex-row bg-background text-foreground overflow-hidden relative ${isOverdue ? 'h-[calc(100vh-48px)]' : 'h-screen'}`}>
      
      {/* Modal de Limite de NFe */}
      {showNfeLimitModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-md flex items-center justify-center z-[300] p-4">
          <Card className="w-full max-w-md border-border bg-card shadow-2xl p-6 relative overflow-hidden flex flex-col items-center text-center">
            <AlertTriangle className="w-12 h-12 text-amber-500 mb-4" />
            <CardTitle className="text-xl mb-2">Limite de Notas Atingido</CardTitle>
            <CardDescription className="mb-6">
              Você atingiu o limite mensal de emissão de NF-e do seu plano atual. A venda foi registrada, mas a nota fiscal não pôde ser emitida.
            </CardDescription>
            <div className="flex gap-3 w-full">
              <Button variant="outline" className="flex-1" onClick={() => setShowNfeLimitModal(false)}>Fechar</Button>
              <Button className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-bold" onClick={() => navigate('/plans')}>Ver Planos</Button>
            </div>
          </Card>
        </div>
      )}
      
      {/* Modal do PIX Dinâmico */}
      {showPixModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-md flex items-center justify-center z-[100] p-4">
          <Card className="w-full max-w-md border-border bg-card shadow-2xl p-6 relative overflow-hidden flex flex-col items-center">
            <div className="absolute top-[-20%] left-[-10%] w-[250px] h-[250px] bg-purple-600/10 rounded-full blur-[80px] pointer-events-none" />
            <div className="absolute bottom-[-20%] right-[-10%] w-[250px] h-[250px] bg-cyan-500/10 rounded-full blur-[80px] pointer-events-none" />

            <div className="text-center space-y-1 mb-6 z-10 w-full">
              <CardTitle className="text-card-foreground text-lg flex items-center justify-center gap-2">
                <QrCode className="w-5 h-5 text-purple-400 animate-pulse" /> PIX Dinâmico Gerado
              </CardTitle>
              <CardDescription className="text-muted-foreground text-xs">
                Apresente o QR Code abaixo ao cliente ou copie a chave.
              </CardDescription>
            </div>

            {/* QR Code Container */}
            <div className="bg-white p-4 rounded-2xl shadow-lg border border-border mb-6 relative group">
              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(pixPayload)}`} 
                alt="QR Code PIX" 
                className="w-48 h-48"
              />
            </div>

            {/* Spinner Status */}
            <div className="flex items-center gap-3 text-sm text-muted-foreground mb-6 bg-muted px-4 py-2 rounded-full border border-border font-medium animate-pulse">
              <span className="w-2 h-2 rounded-full bg-purple-400 animate-ping"></span>
              Aguardando confirmação bancária...
            </div>

            {/* Copiar Chave */}
            <div className="w-full space-y-3 z-10 mb-6">
              <div className="flex gap-2">
                <Input 
                  readOnly 
                  value={pixPayload} 
                  className="bg-background border-border text-foreground font-mono text-[10px] h-10 select-all" 
                />
                <Button 
                  variant="outline" 
                  size="icon" 
                  className="h-10 w-10 shrink-0 hover:bg-purple-600 hover:text-white"
                  onClick={() => {
                    navigator.clipboard.writeText(pixPayload)
                    alert("Código Copia e Cola copiado!")
                  }}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Ações */}
            <div className="grid grid-cols-2 gap-3 w-full z-10">
              <Button 
                variant="outline" 
                className="border-border hover:bg-muted" 
                onClick={() => setShowPixModal(false)}
              >
                Cancelar
              </Button>
              <Button 
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                onClick={() => {
                  setShowPixModal(false)
                  proceedToCheckout()
                }}
              >
                Simular Confirmação
              </Button>
            </div>
          </Card>
        </div>
      )}
      
      {/* CSS para Impressão */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #receipt-modal, #receipt-modal * { visibility: visible; }
          #receipt-modal { position: absolute; left: 0; top: 0; width: 300px; padding: 0; margin: 0; color: black !important; background: white !important; box-shadow: none !important; }
          .no-print { display: none !important; }
        }
      `}</style>

      {/* Catálogo de Produtos */}
      <div className={`flex-1 flex flex-col p-4 md:p-6 overflow-hidden no-print ${isCartOpen ? 'hidden md:flex' : 'flex'}`}>
        <div className="flex items-center justify-between mb-4 md:mb-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="w-6 h-6" />
            </Button>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">PDV</h1>
          </div>
          <ThemeToggle />
        </div>
        
        <div className="flex flex-col md:flex-row gap-4 mb-4 md:mb-6">
          <div className="relative w-full">
            <Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
            <Input 
              placeholder="Buscar por código de barras, SKU ou Nome..." 
              className="pl-10 h-12 text-lg"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="relative w-[300px]">
            <User className="absolute left-3 top-3 h-5 w-5 text-muted-foreground pointer-events-none" />
            <select 
              className="w-full h-12 pl-10 pr-3 rounded-md border border-input bg-background text-sm cursor-pointer appearance-none"
              value={selectedCustomer}
              onChange={(e) => setSelectedCustomer(e.target.value)}
            >
              <option value="" className="bg-background text-foreground">Consumidor Final</option>
              {customers.map(c => (
                <option key={c.id} value={c.id} className="bg-background text-foreground">{c.name} (Saldo: R$ {c.cashback_balance || 0})</option>
              ))}
            </select>
          </div>
        </div>

        {customerInfo && (
          <div className="mb-4 p-3 bg-purple-950/20 border border-purple-500/20 rounded-md text-sm text-left">
            <div className="flex justify-between items-center">
              <span className="text-zinc-300 font-medium">Cliente: <strong className="text-white">{customerInfo.name}</strong></span>
              <span className="font-bold text-green-400">Saldo da Carteira: R$ {customerBalance.toFixed(2)}</span>
            </div>
            {customerBalance > 0 && (
              <p className="text-[11px] text-purple-300 mt-2 font-medium">
                ✨ R$ {cashbackDeducted.toFixed(2)} do saldo do cliente serão deduzidos automaticamente desta compra!
              </p>
            )}
          </div>
        )}
        
        <div className="flex-1 overflow-y-auto pr-2">
          <div className="flex flex-col gap-2">
            {filteredProducts.map(product => (
              <div 
                key={product.id} 
                className="flex items-center gap-3 p-2.5 rounded-lg border border-border bg-card dark:bg-slate-800/50 hover:border-primary hover:bg-primary/5 dark:hover:bg-primary/10 transition-colors cursor-pointer" 
                onClick={() => addToCart(product)}
              >
                {product.image_url ? (
                  <img src={product.image_url} alt={product.name} className="w-10 h-10 rounded-md object-cover flex-shrink-0 bg-muted" />
                ) : (
                  <div className="w-10 h-10 bg-muted rounded-md flex items-center justify-center flex-shrink-0 border border-border/50">
                    <Package className="w-5 h-5 text-muted-foreground opacity-50" />
                  </div>
                )}
                <div className="flex-1 text-left min-w-0">
                  <h3 className="font-semibold text-sm truncate text-foreground dark:text-neutral-100">{product.name}</h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">SKU: {product.sku} • Est: {product.stock_quantity}</p>
                </div>
                <div className="font-bold text-primary dark:text-emerald-400 text-sm whitespace-nowrap shrink-0">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(product.price)}
                </div>
              </div>
            ))}
            {filteredProducts.length === 0 && (
              <div className="text-center p-12 text-muted-foreground border-2 border-dashed border-border rounded-lg">
                Nenhum produto encontrado na busca.
              </div>
            )}
          </div>
        </div>
        {/* Botão flutuante mobile para abrir carrinho */}
        <div className="md:hidden mt-auto pt-4 pb-2">
          <Button 
            className="w-full h-14 text-lg font-bold shadow-xl shadow-primary/20 flex items-center justify-between px-6" 
            onClick={() => setIsCartOpen(true)}
          >
            <span className="flex items-center gap-2"><ShoppingCart className="w-5 h-5" /> Carrinho ({cart.reduce((a,b) => a + b.cartQuantity, 0)})</span>
            <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalAmount)}</span>
          </Button>
        </div>
      </div>

      {/* Carrinho / Checkout */}
      <div className={`w-full md:w-[450px] border-l border-border bg-card/30 backdrop-blur-md flex-col no-print absolute md:relative z-50 h-full transition-transform duration-300 ${isCartOpen ? 'translate-y-0 flex' : 'translate-y-full md:translate-y-0 md:flex'} bottom-0`}>
        <div className="p-4 md:p-6 border-b border-border bg-card/50 flex justify-between items-center flex-none z-10">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <ShoppingCart className="w-5 h-5" /> Carrinho
          </h2>
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setIsCartOpen(false)}>
            <ChevronUp className="w-6 h-6 rotate-180" />
          </Button>
        </div>
        
        <div className="flex-1 overflow-y-auto flex flex-col">
          <div className="p-4 flex flex-col gap-3">
          {success && (
            <div className="bg-green-500/20 text-green-500 p-4 rounded-lg flex flex-col items-center gap-3 border border-green-500/30 text-center flex-none">
              <div className="flex items-center gap-2 font-bold text-lg">
                <CheckCircle className="w-6 h-6" /> Venda Finalizada!
              </div>
              <Button onClick={() => window.print()} className="w-full mt-2 bg-green-600 hover:bg-green-700">
                <Printer className="w-4 h-4 mr-2" /> Imprimir Cupom
              </Button>
            </div>
          )}
          
          {cart.map(item => (
            <div key={item.id} className="flex items-center justify-between bg-card dark:bg-slate-800 p-2.5 rounded-lg border border-border shadow-sm gap-2 shrink-0 hover:bg-muted/30 transition-colors">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {item.image_url ? (
                  <img src={item.image_url} className="w-8 h-8 rounded-md object-cover bg-muted shrink-0 border border-border/50" />
                ) : (
                  <div className="w-8 h-8 bg-muted rounded-md flex items-center justify-center shrink-0 border border-border/50">
                     <Package className="w-4 h-4 text-muted-foreground opacity-50" />
                  </div>
                )}
                <div className="flex flex-col min-w-0">
                  <span className="font-medium text-foreground dark:text-neutral-100 text-sm truncate">{item.name}</span>
                  <span className="text-primary dark:text-emerald-400 font-bold text-xs mt-0.5">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.price * item.cartQuantity)}
                  </span>
                </div>
              </div>
              
              <div className="flex items-center gap-2 shrink-0">
                <div className="flex items-center gap-0.5 text-foreground dark:text-neutral-100 bg-background dark:bg-slate-900 rounded-md p-0.5 border border-border shadow-sm">
                  <Button variant="ghost" size="icon" className="h-6 w-6 rounded-md hover:bg-muted dark:hover:bg-slate-700 shrink-0" onClick={() => updateQuantity(item.id, -1)}>
                    <Minus className="w-3 h-3" />
                  </Button>
                  <span className="w-6 text-center font-bold text-xs">{item.cartQuantity}</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6 rounded-md hover:bg-muted dark:hover:bg-slate-700 shrink-0" onClick={() => updateQuantity(item.id, 1)}>
                    <Plus className="w-3 h-3" />
                  </Button>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10 shrink-0 rounded-md" onClick={() => removeFromCart(item.id)}>
                  <Trash className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
          {cart.length === 0 && !success && (
            <div className="text-center p-8 text-muted-foreground flex flex-col items-center gap-2">
              <ShoppingCart className="w-12 h-12 opacity-20" />
              <p>Adicione itens ao carrinho</p>
            </div>
          )}
          </div>

          <div className="p-6 border-t border-border bg-card/80 backdrop-blur-xl space-y-4 mt-auto">
          
          {/* Forma de Pagamento e Desconto */}
          <div className="space-y-2">
            <div className="flex justify-between items-center bg-background p-2 rounded-md border border-input">
              <span className="text-sm font-medium px-2">Pagamento:</span>
              <select 
                className="w-40 h-8 bg-transparent border-0 focus-visible:ring-0 text-right text-sm font-medium cursor-pointer"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
              >
                <option value="money" className="bg-background text-foreground">Dinheiro</option>
                <option value="pix" className="bg-background text-foreground">PIX</option>
                <option value="card" className="bg-background text-foreground">Cartão</option>
                <option value="installments" className="bg-background text-foreground">A Prazo (Carnê)</option>
              </select>
            </div>

            {paymentMethod === 'installments' && (
              <div className="flex justify-between items-center bg-primary/10 p-2 rounded-md border border-primary/20">
                <span className="text-sm font-medium px-2 text-primary">Parcelamento:</span>
                <select 
                  className="w-40 h-8 bg-transparent border-0 focus-visible:ring-0 text-right text-sm font-medium text-primary cursor-pointer"
                  value={installmentPlan}
                  onChange={(e) => setInstallmentPlan(e.target.value)}
                >
                  <option value="1" className="bg-background text-foreground">1x (30 dias)</option>
                  <option value="2" className="bg-background text-foreground">2x (30 e 60 dias)</option>
                  <option value="3" className="bg-background text-foreground">3x (30, 60 e 90 dias)</option>
                </select>
              </div>
            )}

            <div className="flex justify-between items-center bg-background p-2 rounded-md border border-input">
              <span className="text-sm font-medium px-2">Desconto (R$):</span>
              <Input 
                type="number" 
                placeholder="0.00" 
                className="w-32 h-8 text-right bg-transparent border-0 focus-visible:ring-0"
                value={discountInput}
                onChange={(e) => setDiscountInput(e.target.value)}
              />
            </div>

            <div className={`flex justify-between items-center p-2 rounded-md border ${selectedCustomer ? 'bg-background border-input' : 'bg-muted border-border opacity-50'}`}>
              <span className="text-sm font-medium px-2">Gerar Cashback (R$):</span>
              <Input 
                type="number" 
                placeholder={selectedCustomer ? "0.00" : "Selecione cliente"} 
                className="w-32 h-8 text-right bg-transparent border-0 focus-visible:ring-0"
                value={cashbackInput}
                onChange={(e) => setCashbackInput(e.target.value)}
                disabled={!selectedCustomer}
              />
            </div>

            {paymentMethod === 'money' && (
              <>
                <div className="flex justify-between items-center bg-background p-2 rounded-md border border-input">
                  <span className="text-sm font-medium px-2">Valor Recebido (R$):</span>
                  <Input 
                    type="number" 
                    placeholder="0.00" 
                    className="w-32 h-8 text-right bg-transparent border-0 focus-visible:ring-0"
                    value={receivedAmountInput}
                    onChange={(e) => setReceivedAmountInput(e.target.value)}
                  />
                </div>

                {parseFloat(receivedAmountInput) > totalAmount && (
                  <div className="p-3 border border-dashed border-zinc-700/50 rounded-lg bg-zinc-950/20 space-y-2">
                    <div className="flex justify-between text-sm font-semibold">
                      <span>Troco Calculado:</span>
                      <span className="text-emerald-400 font-bold">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parseFloat(receivedAmountInput) - totalAmount)}
                      </span>
                    </div>
                    {selectedCustomer ? (
                      <div className="flex items-center gap-2 pt-1 border-t border-border">
                        <input 
                          type="checkbox" 
                          id="addChangeToWallet"
                          className="w-4 h-4 accent-primary cursor-pointer"
                          checked={addChangeToWallet}
                          onChange={(e) => setAddChangeToWallet(e.target.checked)}
                        />
                        <label htmlFor="addChangeToWallet" className="text-xs text-zinc-400 cursor-pointer select-none">
                          Adicionar troco ao saldo do cliente
                        </label>
                      </div>
                    ) : (
                      <p className="text-[10px] text-zinc-500 text-center">
                        Selecione o cliente para guardar o troco no saldo.
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

            <div className="flex justify-between items-center py-2">
              <span className="text-lg font-medium text-muted-foreground">Total:</span>
              <div className="text-right">
                {discountAmount > 0 && <span className="text-sm line-through text-muted-foreground block">R$ {subtotal.toFixed(2)}</span>}
                {cashbackDeducted > 0 && <span className="text-xs text-purple-400 block">- R$ {cashbackDeducted.toFixed(2)} (Saldo Carteira)</span>}
                <span className="text-4xl font-bold text-primary block">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalAmount)}
                </span>
              </div>
            </div>

          <div className={`flex items-center gap-2 p-3 border rounded-lg ${tenant?.plan === 'bronze' ? 'bg-muted/50 border-dashed border-border' : 'border-border bg-background'}`}>
            <input 
              type="checkbox" 
              id="nfe" 
              className="w-5 h-5 accent-primary cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              checked={emitNfe}
              onChange={(e) => setEmitNfe(e.target.checked)}
              disabled={tenant?.plan === 'bronze'}
            />
            <label htmlFor="nfe" className={`flex-1 cursor-pointer text-sm font-medium flex items-center gap-2 ${tenant?.plan === 'bronze' ? 'text-muted-foreground cursor-not-allowed' : ''}`}>
              <FileText className={`w-4 h-4 ${tenant?.plan === 'bronze' ? 'text-muted-foreground' : 'text-primary'}`} /> Emitir NFe Automática
              {tenant?.plan === 'bronze' && <span className="text-[10px] bg-rose-500/10 text-rose-500 px-2 py-0.5 rounded-full ml-auto font-bold">Plano Bronze Bloqueado</span>}
            </label>
          </div>

          <div className={`flex items-center gap-2 p-3 border rounded-lg ${!selectedCustomer || tenant?.plan === 'bronze' ? 'bg-muted/50 border-dashed border-border' : 'border-border bg-background'}`}>
            <input 
              type="checkbox" 
              id="whatsapp" 
              className="w-5 h-5 accent-green-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              checked={sendWhatsapp}
              onChange={(e) => setSendWhatsapp(e.target.checked)}
              disabled={!selectedCustomer || tenant?.plan === 'bronze'}
            />
            <label htmlFor="whatsapp" className={`flex-1 cursor-pointer text-sm font-medium flex items-center gap-2 ${!selectedCustomer || tenant?.plan === 'bronze' ? 'text-muted-foreground cursor-not-allowed' : ''}`}>
              <MessageCircle className={`w-4 h-4 ${!selectedCustomer || tenant?.plan === 'bronze' ? 'text-muted-foreground' : 'text-green-500'}`} /> Enviar Comprovante via WhatsApp
              {tenant?.plan === 'bronze' && <span className="text-[10px] bg-rose-500/10 text-rose-500 px-2 py-0.5 rounded-full ml-auto font-bold">Plano Bronze Bloqueado</span>}
              {!selectedCustomer && tenant?.plan !== 'bronze' && <span className="text-[10px] text-muted-foreground px-2 py-0.5 ml-auto">Selecione um cliente</span>}
            </label>
          </div>

          <div className="flex gap-2">
            <Button 
              variant="outline"
              className="flex-1 h-14 text-sm md:text-lg font-bold shadow-xl border-primary/20 text-primary hover:bg-primary/5" 
              disabled={cart.length === 0 || loading}
              onClick={handleQuote}
            >
              {loading ? "..." : "Salvar Orçamento"}
            </Button>
            <Button 
              className="flex-1 h-14 text-sm md:text-lg font-bold shadow-xl shadow-primary/20" 
              disabled={cart.length === 0 || loading}
              onClick={handleCheckout}
            >
              {loading ? "Processando..." : "Finalizar Venda"}
            </Button>
          </div>
        </div>
        </div>
      </div>

      {/* Modal/Overlay Invisível do Cupom Não Fiscal para Impressão */}
      {receiptData && (
        <div id="receipt-modal" className="fixed top-0 left-0 bg-white text-black p-6 w-[80mm] z-[-1] font-mono text-sm leading-tight">
          <div className="text-center mb-4 border-b border-black pb-2 border-dashed">
            <h2 className="font-bold text-xl uppercase mb-1">{receiptData.tenant?.name || 'Sua Empresa'}</h2>
            <p>{receiptData.tenant?.address || 'Endereço não cadastrado'}</p>
            <p>CNPJ: {receiptData.tenant?.document || '00.000.000/0001-00'}</p>
            <br/>
            <h3 className="font-bold">{receiptData.isQuote ? 'ORÇAMENTO' : 'CUPOM NÃO FISCAL'}</h3>
            {receiptData.isQuote && <p className="text-xs uppercase">(Não é documento fiscal válido)</p>}
            <p>Pedido: #{receiptData.saleId}</p>
            <p>Data: {receiptData.date}</p>
          </div>

          <div className="mb-2">
            <div className="flex justify-between font-bold border-b border-black border-dashed pb-1 mb-1">
              <span>Item</span>
              <span>Valor</span>
            </div>
            {receiptData.items.map((item: any) => (
              <div key={item.id} className="flex justify-between mb-1">
                <span className="w-2/3 truncate">{item.cartQuantity}x {item.name}</span>
                <span>R$ {(item.price * item.cartQuantity).toFixed(2)}</span>
              </div>
            ))}
          </div>

          <div className="border-t border-black border-dashed pt-2 mt-2">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span>R$ {receiptData.subtotal.toFixed(2)}</span>
            </div>
            {receiptData.discount > 0 && (
              <div className="flex justify-between text-black">
                <span>Desconto:</span>
                <span>- R$ {receiptData.discount.toFixed(2)}</span>
              </div>
            )}
            {receiptData.cashbackDeducted > 0 && (
              <div className="flex justify-between text-black font-semibold">
                <span>Saldo Utilizado:</span>
                <span>- R$ {receiptData.cashbackDeducted.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-lg mt-1">
              <span>TOTAL:</span>
              <span>R$ {receiptData.total.toFixed(2)}</span>
            </div>
            <div className="text-xs mt-1 text-right uppercase">
              PGTO: {receiptData.paymentMethod}
            </div>
          </div>

          <div className="border-t border-black border-dashed pt-2 mt-4 text-center">
            <p className="font-bold mb-1">DADOS DO CLIENTE</p>
            <p>{receiptData.customer}</p>
            
            {/* Se for a prazo, mostra as parcelas no recibo físico também! */}
            {receiptData.installments?.length > 0 && (
              <div className="mt-2 p-1 border border-black border-dashed text-left">
                <p className="font-bold text-center mb-1">CARNÊ DE PAGAMENTO</p>
                {receiptData.installments.map((inst: any) => (
                  <div key={inst.number} className="flex justify-between text-xs">
                    <span>{inst.number}ª Parcela ({inst.due_date})</span>
                    <span>R$ {inst.amount.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}

            {receiptData.cashbackEarned > 0 && !receiptData.isQuote && (
              <div className="mt-2 p-1 border border-black border-dashed">
                <p className="font-bold">CASHBACK / SALDO GERADO</p>
                <p className="text-lg">R$ {receiptData.cashbackEarned.toFixed(2)}</p>
                {receiptData.changeAddedToWallet > 0 && <p className="text-[10px]">* Inclui R$ {receiptData.changeAddedToWallet.toFixed(2)} de troco guardado</p>}
                <p className="text-xs">Para a próxima compra!</p>
              </div>
            )}

            {receiptData.paymentMethod === 'money' && receiptData.receivedAmount > 0 && !receiptData.isQuote && (
              <div className="mt-2 text-left text-xs border-t border-black border-dashed pt-2 space-y-1">
                <div className="flex justify-between">
                  <span>VALOR PAGO:</span>
                  <span>R$ {receiptData.receivedAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>TROCO:</span>
                  <span>R$ {receiptData.changeAmount.toFixed(2)}</span>
                </div>
                {receiptData.changeAddedToWallet > 0 && (
                  <p className="text-[10px] font-bold mt-1 text-center">* TROCO ADICIONADO AO SALDO DO CLIENTE *</p>
                )}
              </div>
            )}
            <br/>
            <p>Obrigado pela preferência!</p>
            <p>Software por NexERP</p>
          </div>
        </div>
      )}
    </div>
    </>
  )
}
