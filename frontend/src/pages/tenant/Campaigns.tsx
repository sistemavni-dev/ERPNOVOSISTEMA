import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "../../lib/supabase"
import { Button } from "../../components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card"
import { Megaphone, ArrowLeft, Send, Users, Smartphone, MessageCircle } from "lucide-react"

export default function Campaigns() {
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const navigate = useNavigate()
  
  const [customers, setCustomers] = useState<any[]>([])
  const [selectedPhones, setSelectedPhones] = useState<string[]>([])
  const [messageText, setMessageText] = useState("Olá! Temos uma oferta especial para você hoje.")

  useEffect(() => {
    loadCustomers()
  }, [])

  const loadCustomers = async () => {
    setFetching(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data } = await supabase
        .from('customers')
        .select('name, phone')
        .eq('tenant_id', user.id)
        .not('phone', 'is', null)
        .order('created_at', { ascending: false })
      
      setCustomers(data || [])
    }
    setFetching(false)
  }

  const toggleSelectAll = () => {
    if (selectedPhones.length === customers.length) {
      setSelectedPhones([])
    } else {
      setSelectedPhones(customers.map(c => c.phone))
    }
  }

  const toggleSelect = (phone: string) => {
    if (selectedPhones.includes(phone)) {
      setSelectedPhones(selectedPhones.filter(p => p !== phone))
    } else {
      setSelectedPhones([...selectedPhones, phone])
    }
  }

  const handleSendCampaign = async () => {
    if (selectedPhones.length === 0) {
      alert("Selecione pelo menos um cliente.")
      return
    }
    if (!messageText.trim()) {
      alert("Digite a mensagem da campanha.")
      return
    }

    if (!confirm(`Deseja disparar esta campanha para ${selectedPhones.length} clientes?`)) return

    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('dispatch-campaign', {
        body: { target_phones: selectedPhones, text: messageText }
      })

      if (error || data?.error) {
        alert(data?.error || error?.message || "Erro ao disparar campanha. Verifique sua conexão e plano.")
      } else {
        alert("Campanha enviada com sucesso para a fila de disparo!")
        setMessageText("")
        setSelectedPhones([])
      }
    } catch (e: any) {
      alert("Erro fatal ao disparar: " + e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-4 md:p-8 bg-[#020617] min-h-screen text-foreground relative overflow-hidden dark">
      {/* Background Orbs */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-pink-500/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center max-w-6xl mx-auto gap-4 relative z-10">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')} className="hover:bg-white/5">
            <ArrowLeft className="w-6 h-6" />
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2 text-white">
              <Megaphone className="w-6 h-6 md:w-8 md:h-8 text-pink-500" /> Central de Campanhas
            </h1>
            <p className="text-zinc-400 mt-1">Dispare promoções em massa via WhatsApp para seus clientes.</p>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8 relative z-10">
        
        {/* Editor de Mensagem */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-white/10 bg-black/40 backdrop-blur-md">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-pink-500" /> Escreva sua Mensagem
              </CardTitle>
              <CardDescription className="text-zinc-400">Dica: Use formatação do WhatsApp (*negrito*, _itálico_)</CardDescription>
            </CardHeader>
            <CardContent>
              <textarea 
                className="flex min-h-[200px] w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-base text-white ring-offset-background placeholder:text-zinc-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-500/50 disabled:cursor-not-allowed disabled:opacity-50 transition-all resize-y"
                value={messageText} 
                onChange={e => setMessageText(e.target.value)} 
                placeholder="Ex: 🚨 Promoção Relâmpago! Toda a loja com 20% OFF hoje..." 
              />
              
              <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                <p className="text-sm text-zinc-500">
                  <strong className="text-white">{selectedPhones.length}</strong> clientes selecionados
                </p>
                <Button 
                  onClick={handleSendCampaign} 
                  disabled={loading || selectedPhones.length === 0} 
                  className="w-full sm:w-auto bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-bold shadow-lg shadow-pink-500/25 border-0 px-8"
                >
                  {loading ? (
                    "Disparando..."
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Disparar Campanha
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Dicas de Marketing */}
          <Card className="border-white/5 bg-gradient-to-br from-purple-900/20 to-transparent">
            <CardContent className="p-6">
              <h3 className="font-semibold text-white mb-2 flex items-center gap-2">💡 Dicas de Conversão</h3>
              <ul className="text-sm text-zinc-400 space-y-2 list-disc list-inside">
                <li>Crie senso de urgência ("Somente Hoje").</li>
                <li>Sempre inclua o link da sua vitrine virtual ou chave PIX.</li>
                <li>Não dispare mais de 50 mensagens por dia para evitar bloqueios do WhatsApp.</li>
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* Seleção de Clientes */}
        <div className="space-y-6">
          <Card className="border-white/10 bg-black/40 backdrop-blur-md h-full flex flex-col max-h-[600px]">
            <CardHeader className="pb-3 border-b border-white/5">
              <CardTitle className="text-white flex items-center justify-between">
                <span className="flex items-center gap-2"><Users className="w-5 h-5 text-purple-400" /> Destinatários</span>
              </CardTitle>
              <CardDescription className="text-zinc-400">Escolha quem receberá a mensagem.</CardDescription>
            </CardHeader>
            
            <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/5">
              <span className="text-sm font-medium text-white">Selecionar Todos</span>
              <input 
                type="checkbox" 
                className="w-4 h-4 accent-pink-500 cursor-pointer"
                checked={customers.length > 0 && selectedPhones.length === customers.length}
                onChange={toggleSelectAll}
                disabled={fetching || customers.length === 0}
              />
            </div>

            <CardContent className="p-0 overflow-y-auto flex-1 custom-scrollbar">
              {fetching ? (
                <div className="p-8 text-center text-zinc-500 text-sm">Carregando contatos...</div>
              ) : customers.length === 0 ? (
                <div className="p-8 text-center text-zinc-500 text-sm">Nenhum cliente com telefone cadastrado.</div>
              ) : (
                <div className="divide-y divide-white/5">
                  {customers.map((c, i) => (
                    <label key={i} className="flex items-center justify-between p-4 hover:bg-white/5 cursor-pointer transition-colors">
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-white">{c.name || 'Sem Nome'}</span>
                        <span className="text-xs text-zinc-500 flex items-center gap-1 mt-1">
                          <Smartphone className="w-3 h-3" /> {c.phone}
                        </span>
                      </div>
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 accent-pink-500 cursor-pointer"
                        checked={selectedPhones.includes(c.phone)}
                        onChange={() => toggleSelect(c.phone)}
                      />
                    </label>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  )
}
