import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "../../lib/supabase"
import { Button } from "../../components/ui/button"
import { Input } from "../../components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card"
import { Users, Plus, Trash2, CheckCircle, Clock, ArrowLeft, Wallet } from "lucide-react"

export default function Customers() {
  const [customers, setCustomers] = useState<any[]>([])
  const [pendingOrders, setPendingOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [tenantPlan, setTenantPlan] = useState<string | null>(null)
  const [search] = useState("")
  const navigate = useNavigate()

  // Form states
  const [name, setName] = useState("")
  const [document, setDocument] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")

  useEffect(() => {
    fetchTenantData()
    fetchCustomers()
    fetchPendingOrders()
  }, [])

  const fetchTenantData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data } = await supabase.from('tenants').select('plan').eq('id', user.id).single()
      if (data) setTenantPlan(data.plan)
    }
  }

  const fetchCustomers = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) console.error(error)
    else setCustomers(data || [])
    setLoading(false)
  }

  const fetchPendingOrders = async () => {
    const { data, error } = await supabase
      .from('sales')
      .select('*, customers(name, phone)')
      .in('status', ['pending_online', 'awaiting_pickup'])
      .order('created_at', { ascending: false })
    
    if (error) console.error(error)
    else setPendingOrders(data || [])
  }

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    // O RLS cuida de pegar o tenant_id do usuário logado
    const { error } = await supabase
      .from('customers')
      .insert([{ name, document, email, phone }])

    if (error) {
      alert("Erro ao adicionar cliente: " + error.message)
    } else {
      setName("")
      setDocument("")
      setEmail("")
      setPhone("")
      fetchCustomers()
    }
    setLoading(false)
  }

  const deleteCustomer = async (id: string) => {
    if(!confirm("Certeza que deseja excluir o cliente?")) return
    await supabase.from('customers').delete().eq('id', id)
    fetchCustomers()
  }

  const updateCashback = async (id: string, currentBalance: number) => {
    const val = prompt(`Informe o novo Saldo de Cashback para este cliente:\n(Atual: R$ ${currentBalance?.toFixed(2) || '0.00'})`, currentBalance?.toString() || "0")
    if (val === null) return
    
    const newBalance = parseFloat(val.replace(',', '.'))
    if (isNaN(newBalance)) {
      alert("Valor inválido. Use apenas números.")
      return
    }

    const { error } = await supabase
      .from('customers')
      .update({ cashback_balance: newBalance })
      .eq('id', id)

    if (error) {
      alert("Erro ao atualizar cashback: " + error.message)
    } else {
      fetchCustomers()
    }
  }

  const handleActionOrder = async (orderId: string, currentStatus: string, customerPhone: string, customerName: string) => {
    setApprovingId(orderId)
    
    let newStatus = ''
    let webhookType = ''
    let alertMessage = ''

    if (currentStatus === 'pending_online') {
      newStatus = 'awaiting_pickup'
      webhookType = 'reservation_approved'
      alertMessage = 'Reserva confirmada! O cliente foi avisado para retirar (Alerta de 4h ativado via webhook).'
    } else if (currentStatus === 'awaiting_pickup') {
      newStatus = 'paid'
      webhookType = 'sale_completed'
      alertMessage = 'Venda liquidada com sucesso! O valor entrou no fluxo de caixa.'
    } else {
      setApprovingId(null)
      return
    }

    const { error } = await supabase
      .from('sales')
      .update({ status: newStatus })
      .eq('id', orderId)
      
    if (error) {
      alert("Erro ao processar pedido: " + error.message)
      setApprovingId(null)
      return
    }

    // Dispara o Webhook avisando o cliente apenas se o plano for OURO
    if (tenantPlan === 'ouro') {
      supabase.functions.invoke('whatsapp-webhook', { 
        body: { 
          type: webhookType,
          sale_id: orderId, 
          customer_name: customerName,
          customer_phone: customerPhone
        } 
      }).catch(console.error)
    }

    alert(alertMessage)
    
    setApprovingId(null)
    fetchPendingOrders()
  }

  const filteredCustomers = customers.filter(c => 
    c.name?.toLowerCase().includes(search.toLowerCase()) || 
    c.document?.includes(search)
  )

  return (
    <div className="p-4 md:p-8 bg-background min-h-screen dark text-foreground">
      <div className="mb-8 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="w-6 h-6" />
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
              <Users className="w-6 h-6 md:w-8 md:h-8 text-primary" /> CRM & Pedidos Online
            </h1>
            <p className="text-muted-foreground mt-1">Gerencie a base de clientes e aprove reservas da Vitrine Virtual.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-8">
          <Card className="border-border">
            <CardHeader>
              <CardTitle>Novo Cliente</CardTitle>
              <CardDescription>Cadastre manualmente para histórico e integração com PDV.</CardDescription>
            </CardHeader>
            <form onSubmit={handleAddCustomer}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nome Completo / Razão Social</label>
                  <Input value={name} onChange={e => setName(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">CPF/CNPJ</label>
                  <Input value={document} onChange={e => setDocument(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">WhatsApp (Com DDD)</label>
                  <Input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="Ex: 5511999999999" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Email</label>
                  <Input type="email" value={email} onChange={e => setEmail(e.target.value)} />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  <Plus className="w-4 h-4 mr-2" /> Salvar Cliente
                </Button>
              </CardContent>
            </form>
          </Card>
        </div>

        {/* Painel Direito (Pedidos e Lista de CRM) */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Sessão de Pedidos Online Pendentes */}
          <Card className="border-primary/50 shadow-lg shadow-primary/10">
            <CardHeader className="bg-primary/5 rounded-t-lg">
              <CardTitle className="flex items-center gap-2 text-primary">
                <Clock className="w-5 h-5" /> Fila de Pedidos da Vitrine
              </CardTitle>
              <CardDescription>
                Aprove os pedidos feitos pelos clientes na internet para confirmar a venda.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 md:p-6 overflow-x-auto">
              <div className="min-w-[800px] border-0 md:rounded-b-md md:border-t md:border-border">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted/30 border-b">
                    <tr>
                      <th className="px-4 py-3 font-medium">Data/Hora</th>
                      <th className="px-4 py-3 font-medium">Cliente (WhatsApp)</th>
                      <th className="px-4 py-3 font-medium">Valor Total</th>
                      <th className="px-4 py-3 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingOrders.map((order) => (
                      <tr key={order.id} className="border-b last:border-0 hover:bg-muted/10">
                        <td className="px-4 py-3 text-muted-foreground">
                          {new Date(order.created_at).toLocaleString('pt-BR')}
                          <div className="mt-1">
                            {order.status === 'pending_online' ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-yellow-500/10 text-yellow-500">Nova Reserva</span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-500/10 text-blue-500">Aguardando Retirada</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-medium">
                          {order.customers?.name || "Cliente Desconhecido"}
                          <div className="text-xs text-muted-foreground font-normal">{order.customers?.phone || ""}</div>
                        </td>
                        <td className="px-4 py-3 font-bold text-primary">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.total_amount)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {order.status === 'pending_online' ? (
                            <Button 
                              variant="default" 
                              size="sm" 
                              className="bg-yellow-600 hover:bg-yellow-700 text-white"
                              onClick={() => handleActionOrder(order.id, order.status, order.customers?.phone, order.customers?.name)}
                              disabled={approvingId === order.id}
                            >
                              {approvingId === order.id ? "..." : <><CheckCircle className="w-4 h-4 mr-2" /> Aprovar Reserva</>}
                            </Button>
                          ) : (
                            <Button 
                              variant="default" 
                              size="sm" 
                              className="bg-green-600 hover:bg-green-700 text-white"
                              onClick={() => handleActionOrder(order.id, order.status, order.customers?.phone, order.customers?.name)}
                              disabled={approvingId === order.id}
                            >
                              {approvingId === order.id ? "..." : <><CheckCircle className="w-4 h-4 mr-2" /> Liquidar Venda</>}
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {loading && pendingOrders.length === 0 && (
                      [...Array(3)].map((_, i) => (
                        <tr key={`skeleton-po-${i}`} className="border-b animate-pulse">
                          <td className="px-4 py-4"><div className="h-4 bg-muted rounded w-32 mb-2"></div><div className="h-4 bg-muted rounded w-20"></div></td>
                          <td className="px-4 py-4"><div className="h-4 bg-muted rounded w-32 mb-2"></div><div className="h-4 bg-muted rounded w-24"></div></td>
                          <td className="px-4 py-4"><div className="h-4 bg-muted rounded w-20"></div></td>
                          <td className="px-4 py-4 text-right"><div className="h-8 bg-muted rounded w-32 ml-auto"></div></td>
                        </tr>
                      ))
                    )}
                    {pendingOrders.length === 0 && !loading && (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                          Nenhum pedido pendente no momento.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Sessão da Carteira de Clientes (CRM Original) */}
          <Card className="border-border">
            <CardHeader>
              <CardTitle>Carteira de Clientes</CardTitle>
              <CardDescription>Todos os clientes físicos e os vindos da internet.</CardDescription>
            </CardHeader>
            <CardContent className="p-0 md:p-6 overflow-x-auto">
              <div className="min-w-[800px] border-0 md:rounded-md md:border mt-4 md:mt-0">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="px-4 py-3 font-medium">Cliente</th>
                      <th className="px-4 py-3 font-medium">Contato</th>
                      <th className="px-4 py-3 font-medium">Documento</th>
                      <th className="px-4 py-3 font-medium">Saldo (Cashback)</th>
                      <th className="px-4 py-3 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCustomers.map((c) => (
                      <tr key={c.id} className="border-b last:border-0 hover:bg-muted/20">
                        <td className="px-4 py-3 font-medium">{c.name}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          <div>{c.phone}</div>
                          <div className="text-xs">{c.email}</div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{c.document}</td>
                        <td className="px-4 py-3 font-bold text-green-500">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(c.cashback_balance || 0)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-green-500 mr-2" onClick={() => updateCashback(c.id, c.cashback_balance || 0)} title="Ajustar Cashback">
                            <Wallet className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteCustomer(c.id)} title="Excluir Cliente">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {loading && customers.length === 0 && (
                      [...Array(5)].map((_, i) => (
                        <tr key={`skeleton-c-${i}`} className="border-b animate-pulse">
                          <td className="px-4 py-4"><div className="h-4 bg-muted rounded w-32"></div></td>
                          <td className="px-4 py-4"><div className="h-4 bg-muted rounded w-24 mb-2"></div><div className="h-3 bg-muted rounded w-32"></div></td>
                          <td className="px-4 py-4"><div className="h-4 bg-muted rounded w-28"></div></td>
                          <td className="px-4 py-4"><div className="h-4 bg-muted rounded w-20"></div></td>
                          <td className="px-4 py-4 text-right"><div className="h-8 bg-muted rounded w-16 ml-auto"></div></td>
                        </tr>
                      ))
                    )}
                    {customers.length === 0 && !loading && (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Nenhum cliente cadastrado.</td>
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
