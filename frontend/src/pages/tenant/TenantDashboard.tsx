import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "../../lib/supabase"
import { Button } from "../../components/ui/button"
import { Input } from "../../components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card"
import { LogOut, LayoutDashboard, ShoppingCart, Users, Package, DollarSign, Printer, Settings, Menu, X } from "lucide-react"

export default function TenantDashboard() {
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<any>(null)
  const navigate = useNavigate()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  // Estados de Métricas
  const [metrics, setMetrics] = useState({
    vendasHoje: 0,
    qtdPedidosHoje: 0,
    contasVencidas: 0,
    qtdVencidas: 0,
    alertaEstoque: 0,
    saldoPendente: 0
  })
  
  const [recentSales, setRecentSales] = useState<any[]>([])
  const [receiptData, setReceiptData] = useState<any>(null)

  // Date Picker State para o Dashboard
  const [startDate, setStartDate] = useState(() => {
    return new Date().toISOString().split('T')[0]
  })
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0]
  })

  useEffect(() => {
    checkAccess()
  }, [])

  useEffect(() => {
    // Carrega apenas no início
    if (profile) loadMetrics()
  }, [profile])

  const checkAccess = async () => {
    // 1. Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      navigate('/login')
      return
    }

    // 2. Fetch Tenant Data Directly
    const { data: tenantData, error: tenantError } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', user.id)
      .single()

    if (tenantError || !tenantData) {
      console.error(tenantError)
    } else {
      setProfile({ tenants: tenantData }) // Mantendo a estrutura para não quebrar o JSX
      
      if (tenantData.status !== 'active' && tenantData.status !== 'pending') {
        alert("O status da sua empresa é: " + tenantData.status)
      }

      // 3. Load Dashboard Metrics (chamado pelo useEffect de selectedDate)
      // Mas para não atrasar o primeiro render:
      loadMetrics()
    }
    
    setLoading(false)
  }

  const loadMetrics = async () => {
    const startOfDay = new Date(startDate)
    startOfDay.setHours(0, 0, 0, 0)
    
    const endOfDay = new Date(endDate)
    endOfDay.setHours(23, 59, 59, 999)
    
    // Vendas no período selecionado
    const { data: salesToday } = await supabase
      .from('sales')
      .select('total_amount')
      .eq('status', 'paid')
      .gte('created_at', startOfDay.toISOString())
      .lte('created_at', endOfDay.toISOString())
      
    const totalVendas = salesToday?.reduce((acc, sale) => acc + Number(sale.total_amount), 0) || 0
    const qtdPedidos = salesToday?.length || 0

    // Alerta de Estoque Baixo
    const { data: products } = await supabase.from('products').select('stock_quantity, min_stock')
    const lowStock = products?.filter(p => p.stock_quantity <= (p.min_stock || 5))?.length || 0

    // Contas a Receber Vencidas (qualquer dia menor que hoje é vencido, a data do seletor não muda o que é vencido HOJE)
    const { data: overdue } = await supabase
      .from('financial_transactions')
      .select('amount')
      .eq('type', 'receivable')
      .eq('status', 'pending')
      .lt('due_date', new Date().toISOString().split('T')[0])
      
    const totalVencido = overdue?.reduce((acc, t) => acc + Number(t.amount), 0) || 0

    // Saldo Pendente (Aguardando Retirada ou A Prazo Pendente)
    const { data: pendingSales } = await supabase
      .from('sales')
      .select('total_amount')
      .in('status', ['awaiting_pickup', 'pending'])

    const totalPendente = pendingSales?.reduce((acc, sale) => acc + Number(sale.total_amount), 0) || 0

    setMetrics({
      vendasHoje: totalVendas,
      qtdPedidosHoje: qtdPedidos,
      contasVencidas: totalVencido,
      qtdVencidas: overdue?.length || 0,
      alertaEstoque: lowStock,
      saldoPendente: totalPendente
    })

    // Últimas Vendas
    const { data: recentData } = await supabase
      .from('sales')
      .select('*, customers(name)')
      .order('created_at', { ascending: false })
      .limit(10)
      
    setRecentSales(recentData || [])
  }

  const handleDeleteSale = async (id: string) => {
    if (!confirm("Atenção: A exclusão é irreversível e removerá a venda do histórico financeiro. Deseja continuar?")) return
    
    // Deleta os itens da venda primeiro (chave estrangeira)
    await supabase.from('sale_items').delete().eq('sale_id', id)
    // Deleta a venda
    await supabase.from('sales').delete().eq('id', id)
    
    loadMetrics()
  }

  const handleReprintSale = async (sale: any) => {
    // Busca os produtos atrelados à venda
    const { data: items } = await supabase
      .from('sale_items')
      .select('quantity, unit_price, total_price, products(name)')
      .eq('sale_id', sale.id)

    // Monta os dados do recibo
    const subtotal = (Number(sale.total_amount) || 0) + (Number(sale.discount) || 0)

    setReceiptData({
      tenant: profile?.tenants?.name || 'Minha Empresa',
      customer: sale.customers, // Puxa do JOIN feito em loadMetrics
      items: items?.map((i: any) => ({
        name: i.products?.name || 'Produto Excluído',
        cartQuantity: i.quantity,
        price: i.unit_price
      })) || [],
      discount: sale.discount || 0,
      subtotal: subtotal,
      total: sale.total_amount,
      date: new Date(sale.created_at).toLocaleString('pt-BR')
    })

    // Aguarda a renderização do DOM e dispara a impressão
    setTimeout(() => {
      window.print()
      // Opcional: setReceiptData(null) após imprimir se não quiser manter os dados na tela oculta
    }, 500)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-background text-foreground dark">Carregando painel...</div>
  }


  return (
    <>
    <div className="min-h-screen bg-background flex flex-col md:flex-row dark print:hidden">
      
      {/* Topbar Mobile */}
      <div className="md:hidden flex items-center justify-between p-4 border-b border-border bg-card/50 backdrop-blur-xl z-50 sticky top-0">
        <h2 className="text-xl font-bold tracking-tight text-primary flex items-center gap-2">
          <LayoutDashboard className="w-5 h-5" /> {profile?.tenants?.name || 'Sua Empresa'}
        </h2>
        <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </Button>
      </div>

      {/* Sidebar Tenant */}
      <aside className={`w-full md:w-64 border-r border-border bg-background md:bg-card/50 backdrop-blur-xl flex-col absolute md:relative z-40 h-[calc(100vh-73px)] md:h-screen transition-transform duration-300 ease-in-out ${isMobileMenuOpen ? 'translate-x-0 flex' : '-translate-x-full md:translate-x-0 hidden md:flex'} top-[73px] md:top-0`}>
        <div className="p-6 hidden md:block">
          <h2 className="text-xl font-bold tracking-tight text-primary flex items-center gap-2">
            <LayoutDashboard className="w-5 h-5" /> {profile?.tenants?.name || 'Sua Empresa'}
          </h2>
          <p className="text-xs text-muted-foreground mt-1">Olá, {profile?.full_name || 'Usuário'}</p>
        </div>
        <nav className="flex-1 px-4 space-y-2">
          <Button variant="secondary" className="w-full justify-start gap-2 text-foreground" onClick={() => navigate('/dashboard')}>
            <LayoutDashboard className="w-4 h-4" /> Visão Geral
          </Button>
          <Button variant="secondary" className="w-full justify-start gap-2 text-foreground" onClick={() => navigate('/pdv')}>
            <ShoppingCart className="w-4 h-4" /> PDV (Vendas)
          </Button>
          <Button variant="secondary" className="w-full justify-start gap-2 text-foreground" onClick={() => navigate('/produtos')}>
            <Package className="w-4 h-4" /> Estoque & Produtos
          </Button>
          <Button variant="secondary" className="w-full justify-start gap-2 text-foreground" onClick={() => navigate('/clientes')}>
            <Users className="w-4 h-4" /> CRM (Clientes)
          </Button>
          <Button variant="secondary" className="w-full justify-start gap-2 text-foreground" onClick={() => navigate('/financeiro')}>
            <DollarSign className="w-4 h-4" /> Financeiro
          </Button>
          <Button variant="secondary" className="w-full justify-start gap-2 text-foreground" onClick={() => navigate('/configuracoes')}>
            <Settings className="w-4 h-4" /> Configurações
          </Button>
        </nav>
        <div className="p-4 border-t border-border">
          <Button variant="ghost" className="w-full justify-start gap-2 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={handleLogout}>
            <LogOut className="w-4 h-4" /> Sair
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto">
        <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground mt-1">Resumo das suas operações.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <span className="text-sm font-medium text-muted-foreground">Período:</span>
            <Input 
              type="date" 
              className="w-auto h-10 dark:[color-scheme:dark] text-foreground" 
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <span className="text-sm font-medium text-muted-foreground">até</span>
            <Input 
              type="date" 
              className="w-auto h-10 dark:[color-scheme:dark] text-foreground" 
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
            <Button variant="secondary" onClick={() => loadMetrics()} className="h-10">
              Filtrar
            </Button>
          </div>
        </div>

        {/* Resumo Rápido */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Vendas de Hoje</CardDescription>
              <CardTitle className="text-3xl text-green-500">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(metrics.vendasHoje)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">{metrics.qtdPedidosHoje} liquidados</p>
            </CardContent>
          </Card>
          
          <Card className="border-blue-500/20">
            <CardHeader className="pb-2">
              <CardDescription>Saldo Pendente (Reservas)</CardDescription>
              <CardTitle className="text-3xl text-blue-500">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(metrics.saldoPendente)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">aguardando retirada</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Contas Vencidas</CardDescription>
              <CardTitle className="text-3xl text-yellow-500">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(metrics.contasVencidas)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">{metrics.qtdVencidas} faturas</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Alerta Estoque</CardDescription>
              <CardTitle className="text-3xl text-destructive">{metrics.alertaEstoque}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">produtos baixos</p>
            </CardContent>
          </Card>
        </div>

        {/* Acesso Rápido (Funções do Site) */}
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4">Acesso Rápido</h2>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4">
            <Card className="cursor-pointer border-border hover:border-primary transition-all hover:bg-primary/5 shadow-sm" onClick={() => navigate('/pdv')}>
              <CardContent className="flex flex-col items-center justify-center p-6 gap-3">
                <div className="p-3 bg-primary/10 rounded-full text-primary">
                  <ShoppingCart className="w-8 h-8" />
                </div>
                <div className="text-center">
                  <h3 className="font-semibold">PDV</h3>
                  <p className="text-xs text-muted-foreground mt-1">Frente de Caixa</p>
                </div>
              </CardContent>
            </Card>

            <Card className="cursor-pointer border-border hover:border-blue-500 transition-all hover:bg-blue-500/5 shadow-sm" onClick={() => navigate('/produtos')}>
              <CardContent className="flex flex-col items-center justify-center p-6 gap-3">
                <div className="p-3 bg-blue-500/10 rounded-full text-blue-500">
                  <Package className="w-8 h-8" />
                </div>
                <div className="text-center">
                  <h3 className="font-semibold">Estoque</h3>
                  <p className="text-xs text-muted-foreground mt-1">Produtos</p>
                </div>
              </CardContent>
            </Card>

            <Card className="cursor-pointer border-border hover:border-purple-500 transition-all hover:bg-purple-500/5 shadow-sm" onClick={() => navigate('/clientes')}>
              <CardContent className="flex flex-col items-center justify-center p-6 gap-3">
                <div className="p-3 bg-purple-500/10 rounded-full text-purple-500">
                  <Users className="w-8 h-8" />
                </div>
                <div className="text-center">
                  <h3 className="font-semibold">CRM</h3>
                  <p className="text-xs text-muted-foreground mt-1">Clientes</p>
                </div>
              </CardContent>
            </Card>

            <Card className="cursor-pointer border-border hover:border-green-500 transition-all hover:bg-green-500/5 shadow-sm" onClick={() => navigate('/financeiro')}>
              <CardContent className="flex flex-col items-center justify-center p-6 gap-3">
                <div className="p-3 bg-green-500/10 rounded-full text-green-500">
                  <DollarSign className="w-8 h-8" />
                </div>
                <div className="text-center">
                  <h3 className="font-semibold">Financeiro</h3>
                  <p className="text-xs text-muted-foreground mt-1">Fluxo de Caixa</p>
                </div>
              </CardContent>
            </Card>

            <Card className="cursor-pointer border-border hover:border-zinc-500 transition-all hover:bg-zinc-500/5 shadow-sm" onClick={() => navigate('/configuracoes')}>
              <CardContent className="flex flex-col items-center justify-center p-6 gap-3">
                <div className="p-3 bg-zinc-500/10 rounded-full text-zinc-500">
                  <Settings className="w-8 h-8" />
                </div>
                <div className="text-center">
                  <h3 className="font-semibold">Ajustes</h3>
                  <p className="text-xs text-muted-foreground mt-1">Empresa</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <Card className="border-border">
          <CardHeader>
            <CardTitle>Vendas Recentes</CardTitle>
            <CardDescription>Últimas 10 transações realizadas no PDV ou aprovadas da internet.</CardDescription>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <div className="min-w-[800px] border-0">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="px-4 py-3 font-medium">Data / Hora</th>
                    <th className="px-4 py-3 font-medium">ID Pedido</th>
                    <th className="px-4 py-3 font-medium">Cliente</th>
                    <th className="px-4 py-3 font-medium">Total</th>
                    <th className="px-4 py-3 font-medium text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {recentSales.map((sale) => (
                    <tr key={sale.id} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="px-4 py-3 text-muted-foreground">
                        {new Date(sale.created_at).toLocaleString('pt-BR')}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {sale.id.slice(0, 8)}
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {sale.customers?.name || "Consumidor Final"}
                      </td>
                      <td className="px-4 py-3 font-bold text-primary">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(sale.total_amount)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground h-8 px-2 mr-2" onClick={() => handleReprintSale(sale)}>
                          <Printer className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="text-destructive h-8 px-2" onClick={() => handleDeleteSale(sale.id)}>
                          Excluir
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {recentSales.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center p-8 text-muted-foreground">
                        Nenhuma venda registrada ainda.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>

    {/* Cupom Não Fiscal para Impressão (Fica oculto na tela normal, visível apenas na impressão) */}
    {receiptData && (
        <div className="hidden print:block absolute top-0 left-0 w-full bg-white text-black p-4 text-xs font-mono">
          <div className="text-center mb-4">
            <h2 className="text-lg font-bold">{receiptData.tenant.toUpperCase()}</h2>
            <p>CNPJ: {profile?.tenants?.document || '00.000.000/0001-00'}</p>
            <p>{profile?.tenants?.address || 'Endereço da Loja'}</p>
            <p>====================================</p>
            <h3 className="font-bold mt-2">CUPOM NÃO FISCAL - VIA LOJA</h3>
            <p>Data: {receiptData.date}</p>
          </div>

          <table className="w-full text-left border-collapse mb-4">
            <thead>
              <tr className="border-b border-dashed border-black">
                <th className="py-1">QTD</th>
                <th className="py-1">DESCRIÇÃO</th>
                <th className="py-1 text-right">VL.UN</th>
                <th className="py-1 text-right">VL.TOT</th>
              </tr>
            </thead>
            <tbody>
              {receiptData.items.map((item: any, i: number) => (
                <tr key={i}>
                  <td className="py-1 align-top">{item.cartQuantity}x</td>
                  <td className="py-1 break-words">{item.name}</td>
                  <td className="py-1 text-right align-top">{item.price.toFixed(2)}</td>
                  <td className="py-1 text-right align-top">{(item.price * item.cartQuantity).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="border-t border-dashed border-black pt-2 space-y-1">
            <div className="flex justify-between">
              <span>SUBTOTAL:</span>
              <span>R$ {receiptData.subtotal.toFixed(2)}</span>
            </div>
            {receiptData.discount > 0 && (
              <div className="flex justify-between">
                <span>DESCONTO:</span>
                <span>- R$ {receiptData.discount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-sm mt-2 pt-2 border-t border-black">
              <span>TOTAL A PAGAR:</span>
              <span>R$ {receiptData.total.toFixed(2)}</span>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-dashed border-black text-center space-y-1">
            <p className="font-bold">CLIENTE</p>
            <p>{receiptData.customer?.name || 'Consumidor Final'}</p>
            {receiptData.customer?.document && <p>CPF/CNPJ: {receiptData.customer.document}</p>}
            <br />
            <p>Obrigado pela preferência!</p>
            <p>Volte sempre.</p>
          </div>
        </div>
      )}
    </>
  )
}
