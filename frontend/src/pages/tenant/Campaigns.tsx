import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "../../lib/supabase"
import { Button } from "../../components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card"
import { Megaphone, ArrowLeft, Send, Users, Smartphone, MessageCircle } from "lucide-react"
import { ThemeToggle } from "../../components/ThemeToggle"

export default function Campaigns() {
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const navigate = useNavigate()
  
  const [customers, setCustomers] = useState<any[]>([])
  const [selectedChatIds, setSelectedChatIds] = useState<string[]>([])
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
        .select('name, phone, telegram_chat_id')
        .eq('tenant_id', user.id)
        .not('telegram_chat_id', 'is', null)
        .order('created_at', { ascending: false })
      
      setCustomers(data || [])
    }
    setFetching(false)
  }

  const toggleSelectAll = () => {
    if (selectedChatIds.length === customers.length) {
      setSelectedChatIds([])
    } else {
      setSelectedChatIds(customers.map(c => c.telegram_chat_id))
    }
  }

  const toggleSelect = (chatId: string) => {
    if (selectedChatIds.includes(chatId)) {
      setSelectedChatIds(selectedChatIds.filter(id => id !== chatId))
    } else {
      setSelectedChatIds([...selectedChatIds, chatId])
    }
  }

  const handleSendCampaign = async () => {
    if (selectedChatIds.length === 0) {
      alert("Selecione pelo menos um cliente com Telegram vinculado.")
      return
    }
    if (!messageText.trim()) {
      alert("Digite a mensagem da campanha.")
      return
    }

    if (!confirm(`Deseja disparar esta campanha no Telegram para ${selectedChatIds.length} clientes?`)) return

    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('dispatch-campaign', {
        body: { target_customers: selectedChatIds, text: messageText }
      })

      if (error || data?.error) {
        alert(data?.error || error?.message || "Erro ao disparar campanha. Verifique sua conexão e plano.")
      } else {
        alert("Campanha enviada com sucesso no Telegram!")
        setMessageText("")
        setSelectedChatIds([])
      }
    } catch (e: any) {
      alert("Erro fatal ao disparar: " + e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-4 md:p-8 bg-background min-h-screen text-foreground relative overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-pink-500/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center max-w-6xl mx-auto gap-4 relative z-10">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')} className="hover:bg-muted">
            <ArrowLeft className="w-6 h-6" />
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2 text-foreground">
              <Megaphone className="w-6 h-6 md:w-8 md:h-8 text-pink-500" /> Central de Campanhas
            </h1>
            <p className="text-muted-foreground mt-1">Dispare promoções em massa via Telegram para seus clientes vinculados.</p>
          </div>
        </div>
        <ThemeToggle />
      </div>

      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8 relative z-10">
        
        {/* Editor de Mensagem */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-border bg-background backdrop-blur-md">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-pink-500" /> Escreva sua Mensagem
              </CardTitle>
              <CardDescription className="text-muted-foreground">Dica: Use formatação do Telegram (*negrito*, _itálico_)</CardDescription>
            </CardHeader>
            <CardContent>
              <textarea 
                className="flex min-h-[200px] w-full rounded-xl border border-border bg-background px-4 py-3 text-base text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-500/50 disabled:cursor-not-allowed disabled:opacity-50 transition-all resize-y"
                value={messageText} 
                onChange={e => setMessageText(e.target.value)} 
                placeholder="Ex: 🚨 Promoção Relâmpago! Toda a loja com 20% OFF hoje..." 
              />
              
              <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                <p className="text-sm text-muted-foreground">
                  <strong className="text-foreground">{selectedChatIds.length}</strong> clientes selecionados
                </p>
                <Button 
                  onClick={handleSendCampaign} 
                  disabled={loading || selectedChatIds.length === 0} 
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
          <Card className="border-border bg-muted/50">
            <CardContent className="p-6">
              <h3 className="font-semibold text-foreground mb-2 flex items-center gap-2">💡 Dicas de Conversão</h3>
              <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside">
                <li>Crie senso de urgência ("Somente Hoje").</li>
                <li>Sempre inclua o link da sua vitrine virtual ou chave PIX.</li>
                <li>Não dispare mais de 50 mensagens por vez para evitar sobrecarga.</li>
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* Seleção de Clientes */}
        <div className="space-y-6">
          <Card className="border-border bg-background backdrop-blur-md h-full flex flex-col max-h-[600px]">
            <CardHeader className="pb-3 border-b border-border">
              <CardTitle className="text-foreground flex items-center justify-between">
                <span className="flex items-center gap-2"><Users className="w-5 h-5 text-purple-400" /> Destinatários</span>
              </CardTitle>
              <CardDescription className="text-muted-foreground">Escolha quem receberá a mensagem.</CardDescription>
            </CardHeader>
            
            <div className="p-4 border-b border-border flex items-center justify-between bg-muted/50">
              <span className="text-sm font-medium text-foreground">Selecionar Todos</span>
              <input 
                type="checkbox" 
                className="w-4 h-4 accent-pink-500 cursor-pointer"
                checked={customers.length > 0 && selectedChatIds.length === customers.length}
                onChange={toggleSelectAll}
                disabled={fetching || customers.length === 0}
              />
            </div>

            <CardContent className="p-0 overflow-y-auto flex-1 custom-scrollbar">
              {fetching ? (
                <div className="p-8 text-center text-muted-foreground text-sm">Carregando contatos...</div>
              ) : customers.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm">Nenhum cliente com Telegram vinculado. Peça aos seus clientes enviarem mensagem ao Bot primeiro.</div>
              ) : (
                <div className="divide-y divide-border">
                  {customers.map((c, i) => (
                    <label key={i} className="flex items-center justify-between p-4 hover:bg-muted cursor-pointer transition-colors">
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-foreground">{c.name || 'Sem Nome'}</span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                          <Smartphone className="w-3 h-3" /> {c.phone} (Telegram Vinculado)
                        </span>
                      </div>
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 accent-pink-500 cursor-pointer"
                        checked={selectedChatIds.includes(c.telegram_chat_id)}
                        onChange={() => toggleSelect(c.telegram_chat_id)}
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
