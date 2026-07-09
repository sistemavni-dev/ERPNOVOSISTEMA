import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "../../lib/supabase"
import { Button } from "../../components/ui/button"
import { Input } from "../../components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card"
import { Truck, Plus, Trash2, ArrowLeft, Edit2, Check, X } from "lucide-react"

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState("")
  const navigate = useNavigate()

  // Form states
  const [name, setName] = useState("")
  const [document, setDocument] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [address, setAddress] = useState("")

  // Edit states
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [editDocument, setEditDocument] = useState("")
  const [editEmail, setEditEmail] = useState("")
  const [editPhone, setEditPhone] = useState("")
  const [editAddress, setEditAddress] = useState("")

  useEffect(() => {
    fetchSuppliers()
  }, [])

  const fetchSuppliers = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) console.error(error)
    else setSuppliers(data || [])
    setLoading(false)
  }

  const handleAddSupplier = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      alert("Erro: Usuário não autenticado.")
      setLoading(false)
      return
    }

    const { error } = await supabase
      .from('suppliers')
      .insert([{ 
        tenant_id: user.id,
        name, 
        document, 
        email, 
        phone, 
        address
      }])

    if (error) {
      alert("Erro ao adicionar fornecedor: " + error.message)
    } else {
      setName("")
      setDocument("")
      setEmail("")
      setPhone("")
      setAddress("")
      fetchSuppliers()
    }
    setLoading(false)
  }

  const handleDeleteSupplier = async (id: string) => {
    if(!confirm("Certeza que deseja excluir o fornecedor? Todos os orçamentos associados também serão excluídos.")) return
    await supabase.from('suppliers').delete().eq('id', id)
    fetchSuppliers()
  }

  const startEdit = (supplier: any) => {
    setEditingId(supplier.id)
    setEditName(supplier.name)
    setEditDocument(supplier.document || "")
    setEditEmail(supplier.email || "")
    setEditPhone(supplier.phone || "")
    setEditAddress(supplier.address || "")
  }

  const handleUpdateSupplier = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingId) return

    const { error } = await supabase
      .from('suppliers')
      .update({
        name: editName,
        document: editDocument,
        email: editEmail,
        phone: editPhone,
        address: editAddress
      })
      .eq('id', editingId)

    if (error) {
      alert("Erro ao atualizar fornecedor: " + error.message)
    } else {
      setEditingId(null)
      fetchSuppliers()
    }
  }

  const filteredSuppliers = suppliers.filter(s => 
    s.name?.toLowerCase().includes(search.toLowerCase()) || 
    s.document?.includes(search)
  )

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
              <Truck className="w-6 h-6 md:w-8 md:h-8 text-purple-400" /> Cadastro de Fornecedores
            </h1>
            <p className="text-zinc-400 mt-1">Gerencie seus fornecedores cadastrados.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 z-10 relative">
        {/* Formulario Cadastro */}
        <div className="lg:col-span-1 space-y-8">
          <Card className="bg-slate-950/40 border-white/5 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-white">Novo Fornecedor</CardTitle>
              <CardDescription className="text-zinc-500">Cadastre os dados cadastrais e tributários do fornecedor.</CardDescription>
            </CardHeader>
            <form onSubmit={handleAddSupplier}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-300">Razão Social / Nome</label>
                  <Input value={name} onChange={e => setName(e.target.value)} required className="bg-slate-900 border-white/5 text-white" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-300">CNPJ / CPF</label>
                  <Input value={document} onChange={e => setDocument(e.target.value)} className="bg-slate-900 border-white/5 text-white" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-300">Telefone / WhatsApp</label>
                  <Input value={phone} onChange={e => setPhone(e.target.value)} className="bg-slate-900 border-white/5 text-white" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-300">Email</label>
                  <Input type="email" value={email} onChange={e => setEmail(e.target.value)} className="bg-slate-900 border-white/5 text-white" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-300">Endereço Completo</label>
                  <Input value={address} onChange={e => setAddress(e.target.value)} className="bg-slate-900 border-white/5 text-white" />
                </div>


                <Button type="submit" className="w-full bg-purple-600 hover:bg-purple-500 text-white" disabled={loading}>
                  <Plus className="w-4 h-4 mr-2" /> Salvar Fornecedor
                </Button>
              </CardContent>
            </form>
          </Card>
        </div>

        {/* Tabela de Fornecedores */}
        <div className="lg:col-span-2 space-y-8">
          <Card className="bg-slate-950/40 border-white/5 backdrop-blur-xl">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-white">Lista de Fornecedores</CardTitle>
                <CardDescription className="text-zinc-500">Consulte e edite as informações de fornecedores cadastrados.</CardDescription>
              </div>
              <Input 
                placeholder="Buscar por nome ou CNPJ..." 
                value={search} 
                onChange={e => setSearch(e.target.value)} 
                className="w-64 bg-slate-900 border-white/5 text-white text-xs"
              />
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <div className="min-w-[800px] border-0">
                <table className="w-full text-sm text-left text-zinc-300">
                  <thead className="bg-white/5 border-b border-white/5 text-white">
                    <tr>
                      <th className="px-4 py-3 font-medium">Nome / Razão Social</th>
                      <th className="px-4 py-3 font-medium">Documento</th>
                      <th className="px-4 py-3 font-medium">Contato</th>
                      <th className="px-4 py-3 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSuppliers.map((supplier) => (
                      <tr key={supplier.id} className="border-b border-white/5 last:border-0 hover:bg-white/5">
                        {editingId === supplier.id ? (
                          // Edição Inline
                          <td colSpan={4} className="p-4">
                            <form onSubmit={handleUpdateSupplier} className="grid grid-cols-4 gap-3 items-end">
                              <div className="space-y-1">
                                <label className="text-[10px] text-zinc-500">Nome</label>
                                <Input value={editName} onChange={e => setEditName(e.target.value)} required className="h-8 bg-slate-900 border-white/5 text-white text-xs" />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[10px] text-zinc-500">CNPJ / CPF</label>
                                <Input value={editDocument} onChange={e => setEditDocument(e.target.value)} className="h-8 bg-slate-900 border-white/5 text-white text-xs" />
                              </div>
                              <div className="flex gap-2 justify-end pb-1">
                                <Button type="submit" size="icon" variant="ghost" className="h-8 w-8 text-emerald-400 hover:bg-emerald-400/10">
                                  <Check className="w-4 h-4" />
                                </Button>
                                <Button type="button" size="icon" variant="ghost" onClick={() => setEditingId(null)} className="h-8 w-8 text-zinc-400 hover:bg-white/5">
                                  <X className="w-4 h-4" />
                                </Button>
                              </div>
                            </form>
                          </td>
                        ) : (
                          // Visualização normal
                          <>
                            <td className="px-4 py-3 font-medium text-white">
                              {supplier.name}
                              <div className="text-xs text-zinc-500 font-normal">{supplier.address || "Sem endereço cadastrado"}</div>
                            </td>
                            <td className="px-4 py-3 font-mono text-xs">{supplier.document || "-"}</td>
                            <td className="px-4 py-3">
                              <div>{supplier.phone || "-"}</div>
                              <div className="text-xs text-zinc-500">{supplier.email || ""}</div>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <Button variant="ghost" size="icon" className="text-zinc-400 hover:text-white hover:bg-white/5 mr-2" onClick={() => startEdit(supplier)}>
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10" onClick={() => handleDeleteSupplier(supplier.id)}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                    {suppliers.length === 0 && !loading && (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-zinc-500">Nenhum fornecedor cadastrado.</td>
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
