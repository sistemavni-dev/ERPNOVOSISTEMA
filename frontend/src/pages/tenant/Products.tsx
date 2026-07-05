import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "../../lib/supabase"
import { Button } from "../../components/ui/button"
import { Input } from "../../components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card"
import { Package, Plus, Search, Trash2, ArrowLeft } from "lucide-react"

export default function Products() {
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [name, setName] = useState("")
  const [price, setPrice] = useState("")
  const [sku, setSku] = useState("")
  const [stockQuantity, setStockQuantity] = useState("")
  const [minStock, setMinStock] = useState("")
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string>("")
  const navigate = useNavigate()

  useEffect(() => {
    fetchProducts()
  }, [])

  const fetchProducts = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('products')
      .select('*, inventory(quantity)')
      .order('created_at', { ascending: false })
    
    if (error) console.error(error)
    else setProducts(data || [])
    
    setLoading(false)
  }

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    let imageUrl = null

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

    const { data: product, error: pError } = await supabase
      .from('products')
      .insert([{ name, price: parseFloat(price), sku, image_url: imageUrl, min_stock: parseInt(minStock) }])
      .select()
      .single()

    if (pError || !product) {
      alert("Erro ao adicionar produto: " + pError?.message)
    } else {
      await supabase.from('inventory').insert([{ product_id: product.id, quantity: parseInt(stockQuantity) }])
      
      setName("")
      setPrice("")
      setSku("")
      setStockQuantity("")
      setMinStock("")
      setImageFile(null)
      setPreviewUrl("")
      fetchProducts()
    }
    setLoading(false)
  }

  const deleteProduct = async (id: string) => {
    if(!confirm("Certeza que deseja excluir?")) return
    await supabase.from('products').delete().eq('id', id)
    fetchProducts()
  }

  return (
    <div className="p-8 bg-background min-h-screen dark text-foreground">
      <div className="mb-8 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="w-6 h-6" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Package className="w-8 h-8 text-primary" /> Produtos e Estoque
            </h1>
            <p className="text-muted-foreground mt-1">Gerencie seu catálogo de produtos.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <Card className="border-border">
            <CardHeader>
              <CardTitle>Novo Produto</CardTitle>
              <CardDescription>Cadastre um novo item para venda.</CardDescription>
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
                <div className="space-y-2">
                  <label className="text-sm font-medium">Preço de Venda (R$)</label>
                  <Input type="number" step="0.01" value={price} onChange={e => setPrice(e.target.value)} required placeholder="49.90" />
                </div>
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
                <Button type="submit" className="w-full" disabled={loading}>
                  <Plus className="w-4 h-4 mr-2" /> Cadastrar Produto
                </Button>
              </CardContent>
            </form>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card className="border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className="space-y-1">
                <CardTitle>Lista de Produtos</CardTitle>
                <CardDescription>Itens cadastrados no sistema.</CardDescription>
              </div>
              <div className="relative w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input type="search" placeholder="Buscar..." className="pl-8" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border mt-4">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="px-4 py-3 font-medium">Produto</th>
                      <th className="px-4 py-3 font-medium">SKU</th>
                      <th className="px-4 py-3 font-medium text-right">Preço</th>
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
                          <span className="inline-flex items-center justify-center bg-secondary px-2.5 py-0.5 rounded-full text-xs font-medium">
                            {p.inventory?.[0]?.quantity || 0} un
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
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
                          <td className="px-4 py-4 text-center"><div className="h-6 bg-muted rounded-full w-12 mx-auto"></div></td>
                          <td className="px-4 py-4"><div className="h-8 bg-muted rounded w-8 ml-auto"></div></td>
                        </tr>
                      ))
                    )}
                    {products.length === 0 && !loading && (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Nenhum produto cadastrado.</td>
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
