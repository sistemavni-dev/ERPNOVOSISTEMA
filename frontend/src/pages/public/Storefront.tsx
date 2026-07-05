import { useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import { supabase } from "../../lib/supabase"
import { Button } from "../../components/ui/button"
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from "../../components/ui/card"
import { Input } from "../../components/ui/input"
import { ShoppingBag, Plus, Minus, Store, Send, ShoppingCart, Info } from "lucide-react"

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

  useEffect(() => {
    if (slug) {
      loadStore()
    }
  }, [slug])

  const loadStore = async () => {
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
    // A Edge Function fica encarregada de ler a venda e disparar as mensagens iniciais do WhatsApp
    supabase.functions.invoke('whatsapp-webhook', { 
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
    return <div className="min-h-screen flex items-center justify-center bg-background text-foreground dark">Carregando loja...</div>
  }

  if (!tenant) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground p-4 text-center dark">
        <Store className="w-16 h-16 text-muted-foreground mb-4 opacity-50" />
        <h1 className="text-2xl font-bold mb-2">Loja não encontrada</h1>
        <p className="text-muted-foreground">O endereço acessado não existe ou está indisponível.</p>
      </div>
    )
  }

  const totalAmount = cart.reduce((acc, item) => acc + (item.price * item.cartQuantity), 0)
  const totalItems = cart.reduce((acc, item) => acc + item.cartQuantity, 0)

  return (
    <div className="min-h-screen bg-background text-foreground dark">
      {/* Header da Loja */}
      <header className="bg-card/50 backdrop-blur-xl border-b border-border sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center">
              <Store className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight">{tenant.name}</h1>
              <p className="text-xs text-muted-foreground line-clamp-1">{tenant.store_description || 'Catálogo Oficial'}</p>
            </div>
          </div>
          
          <Button variant="outline" className="relative h-10 px-4" onClick={() => setCheckoutMode(true)} disabled={cart.length === 0}>
            <ShoppingCart className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Ver Sacola</span>
            {totalItems > 0 && (
              <span className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                {totalItems}
              </span>
            )}
          </Button>
        </div>
      </header>

      {/* Catálogo */}
      <main className="container mx-auto px-4 py-8 pb-32">
        <h2 className="text-2xl font-bold mb-6">Nossos Produtos</h2>
        
        {products.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Info className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p>Nenhum produto cadastrado nesta loja ainda.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {products.map(product => {
              const inCart = cart.find(c => c.id === product.id)
              return (
                <Card key={product.id} className="border-border hover:border-primary/50 transition-all flex flex-col h-full bg-card overflow-hidden">
                  {/* Imagem do Produto */}
                  <div className="h-48 bg-muted/30 flex items-center justify-center overflow-hidden">
                    {product.image_url ? (
                      <img src={product.image_url} alt={product.name} className="w-full h-full object-cover transition-transform hover:scale-105 duration-500" />
                    ) : (
                      <ShoppingBag className="w-12 h-12 text-muted-foreground/30" />
                    )}
                  </div>
                  
                  <CardHeader className="p-4 pb-0 flex-1">
                    <CardTitle className="text-lg line-clamp-2">{product.name}</CardTitle>
                    <CardDescription className="text-primary font-bold text-lg mt-2">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(product.price)}
                    </CardDescription>
                  </CardHeader>
                  
                  <CardFooter className="p-4 pt-4">
                    {!inCart ? (
                      <Button className="w-full" onClick={() => addToCart(product)}>
                        <Plus className="w-4 h-4 mr-2" /> Adicionar
                      </Button>
                    ) : (
                      <div className="flex items-center justify-between w-full bg-primary/10 rounded-md p-1 border border-primary/20">
                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-background" onClick={() => updateQuantity(product.id, -1)}>
                          <Minus className="w-4 h-4" />
                        </Button>
                        <span className="font-bold w-8 text-center">{inCart.cartQuantity}</span>
                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-background" onClick={() => updateQuantity(product.id, 1)}>
                          <Plus className="w-4 h-4" />
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

      {/* Botão Fixo Mobile / Desktop (Floating Checkout) */}
      {cart.length > 0 && !checkoutMode && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-md border-t border-border z-20">
          <div className="container mx-auto">
            <Button className="w-full h-14 text-lg font-bold shadow-2xl" onClick={() => setCheckoutMode(true)}>
              Finalizar Pedido • {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalAmount)}
            </Button>
          </div>
        </div>
      )}

      {/* Checkout Modal / Sidebar */}
      {checkoutMode && (
        <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
          <div className="w-full max-w-lg bg-card border-border sm:border rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-border flex justify-between items-center bg-muted/20">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <ShoppingCart className="w-5 h-5" /> Sua Sacola
              </h3>
              <Button variant="ghost" size="sm" onClick={() => setCheckoutMode(false)}>Fechar</Button>
            </div>
            
            {success ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
                <div className="w-16 h-16 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mb-2">
                  <Send className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-bold text-green-500">Pedido Recebido!</h3>
                <p className="text-muted-foreground">
                  Seu pedido foi enviado com sucesso diretamente para a loja.
                </p>
                <p className="text-sm font-medium">
                  Você receberá a confirmação em breve no seu WhatsApp.
                </p>
                <Button className="mt-4" onClick={() => { setSuccess(false); setCheckoutMode(false); }}>
                  Voltar para o Catálogo
                </Button>
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {cart.map(item => (
                    <div key={item.id} className="flex justify-between items-center border-b border-white/5 pb-2">
                      <div className="flex items-center gap-3 flex-1">
                        {item.image_url ? (
                          <img src={item.image_url} className="w-12 h-12 rounded object-cover flex-shrink-0 bg-muted" />
                        ) : (
                          <div className="w-12 h-12 rounded bg-muted flex items-center justify-center flex-shrink-0">
                            <ShoppingBag className="w-5 h-5 opacity-30" />
                          </div>
                        )}
                        <div>
                          <p className="font-medium line-clamp-1">{item.name}</p>
                          <p className="text-sm text-primary font-bold">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.price)} x {item.cartQuantity}
                          </p>
                        </div>
                      </div>
                      <div className="font-bold ml-2">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.price * item.cartQuantity)}
                      </div>
                    </div>
                  ))}
                  
                  <div className="pt-4 mt-4">
                    <div className="flex justify-between font-bold text-xl text-primary">
                      <span>Total do Pedido:</span>
                      <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalAmount)}</span>
                    </div>
                  </div>

                  <div className="pt-6 space-y-4">
                    <div>
                      <label className="text-sm font-bold mb-1 block">Seu Nome Completo:</label>
                      <Input 
                        placeholder="Ex: João Silva" 
                        className="h-12"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-bold mb-1 block">Seu WhatsApp com DDD:</label>
                      <Input 
                        placeholder="Ex: 11999999999" 
                        className="h-12"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
                
                <div className="p-4 border-t border-border bg-card">
                  <Button 
                    className="w-full h-14 text-lg font-bold shadow-xl shadow-green-500/20 bg-green-600 hover:bg-green-700 text-white"
                    disabled={!customerName.trim() || !customerPhone.trim() || loading}
                    onClick={handleSendOrder}
                  >
                    {loading ? "Processando..." : <><Send className="w-5 h-5 mr-2" /> Enviar Pedido Oficial</>}
                  </Button>
                  {(!customerName.trim() || !customerPhone.trim()) && (
                    <p className="text-xs text-center text-muted-foreground mt-2">Preencha seu nome e celular para prosseguir.</p>
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
