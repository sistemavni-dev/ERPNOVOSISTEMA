import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "../../lib/supabase"
import { Button } from "../../components/ui/button"
import { Input } from "../../components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card"
import { Package, Plus, Search, Trash2, ArrowLeft, Sparkles, Upload, Edit, X } from "lucide-react"
import { ThemeToggle } from "../../components/ThemeToggle"

export default function Products() {
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [name, setName] = useState("")
  const [costPrice, setCostPrice] = useState("")
  const [margin, setMargin] = useState("")
  const [price, setPrice] = useState("")
  const [sku, setSku] = useState("")
  const [stockQuantity, setStockQuantity] = useState("")
  const [minStock, setMinStock] = useState("")
  const [ncm, setNcm] = useState("")
  const [cest, setCest] = useState("")
  const [origin, setOrigin] = useState("0")
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string>("")
  const [taxRegime, setTaxRegime] = useState<"Simples Nacional" | "Lucro Presumido" | "Lucro Real">("Simples Nacional")
  const [defaultTaxRate, setDefaultTaxRate] = useState("6.00")
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [editingProductId, setEditingProductId] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    fetchProducts()
  }, [])

  const fetchProducts = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }

    const { data, error } = await supabase
      .from('products')
      .select('*, inventory(quantity)')
      .eq('tenant_id', user.id)
      .order('created_at', { ascending: false })
    
    if (error) console.error(error)
    else setProducts(data || [])
    
    await fetchSuggestions()
    setLoading(false)
  }

  const fetchSuggestions = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    // 1. Vendas nos últimos 30 dias para calcular velocidade de giro
    const { data: salesItemsData } = await supabase
      .from('sale_items')
      .select('quantity, product_id')
      .eq('tenant_id', user.id)
      .gte('created_at', thirtyDaysAgo.toISOString())

    // 2. Todos os produtos e estoque
    const { data: productsData } = await supabase
      .from('products')
      .select('id, name, min_stock, sku, inventory(quantity)')
      .eq('tenant_id', user.id)

    if (!productsData) return

    const salesVolume: { [key: string]: number } = {}
    salesItemsData?.forEach(item => {
      if (item.product_id) {
        salesVolume[item.product_id] = (salesVolume[item.product_id] || 0) + Number(item.quantity)
      }
    })

    const restockSuggestions: any[] = []

    productsData.forEach(p => {
      const currentStock = p.inventory?.[0]?.quantity || 0
      const minS = p.min_stock || 5
      const sold30 = salesVolume[p.id] || 0
      const dailyAvg = sold30 / 30
      
      let daysRemaining = null
      if (dailyAvg > 0) {
        daysRemaining = currentStock / dailyAvg
      }

      // Se o estoque está abaixo do mínimo ou vai acabar em menos de 10 dias
      if (currentStock <= minS || (daysRemaining !== null && daysRemaining <= 10)) {
        const targetQty = Math.max(Math.ceil(dailyAvg * 30), minS * 2)
        const suggestQty = Math.max(targetQty - currentStock, 0)

        if (suggestQty > 0) {
          restockSuggestions.push({
            id: p.id,
            name: p.name,
            sku: p.sku,
            currentStock,
            minStock: minS,
            daysRemaining: daysRemaining !== null ? Math.round(daysRemaining) : null,
            suggestQty,
            urgency: currentStock === 0 ? 'crítico' : (currentStock <= minS ? 'alto' : 'médio')
          })
        }
      }
    })

    setSuggestions(restockSuggestions.sort((a, b) => {
      const score = (val: string) => val === 'crítico' ? 3 : (val === 'alto' ? 2 : 1)
      return score(b.urgency) - score(a.urgency)
    }))
  }

  const handleCostChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setCostPrice(val)
    if (val && margin) {
      const p = parseFloat(val) * (1 + parseFloat(margin) / 100)
      setPrice(p.toFixed(2))
    }
  }

  const handleMarginChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setMargin(val)
    if (val && costPrice) {
      const p = parseFloat(costPrice) * (1 + parseFloat(val) / 100)
      setPrice(p.toFixed(2))
    }
  }

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setPrice(val)
    if (val && costPrice && parseFloat(costPrice) > 0) {
      const m = ((parseFloat(val) / parseFloat(costPrice)) - 1) * 100
      setMargin(m.toFixed(2))
    }
  }

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      alert("Usuário não autenticado.")
      setLoading(false)
      return
    }

    let imageUrl = previewUrl.startsWith('blob:') ? null : previewUrl

    if (imageFile) {
      const fileExt = imageFile.name.split('.').pop()
      const fileName = `${Math.random()}.${fileExt}`
      const { error: uploadError } = await supabase.storage
        .from('product_images')
        .upload(fileName, imageFile)

      if (uploadError) {
        alert("Erro no upload da imagem: " + uploadError.message)
        setLoading(false)
        return
      }
      const { data } = supabase.storage.from('product_images').getPublicUrl(fileName)
      imageUrl = data.publicUrl
    }

    const rate = parseFloat(defaultTaxRate)
    const newTaxRate = taxRegime === "Simples Nacional" ? (isNaN(rate) ? 6 : rate) : 0

    if (editingProductId) {
      // Rotina de Atualização
      const { error: updateError } = await supabase
        .from('products')
        .update({
          name, 
          cost_price: parseFloat(costPrice || "0"),
          margin_percentage: parseFloat(margin || "0"),
          price: parseFloat(price), 
          sku, 
          image_url: imageUrl, 
          min_stock: parseInt(minStock),
          tax_regime: taxRegime,
          default_tax_rate: newTaxRate,
          ncm: ncm || null,
          cest: cest || null,
          origin: parseInt(origin) || 0
        })
        .eq('id', editingProductId)

      if (updateError) {
        alert("Erro ao atualizar produto: " + updateError.message)
      } else {
        // Atualiza o estoque
        const { data: invData } = await supabase.from('inventory').select('id').eq('product_id', editingProductId).single()
        if (invData) {
          await supabase.from('inventory').update({ quantity: parseInt(stockQuantity) }).eq('id', invData.id)
        } else {
          await supabase.from('inventory').insert([{ product_id: editingProductId, quantity: parseInt(stockQuantity) }])
        }
        cancelEdit()
        fetchProducts()
      }
    } else {
      // Rotina de Criação
      const { data: product, error: pError } = await supabase
        .from('products')
        .insert([{ 
          tenant_id: user.id,
          name, 
          cost_price: parseFloat(costPrice || "0"),
          margin_percentage: parseFloat(margin || "0"),
          price: parseFloat(price), 
          sku, 
          image_url: imageUrl, 
          min_stock: parseInt(minStock),
          tax_regime: taxRegime,
          default_tax_rate: newTaxRate,
          ncm: ncm || null,
          cest: cest || null,
          origin: parseInt(origin) || 0
        }])
        .select()
        .single()

      if (pError || !product) {
        alert("Erro ao adicionar produto: " + pError?.message)
      } else {
        await supabase.from('inventory').insert([{ product_id: product.id, quantity: parseInt(stockQuantity) }])
        cancelEdit()
        fetchProducts()
      }
    }
    setLoading(false)
  }

  const handleEdit = (product: any) => {
    setEditingProductId(product.id)
    setName(product.name)
    setCostPrice(product.cost_price?.toString() || "")
    setMargin(product.margin_percentage?.toString() || "")
    setPrice(product.price.toString())
    setSku(product.sku || "")
    setStockQuantity(product.inventory?.[0]?.quantity?.toString() || "0")
    setMinStock(product.min_stock?.toString() || "5")
    setPreviewUrl(product.image_url || "")
    setImageFile(null)
    setTaxRegime(product.tax_regime || "Simples Nacional")
    setDefaultTaxRate(product.default_tax_rate?.toString() || "6.00")
    setNcm(product.ncm || "")
    setCest(product.cest || "")
    setOrigin(product.origin?.toString() || "0")
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const cancelEdit = () => {
    setEditingProductId(null)
    setName("")
    setCostPrice("")
    setMargin("")
    setPrice("")
    setSku("")
    setStockQuantity("")
    setMinStock("")
    setImageFile(null)
    setPreviewUrl("")
    setTaxRegime("Simples Nacional")
    setDefaultTaxRate("6.00")
    setNcm("")
    setCest("")
    setOrigin("0")
  }

  const deleteProduct = async (id: string) => {
    if(!confirm("Certeza que deseja excluir?")) return
    await supabase.from('products').delete().eq('id', id)
    fetchProducts()
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      alert("Usuário não autenticado.")
      setLoading(false)
      return
    }

    const reader = new FileReader()
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string
        const parser = new DOMParser()
        const xmlDoc = parser.parseFromString(text, "text/xml")

        const dets = xmlDoc.getElementsByTagName("det")
        if (dets.length === 0) {
          alert("Nenhum produto encontrado neste XML ou XML inválido.")
          setLoading(false)
          return
        }

        let newProductsCount = 0
        let updatedProductsCount = 0

        for (let i = 0; i < dets.length; i++) {
          const det = dets[i]
          const prod = det.getElementsByTagName("prod")[0]
          
          if (prod) {
            const sku = prod.getElementsByTagName("cProd")[0]?.textContent || ""
            const name = prod.getElementsByTagName("xProd")[0]?.textContent || ""
            const qtyStr = prod.getElementsByTagName("qCom")[0]?.textContent || "0"
            const unitPriceStr = prod.getElementsByTagName("vUnCom")[0]?.textContent || "0"
            
            const quantity = parseFloat(qtyStr)
            const unitCost = parseFloat(unitPriceStr)
            
            // Regra: Custo + 50%
            const salePrice = unitCost * 1.5

            if (!sku) continue

            // Verifica se produto já existe pelo SKU
            const { data: existingProduct } = await supabase
              .from('products')
              .select('id')
              .eq('tenant_id', user.id)
              .eq('sku', sku)
              .single()

            if (existingProduct) {
              // Produto existe: atualiza estoque
              const { data: currentInv } = await supabase
                .from('inventory')
                .select('quantity, id')
                .eq('product_id', existingProduct.id)
                .single()
              
              if (currentInv) {
                await supabase
                  .from('inventory')
                  .update({ quantity: currentInv.quantity + quantity })
                  .eq('id', currentInv.id)
              } else {
                await supabase
                  .from('inventory')
                  .insert([{ product_id: existingProduct.id, quantity }])
              }
              updatedProductsCount++
            } else {
              // Produto não existe: cria novo e insere estoque
              const { data: newProd, error: pError } = await supabase
                .from('products')
                .insert([{
                  tenant_id: user.id,
                  name,
                  sku,
                  price: salePrice,
                  min_stock: 5,
                  tax_regime: "Simples Nacional",
                  default_tax_rate: 6
                }])
                .select()
                .single()

              if (newProd && !pError) {
                await supabase
                  .from('inventory')
                  .insert([{ product_id: newProd.id, quantity }])
                newProductsCount++
              } else {
                 console.error("Erro ao inserir produto:", name, pError)
              }
            }
          }
        }
        
        alert(`Importação concluída!\n\nNovos produtos criados: ${newProductsCount}\nProdutos com estoque atualizado: ${updatedProductsCount}`)
        fetchProducts() // atualiza listagem
      } catch (err: any) {
        alert("Erro ao processar arquivo XML: " + err.message)
      } finally {
        setLoading(false)
        e.target.value = ""
      }
    }
    
    reader.onerror = () => {
      alert("Erro ao ler o arquivo.")
      setLoading(false)
    }
    
    reader.readAsText(file)
  }

  return (
    <div className="p-4 md:p-8 bg-background min-h-screen text-foreground">
      <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center justify-between w-full md:w-auto gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="w-6 h-6" />
            </Button>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
                <Package className="w-6 h-6 md:w-8 md:h-8 text-primary" /> Produtos e Estoque
              </h1>
              <p className="text-muted-foreground mt-1">Gerencie seu catálogo de produtos.</p>
            </div>
          </div>
          <div className="md:hidden">
            <ThemeToggle />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input 
            type="file" 
            id="xml-upload" 
            accept=".xml" 
            className="hidden" 
            onChange={handleFileUpload}
          />
          <Button onClick={() => document.getElementById('xml-upload')?.click()} variant="outline" className="gap-2 bg-background">
            <Upload className="w-4 h-4" /> Importar XML
          </Button>
          <div className="hidden md:block">
            <ThemeToggle />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <Card className="border-border">
            <CardHeader>
              <CardTitle>{editingProductId ? "Editar Produto" : "Novo Produto"}</CardTitle>
              <CardDescription>{editingProductId ? "Altere as informações do produto selecionado." : "Cadastre um novo item para venda."}</CardDescription>
            </CardHeader>
            <form onSubmit={handleAddProduct}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nome do Produto</label>
                  <Input value={name} onChange={e => setName(e.target.value)} required placeholder="Ex: Camiseta Básica" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Código/SKU</label>
                  <Input value={sku} onChange={e => setSku(e.target.value)} placeholder="Ex: CAM-001" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Preço de Custo (R$)</label>
                    <Input type="number" step="0.01" value={costPrice} onChange={handleCostChange} placeholder="Ex: 25.00" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Margem de Lucro (%)</label>
                    <Input type="number" step="0.01" value={margin} onChange={handleMarginChange} placeholder="Ex: 50.00" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Preço de Venda (R$)</label>
                    <Input type="number" step="0.01" value={price} onChange={handlePriceChange} required placeholder="Ex: 49.90" />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">NCM (8 dígitos)</label>
                    <Input value={ncm} onChange={e => setNcm(e.target.value.replace(/\D/g, '').substring(0, 8))} required placeholder="Ex: 61091000" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">CEST</label>
                    <Input value={cest} onChange={e => setCest(e.target.value.replace(/\D/g, '').substring(0, 7))} placeholder="Ex: 2803800" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Origem do Produto</label>
                    <select 
                      value={origin} 
                      onChange={e => setOrigin(e.target.value)} 
                      className="w-full h-10 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="0">0 - Nacional</option>
                      <option value="1">1 - Estrangeira (Importação direta)</option>
                      <option value="2">2 - Estrangeira (Adquirida no mercado interno)</option>
                      <option value="3">3 - Nacional (Conteúdo de Importação {'>'} 40%)</option>
                      <option value="4">4 - Nacional (Processos produtivos básicos)</option>
                      <option value="5">5 - Nacional (Conteúdo de Importação {'<'} 40%)</option>
                      <option value="6">6 - Estrangeira (Importação direta, sem similar)</option>
                      <option value="7">7 - Estrangeira (Mercado interno, sem similar)</option>
                      <option value="8">8 - Nacional (Conteúdo de Importação {'>'} 70%)</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Regime Tributário (Enquadramento)</label>
                  <select 
                    value={taxRegime} 
                    onChange={e => setTaxRegime(e.target.value as any)} 
                    className="w-full h-10 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="Simples Nacional">Simples Nacional</option>
                    <option value="Lucro Presumido" disabled>Lucro Presumido (Em breve)</option>
                    <option value="Lucro Real" disabled>Lucro Real (Em breve)</option>
                  </select>
                </div>
                {taxRegime === "Simples Nacional" && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Alíquota do DAS Padrão (%)</label>
                    <Input 
                      type="number" 
                      step="0.01" 
                      value={defaultTaxRate} 
                      onChange={e => setDefaultTaxRate(e.target.value)} 
                    />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Qtd em Estoque</label>
                    <Input placeholder="Ex: 50" type="number" value={stockQuantity} onChange={e => setStockQuantity(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Estoque Mínimo</label>
                    <Input placeholder="Ex: 5" type="number" value={minStock} onChange={e => setMinStock(e.target.value)} required />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Imagem do Produto</label>
                  <div className="flex items-center gap-4">
                    {previewUrl ? (
                      <div className="w-16 h-16 rounded-md overflow-hidden bg-muted flex-shrink-0 border border-border">
                        <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-16 h-16 rounded-md bg-muted border border-dashed border-border flex items-center justify-center flex-shrink-0">
                        <Package className="w-6 h-6 text-muted-foreground opacity-50" />
                      </div>
                    )}
                    <Input 
                      type="file" 
                      accept="image/*" 
                      className="cursor-pointer"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) {
                          setImageFile(file)
                          setPreviewUrl(URL.createObjectURL(file))
                        }
                      }}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  {editingProductId && (
                    <Button type="button" variant="outline" className="w-full text-zinc-400" onClick={cancelEdit} disabled={loading}>
                      <X className="w-4 h-4 mr-2" /> Cancelar
                    </Button>
                  )}
                  <Button type="submit" className="w-full" disabled={loading}>
                    <Plus className="w-4 h-4 mr-2" /> {editingProductId ? "Salvar Alterações" : "Cadastrar Produto"}
                  </Button>
                </div>
              </CardContent>
            </form>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-6">
          {/* Card de Sugestões de Reposição Inteligente */}
          {suggestions.length > 0 && (
            <Card className="border-purple-500/20 bg-purple-500/5 backdrop-blur-sm shadow-lg shadow-purple-500/5">
              <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle className="text-white text-base flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-purple-400 animate-pulse" /> Sugestões de Reposição Inteligente
                  </CardTitle>
                  <CardDescription className="text-zinc-400 text-xs mt-1">Algoritmo de giro preditivo analisando os últimos 30 dias de vendas.</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {suggestions.slice(0, 4).map(s => (
                    <div key={s.id} className="p-3.5 bg-background rounded-xl border border-border flex flex-col justify-between hover:border-purple-500/25 transition-all shadow-sm">
                      <div>
                        <div className="flex justify-between items-start gap-2">
                          <h4 className="font-bold text-white text-sm line-clamp-1">{s.name}</h4>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            s.urgency === 'crítico' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                            s.urgency === 'alto' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                          }`}>
                            {s.urgency}
                          </span>
                        </div>
                        <p className="text-[10px] text-zinc-500 font-mono mt-0.5">SKU: {s.sku || '---'}</p>
                      </div>

                      <div className="mt-4 pt-3 border-t border-border flex justify-between items-center text-xs">
                        <div className="text-muted-foreground space-y-0.5">
                          <div>Estoque atual: <span className="text-foreground font-mono font-bold">{s.currentStock} un</span></div>
                          <div>Previsão: <span className="text-white font-bold">{s.daysRemaining !== null ? `${s.daysRemaining} dias restando` : 'Sem giro recente'}</span></div>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] text-purple-300 font-bold uppercase">Sugerido Comprar</div>
                          <div className="text-purple-400 font-black text-lg font-mono">+{s.suggestQty} un</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="border-border">
            <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between pb-2 gap-4">
              <div className="space-y-1">
                <CardTitle>Lista de Produtos</CardTitle>
                <CardDescription>Itens cadastrados no sistema.</CardDescription>
              </div>
              <div className="relative w-full md:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input type="search" placeholder="Buscar..." className="pl-8 w-full" />
              </div>
            </CardHeader>
            <CardContent className="p-0 md:p-6 overflow-x-auto">
              <div className="min-w-[800px] border-0 md:rounded-md md:border mt-4">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="px-4 py-3 font-medium">Produto</th>
                      <th className="px-4 py-3 font-medium">SKU</th>
                      <th className="px-4 py-3 font-medium text-right">Preço</th>
                      <th className="px-4 py-3 font-medium text-center">Tributação</th>
                      <th className="px-4 py-3 font-medium text-center">Estoque</th>
                      <th className="px-4 py-3 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((p) => (
                      <tr key={p.id} className="border-b last:border-0 hover:bg-muted/20">
                        <td className="px-4 py-3 font-medium flex items-center gap-3">
                          {p.image_url ? (
                            <img src={p.image_url} className="w-8 h-8 rounded object-cover" />
                          ) : <div className="w-8 h-8 bg-muted rounded" />}
                          {p.name}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{p.sku}</td>
                        <td className="px-4 py-3 text-right font-medium text-primary">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(p.price)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                            p.tax_regime === "Simples Nacional" ? "bg-emerald-500/10 text-emerald-400" :
                            p.tax_regime === "Lucro Presumido" ? "bg-blue-500/10 text-blue-400" : "bg-purple-500/10 text-purple-400"
                          }`}>
                            {p.tax_regime || "Simples Nacional"}
                          </span>
                          {p.tax_regime === "Simples Nacional" && (
                            <div className="text-[10px] text-zinc-500 mt-0.5">Alíquota: {p.default_tax_rate}%</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center justify-center bg-secondary px-2.5 py-0.5 rounded-full text-xs font-medium">
                            {p.inventory?.[0]?.quantity || 0} un
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => handleEdit(p)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteProduct(p.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {loading && products.length === 0 && (
                      [...Array(5)].map((_, i) => (
                        <tr key={`skeleton-${i}`} className="border-b animate-pulse">
                          <td className="px-4 py-4"><div className="h-6 bg-muted rounded w-48"></div></td>
                          <td className="px-4 py-4"><div className="h-4 bg-muted rounded w-24"></div></td>
                          <td className="px-4 py-4 text-right"><div className="h-4 bg-muted rounded w-20 ml-auto"></div></td>
                          <td className="px-4 py-4 text-center"><div className="h-4 bg-muted rounded w-20 mx-auto"></div></td>
                          <td className="px-4 py-4 text-center"><div className="h-6 bg-muted rounded-full w-12 mx-auto"></div></td>
                          <td className="px-4 py-4"><div className="h-8 bg-muted rounded w-8 ml-auto"></div></td>
                        </tr>
                      ))
                    )}
                    {products.length === 0 && !loading && (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Nenhum produto cadastrado.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
