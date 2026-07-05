import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "../../lib/supabase"
import { Button } from "../../components/ui/button"
import { Input } from "../../components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card"
import { Settings as SettingsIcon, ArrowLeft, Save, Building2, Store } from "lucide-react"

export default function Settings() {
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const navigate = useNavigate()
  const [profileId, setProfileId] = useState<string | null>(null)

  // Dados da Empresa
  const [name, setName] = useState("")
  const [document, setDocument] = useState("")
  const [address, setAddress] = useState("")

  // Vitrine Virtual
  const [storeSlug, setStoreSlug] = useState("")
  const [whatsapp, setWhatsapp] = useState("")
  const [storeDescription, setStoreDescription] = useState("")
  const [plan, setPlan] = useState<string | null>(null)

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    
    if (user) {
      setProfileId(user.id)
      const { data: tenant } = await supabase
        .from('tenants')
        .select('*')
        .eq('id', user.id)
        .single()
        
      if (tenant) {
        setName(tenant.name || "")
        setDocument(tenant.document || "")
        setAddress(tenant.address || "")
        setStoreSlug(tenant.store_slug || "")
        setWhatsapp(tenant.whatsapp_number || "")
        setStoreDescription(tenant.store_description || "")
        setPlan(tenant.plan)
      }
    }
    setLoading(false)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profileId) return
    
    setLoading(true)
    setSuccess(false)
    
    const { error } = await supabase
      .from('tenants')
      .update({
        name,
        document,
        address,
        store_slug: storeSlug || null, // Permite nulo se vazio
        whatsapp_number: whatsapp,
        store_description: storeDescription
      })
      .eq('id', profileId)

    setLoading(false)

    if (error) {
      if (error.code === '23505') {
        alert("Este Link da Loja já está em uso por outra empresa. Escolha outro.")
      } else {
        alert("Erro ao salvar configurações: " + error.message)
      }
    } else {
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    }
  }

  return (
    <div className="p-4 md:p-8 bg-background min-h-screen dark text-foreground">
      <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center max-w-4xl mx-auto gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="w-6 h-6" />
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
              <SettingsIcon className="w-6 h-6 md:w-8 md:h-8 text-primary" /> Configurações
            </h1>
            <p className="text-muted-foreground mt-1">Gerencie os dados da sua empresa e vitrine virtual.</p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto space-y-8">
        <form onSubmit={handleSave}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* Dados da Empresa */}
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-primary" /> Dados da Empresa
                </CardTitle>
                <CardDescription>Informações que sairão no cabeçalho do recibo.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Razão Social / Nome Fantasia</label>
                  <Input 
                    value={name} 
                    onChange={e => setName(e.target.value)} 
                    required 
                    placeholder="Sua Empresa Ltda" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">CNPJ / CPF</label>
                  <Input 
                    value={document} 
                    onChange={e => setDocument(e.target.value)} 
                    placeholder="00.000.000/0001-00" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Endereço Completo</label>
                  <textarea 
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={address} 
                    onChange={e => setAddress(e.target.value)} 
                    placeholder="Rua Exemplo, 123 - Centro, São Paulo - SP" 
                  />
                </div>
              </CardContent>
            </Card>

            {/* Vitrine Virtual */}
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Store className="w-5 h-5 text-primary" /> Vitrine Virtual
                </CardTitle>
                <CardDescription>Configure como seus clientes verão sua loja online.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Link da Loja (ex: lojadox)</label>
                  <Input 
                    value={storeSlug} 
                    onChange={e => setStoreSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'))} 
                    placeholder="nome-da-sua-loja" 
                  />
                  {storeSlug && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Seu link público é: <br/>
                      <a 
                        href={`${window.location.origin}/loja/${storeSlug}`} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="text-primary font-bold hover:underline"
                      >
                        {window.location.origin}/loja/{storeSlug}
                      </a>
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">WhatsApp p/ Pedidos Automáticos</label>
                  {plan === 'prata' ? (
                    <div className="p-3 bg-muted rounded-md text-sm text-muted-foreground border border-border flex items-center justify-between">
                      <span>Esta funcionalidade é exclusiva do Plano Ouro.</span>
                      <Button type="button" variant="outline" size="sm" onClick={() => navigate('/planos')}>Fazer Upgrade</Button>
                    </div>
                  ) : (
                    <Input 
                      value={whatsapp} 
                      onChange={e => setWhatsapp(e.target.value)} 
                      placeholder="5511999999999" 
                    />
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Descrição da Loja</label>
                  <textarea 
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={storeDescription} 
                    onChange={e => setStoreDescription(e.target.value)} 
                    placeholder="Bem-vindo à nossa loja! Faça seu pedido abaixo." 
                  />
                </div>
              </CardContent>
            </Card>

          </div>

          <div className="mt-8 flex flex-col-reverse md:flex-row justify-end items-center gap-4 w-full">
            {success && <span className="text-green-500 font-medium w-full text-center md:w-auto md:text-left">Configurações salvas com sucesso!</span>}
            <Button type="submit" size="lg" disabled={loading} className="w-full md:w-48 text-lg font-semibold shadow-lg shadow-primary/20">
              <Save className="w-5 h-5 mr-2" />
              {loading ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
