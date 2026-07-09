import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "../../lib/supabase"
import { Button } from "../../components/ui/button"
import { Input } from "../../components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card"
import { FileText, Plus, Trash2, ArrowLeft, Eye, X, Calculator } from "lucide-react"

interface QuoteItemInput {
  productId: string
  quantity: number
  unitPrice: number
  taxRate: number
  taxAmount: number
  totalPrice: number
}

export default function SupplierQuotes() {
  const [quotes, setQuotes] = useState<any[]>([])
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [selectedQuote, setSelectedQuote] = useState<any>(null)

  // Creation State
  const [supplierId, setSupplierId] = useState("")
  const [selectedSupplier, setSelectedSupplier] = useState<any>(null)
  const [items, setItems] = useState<QuoteItemInput[]>([])
  
  // Total summary of current quote being created
  const [subtotal, setSubtotal] = useState(0)
  const [taxAmount, setTaxAmount] = useState(0)
  const [totalAmount, setTotalAmount] = useState(0)

  const navigate = useNavigate()

  useEffect(() => {
    fetchQuotes()
    fetchSuppliers()
    fetchProducts()
  }, [])

  const fetchQuotes = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }
    const { data, error } = await supabase
      .from('supplier_quotes')
      .select('*, suppliers(name)')
      .eq('tenant_id', user.id)
      .order('created_at', { ascending: false })
    
    if (error) console.error(error)
    else setQuotes(data || [])
    setLoading(false)
  }

  const fetchSuppliers = async () => {
    const { data, error } = await supabase.from('suppliers').select('*').order('name')
    if (error) {
      console.error("Erro ao buscar fornecedores:", error)
    } else {
      setSuppliers(data || [])
    }
  }

  const fetchProducts = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data, error } = await supabase.from('products').select('*').eq('tenant_id', user.id).order('name')
    if (error) {
      console.error("Erro ao buscar produtos:", error)
      alert("Erro ao buscar produtos do estoque: " + error.message)
    } else {
      setProducts(data || [])
    }
  }

  // Handle supplier change to update tax suggestions
  const handleSupplierChange = (id: string) => {
    setSupplierId(id)
    const supp = suppliers.find(s => s.id === id)
    setSelectedSupplier(supp || null)
  }

  const getTaxRateForRegime = (regime: string, defaultRate: number) => {
    switch (regime) {
      case "Simples Nacional":
        return defaultRate || 6.00
      case "Lucro Presumido":
        return 21.65 // PIS (0.65) + COFINS (3) + ICMS (18)
      case "Lucro Real":
        return 27.25 // PIS (1.65) + COFINS (7.6) + ICMS (18)
      default:
        return 0
    }
  }

  const addRow = () => {
    const defaultProduct = products[0]?.id || ""
    const prod = products.find(p => p.id === defaultProduct)
    const rate = prod ? getTaxRateForRegime(prod.tax_regime, prod.default_tax_rate) : 0
    const newItem: QuoteItemInput = {
      productId: defaultProduct,
      quantity: 1,
      unitPrice: prod ? Number(prod.price) : 0,
      taxRate: rate,
      taxAmount: prod ? parseFloat((Number(prod.price) * (rate / 100)).toFixed(2)) : 0,
      totalPrice: prod ? parseFloat((Number(prod.price) * (1 + rate / 100)).toFixed(2)) : 0
    }
    const newItems = [...items, newItem]
    setItems(newItems)
    updateQuoteTotals(newItems)
  }

  const removeRow = (index: number) => {
    const newItems = items.filter((_, i) => i !== index)
    setItems(newItems)
    updateQuoteTotals(newItems)
  }

  const handleItemChange = (index: number, field: keyof QuoteItemInput, value: any) => {
    const updatedItems = [...items]
    let item = { ...updatedItems[index] }

    if (field === "productId") {
      item.productId = value
      // Optionally prefill default price of product
      const prod = products.find(p => p.id === value)
      if (prod) {
        item.unitPrice = Number(prod.price) || 0
        item.taxRate = getTaxRateForRegime(prod.tax_regime, prod.default_tax_rate)
      }
    } else if (field === "quantity") {
      item.quantity = Math.max(1, parseInt(value) || 0)
    } else if (field === "unitPrice") {
      item.unitPrice = Math.max(0, parseFloat(value) || 0)
    } else if (field === "taxRate") {
      item.taxRate = Math.max(0, parseFloat(value) || 0)
    }

    // Recalculate item tax & total
    const itemSubtotal = item.unitPrice * item.quantity
    item.taxAmount = parseFloat((itemSubtotal * (item.taxRate / 100)).toFixed(2))
    item.totalPrice = parseFloat((itemSubtotal + item.taxAmount).toFixed(2))

    updatedItems[index] = item
    setItems(updatedItems)
    updateQuoteTotals(updatedItems)
  }

  const updateQuoteTotals = (currentItems: QuoteItemInput[]) => {
    const sub = currentItems.reduce((acc, i) => acc + (i.unitPrice * i.quantity), 0)
    const tax = currentItems.reduce((acc, i) => acc + i.taxAmount, 0)
    const tot = sub + tax

    setSubtotal(parseFloat(sub.toFixed(2)))
    setTaxAmount(parseFloat(tax.toFixed(2)))
    setTotalAmount(parseFloat(tot.toFixed(2)))
  }

  const handleSaveQuote = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supplierId) {
      alert("Por favor, selecione um fornecedor.")
      return
    }
    if (items.length === 0) {
      alert("Adicione pelo menos um item ao orçamento.")
      return
    }

    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      alert("Erro: Usuário não autenticado.")
      setLoading(false)
      return
    }

    // 1. Insert Quote
    const { data: quoteData, error: quoteError } = await supabase
      .from('supplier_quotes')
      .insert([{
        tenant_id: user.id,
        supplier_id: supplierId,
        subtotal,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        status: 'draft'
      }])
      .select()

    if (quoteError || !quoteData) {
      alert("Erro ao salvar orçamento: " + quoteError?.message)
      setLoading(false)
      return
    }

    const newQuoteId = quoteData[0].id

    // 2. Insert Items
    const itemsToInsert = items.map(item => ({
      tenant_id: user.id,
      quote_id: newQuoteId,
      product_id: item.productId,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      tax_rate: item.taxRate,
      tax_amount: item.taxAmount,
      total_price: item.totalPrice
    }))

    const { error: itemsError } = await supabase
      .from('supplier_quote_items')
      .insert(itemsToInsert)

    if (itemsError) {
      alert("Erro ao salvar itens do orçamento: " + itemsError.message)
      // Rollback quote if items fail
      await supabase.from('supplier_quotes').delete().eq('id', newQuoteId)
    } else {
      setIsCreating(false)
      setItems([])
      setSupplierId("")
      setSelectedSupplier(null)
      fetchQuotes()
    }
    setLoading(false)
  }

  const handleDeleteQuote = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este orçamento?")) return
    await supabase.from('supplier_quotes').delete().eq('id', id)
    fetchQuotes()
  }

  const handleViewQuoteDetails = async (quote: any) => {
    setLoading(true)
    const { data, error } = await supabase
      .from('supplier_quote_items')
      .select('*, products(name, tax_regime)')
      .eq('quote_id', quote.id)

    if (error) {
      alert("Erro ao carregar detalhes: " + error.message)
    } else {
      setSelectedQuote({
        ...quote,
        items: data || []
      })
    }
    setLoading(false)
  }

  const updateQuoteStatus = async (status: 'draft' | 'pending' | 'approved' | 'rejected') => {
    if (!selectedQuote) return
    const { error } = await supabase
      .from('supplier_quotes')
      .update({ status })
      .eq('id', selectedQuote.id)

    if (error) {
      alert("Erro ao atualizar status: " + error.message)
    } else {
      setSelectedQuote((prev: any) => ({ ...prev, status }))
      fetchQuotes()
    }
  }

  return (
    <div className="p-4 md:p-8 bg-[#020617] min-h-screen dark text-foreground relative overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute top-[-30%] left-[-10%] w-[600px] h-[600px] bg-purple-600/5 rounded-full blur-[180px] pointer-events-none" />
      <div className="absolute bottom-[-30%] right-[-10%] w-[600px] h-[600px] bg-cyan-500/5 rounded-full blur-[180px] pointer-events-none" />

      <div className="mb-8 flex justify-between items-center z-10 relative">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')} className="hover:bg-white/5 text-white">
            <ArrowLeft className="w-6 h-6" />
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent flex items-center gap-2">
              <FileText className="w-6 h-6 md:w-8 md:h-8 text-purple-400" /> Orçamentos de Fornecedores
            </h1>
            <p className="text-zinc-400 mt-1">Crie cotações comparativas e simule o impacto tributário por enquadramento.</p>
          </div>
        </div>

        {!isCreating && (
          <Button onClick={() => setIsCreating(true)} className="bg-purple-600 hover:bg-purple-500 text-white font-semibold">
            <Plus className="w-4 h-4 mr-2" /> Novo Orçamento
          </Button>
        )}
      </div>

      {isCreating ? (
        // Criar Novo Orçamento
        <Card className="bg-slate-950/40 border-white/5 backdrop-blur-xl z-10 relative">
          <CardHeader className="flex flex-row justify-between items-center">
            <div>
              <CardTitle className="text-white">Criar Novo Orçamento</CardTitle>
              <CardDescription className="text-zinc-500">Adicione os itens e calcule automaticamente os impostos com base no fornecedor.</CardDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={() => { setIsCreating(false); setItems([]); }} className="text-zinc-400 hover:text-white">
              <X className="w-5 h-5" />
            </Button>
          </CardHeader>
          <form onSubmit={handleSaveQuote}>
            <CardContent className="space-y-6">
              {/* Seleção do Fornecedor */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-300">Fornecedor</label>
                  <select 
                    value={supplierId} 
                    onChange={e => handleSupplierChange(e.target.value)} 
                    required
                    className="w-full h-10 rounded-md border border-white/5 bg-slate-900 px-3 py-2 text-sm text-white focus:outline-none"
                  >
                    <option value="">Selecione um fornecedor...</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.tax_regime})</option>
                    ))}
                  </select>
                </div>
                
                {selectedSupplier && (
                  <div className="p-3 bg-purple-500/5 rounded-lg border border-purple-500/10 flex flex-col justify-center col-span-1">
                    <div className="text-xs text-purple-400 font-mono uppercase font-bold">Fornecedor Selecionado</div>
                    <div className="text-sm font-medium text-white">{selectedSupplier.name}</div>
                    <div className="text-[10px] text-zinc-500">
                      Os impostos (Simples Nacional, Lucro Presumido, Lucro Real) serão calculados com base no enquadramento fiscal individual de cada produto.
                    </div>
                  </div>
                )}
              </div>

              {/* Tabela de Itens */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-medium text-zinc-300">Produtos da Cotação</label>
                  <Button type="button" variant="outline" size="sm" onClick={addRow} className="border-white/5 text-zinc-300 hover:bg-white/5">
                    <Plus className="w-4 h-4 mr-1" /> Adicionar Linha
                  </Button>
                </div>

                <div className="overflow-x-auto border border-white/5 rounded-lg">
                  <table className="w-full text-sm text-left text-zinc-300">
                    <thead className="bg-white/5 text-white border-b border-white/5">
                      <tr>
                        <th className="px-4 py-2 font-medium">Produto</th>
                        <th className="px-4 py-2 font-medium w-24">Qtd.</th>
                        <th className="px-4 py-2 font-medium w-36">Preço Unit. (R$)</th>
                        <th className="px-4 py-2 font-medium w-28">Alíquota Imp. (%)</th>
                        <th className="px-4 py-2 font-medium w-32">Vl. Imposto (R$)</th>
                        <th className="px-4 py-2 font-medium w-32">Total com Imp.</th>
                        <th className="px-4 py-2 text-right w-12"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, index) => (
                        <tr key={index} className="border-b border-white/5 last:border-0 hover:bg-white/5">
                          <td className="p-2">
                            <select 
                              value={item.productId} 
                              onChange={e => handleItemChange(index, "productId", e.target.value)}
                              className="w-full h-9 rounded-md border border-white/5 bg-slate-900 px-2 py-1 text-xs text-white focus:outline-none"
                            >
                              <option value="">Selecione...</option>
                              {products.map(p => (
                                <option key={p.id} value={p.id}>{p.name} (Ref: {p.price})</option>
                              ))}
                            </select>
                          </td>
                          <td className="p-2">
                            <Input 
                              type="number" 
                              value={item.quantity} 
                              onChange={e => handleItemChange(index, "quantity", e.target.value)}
                              className="h-9 bg-slate-900 border-white/5 text-white text-xs"
                            />
                          </td>
                          <td className="p-2">
                            <Input 
                              type="number" 
                              step="0.01"
                              value={item.unitPrice} 
                              onChange={e => handleItemChange(index, "unitPrice", e.target.value)}
                              className="h-9 bg-slate-900 border-white/5 text-white text-xs"
                            />
                          </td>
                          <td className="p-2">
                            <Input 
                              type="number" 
                              step="0.01"
                              value={item.taxRate} 
                              onChange={e => handleItemChange(index, "taxRate", e.target.value)}
                              className="h-9 bg-slate-900 border-white/5 text-white text-xs"
                            />
                          </td>
                          <td className="p-2 font-mono text-xs text-zinc-400">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.taxAmount)}
                          </td>
                          <td className="p-2 font-mono text-xs font-bold text-white">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.totalPrice)}
                          </td>
                          <td className="p-2 text-right">
                            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-rose-400 hover:bg-rose-500/10" onClick={() => removeRow(index)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                      {items.length === 0 && (
                        <tr>
                          <td colSpan={7} className="px-4 py-8 text-center text-zinc-500">Nenhum produto adicionado. Clique em "Adicionar Linha" acima.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Resumo Final */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center p-4 bg-white/5 rounded-lg border border-white/5 gap-4">
                <div className="flex items-center gap-2 text-xs text-zinc-400">
                  <Calculator className="w-4 h-4 text-purple-400" />
                  <span>Cálculos baseados no enquadramento tributário do fornecedor selecionado.</span>
                </div>
                <div className="flex gap-8 text-right self-end md:self-auto">
                  <div>
                    <div className="text-[10px] text-zinc-500 uppercase">Subtotal (Sem Imposto)</div>
                    <div className="text-lg font-bold text-zinc-300">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(subtotal)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-zinc-500 uppercase">Impostos Estimados</div>
                    <div className="text-lg font-bold text-purple-400">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(taxAmount)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-zinc-500 uppercase">Valor Total</div>
                    <div className="text-xl font-black text-white">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalAmount)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <Button type="button" variant="ghost" onClick={() => { setIsCreating(false); setItems([]); }} className="text-zinc-400 hover:text-white">
                  Cancelar
                </Button>
                <Button type="submit" className="bg-purple-600 hover:bg-purple-500 text-white" disabled={loading || items.length === 0}>
                  Salvar Orçamento
                </Button>
              </div>
            </CardContent>
          </form>
        </Card>
      ) : (
        // Listagem de Orçamentos
        <div className="grid grid-cols-1 gap-8 z-10 relative">
          <Card className="bg-slate-950/40 border-white/5 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-white">Orçamentos Cadastrados</CardTitle>
              <CardDescription className="text-zinc-500">Histórico de cotações de compra emitidas para seus fornecedores.</CardDescription>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <div className="min-w-[800px] border-0">
                <table className="w-full text-sm text-left text-zinc-300">
                  <thead className="bg-white/5 border-b border-white/5 text-white">
                    <tr>
                      <th className="px-4 py-3 font-medium">Data / Hora</th>
                      <th className="px-4 py-3 font-medium">Fornecedor</th>
                      <th className="px-4 py-3 font-medium">Subtotal</th>
                      <th className="px-4 py-3 font-medium">Impostos</th>
                      <th className="px-4 py-3 font-medium">Valor Total</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quotes.map((quote) => (
                      <tr key={quote.id} className="border-b border-white/5 last:border-0 hover:bg-white/5">
                        <td className="px-4 py-3 text-zinc-500">
                          {new Date(quote.created_at).toLocaleString('pt-BR')}
                        </td>
                        <td className="px-4 py-3 font-medium text-white">
                          {quote.suppliers?.name || "Fornecedor Removido"}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(quote.subtotal)}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-purple-400">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(quote.tax_amount)}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs font-bold text-white">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(quote.total_amount)}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                            quote.status === "approved" ? "bg-emerald-500/10 text-emerald-400" :
                            quote.status === "pending" ? "bg-amber-500/10 text-amber-400" :
                            quote.status === "rejected" ? "bg-rose-500/10 text-rose-400" : "bg-zinc-500/10 text-zinc-400"
                          }`}>
                            {quote.status === "approved" ? "Aprovado" :
                             quote.status === "pending" ? "Pendente" :
                             quote.status === "rejected" ? "Rejeitado" : "Rascunho"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button variant="ghost" size="icon" className="text-zinc-400 hover:text-white hover:bg-white/5 mr-2" onClick={() => handleViewQuoteDetails(quote)}>
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10" onClick={() => handleDeleteQuote(quote.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {quotes.length === 0 && !loading && (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-zinc-500">Nenhum orçamento cadastrado ainda.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal / Dialog de Detalhes do Orçamento */}
      {selectedQuote && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="bg-[#0b1329] border-white/10 max-w-3xl w-full">
            <CardHeader className="flex flex-row justify-between items-center border-b border-white/5 pb-4">
              <div>
                <CardTitle className="text-white">Detalhes do Orçamento</CardTitle>
                <CardDescription className="text-zinc-500">
                  Emitido em {new Date(selectedQuote.created_at).toLocaleString('pt-BR')} para {selectedQuote.suppliers?.name}
                </CardDescription>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setSelectedQuote(null)} className="text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </Button>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              {/* Info Fornecedor */}
              <div className="p-3 bg-white/5 rounded-lg border border-white/5">
                <div>
                  <div className="text-[10px] text-zinc-500 uppercase">Fornecedor</div>
                  <div className="text-sm font-medium text-white">{selectedQuote.suppliers?.name}</div>
                </div>
              </div>

              {/* Itens */}
              <div className="space-y-2">
                <div className="text-sm font-semibold text-white">Produtos</div>
                <div className="border border-white/5 rounded-lg overflow-hidden">
                  <table className="w-full text-xs text-left text-zinc-300">
                    <thead className="bg-white/5 text-white">
                      <tr>
                        <th className="px-3 py-2 font-medium">Produto</th>
                        <th className="px-3 py-2 font-medium">Regime</th>
                        <th className="px-3 py-2 font-medium w-16 text-right">Qtd.</th>
                        <th className="px-3 py-2 font-medium w-28 text-right">Preço Unit.</th>
                        <th className="px-3 py-2 font-medium w-16 text-right">Imp. (%)</th>
                        <th className="px-3 py-2 font-medium w-24 text-right">Vl. Imposto</th>
                        <th className="px-3 py-2 font-medium w-28 text-right">Total c/ Imp.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedQuote.items.map((item: any) => (
                        <tr key={item.id} className="border-b border-white/5 last:border-0">
                          <td className="px-3 py-2 text-white font-medium">{item.products?.name || "Produto Excluído"}</td>
                          <td className="px-3 py-2 text-zinc-400">{item.products?.tax_regime || "Simples Nacional"}</td>
                          <td className="px-3 py-2 text-right">{item.quantity}</td>
                          <td className="px-3 py-2 text-right">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.unit_price)}</td>
                          <td className="px-3 py-2 text-right">{item.tax_rate}%</td>
                          <td className="px-3 py-2 text-right text-purple-400">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.tax_amount)}</td>
                          <td className="px-3 py-2 text-right text-white font-bold">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.total_price)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Totais do Modal */}
              <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg border border-white/5">
                <div className="flex gap-4">
                  <Button size="sm" variant="outline" onClick={() => updateQuoteStatus('approved')} className={`h-8 border-white/5 hover:bg-emerald-500/10 hover:text-emerald-400 ${selectedQuote.status === 'approved' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'text-zinc-400'}`}>
                    Aprovar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => updateQuoteStatus('rejected')} className={`h-8 border-white/5 hover:bg-rose-500/10 hover:text-rose-400 ${selectedQuote.status === 'rejected' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 'text-zinc-400'}`}>
                    Rejeitar
                  </Button>
                </div>

                <div className="flex gap-6 text-right">
                  <div>
                    <div className="text-[9px] text-zinc-500 uppercase">Subtotal</div>
                    <div className="text-xs font-semibold text-zinc-300">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(selectedQuote.subtotal)}</div>
                  </div>
                  <div>
                    <div className="text-[9px] text-zinc-500 uppercase">Impostos</div>
                    <div className="text-xs font-semibold text-purple-400">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(selectedQuote.tax_amount)}</div>
                  </div>
                  <div>
                    <div className="text-[9px] text-zinc-500 uppercase">Total</div>
                    <div className="text-sm font-bold text-white">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(selectedQuote.total_amount)}</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
