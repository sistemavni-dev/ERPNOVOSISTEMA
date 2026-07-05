import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "../../lib/supabase"
import { Button } from "../../components/ui/button"
import { Input } from "../../components/ui/input"
import { Card, CardContent } from "../../components/ui/card"
import { ShoppingCart, Search, Plus, Minus, Trash, CheckCircle, FileText, User, Printer, ArrowLeft, Package } from "lucide-react"

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
  const [cart, setCart] = useState<CartItem[]>([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [emitNfe, setEmitNfe] = useState(false)
  
  // Novos estados
  const [selectedCustomer, setSelectedCustomer] = useState<string>("")
  const [discountInput, setDiscountInput] = useState<string>("")
  const [receiptData, setReceiptData] = useState<any>(null)
  
  // Estados de Pagamento
  const [paymentMethod, setPaymentMethod] = useState("money")
  const [installmentPlan, setInstallmentPlan] = useState("1")

  const navigate = useNavigate()

  useEffect(() => {
    fetchProducts()
    fetchCustomers()
  }, [])

  const fetchProducts = async () => {
    const { data } = await supabase.from('products').select('*').limit(20)
    setProducts(data || [])
  }

  const fetchCustomers = async () => {
    const { data } = await supabase.from('customers').select('*').limit(50)
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
  const totalAmount = Math.max(0, subtotal - discountAmount)

  const handleCheckout = async () => {
    if (cart.length === 0) return
    
    // Trava de segurança para Fiado
    if (paymentMethod === 'installments' && !selectedCustomer) {
      alert("Para vender a Prazo (Fiado), é obrigatório selecionar um cliente cadastrado!")
      return
    }

    setLoading(true)
    
    // 1. Criar a venda base
    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .insert([{ 
        total_amount: totalAmount, 
        status: paymentMethod === 'installments' ? 'pending' : 'paid', 
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
      sale_id: sale.id,
      product_id: item.id,
      quantity: item.cartQuantity,
      unit_price: item.price,
      total_price: item.price * item.cartQuantity
    }))
    await supabase.from('sale_items').insert(saleItems)

    // 3. Lógica Financeira (À Vista vs A Prazo)
    let generatedInstallments: any[] = []
    
    if (paymentMethod === 'installments') {
      const numInstallments = parseInt(installmentPlan)
      const installmentAmount = totalAmount / numInstallments
      const transactions = []
      
      for (let i = 1; i <= numInstallments; i++) {
        const dueDate = new Date()
        dueDate.setDate(dueDate.getDate() + (30 * i))
        
        const instDateStr = dueDate.toISOString().split('T')[0]
        
        transactions.push({
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
         sale_id: sale.id,
         type: 'receivable',
         amount: totalAmount,
         due_date: new Date().toISOString().split('T')[0],
         status: 'paid', // Liquidada!
         category: `Venda à Vista PDV - ${paymentMethod.toUpperCase()}`
      }])
    }

    // 4. Lógica de Cashback (5%)
    let cashbackEarned = 0
    let customerInfo = null
    
    if (selectedCustomer) {
      cashbackEarned = totalAmount * 0.05 // 5%
      customerInfo = customers.find(c => c.id === selectedCustomer)
      
      if (customerInfo) {
        await supabase.from('customers')
          .update({ cashback_balance: (customerInfo.cashback_balance || 0) + cashbackEarned })
          .eq('id', selectedCustomer)
      }
    }

    // 5. Integrações Extras (NFe, WhatsApp)
    if (emitNfe) {
      supabase.functions.invoke('emit-nfe', { body: { sale_id: sale.id } }).catch(console.error)
    }

    if (customerInfo && customerInfo.phone) {
      // Se for a prazo, manda o Carnê, senão manda recibo com cashback
      const webhookPayload = paymentMethod === 'installments' 
        ? {
            type: 'installment_plan',
            sale_id: sale.id, 
            customer_name: customerInfo.name,
            customer_phone: customerInfo.phone,
            installments: generatedInstallments
          }
        : {
            type: 'cashback_receipt',
            sale_id: sale.id, 
            customer_name: customerInfo.name,
            customer_phone: customerInfo.phone,
            cashback_earned: cashbackEarned,
            cashback_balance: (customerInfo.cashback_balance || 0) + cashbackEarned
          }

      supabase.functions.invoke('whatsapp-webhook', { body: webhookPayload }).catch(console.error)
    }

    // 6. Preparar Recibo Não Fiscal
    setReceiptData({
      saleId: sale.id.slice(0, 8),
      date: new Date().toLocaleString('pt-BR'),
      items: [...cart],
      subtotal,
      discount: discountAmount,
      total: totalAmount,
      customer: customerInfo?.name || "Consumidor Final",
      paymentMethod,
      installments: generatedInstallments,
      cashbackEarned
    })

    setSuccess(true)
    setCart([])
    setEmitNfe(false)
    setDiscountInput("")
    setSelectedCustomer("")
    setPaymentMethod("money")
    setInstallmentPlan("1")
    setLoading(false)
  }

  const filteredProducts = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.sku?.includes(search))

  return (
    <div className="flex h-screen bg-background dark text-foreground overflow-hidden">
      
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
      <div className="flex-1 flex flex-col p-6 overflow-hidden no-print">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="w-6 h-6" />
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">Ponto de Venda (PDV)</h1>
        </div>
        
        <div className="flex gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
            <Input 
              placeholder="Buscar por código de barras, SKU ou Nome..." 
              className="pl-10 h-12 text-lg"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="relative w-[300px]">
            <User className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
            <select 
              className="w-full h-12 pl-10 pr-3 rounded-md border border-input bg-background text-sm cursor-pointer"
              value={selectedCustomer}
              onChange={(e) => setSelectedCustomer(e.target.value)}
            >
              <option value="">Consumidor Final</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>{c.name} (Saldo: R$ {c.cashback_balance || 0})</option>
              ))}
            </select>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto pr-2">
          <div className="flex flex-col gap-2">
            {filteredProducts.map(product => (
              <Card key={product.id} className="cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors" onClick={() => addToCart(product)}>
                <CardContent className="p-3 flex items-center gap-4">
                  {product.image_url ? (
                    <img src={product.image_url} alt={product.name} className="w-12 h-12 rounded-md object-cover flex-shrink-0 bg-muted" />
                  ) : (
                    <div className="w-12 h-12 bg-muted rounded-md flex items-center justify-center flex-shrink-0">
                      <Package className="w-6 h-6 text-muted-foreground opacity-50" />
                    </div>
                  )}
                  <div className="flex-1 text-left">
                    <h3 className="font-semibold text-sm leading-tight">{product.name}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">SKU: {product.sku} • Estoque: {product.stock_quantity}</p>
                  </div>
                  <div className="font-bold text-primary whitespace-nowrap">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(product.price)}
                  </div>
                </CardContent>
              </Card>
            ))}
            {filteredProducts.length === 0 && (
              <div className="text-center p-12 text-muted-foreground border-2 border-dashed border-border rounded-lg">
                Nenhum produto encontrado na busca.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Carrinho / Checkout */}
      <div className="w-[450px] border-l border-border bg-card/30 backdrop-blur-md flex flex-col no-print">
        <div className="p-6 border-b border-border bg-card/50">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <ShoppingCart className="w-5 h-5" /> Carrinho Atual
          </h2>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {success && (
            <div className="bg-green-500/20 text-green-500 p-4 rounded-lg flex flex-col items-center gap-3 border border-green-500/30 text-center">
              <div className="flex items-center gap-2 font-bold text-lg">
                <CheckCircle className="w-6 h-6" /> Venda Finalizada!
              </div>
              <Button onClick={() => window.print()} className="w-full mt-2 bg-green-600 hover:bg-green-700">
                <Printer className="w-4 h-4 mr-2" /> Imprimir Cupom
              </Button>
            </div>
          )}
          
          {cart.map(item => (
            <div key={item.id} className="flex flex-col bg-background p-3 rounded-lg border border-white/5">
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  {item.image_url && (
                    <img src={item.image_url} className="w-6 h-6 rounded-sm object-cover bg-muted" />
                  )}
                  <span className="font-medium line-clamp-2">{item.name}</span>
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:bg-destructive/20 ml-2" onClick={() => removeFromCart(item.id)}>
                  <Trash className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex justify-between items-center">
                <p className="text-primary font-semibold">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.price * item.cartQuantity)}
                </p>
                <div className="flex items-center gap-3">
                  <Button variant="outline" size="icon" className="h-7 w-7 rounded-full" onClick={() => updateQuantity(item.id, -1)}>
                    <Minus className="w-3 h-3" />
                  </Button>
                  <span className="w-4 text-center font-medium">{item.cartQuantity}</span>
                  <Button variant="outline" size="icon" className="h-7 w-7 rounded-full" onClick={() => updateQuantity(item.id, 1)}>
                    <Plus className="w-3 h-3" />
                  </Button>
                </div>
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

        <div className="p-6 border-t border-border bg-card/80 backdrop-blur-xl space-y-4">
          
          {/* Forma de Pagamento e Desconto */}
          <div className="space-y-2">
            <div className="flex justify-between items-center bg-background p-2 rounded-md border border-input">
              <span className="text-sm font-medium px-2">Pagamento:</span>
              <select 
                className="w-40 h-8 bg-transparent border-0 focus-visible:ring-0 text-right text-sm font-medium cursor-pointer"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
              >
                <option value="money">Dinheiro</option>
                <option value="pix">PIX</option>
                <option value="card">Cartão</option>
                <option value="installments">A Prazo (Carnê)</option>
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
                  <option value="1">1x (30 dias)</option>
                  <option value="2">2x (30 e 60 dias)</option>
                  <option value="3">3x (30, 60 e 90 dias)</option>
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
          </div>

          <div className="flex justify-between items-center py-2">
            <span className="text-lg font-medium text-muted-foreground">Total:</span>
            <div className="text-right">
              {discountAmount > 0 && <span className="text-sm line-through text-muted-foreground block">R$ {subtotal.toFixed(2)}</span>}
              <span className="text-4xl font-bold text-primary block">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalAmount)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 p-3 border border-border rounded-lg bg-background">
            <input 
              type="checkbox" 
              id="nfe" 
              className="w-5 h-5 accent-primary cursor-pointer"
              checked={emitNfe}
              onChange={(e) => setEmitNfe(e.target.checked)}
            />
            <label htmlFor="nfe" className="flex-1 cursor-pointer text-sm font-medium flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" /> Emitir NFe Automática
            </label>
          </div>

          <Button 
            className="w-full h-14 text-lg font-bold shadow-xl shadow-primary/20" 
            disabled={cart.length === 0 || loading}
            onClick={handleCheckout}
          >
            {loading ? "Processando..." : "Finalizar Venda"}
          </Button>
        </div>
      </div>

      {/* Modal/Overlay Invisível do Cupom Não Fiscal para Impressão */}
      {receiptData && (
        <div id="receipt-modal" className="fixed top-0 left-0 bg-white text-black p-6 w-[80mm] z-[-1] font-mono text-sm leading-tight">
          <div className="text-center mb-4 border-b border-black pb-2 border-dashed">
            <h2 className="font-bold text-xl uppercase mb-1">NexERP Cloud</h2>
            <p>SISTEMA DE GESTÃO EMPRESARIAL</p>
            <p>CNPJ: 00.000.000/0001-00</p>
            <br/>
            <h3 className="font-bold">CUPOM NÃO FISCAL</h3>
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

            {receiptData.cashbackEarned > 0 && (
              <div className="mt-2 p-1 border border-black border-dashed">
                <p className="font-bold">CASHBACK GERADO</p>
                <p className="text-lg">R$ {receiptData.cashbackEarned.toFixed(2)}</p>
                <p className="text-xs">Para a próxima compra!</p>
              </div>
            )}
            <br/>
            <p>Obrigado pela preferência!</p>
            <p>Software por NexERP</p>
          </div>
        </div>
      )}
    </div>
  )
}
