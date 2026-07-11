import { useEffect, useState, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "../../lib/supabase"
import { Button } from "../../components/ui/button"
import { Input } from "../../components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card"
import { LogOut, LayoutDashboard, ShoppingCart, Users, Package, DollarSign, Printer, Settings, Menu, X, Truck, FileText, Crown, Lock } from "lucide-react"
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, BarChart, Bar } from "recharts"

const COLORS = ['#a855f7', '#6366f1', '#06b6d4', '#3b82f6', '#14b8a6', '#64748b']

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
  const [salesChartData, setSalesChartData] = useState<any[]>([])
  const [expenseChartData, setExpenseChartData] = useState<any[]>([])
  const [topProductsData, setTopProductsData] = useState<any[]>([])

  // Date Picker State para o Dashboard
  const [startDate, setStartDate] = useState(() => {
    return new Date().toISOString().split('T')[0]
  })
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0]
  })

  const loadMetrics = useCallback(async () => {
    // Corrige fuso horário para bater exatamente com o dia local do lojista
    const startOfDay = new Date(startDate + 'T00:00:00')
    const endOfDay = new Date(endDate + 'T23:59:59.999')
    
    // Vendas no período selecionado (puxa o timestamp de criação para agrupamento por dia)
    const { data: salesToday } = await supabase
      .from('sales')
      .select('total_amount, created_at')
      .eq('status', 'paid')
      .gte('created_at', startOfDay.toISOString())
      .lte('created_at', endOfDay.toISOString())
      
    const totalVendas = salesToday?.reduce((acc, sale) => acc + Number(sale.total_amount), 0) || 0
    const qtdPedidos = salesToday?.length || 0

    // Agrupar vendas por dia para o gráfico de linhas
    const salesByDay: { [key: string]: number } = {}
    salesToday?.forEach(sale => {
      const dateKey = new Date(sale.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
      salesByDay[dateKey] = (salesByDay[dateKey] || 0) + Number(sale.total_amount)
    })
    const formattedSalesChart = Object.keys(salesByDay).map(day => ({
      date: day,
      valor: salesByDay[day]
    })).sort((a, b) => a.date.localeCompare(b.date))
    setSalesChartData(formattedSalesChart)

    // Alerta de Estoque Baixo
    const { data: { user } } = await supabase.auth.getUser()
    const { data: products } = user
      ? await supabase.from('products').select('stock_quantity, min_stock').eq('tenant_id', user.id)
      : { data: [] }
    const lowStock = products?.filter(p => p.stock_quantity <= (p.min_stock || 5))?.length || 0

    // Contas a Receber Vencidas
    const { data: overdue } = await supabase
      .from('financial_transactions')
      .select('amount')
      .eq('type', 'receivable')
      .eq('status', 'pending')
      .lt('due_date', new Date().toISOString().split('T')[0])
      
    const totalVencido = overdue?.reduce((acc, t) => acc + Number(t.amount), 0) || 0

    // Saldo Pendente (Aguardando Retirada ou A Prazo Pendente ou Venda Online Pendente)
    const { data: pendingSales } = await supabase
      .from('sales')
      .select('total_amount')
      .in('status', ['awaiting_pickup', 'pending', 'pending_online'])

    const totalPendente = pendingSales?.reduce((acc, sale) => acc + Number(sale.total_amount), 0) || 0

    setMetrics({
      vendasHoje: totalVendas,
      qtdPedidosHoje: qtdPedidos,
      contasVencidas: totalVencido,
      qtdVencidas: overdue?.length || 0,
      alertaEstoque: lowStock,
      saldoPendente: totalPendente
    })

    // Transações de despesas pagas no período para gráfico de pizza
    const { data: expenses } = await supabase
      .from('financial_transactions')
      .select('amount, category')
      .eq('type', 'payable')
      .eq('status', 'paid')
      .gte('due_date', startDate)
      .lte('due_date', endDate)

    const expenseByCategory: { [key: string]: number } = {}
    expenses?.forEach(exp => {
      const cat = exp.category || 'Outros'
      expenseByCategory[cat] = (expenseByCategory[cat] || 0) + Number(exp.amount)
    })
    const formattedExpenseChart = Object.keys(expenseByCategory).map(cat => ({
      name: cat,
      value: expenseByCategory[cat]
    }))
    setExpenseChartData(formattedExpenseChart)

    // Busca itens de vendas no período para ranking de produtos
    const { data: saleItems } = await supabase
      .from('sale_items')
      .select('quantity, products(name)')
      .gte('created_at', startOfDay.toISOString())
      .lte('created_at', endOfDay.toISOString())

    const productsVolume: { [key: string]: number } = {}
    saleItems?.forEach(item => {
      const pName = (Array.isArray(item.products) ? item.products[0]?.name : (item.products as any)?.name) || 'Produto Excluído'
      productsVolume[pName] = (productsVolume[pName] || 0) + Number(item.quantity)
    })
    const formattedTopProducts = Object.keys(productsVolume).map(pName => ({
      name: pName,
      vendas: productsVolume[pName]
    })).sort((a, b) => b.vendas - a.vendas).slice(0, 5)
    setTopProductsData(formattedTopProducts)

    // Últimas Vendas
    const { data: recentData } = await supabase
      .from('sales')
      .select('*, customers(name)')
      .order('created_at', { ascending: false })
      .limit(10)
      
    setRecentSales(recentData || [])
  }, [startDate, endDate])

  const checkAccess = useCallback(async () => {
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
    }
    
    setLoading(false)
  }, [navigate])

  useEffect(() => {
    checkAccess()
  }, [checkAccess])

  useEffect(() => {
    // Carrega apenas no início
    if (profile) loadMetrics()
  }, [profile, loadMetrics])

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

  const isTrial = profile?.tenants?.subscription_status === 'trialing' && profile?.tenants?.trial_ends_at && new Date(profile?.tenants?.trial_ends_at) > new Date();
  const hasPrataAccess = isTrial || profile?.tenants?.plan === 'prata' || profile?.tenants?.plan === 'ouro';
  const hasOuroAccess = isTrial || profile?.tenants?.plan === 'ouro';

  return (
    <>
    <div className="min-h-screen bg-[#020617] flex flex-col md:flex-row dark print:hidden text-foreground relative overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute top-[-30%] left-[-10%] w-[600px] h-[600px] bg-purple-600/5 rounded-full blur-[180px] pointer-events-none" />
      <div className="absolute bottom-[-30%] right-[-10%] w-[600px] h-[600px] bg-cyan-500/5 rounded-full blur-[180px] pointer-events-none" />

      {/* Topbar Mobile */}
      <div className="md:hidden flex items-center justify-between p-4 border-b border-white/5 bg-slate-950/50 backdrop-blur-xl z-50 sticky top-0">
        <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
          <LayoutDashboard className="w-5 h-5 text-purple-400" /> {profile?.tenants?.name || 'Sua Empresa'}
        </h2>
        <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="text-white hover:bg-white/5">
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </Button>
      </div>

      {/* Sidebar Tenant */}
      <aside className={`w-full md:w-64 border-r border-white/5 bg-slate-950/40 backdrop-blur-xl flex-col absolute md:relative z-40 h-[calc(100vh-73px)] md:h-screen transition-transform duration-300 ease-in-out ${isMobileMenuOpen ? 'translate-x-0 flex' : '-translate-x-full md:translate-x-0 hidden md:flex'} top-[73px] md:top-0`}>
        <div className="p-6 hidden md:block border-b border-white/5">
          <h2 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
            <LayoutDashboard className="w-5 h-5 text-purple-400" /> {profile?.tenants?.name || 'Sua Empresa'}
          </h2>
          <p className="text-[10px] font-mono text-purple-400 uppercase tracking-widest mt-1">
            Olá, {profile?.full_name || 'Usuário'} ({profile?.tenants?.role === 'cashier' ? 'Caixa' : (profile?.tenants?.role === 'manager' ? 'Gerente' : 'Admin')})
          </p>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          <Button variant="secondary" className="w-full justify-start gap-2 bg-white/5 text-white border-0 hover:bg-white/10" onClick={() => navigate('/dashboard')}>
            <LayoutDashboard className="w-4 h-4 text-purple-400" /> Visão Geral
          </Button>
          <Button variant="ghost" className="w-full justify-start gap-2 text-zinc-400 hover:text-white hover:bg-white/5" onClick={() => navigate('/pdv')}>
            <ShoppingCart className="w-4 h-4" /> PDV (Vendas)
          </Button>
          <Button variant="ghost" className="w-full justify-start gap-2 text-zinc-400 hover:text-white hover:bg-white/5" onClick={() => navigate('/produtos')}>
            <Package className="w-4 h-4" /> Estoque & Produtos
          </Button>
          <Button variant="ghost" className={`w-full justify-start gap-2 text-zinc-400 hover:text-white hover:bg-white/5 ${!hasPrataAccess && 'opacity-70'}`} onClick={() => hasPrataAccess ? navigate('/clientes') : navigate('/planos?blocked=true')}>
            <Users className="w-4 h-4" /> CRM (Clientes) {!hasPrataAccess && <Lock className="w-3 h-3 ml-auto text-zinc-600" />}
          </Button>
          <Button variant="ghost" className={`w-full justify-start gap-2 text-zinc-400 hover:text-white hover:bg-white/5 ${!hasOuroAccess && 'opacity-70'}`} onClick={() => hasOuroAccess ? navigate('/clube-membros') : navigate('/planos?blocked=true')}>
            <Crown className="w-4 h-4 text-purple-400" /> Club de Membros {!hasOuroAccess && <Lock className="w-3 h-3 ml-auto text-zinc-600" />}
          </Button>
          <Button variant="ghost" className={`w-full justify-start gap-2 text-zinc-400 hover:text-white hover:bg-white/5 ${!hasPrataAccess && 'opacity-70'}`} onClick={() => hasPrataAccess ? navigate('/fornecedores') : navigate('/planos?blocked=true')}>
            <Truck className="w-4 h-4" /> Fornecedores {!hasPrataAccess && <Lock className="w-3 h-3 ml-auto text-zinc-600" />}
          </Button>
          <Button variant="ghost" className={`w-full justify-start gap-2 text-zinc-400 hover:text-white hover:bg-white/5 ${!hasPrataAccess && 'opacity-70'}`} onClick={() => hasPrataAccess ? navigate('/orcamentos') : navigate('/planos?blocked=true')}>
            <FileText className="w-4 h-4" /> Orçamentos {!hasPrataAccess && <Lock className="w-3 h-3 ml-auto text-zinc-600" />}
          </Button>
          {profile?.tenants?.role !== 'cashier' && (
            <Button variant="ghost" className={`w-full justify-start gap-2 text-zinc-400 hover:text-white hover:bg-white/5 ${!hasPrataAccess && 'opacity-70'}`} onClick={() => hasPrataAccess ? navigate('/financeiro') : navigate('/planos?blocked=true')}>
              <DollarSign className="w-4 h-4" /> Financeiro {!hasPrataAccess && <Lock className="w-3 h-3 ml-auto text-zinc-600" />}
            </Button>
          )}
          {profile?.tenants?.role !== 'cashier' && (
            <Button variant="ghost" className="w-full justify-start gap-2 text-zinc-400 hover:text-white hover:bg-white/5" onClick={() => navigate('/configuracoes')}>
              <Settings className="w-4 h-4" /> Configurações
            </Button>
          )}
          {profile?.tenants?.role !== 'cashier' && (
            <Button variant="ghost" className="w-full justify-start gap-2 text-zinc-400 hover:text-white hover:bg-white/5" onClick={() => navigate('/planos')}>
              <Crown className="w-4 h-4 text-yellow-400" /> Planos & Assinatura
            </Button>
          )}
        </nav>
        <div className="p-4 border-t border-white/5">
          <Button variant="ghost" className="w-full justify-start gap-2 text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10" onClick={handleLogout}>
            <LogOut className="w-4 h-4" /> Sair da Conta
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto z-10">
        <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">Visão Geral</h1>
            <p className="text-zinc-400 mt-1 text-sm">Resumo financeiro e de operações em tempo real.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto bg-glass p-2 rounded-lg border border-white/5 shadow-lg">
            <span className="text-xs font-mono text-zinc-400 uppercase px-2">Filtrar período</span>
            <Input 
              type="date" 
              className="w-auto h-9 bg-slate-900 border-white/5 focus:border-purple-500 focus:ring-purple-500/25 transition-all text-white placeholder:text-zinc-600 font-mono text-xs dark:[color-scheme:dark]" 
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <span className="text-xs font-mono text-zinc-500">até</span>
            <Input 
              type="date" 
              className="w-auto h-9 bg-slate-900 border-white/5 focus:border-purple-500 focus:ring-purple-500/25 transition-all text-white placeholder:text-zinc-600 font-mono text-xs dark:[color-scheme:dark]" 
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
            <Button onClick={() => loadMetrics()} className="h-9 bg-purple-600 hover:bg-purple-500 text-white font-semibold shadow-md shadow-purple-600/10 border-0">
              Filtrar
            </Button>
          </div>
        </div>

        {/* Resumo Rápido */}
        <div className={`grid grid-cols-1 md:grid-cols-2 ${profile?.tenants?.role === 'cashier' ? 'lg:grid-cols-3' : 'lg:grid-cols-4'} gap-4 md:gap-6 mb-8`}>
          <Card className="bg-glass border border-white/5 hover:border-emerald-500/30 transition-all bg-glass-hover">
            <CardHeader className="pb-2">
              <CardDescription className="text-zinc-400 font-medium text-xs uppercase tracking-wider">Vendas no Período</CardDescription>
              <CardTitle className="text-3xl font-black text-emerald-400">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(metrics.vendasHoje)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-zinc-500 font-mono">{metrics.qtdPedidosHoje} liquidadas com sucesso</p>
            </CardContent>
          </Card>
          
          <Card className="bg-glass border border-white/5 hover:border-cyan-500/30 transition-all bg-glass-hover">
            <CardHeader className="pb-2">
              <CardDescription className="text-zinc-400 font-medium text-xs uppercase tracking-wider">Saldo Pendente (Vitrine)</CardDescription>
              <CardTitle className="text-3xl font-black text-cyan-400">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(metrics.saldoPendente)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-zinc-500 font-mono">aguardando retirada ou entrega</p>
            </CardContent>
          </Card>

          {profile?.tenants?.role !== 'cashier' && (
            <Card className="bg-glass border border-white/5 hover:border-amber-500/30 transition-all bg-glass-hover">
              <CardHeader className="pb-2">
                <CardDescription className="text-zinc-400 font-medium text-xs uppercase tracking-wider">Contas Vencidas</CardDescription>
                <CardTitle className="text-3xl font-black text-amber-400">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(metrics.contasVencidas)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-zinc-500 font-mono">{metrics.qtdVencidas} faturas em atraso</p>
              </CardContent>
            </Card>
          )}

          <Card className="bg-glass border border-white/5 hover:border-rose-500/30 transition-all bg-glass-hover">
            <CardHeader className="pb-2">
              <CardDescription className="text-zinc-400 font-medium text-xs uppercase tracking-wider">Alerta Estoque</CardDescription>
              <CardTitle className="text-3xl font-black text-rose-400">{metrics.alertaEstoque}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-zinc-500 font-mono">itens abaixo do mínimo definido</p>
            </CardContent>
          </Card>
        </div>

        {/* Gráficos de BI (Área & Pizza) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <Card className={`${profile?.tenants?.role === 'cashier' ? 'lg:col-span-3' : 'lg:col-span-2'} bg-glass border border-white/5 p-6 flex flex-col justify-between`}>
            <div>
              <h3 className="font-extrabold text-white text-base">Evolução de Vendas</h3>
              <p className="text-zinc-500 text-xs mt-1">Faturamento acumulado por dia no período.</p>
            </div>
            <div className="h-[280px] w-full mt-4">
              {salesChartData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-zinc-600 text-xs">Nenhuma venda no período.</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={salesChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorValor" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#a855f7" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#a855f7" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" stroke="#4b5563" fontSize={11} tickLine={false} />
                    <YAxis stroke="#4b5563" fontSize={11} tickLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#374151', color: '#fff' }} />
                    <Area type="monotone" dataKey="valor" name="Vendas (R$)" stroke="#a855f7" strokeWidth={2} fillOpacity={1} fill="url(#colorValor)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </Card>

          {profile?.tenants?.role !== 'cashier' && (
            <Card className="lg:col-span-1 bg-glass border border-white/5 p-6 flex flex-col justify-between">
              <div>
                <h3 className="font-extrabold text-white text-base">Despesas por Categoria</h3>
                <p className="text-zinc-500 text-xs mt-1">Distribuição de gastos liquidados no período.</p>
              </div>
              <div className="h-[280px] w-full mt-4 flex items-center justify-center">
                {expenseChartData.length === 0 ? (
                  <div className="text-zinc-600 text-xs">Nenhuma despesa registrada.</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={expenseChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {expenseChartData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#374151', color: '#fff' }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>
          )}
        </div>

        {/* Acesso Rápido (Funções do Site) */}
        <div className="mb-8">
          <h2 className="text-lg font-bold text-white mb-4 uppercase tracking-wider text-xs">Atalhos do Painel</h2>
          <div className={`grid grid-cols-2 ${profile?.tenants?.role === 'cashier' ? 'lg:grid-cols-4' : 'lg:grid-cols-6'} gap-3 md:gap-4`}>
            <Card className="cursor-pointer bg-glass border border-white/5 hover:border-purple-500/30 transition-all bg-glass-hover shadow-lg" onClick={() => navigate('/pdv')}>
              <CardContent className="flex flex-col items-center justify-center p-6 gap-3">
                <div className="p-3 bg-purple-500/10 rounded-full text-purple-400 border border-purple-500/20">
                  <ShoppingCart className="w-6 h-6" />
                </div>
                <div className="text-center">
                  <h3 className="font-semibold text-white text-sm">Frente PDV</h3>
                  <p className="text-[10px] text-zinc-500 mt-0.5">Realizar Vendas</p>
                </div>
              </CardContent>
            </Card>

            <Card className="cursor-pointer bg-glass border border-white/5 hover:border-blue-500/30 transition-all bg-glass-hover shadow-lg" onClick={() => navigate('/produtos')}>
              <CardContent className="flex flex-col items-center justify-center p-6 gap-3">
                <div className="p-3 bg-blue-500/10 rounded-full text-blue-400 border border-blue-500/20">
                  <Package className="w-6 h-6" />
                </div>
                <div className="text-center">
                  <h3 className="font-semibold text-white text-sm">Estoque</h3>
                  <p className="text-[10px] text-zinc-500 mt-0.5">Gerenciar Produtos</p>
                </div>
              </CardContent>
            </Card>

            <Card className={`cursor-pointer bg-glass border border-white/5 hover:border-indigo-500/30 transition-all bg-glass-hover shadow-lg ${!hasPrataAccess && 'opacity-60'}`} onClick={() => hasPrataAccess ? navigate('/clientes') : navigate('/planos?blocked=true')}>
              <CardContent className="flex flex-col items-center justify-center p-6 gap-3 relative">
                {!hasPrataAccess && <Lock className="w-4 h-4 text-zinc-500 absolute top-3 right-3" />}
                <div className="p-3 bg-indigo-500/10 rounded-full text-indigo-400 border border-indigo-500/20">
                  <Users className="w-6 h-6" />
                </div>
                <div className="text-center">
                  <h3 className="font-semibold text-white text-sm">CRM</h3>
                  <p className="text-[10px] text-zinc-500 mt-0.5">Base Clientes</p>
                </div>
              </CardContent>
            </Card>

            <Card className={`cursor-pointer bg-glass border border-white/5 hover:border-purple-500/30 transition-all bg-glass-hover shadow-lg ${!hasOuroAccess && 'opacity-60'}`} onClick={() => hasOuroAccess ? navigate('/clube-membros') : navigate('/planos?blocked=true')}>
              <CardContent className="flex flex-col items-center justify-center p-6 gap-3 relative">
                {!hasOuroAccess && <Lock className="w-4 h-4 text-zinc-500 absolute top-3 right-3" />}
                <div className={`p-3 bg-purple-500/10 rounded-full text-purple-400 border border-purple-500/20 ${hasOuroAccess && 'animate-pulse'}`}>
                  <Crown className="w-6 h-6" />
                </div>
                <div className="text-center">
                  <h3 className="font-semibold text-white text-sm">Clube VIP</h3>
                  <p className="text-[10px] text-zinc-500 mt-0.5">Club de Membros</p>
                </div>
              </CardContent>
            </Card>

            {profile?.tenants?.role !== 'cashier' && (
              <Card className={`cursor-pointer bg-glass border border-white/5 hover:border-emerald-500/30 transition-all bg-glass-hover shadow-lg ${!hasPrataAccess && 'opacity-60'}`} onClick={() => hasPrataAccess ? navigate('/financeiro') : navigate('/planos?blocked=true')}>
                <CardContent className="flex flex-col items-center justify-center p-6 gap-3 relative">
                  {!hasPrataAccess && <Lock className="w-4 h-4 text-zinc-500 absolute top-3 right-3" />}
                  <div className="p-3 bg-emerald-500/10 rounded-full text-emerald-400 border border-emerald-500/20">
                    <DollarSign className="w-6 h-6" />
                  </div>
                  <div className="text-center">
                    <h3 className="font-semibold text-white text-sm">Finanças</h3>
                    <p className="text-[10px] text-zinc-500 mt-0.5">Fluxo de Caixa</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {profile?.tenants?.role !== 'cashier' && (
              <Card className="cursor-pointer bg-glass border border-white/5 hover:border-zinc-500/30 transition-all bg-glass-hover shadow-lg" onClick={() => navigate('/configuracoes')}>
                <CardContent className="flex flex-col items-center justify-center p-6 gap-3">
                  <div className="p-3 bg-zinc-500/10 rounded-full text-zinc-400 border border-zinc-500/20">
                    <Settings className="w-6 h-6" />
                  </div>
                  <div className="text-center">
                    <h3 className="font-semibold text-white text-sm">Configuração</h3>
                    <p className="text-[10px] text-zinc-500 mt-0.5">Ajustes Gerais</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-1 bg-glass border border-white/5 p-6 flex flex-col justify-between">
            <div>
              <h3 className="font-extrabold text-white text-base">Produtos Mais Vendidos</h3>
              <p className="text-zinc-500 text-xs mt-1">Ranking de itens com maior saída no período.</p>
            </div>
            <div className="h-[250px] w-full mt-4">
              {topProductsData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-zinc-600 text-xs">Nenhum produto vendido no período.</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topProductsData} layout="vertical" margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                    <XAxis type="number" stroke="#4b5563" fontSize={11} tickLine={false} />
                    <YAxis dataKey="name" type="category" stroke="#4b5563" fontSize={10} tickLine={false} width={80} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#374151', color: '#fff' }} />
                    <Bar dataKey="vendas" name="Qtd Vendida" fill="#06b6d4" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </Card>

          <Card className="lg:col-span-2 border-border">
            <CardHeader>
              <CardTitle>Vendas Recentes</CardTitle>
              <CardDescription>Últimas 10 transações realizadas no PDV ou aprovadas da internet.</CardDescription>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <div className="min-w-[500px] border-0">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="px-4 py-3 font-medium">Data / Hora</th>
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
                          {profile?.tenants?.role !== 'cashier' && (
                            <Button variant="ghost" size="sm" className="text-destructive h-8 px-2" onClick={() => handleDeleteSale(sale.id)}>
                              Excluir
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {recentSales.length === 0 && (
                      <tr>
                        <td colSpan={4} className="text-center p-8 text-muted-foreground">
                          Nenhuma venda registrada ainda.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
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
