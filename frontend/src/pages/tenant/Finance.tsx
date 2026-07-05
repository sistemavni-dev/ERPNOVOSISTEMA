import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "../../lib/supabase"
import { Button } from "../../components/ui/button"
import { Input } from "../../components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card"
import { DollarSign, ArrowUpRight, ArrowDownRight, Clock, ArrowLeft, Plus } from "lucide-react"

export default function Finance() {
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [metrics, setMetrics] = useState({ receivables: 0, payables: 0, balance: 0, pendingReceivables: 0 })
  const navigate = useNavigate()

  // Form States
  const [formCategory, setFormCategory] = useState("")
  const [formType, setFormType] = useState("payable")
  const [formAmount, setFormAmount] = useState("")
  const [formDueDate, setFormDueDate] = useState("")
  const [formStatus, setFormStatus] = useState("pending")

  useEffect(() => {
    fetchTransactions()
  }, [])

  const fetchTransactions = async () => {
    setLoading(true)
    
    // Busca transações manuais
    const { data: finData, error: finError } = await supabase
      .from('financial_transactions')
      .select('*')
      
    if (finError) console.error(finError)
    
    // Busca Vendas do PDV/Vitrine
    const { data: salesData, error: salesError } = await supabase
      .from('sales')
      .select('*')
      
    if (salesError) console.error(salesError)
    
    // Evita duplicação: se a venda já gerou transações financeiras explícitas, não a incluímos dinamicamente.
    const finSaleIds = new Set((finData || []).map(f => f.sale_id).filter(Boolean))

    // Formata as vendas antigas (que não têm parcelas explícitas) para aparecerem como Entradas
    const formattedSales = (salesData || [])
      .filter(sale => !finSaleIds.has(sale.id))
      .map(sale => ({
        id: sale.id,
        amount: sale.total_amount,
        type: 'receivable',
        status: sale.status,
        category: 'Venda Rápida PDV',
        due_date: sale.created_at,
        created_at: sale.created_at
      }))

    // Junta tudo e ordena por data mais recente
    const allTransactions = [...(finData || []), ...formattedSales]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    setTransactions(allTransactions)
    
    let rec = 0, pay = 0, pendingRec = 0
    allTransactions.forEach(t => {
      // Vendas do PDV ('paid') ou transações manuais ('paid')
      if (t.status === 'paid') {
        if (t.type === 'receivable') rec += Number(t.amount)
        if (t.type === 'payable') pay += Number(t.amount)
      } else if (t.status === 'pending' || t.status === 'pending_online') {
        if (t.type === 'receivable') pendingRec += Number(t.amount)
      }
    })
    
    setMetrics({ receivables: rec, payables: pay, balance: rec - pay, pendingReceivables: pendingRec })
    setLoading(false)
  }

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.from('financial_transactions').insert([{
      category: formCategory,
      type: formType,
      amount: parseFloat(formAmount),
      due_date: formDueDate || new Date().toISOString().split('T')[0],
      status: formStatus
    }])
    if (error) {
      alert("Erro ao adicionar lançamento: " + error.message)
    } else {
      setFormCategory("")
      setFormAmount("")
      setFormDueDate("")
      fetchTransactions()
    }
    setLoading(false)
  }

  const markAsPaid = async (id: string, sale_id?: string) => {
    // 1. Marca a parcela atual como paga
    await supabase.from('financial_transactions').update({ status: 'paid' }).eq('id', id)
    
    // 2. Se essa parcela pertence a uma venda (A Prazo), verifica se todas foram pagas
    if (sale_id) {
      const { data: allInstallments } = await supabase
        .from('financial_transactions')
        .select('status')
        .eq('sale_id', sale_id)
      
      // Se todas estiverem 'paid', atualiza o status da sale para 'paid'
      const allPaid = allInstallments?.every(inst => inst.status === 'paid')
      if (allPaid) {
        await supabase.from('sales').update({ status: 'paid' }).eq('id', sale_id)
      }
    }

    fetchTransactions()
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
              <DollarSign className="w-8 h-8 text-primary" /> Financeiro
            </h1>
            <p className="text-muted-foreground mt-1">Fluxo de caixa e contas a pagar/receber.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardDescription>Receitas (Liquidadas)</CardDescription>
            <CardTitle className="text-4xl text-green-500 flex items-center gap-2">
              <ArrowUpRight className="w-6 h-6" />
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(metrics.receivables)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardDescription>A Receber (A Prazo)</CardDescription>
            <CardTitle className="text-4xl text-blue-500 flex items-center gap-2">
              <Clock className="w-6 h-6" />
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(metrics.pendingReceivables)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardDescription>Despesas (Liquidadas)</CardDescription>
            <CardTitle className="text-4xl text-destructive flex items-center gap-2">
              <ArrowDownRight className="w-6 h-6" />
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(metrics.payables)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-border bg-primary/5">
          <CardHeader className="pb-2">
            <CardDescription>Saldo em Caixa</CardDescription>
            <CardTitle className="text-4xl text-primary">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(metrics.balance)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Painel Esquerdo: Formulário */}
        <div className="lg:col-span-1">
          <Card className="border-border">
            <CardHeader>
              <CardTitle>Novo Lançamento</CardTitle>
              <CardDescription>Adicione uma receita ou despesa manual.</CardDescription>
            </CardHeader>
            <form onSubmit={handleAddTransaction}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Categoria / Descrição</label>
                  <Input value={formCategory} onChange={e => setFormCategory(e.target.value)} required placeholder="Ex: Conta de Luz, Fornecedor" />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Tipo</label>
                    <select 
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      value={formType} onChange={e => setFormType(e.target.value)}
                    >
                      <option value="payable">Saída (Despesa)</option>
                      <option value="receivable">Entrada (Receita)</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Status Inicial</label>
                    <select 
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      value={formStatus} onChange={e => setFormStatus(e.target.value)}
                    >
                      <option value="pending">Pendente</option>
                      <option value="paid">Liquidado</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Valor (R$)</label>
                    <Input type="number" step="0.01" value={formAmount} onChange={e => setFormAmount(e.target.value)} required placeholder="150.00" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Vencimento</label>
                    <Input type="date" value={formDueDate} onChange={e => setFormDueDate(e.target.value)} required />
                  </div>
                </div>

                <Button type="submit" className="w-full mt-2" disabled={loading}>
                  <Plus className="w-4 h-4 mr-2" /> Salvar Lançamento
                </Button>
              </CardContent>
            </form>
          </Card>
        </div>

        {/* Painel Direito: Histórico */}
        <div className="lg:col-span-2">
          <Card className="border-border">
            <CardHeader>
              <CardTitle>Histórico de Transações</CardTitle>
              <CardDescription>Lançamentos manuais e automáticos (via PDV).</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="px-4 py-3 font-medium">Data / Vencimento</th>
                      <th className="px-4 py-3 font-medium">Categoria</th>
                      <th className="px-4 py-3 font-medium">Tipo</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium text-right">Valor</th>
                      <th className="px-4 py-3 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((t) => (
                      <tr key={t.id} className="border-b last:border-0 hover:bg-muted/20">
                        <td className="px-4 py-3 text-muted-foreground">
                          {new Date(t.due_date).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="px-4 py-3 font-medium">{t.category || 'Sem Categoria'}</td>
                        <td className="px-4 py-3">
                          {t.type === 'receivable' ? (
                            <span className="text-green-500 font-medium">Entrada</span>
                          ) : (
                            <span className="text-destructive font-medium">Saída</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {t.status === 'paid' ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-green-500/10 text-green-500">
                              Liquidado
                            </span>
                          ) : t.status === 'pending_online' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-blue-500/10 text-blue-500">
                              <Clock className="w-3 h-3" /> P. Online
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-yellow-500/10 text-yellow-500">
                              <Clock className="w-3 h-3" /> Pendente
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-bold">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(t.amount)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {t.status === 'pending' && t.category !== 'Vendas PDV/Online' && (
                            <Button size="sm" variant="outline" className="h-8" onClick={() => markAsPaid(t.id, t.sale_id)}>
                              Dar Baixa
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {loading && transactions.length === 0 && (
                      [...Array(5)].map((_, i) => (
                        <tr key={`skeleton-${i}`} className="border-b animate-pulse">
                          <td className="px-4 py-4"><div className="h-4 bg-muted rounded w-24"></div></td>
                          <td className="px-4 py-4"><div className="h-4 bg-muted rounded w-32"></div></td>
                          <td className="px-4 py-4"><div className="h-4 bg-muted rounded w-16"></div></td>
                          <td className="px-4 py-4"><div className="h-6 bg-muted rounded-full w-20"></div></td>
                          <td className="px-4 py-4 text-right"><div className="h-4 bg-muted rounded w-24 ml-auto"></div></td>
                          <td className="px-4 py-4"><div className="h-8 bg-muted rounded w-20 ml-auto"></div></td>
                        </tr>
                      ))
                    )}
                    {transactions.length === 0 && !loading && (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Nenhuma transação registrada.</td>
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
