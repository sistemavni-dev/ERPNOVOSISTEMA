import { useState, useEffect, useCallback } from "react"
import { supabase } from "../../lib/supabase"
import { Button } from "../../components/ui/button"
import { Input } from "../../components/ui/input"
import { Card, CardTitle, CardContent, CardDescription, CardHeader } from "../../components/ui/card"
import { Trophy, Target, DollarSign, Users, Plus, Edit, Trash, Save, X, ArrowLeft, TrendingUp } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { ThemeToggle } from "../../components/ThemeToggle"

interface Seller {
  id: string;
  name: string;
  commission_percentage: number;
  current_level: string;
  monthly_target: number;
}

export default function Commissions() {
  const [sellers, setSellers] = useState<Seller[]>([])
  const [loading, setLoading] = useState(true)
  const [isEditing, setIsEditing] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  
  // Dashboard Metrics
  const [dashboardData, setDashboardData] = useState<any[]>([])
  const [totalCommission, setTotalCommission] = useState(0)

  // Form State
  const [formData, setFormData] = useState<Partial<Seller>>({
    name: "",
    commission_percentage: 0,
    current_level: "Bronze",
    monthly_target: 1000
  })

  const navigate = useNavigate()

  const fetchSellersAndMetrics = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Busca vendedores
    const { data: sellersData } = await supabase
      .from('sellers')
      .select('*')
      .eq('tenant_id', user.id)
      .order('name')
    
    setSellers(sellersData || [])

    // Busca vendas do mês atual
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0,0,0,0)

    const { data: salesData } = await supabase
      .from('sales')
      .select('seller_id, total_amount')
      .eq('tenant_id', user.id)
      .gte('created_at', startOfMonth.toISOString())
      .in('status', ['paid', 'pending', 'awaiting_pickup', 'pending_online'])
      .not('seller_id', 'is', null)

    // Agrupa e calcula comissões
    const metricsMap = new Map()
    let totalComm = 0

    if (sellersData && salesData) {
      sellersData.forEach(seller => {
        metricsMap.set(seller.id, {
          ...seller,
          total_sold: 0,
          commission_earned: 0
        })
      })

      salesData.forEach(sale => {
        if (sale.seller_id && metricsMap.has(sale.seller_id)) {
          const sellerObj = metricsMap.get(sale.seller_id)
          const saleValue = Number(sale.total_amount)
          sellerObj.total_sold += saleValue
          
          const commissionVal = saleValue * (Number(sellerObj.commission_percentage) / 100)
          sellerObj.commission_earned += commissionVal
          totalComm += commissionVal
        }
      })
    }

    setDashboardData(Array.from(metricsMap.values()))
    setTotalCommission(totalComm)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchSellersAndMetrics()
  }, [fetchSellersAndMetrics])

  const handleSave = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    if (isEditing) {
      await supabase
        .from('sellers')
        .update({
          name: formData.name,
          commission_percentage: formData.commission_percentage,
          current_level: formData.current_level,
          monthly_target: formData.monthly_target
        })
        .eq('id', isEditing)
    } else {
      await supabase
        .from('sellers')
        .insert([{
          tenant_id: user.id,
          name: formData.name,
          commission_percentage: formData.commission_percentage,
          current_level: formData.current_level,
          monthly_target: formData.monthly_target
        }])
    }

    setIsCreating(false)
    setIsEditing(null)
    setFormData({ name: "", commission_percentage: 0, current_level: "Bronze", monthly_target: 1000 })
    fetchSellersAndMetrics()
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja remover este vendedor? O histórico de vendas continuará, mas sem a referência a ele.")) return
    await supabase.from('sellers').delete().eq('id', id)
    fetchSellersAndMetrics()
  }

  const editSeller = (seller: Seller) => {
    setFormData(seller)
    setIsEditing(seller.id)
    setIsCreating(true)
  }

  const calculateProgress = (sold: number, target: number) => {
    if (!target || target === 0) return 0
    const perc = (sold / target) * 100
    return perc > 100 ? 100 : perc
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-background text-foreground">Carregando painel de metas...</div>
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8 overflow-y-auto relative">
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-yellow-500/10 rounded-full blur-[120px] pointer-events-none" />
      
      <div className="flex items-center justify-between mb-8 relative z-10">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="w-6 h-6" />
          </Button>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-3">
              <Trophy className="w-8 h-8 text-yellow-500" /> Comissões & Metas
            </h1>
            <p className="text-muted-foreground mt-1">Gamificação de Vendas e Gestão de Vendedores</p>
          </div>
        </div>
        <ThemeToggle />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 relative z-10">
        <Card className="bg-glass border-yellow-500/30 bg-glass-hover">
          <CardHeader className="pb-2">
            <CardDescription className="uppercase tracking-wider text-xs font-bold text-muted-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" /> Total Comissões (Mês)
            </CardDescription>
            <CardTitle className="text-4xl font-black text-emerald-500">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalCommission)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground font-mono">Total a ser pago referente às vendas do mês atual.</p>
          </CardContent>
        </Card>

        <Card className="bg-glass border-border shadow-lg">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <div>
              <CardDescription className="uppercase tracking-wider text-xs font-bold text-muted-foreground flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-400" /> Equipe de Vendas
              </CardDescription>
              <CardTitle className="text-4xl font-black">{sellers.length}</CardTitle>
            </div>
            {!isCreating && (
              <Button onClick={() => setIsCreating(true)} className="bg-purple-600 hover:bg-purple-500 font-bold">
                <Plus className="w-4 h-4 mr-2" /> Cadastrar Vendedor
              </Button>
            )}
          </CardHeader>
        </Card>
      </div>

      {isCreating && (
        <Card className="mb-8 border-purple-500/50 shadow-xl shadow-purple-500/10 relative z-10">
          <CardHeader>
            <CardTitle>{isEditing ? 'Editar Vendedor' : 'Novo Vendedor'}</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold">Nome</label>
              <Input 
                value={formData.name} 
                onChange={e => setFormData({...formData, name: e.target.value})} 
                placeholder="Ex: João Silva"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Comissão (%)</label>
              <Input 
                type="number" 
                step="0.1" 
                value={formData.commission_percentage} 
                onChange={e => setFormData({...formData, commission_percentage: Number(e.target.value)})} 
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Nível (Ex: Prata)</label>
              <Input 
                value={formData.current_level} 
                onChange={e => setFormData({...formData, current_level: e.target.value})} 
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Meta Mensal (R$)</label>
              <Input 
                type="number" 
                value={formData.monthly_target} 
                onChange={e => setFormData({...formData, monthly_target: Number(e.target.value)})} 
              />
            </div>
            <div className="md:col-span-4 flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => { setIsCreating(false); setIsEditing(null); }}>
                <X className="w-4 h-4 mr-2" /> Cancelar
              </Button>
              <Button className="bg-emerald-600 hover:bg-emerald-500" onClick={handleSave} disabled={!formData.name}>
                <Save className="w-4 h-4 mr-2" /> Salvar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative z-10">
        {dashboardData.map(seller => {
          const progress = calculateProgress(seller.total_sold, seller.monthly_target)
          
          return (
            <Card key={seller.id} className="bg-glass border-border hover:border-purple-500/50 transition-all group">
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-lg">{seller.name}</h3>
                    <div className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border border-yellow-500/20 mt-1">
                      Nível {seller.current_level}
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-400" onClick={() => editSeller(seller)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-400" onClick={() => handleDelete(seller.id)}>
                      <Trash className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-end border-b border-border/50 pb-2">
                    <span className="text-sm text-muted-foreground">Vendido no Mês</span>
                    <span className="font-bold text-primary">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(seller.total_sold)}
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-end border-b border-border/50 pb-2">
                    <span className="text-sm text-muted-foreground flex items-center gap-1">
                      <Target className="w-4 h-4 text-rose-400" /> Meta ({new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(seller.monthly_target)})
                    </span>
                    <span className="font-bold text-emerald-400">
                      {progress.toFixed(1)}%
                    </span>
                  </div>

                  {/* Progress Bar Gamification */}
                  <div className="w-full bg-secondary rounded-full h-2.5 overflow-hidden">
                    <div 
                      className={`h-2.5 rounded-full transition-all duration-1000 ${progress >= 100 ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]' : 'bg-purple-500'}`} 
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  {progress >= 100 && (
                    <p className="text-[10px] text-emerald-400 text-center font-bold animate-pulse">Meta Batida! 🎉</p>
                  )}

                  <div className="bg-primary/5 rounded-lg p-3 mt-4 flex justify-between items-center border border-primary/10">
                    <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                      <DollarSign className="w-3 h-3 text-emerald-500" /> Comissão ({seller.commission_percentage}%)
                    </span>
                    <span className="font-black text-emerald-500">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(seller.commission_earned)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}

        {dashboardData.length === 0 && !isCreating && (
          <div className="col-span-full text-center p-12 text-muted-foreground border-2 border-dashed border-border rounded-lg bg-glass">
            <Trophy className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p className="font-semibold text-lg">Nenhum vendedor cadastrado</p>
            <p className="text-sm mt-1 mb-4">Adicione sua equipe para acompanhar as metas e comissões.</p>
            <Button onClick={() => setIsCreating(true)} className="bg-purple-600 hover:bg-purple-500 font-bold">
              <Plus className="w-4 h-4 mr-2" /> Cadastrar Primeiro Vendedor
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
