import { useEffect, useState, useCallback } from "react"
import { useParams } from "react-router-dom"
import { supabase } from "../../lib/supabase"
import { Button } from "../../components/ui/button"
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from "../../components/ui/card"
import { Input } from "../../components/ui/input"
import { ShoppingBag, Plus, Minus, Store, Send, ShoppingCart, Info, Sparkles, User, Smartphone } from "lucide-react"

interface Product {
  id: string
  name: string
  price: number
  sku: string
  image_url?: string
}

interface CartItem extends Product {
  cartQuantity: number
}

interface Tenant {
  id: string
  name: string
  store_description: string
  whatsapp_number: string
}

export default function Storefront() {
  const { slug } = useParams<{ slug: string }>()
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(true)
  
  const [checkoutMode, setCheckoutMode] = useState(false)
  const [customerName, setCustomerName] = useState("")
  const [customerPhone, setCustomerPhone] = useState("")
  const [success, setSuccess] = useState(false)

  const loadStore = useCallback(async () => {
    setLoading(true)
    
    // Busca a loja pelo slug público
    const { data: tenantData, error: tenantError } = await supabase
      .from('tenants')
      .select('id, name, store_description, whatsapp_number')
      .eq('store_slug', slug)
      .single()

    if (tenantError || !tenantData) {
      setLoading(false)
      return
    }

    setTenant(tenantData)

    // Busca os produtos públicos da loja
    const { data: productsData } = await supabase
      .from('products')
      .select('*')
      .eq('tenant_id', tenantData.id)

    setProducts(productsData || [])
    setLoading(false)
  }, [slug])

  useEffect(() => {
    if (slug) {
      loadStore()
    }
  }, [slug, loadStore])

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

  const handleSendOrder = async () => {
    if (!tenant?.id || cart.length === 0 || !customerName || !customerPhone) return
    setLoading(true)

    const total = cart.reduce((acc, item) => acc + (item.price * item.cartQuantity), 0)
    
    // 1. Gravar Cliente no CRM (requer RLS Anon Insert liberado)
    const { data: customer } = await supabase
      .from('customers')
      .insert([{
        tenant_id: tenant.id,
        name: customerName,
        phone: customerPhone
      }])
      .select()
      .single()

    // 2. Gravar Venda no Banco de Dados (requer RLS Anon Insert liberado)
    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .insert([{ 
        tenant_id: tenant.id, // Define de qual loja é o pedido
        customer_id: customer?.id || null, // Atrela ao cliente recém-criado
        total_amount: total, 
        status: 'pending_online', // Diferencia de vendas físicas pagas
        discount: 0
      }])
      .select()
      .single()

    if (saleError || !sale) {
      alert("Erro ao gravar pedido online: " + saleError?.message)
      setLoading(false)
      return
    }

    // 3. Gravar Itens da Venda
    const saleItems = cart.map(item => ({
      tenant_id: tenant.id,
      sale_id: sale.id,
      product_id: item.id,
      quantity: item.cartQuantity,
      unit_price: item.price,
      total_price: item.price * item.cartQuantity
    }))
    await supabase.from('sale_items').insert(saleItems)

    // 4. O próprio sistema dispara o Webhook via servidor
    supabase.functions.invoke('telegram-notifier', { 
      body: { 
        type: 'new_online_order',
        sale_id: sale.id, 
        customer_name: customerName,
        customer_phone: customerPhone,
        tenant_whatsapp: tenant.whatsapp_number
      } 
    }).catch(console.error)
    
    setSuccess(true)
    setCart([])
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#020617] text-white font-sans relative overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[180px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-cyan-600/10 rounded-full blur-[180px]" />
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500 mb-4 z-10" />
        <p className="text-zinc-400 text-sm font-mono tracking-wider z-10">CARREGANDO VITRINE VIRTUAL...</p>
      </div>
    )
  }

  if (!tenant) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#020617] text-white p-4 text-center relative overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-red-600/5 rounded-full blur-[180px]" />
        <Store className="w-16 h-16 text-zinc-500 mb-4 opacity-50" />
        <h1 className="text-2xl font-bold mb-2">Vitrine não encontrada</h1>
        <p className="text-zinc-400 max-w-sm">O endereço que você acessou pode estar desativado ou não existir.</p>
      </div>
    )
  }

  const totalAmount = cart.reduce((acc, item) => acc + (item.price * item.cartQuantity), 0)
  const totalItems = cart.reduce((acc, item) => acc + item.cartQuantity, 0)

  return (
    <div className="min-h-screen bg-[#07070b] text-foreground dark relative font-sans overflow-x-hidden pb-24">
      {/* Background blobs */}
      <div className="absolute top-[-30%] left-[-10%] w-[600px] h-[600px] bg-purple-600/5 rounded-full blur-[200px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-cyan-500/5 rounded-full blur-[200px] pointer-events-none" />

      {/* Header */}
      <header className="bg-slate-950/40 backdrop-blur-xl border-b border-white/5 sticky top-0 z-40 transition-all">
        <div className="container mx-auto px-4 md:px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-500/10 rounded-xl flex items-center justify-center border border-purple-500/20 text-purple-400 shadow-inner">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-extrabold text-white text-base md:text-lg leading-tight tracking-tight flex items-center gap-1.5">
                {tenant.name}
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">Oficial</span>
              </h1>
              <p className="text-xs text-zinc-400 line-clamp-1 mt-0.5">{tenant.store_description || 'Vitrine Virtual & Pedidos Rápidos'}</p>
            </div>
          </div>
          
          <Button 
            variant="ghost" 
            className="relative h-11 px-4 text-zinc-300 hover:text-white hover:bg-white/5 border border-white/5 bg-slate-950/20 rounded-xl transition-all gap-2"
            onClick={() => setCheckoutMode(true)} 
            disabled={cart.length === 0}
          >
            <ShoppingCart className="w-4 h-4 text-purple-400" />
            <span className="hidden sm:inline font-semibold">Ver Sacola</span>
            {totalItems > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center border border-slate-950 shadow-md">
                {totalItems}
              </span>
            )}
          </Button>
        </div>
      </header>

      {/* Hero Store banner */}
      <section className="container mx-auto px-4 md:px-6 pt-8 pb-4">
        <div className="relative rounded-2xl md:rounded-3xl border border-white/5 bg-slate-950/20 p-6 md:p-8 overflow-hidden shadow-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="absolute inset-0 bg-grid-pattern opacity-[0.02]" />
          <div className="absolute top-0 right-0 w-80 h-80 bg-purple-500/5 rounded-full blur-[80px]" />
          
          <div className="space-y-2 z-10">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Sparkles className="w-3.5 h-3.5" /> Aberto para pedidos
            </div>
            <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight">Bem-vindo à nossa Vitrine</h2>
            <p className="text-zinc-400 max-w-xl text-sm leading-relaxed">
              Adicione os produtos desejados na sacola e envie diretamente para nosso WhatsApp para finalização e retirada rápida.
            </p>
          </div>
        </div>
      </section>

      {/* Catalog Grid */}
      <main className="container mx-auto px-4 md:px-6 py-8">
        <h3 className="text-lg font-black text-white mb-6 uppercase tracking-wider text-xs flex items-center gap-2">
          <ShoppingBag className="w-4 h-4 text-purple-400" /> Catálogo de Produtos
        </h3>
        
        {products.length === 0 ? (
          <div className="text-center py-20 text-zinc-500 border border-dashed border-white/5 rounded-2xl bg-slate-950/10">
            <Info className="w-12 h-12 mx-auto mb-4 text-zinc-600 opacity-40" />
            <p className="text-zinc-400">Nenhum produto cadastrado nesta vitrine ainda.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-4">
            {products.map(product => {
              const inCart = cart.find(c => c.id === product.id)
              return (
                <Card key={product.id} className="border-white/5 hover:border-purple-500/30 transition-all flex flex-col h-full bg-slate-950/20 backdrop-blur-sm rounded-2xl overflow-hidden group shadow-lg">
                  {/* Imagem do Produto */}
                  <div className="h-36 bg-zinc-950/50 flex items-center justify-center overflow-hidden relative border-b border-white/5">
                    {product.image_url ? (
                      <img src={product.image_url} alt={product.name} className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-500" />
                    ) : (
                      <ShoppingBag className="w-8 h-8 text-zinc-700 opacity-40 group-hover:scale-110 transition-transform" />
                    )}
                  </div>
                  
                  <CardHeader className="p-3 pb-0 flex-1">
                    <CardTitle className="text-xs font-bold text-white leading-snug line-clamp-2 min-h-[32px] group-hover:text-purple-300 transition-colors">{product.name}</CardTitle>
                    <p className="text-[9px] font-mono text-zinc-500 mt-1 uppercase">Ref: {product.sku || '---'}</p>
                    <CardDescription className="text-green-400 font-extrabold text-sm mt-2 flex items-baseline gap-1">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(product.price)}
                    </CardDescription>
                  </CardHeader>
                  
                  <CardFooter className="p-3 pt-3">
                    {!inCart ? (
                      <Button 
                        className="w-full bg-purple-600 hover:bg-purple-500 text-white rounded-xl h-9 text-xs font-bold shadow-md shadow-purple-600/10 transition-all"
                        onClick={() => addToCart(product)}
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar
                      </Button>
                    ) : (
                      <div className="flex items-center justify-between w-full bg-purple-500/10 rounded-xl p-1 border border-purple-500/20 h-9">
                        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-slate-900 text-zinc-300 hover:text-white" onClick={() => updateQuantity(product.id, -1)}>
                          <Minus className="w-3.5 h-3.5" />
                        </Button>
                        <span className="font-extrabold text-white text-xs w-6 text-center">{inCart.cartQuantity}</span>
                        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-slate-900 text-zinc-300 hover:text-white" onClick={() => updateQuantity(product.id, 1)}>
                          <Plus className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    )}
                  </CardFooter>
                </Card>
              )
            })}
          </div>
        )}
      </main>

      {/* Floating Sticky Bar */}
      {cart.length > 0 && !checkoutMode && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-[#07070b]/80 backdrop-blur-xl border-t border-white/5 z-30 transition-transform">
          <div className="container mx-auto">
            <Button 
              className="w-full h-14 text-base font-extrabold shadow-2xl shadow-purple-600/20 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-2xl border-0 flex items-center justify-between px-6 transition-all" 
              onClick={() => setCheckoutMode(true)}
            >
              <span className="flex items-center gap-2"><ShoppingCart className="w-5 h-5" /> Enviar Pedido</span>
              <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalAmount)}</span>
            </Button>
          </div>
        </div>
      )}

      {/* Checkout overlay */}
      {checkoutMode && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-[#0e0e15] border-white/5 sm:border rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] relative">
            <div className="p-5 border-b border-white/5 flex justify-between items-center bg-slate-950/20">
              <h3 className="font-extrabold text-white text-base flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-purple-400" /> Sua Sacola
              </h3>
              <Button variant="ghost" size="sm" onClick={() => setCheckoutMode(false)} className="text-zinc-400 hover:text-white rounded-lg">Fechar</Button>
            </div>
            
            {success ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
                <div className="w-16 h-16 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-2xl flex items-center justify-center mb-2 animate-bounce">
                  <Send className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-black text-white tracking-tight">Pedido Enviado!</h3>
                <p className="text-zinc-400 text-sm max-w-sm leading-relaxed">
                  O seu pedido foi recebido com sucesso no sistema da loja e notificado via WhatsApp.
                </p>
                <p className="text-xs font-semibold text-purple-400 bg-purple-500/10 border border-purple-500/20 px-3 py-1 rounded-full">
                  Fique atento ao seu celular para receber a confirmação!
                </p>
                <Button className="mt-4 bg-purple-600 hover:bg-purple-500 text-white rounded-xl" onClick={() => { setSuccess(false); setCheckoutMode(false); }}>
                  Voltar ao Catálogo
                </Button>
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                  {cart.map(item => (
                    <div key={item.id} className="flex justify-between items-center border-b border-white/5 pb-3">
                      <div className="flex items-center gap-3 flex-1">
                        {item.image_url ? (
                          <img src={item.image_url} className="w-12 h-12 rounded-xl object-cover flex-shrink-0 bg-zinc-950 border border-white/5" />
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-zinc-950 flex items-center justify-center flex-shrink-0 border border-white/5">
                            <ShoppingBag className="w-5 h-5 text-zinc-600 opacity-40" />
                          </div>
                        )}
                        <div>
                          <p className="font-semibold text-white line-clamp-1 text-sm">{item.name}</p>
                          <p className="text-xs text-purple-400 font-bold mt-0.5">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.price)} x {item.cartQuantity}
                          </p>
                        </div>
                      </div>
                      <div className="font-extrabold text-white text-sm ml-2">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.price * item.cartQuantity)}
                      </div>
                    </div>
                  ))}
                  
                  <div className="pt-4 mt-4">
                    <div className="flex justify-between font-extrabold text-lg text-white">
                      <span>Total do Pedido:</span>
                      <span className="text-green-400">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalAmount)}</span>
                    </div>
                  </div>
                  
                  <hr className="border-white/5 my-4" />

                  <div className="pt-2 space-y-4">
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5 block flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-purple-400" /> Seu Nome Completo
                      </label>
                      <Input 
                        placeholder="Ex: João Silva" 
                        className="h-12 bg-slate-900 border-white/5 text-white placeholder:text-zinc-600 rounded-xl"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5 block flex items-center gap-1.5">
                        <Smartphone className="w-3.5 h-3.5 text-purple-400" /> Seu WhatsApp com DDD
                      </label>
                      <Input 
                        placeholder="Ex: 11999999999" 
                        className="h-12 bg-slate-900 border-white/5 text-white placeholder:text-zinc-600 rounded-xl"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
                
                <div className="p-5 border-t border-white/5 bg-[#0e0e15]">
                  <Button 
                    className="w-full h-14 text-base font-extrabold shadow-xl shadow-green-500/10 bg-green-600 hover:bg-green-500 text-white rounded-2xl flex items-center justify-center gap-2 border-0"
                    disabled={!customerName.trim() || !customerPhone.trim() || loading}
                    onClick={handleSendOrder}
                  >
                    {loading ? "Processando..." : <><Send className="w-4 h-4" /> Confirmar & Enviar Pedido</>}
                  </Button>
                  {(!customerName.trim() || !customerPhone.trim()) && (
                    <p className="text-[10px] text-center text-zinc-500 mt-3.5 font-medium">Preencha suas informações acima para habilitar o envio do pedido.</p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
