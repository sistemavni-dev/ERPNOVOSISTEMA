import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "../../lib/supabase"
import { Button } from "../../components/ui/button"
import { Input } from "../../components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card"
import { ArrowLeft, Search, Crown, Sparkles, UserCheck, UserX, Award, ShieldAlert, Wallet } from "lucide-react"

export default function MemberClub() {
  const [customers, setCustomers] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState("")
  const [actionId, setActionId] = useState<string | null>(null)
  const [migrationAlert, setMigrationAlert] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    fetchCustomers()
  }, [])

  const fetchCustomers = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .order('name', { ascending: true })
    
    if (error) {
      console.error(error)
    } else {
      setCustomers(data || [])
    }
    setLoading(false)
  }

  const toggleClubMembership = async (id: string, currentStatus: boolean) => {
    setActionId(id)
    const newStatus = !currentStatus
    const { error } = await supabase
      .from('customers')
      .update({ is_club_member: newStatus })
      .eq('id', id)

    if (error) {
      console.error("Erro ao atualizar clube de membros:", error)
      if (error.message.includes("column") || error.code === "42703") {
        setMigrationAlert(true)
      } else {
        alert("Erro ao atualizar status: " + error.message)
      }
    } else {
      setCustomers(prev => prev.map(c => c.id === id ? { ...c, is_club_member: newStatus } : c))
    }
    setActionId(null)
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
      setCustomers(prev => prev.map(c => c.id === id ? { ...c, cashback_balance: newBalance } : c))
    }
  }

  const filteredCustomers = customers.filter(c => 
    c.name?.toLowerCase().includes(search.toLowerCase()) || 
    c.phone?.includes(search) ||
    c.document?.includes(search)
  )

  const clubMembersCount = customers.filter(c => c.is_club_member).length
  const nonMembersCount = customers.length - clubMembersCount
  const membershipRate = customers.length ? Math.round((clubMembersCount / customers.length) * 100) : 0

  return (
    <div className="p-4 md:p-8 bg-[#020617] min-h-screen dark text-foreground relative overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute top-[-30%] left-[-10%] w-[600px] h-[600px] bg-purple-600/5 rounded-full blur-[180px] pointer-events-none" />
      <div className="absolute bottom-[-30%] right-[-10%] w-[600px] h-[600px] bg-cyan-500/5 rounded-full blur-[180px] pointer-events-none" />

      {/* Header */}
      <div className="mb-8 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')} className="text-zinc-400 hover:text-white">
            <ArrowLeft className="w-6 h-6" />
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-purple-400 via-indigo-200 to-white bg-clip-text text-transparent flex items-center gap-2">
              <Crown className="w-7 h-7 md:w-8 md:h-8 text-purple-400 animate-pulse" /> Clube de Membros
            </h1>
            <p className="text-zinc-400 mt-1 text-sm">Fidelize seus clientes com tratamento VIP e promoções exclusivas.</p>
          </div>
        </div>
      </div>

      {migrationAlert && (
        <Card className="mb-8 border-amber-500/50 bg-amber-500/10 text-amber-200">
          <CardContent className="flex items-start gap-4 p-6">
            <ShieldAlert className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="font-bold">Coluna de Banco de Dados Faltando</h4>
              <p className="text-sm text-amber-300/90">
                A tabela `customers` ainda não possui a coluna `is_club_member`. Execute a migration sql criada no diretório `supabase/migrations` (ou execute a query no SQL Editor do Supabase):
              </p>
              <pre className="mt-2 p-2 bg-black/40 rounded text-xs font-mono select-all text-white">
                ALTER TABLE customers ADD COLUMN IF NOT EXISTS is_club_member BOOLEAN DEFAULT FALSE;
              </pre>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="bg-glass border border-white/5 bg-glass-hover shadow-lg">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Membros do Clube</p>
              <h3 className="text-3xl font-black text-purple-400 mt-1">{clubMembersCount}</h3>
            </div>
            <div className="p-3 bg-purple-500/10 rounded-full border border-purple-500/20 text-purple-400">
              <Crown className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-glass border border-white/5 bg-glass-hover shadow-lg">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Taxa de Adesão</p>
              <h3 className="text-3xl font-black text-cyan-400 mt-1">{membershipRate}%</h3>
            </div>
            <div className="p-3 bg-cyan-500/10 rounded-full border border-cyan-500/20 text-cyan-400">
              <Sparkles className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-glass border border-white/5 bg-glass-hover shadow-lg">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Fora do Clube</p>
              <h3 className="text-3xl font-black text-zinc-400 mt-1">{nonMembersCount}</h3>
            </div>
            <div className="p-3 bg-zinc-500/10 rounded-full border border-zinc-500/20 text-zinc-400">
              <Award className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search & List */}
      <Card className="border-white/5 bg-slate-950/40 backdrop-blur-xl">
        <CardHeader className="border-b border-white/5 pb-4">
          <CardTitle>Membros & Clientes</CardTitle>
          <CardDescription>Adicione clientes ao clube VIP ou gerencie seus status de membro.</CardDescription>
          <div className="mt-4 relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
            <Input 
              placeholder="Buscar cliente por nome, whatsapp ou documento..." 
              className="pl-9 bg-slate-900 border-white/5 text-white"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <div className="min-w-[800px]">
            <table className="w-full text-sm text-left">
              <thead className="bg-white/5 border-b border-white/5 text-zinc-400">
                <tr>
                  <th className="px-6 py-3 font-medium">Cliente</th>
                  <th className="px-6 py-3 font-medium">Contato</th>
                  <th className="px-6 py-3 font-medium">Documento</th>
                  <th className="px-6 py-3 font-medium">Saldo (Cashback)</th>
                  <th className="px-6 py-3 font-medium">Status do Clube</th>
                  <th className="px-6 py-3 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredCustomers.map((c) => (
                  <tr key={c.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4 font-semibold text-white flex items-center gap-2">
                      {c.is_club_member && <Crown className="w-4 h-4 text-purple-400 shrink-0" />}
                      {c.name}
                    </td>
                    <td className="px-6 py-4 text-zinc-400">
                      <div>{c.phone}</div>
                      <div className="text-xs">{c.email}</div>
                    </td>
                    <td className="px-6 py-4 text-zinc-400 font-mono text-xs">{c.document || '---'}</td>
                    <td className="px-6 py-4 font-bold text-green-400">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(c.cashback_balance || 0)}
                    </td>
                    <td className="px-6 py-4">
                      {c.is_club_member ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                          Membro VIP
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-500/10 text-zinc-400 border border-zinc-500/20">
                          Não Participa
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right flex items-center justify-end gap-2">
                      {c.is_club_member && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-zinc-400 hover:text-green-400 hover:bg-green-500/10 h-8 w-8"
                          onClick={() => updateCashback(c.id, c.cashback_balance || 0)}
                          title="Ajustar Cashback"
                        >
                          <Wallet className="w-4 h-4" />
                        </Button>
                      )}
                      {c.is_club_member ? (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10"
                          onClick={() => toggleClubMembership(c.id, true)}
                          disabled={actionId === c.id}
                        >
                          <UserX className="w-4 h-4 mr-1.5" /> Remover
                        </Button>
                      ) : (
                        <Button 
                          variant="default" 
                          size="sm" 
                          className="bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-600/10"
                          onClick={() => toggleClubMembership(c.id, false)}
                          disabled={actionId === c.id}
                        >
                          <UserCheck className="w-4 h-4 mr-1.5" /> Tornar VIP
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
                {loading && customers.length === 0 && (
                  [...Array(5)].map((_, i) => (
                    <tr key={`skeleton-${i}`} className="animate-pulse">
                      <td className="px-6 py-4"><div className="h-4 bg-white/10 rounded w-32"></div></td>
                      <td className="px-6 py-4"><div className="h-4 bg-white/10 rounded w-28 mb-1"></div><div className="h-3 bg-white/10 rounded w-20"></div></td>
                      <td className="px-6 py-4"><div className="h-4 bg-white/10 rounded w-24"></div></td>
                      <td className="px-6 py-4"><div className="h-4 bg-white/10 rounded w-16"></div></td>
                      <td className="px-6 py-4"><div className="h-5 bg-white/10 rounded w-20"></div></td>
                      <td className="px-6 py-4 text-right"><div className="h-8 bg-white/10 rounded w-24 ml-auto"></div></td>
                    </tr>
                  ))
                )}
                {customers.length === 0 && !loading && (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-zinc-500">Nenhum cliente cadastrado.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
