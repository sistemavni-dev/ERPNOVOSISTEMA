import { useState, useEffect } from "react"
import { supabase } from "../lib/supabase"
import { Button } from "./ui/button"
import { Smartphone, RefreshCcw, CheckCircle, QrCode } from "lucide-react"

export function WhatsappConnection({ tenantId }: { tenantId: string }) {
  const [status, setStatus] = useState<string>("disconnected")
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadStatus()
  }, [])

  const loadStatus = async () => {
    const { data: tenant } = await supabase
      .from('tenants')
      .select('whatsapp_status')
      .eq('id', tenantId)
      .single()

    if (tenant) {
      setStatus(tenant.whatsapp_status || 'disconnected')
    }
  }

  const connectWhatsapp = async () => {
    setLoading(true)
    setError(null)
    setQrCode(null)
    
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error("Não autenticado")

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-manager`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ action: 'get-qr-code', tenant_id: tenantId })
      })

      const data = await res.json()

      if (!res.ok) {
        let errorMsg = data.error || "Erro ao conectar";
        if (data.details) {
          try {
            const parsedDetails = JSON.parse(data.details);
            errorMsg += `: ${parsedDetails.response?.message?.[0] || parsedDetails.message || data.details}`;
          } catch (e) {
            errorMsg += `: ${data.details}`;
          }
        }
        throw new Error(errorMsg)
      }

      if (data.base64) {
        let base64str = data.base64
        // Evolution API might return base64 without prefix
        if (!base64str.startsWith('data:image/')) {
          base64str = `data:image/png;base64,${base64str}`
        }
        setQrCode(base64str)
        setStatus('connecting')
        // Inicia o polling
        startPolling()
      } else {
        // Pode já estar conectado
        checkStatus()
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const checkStatus = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-manager`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ action: 'check-status', tenant_id: tenantId })
      })

      const data = await res.json()
      if (res.ok && data.state === 'open') {
        setStatus('connected')
        setQrCode(null)
        return true
      }
      if (res.ok && data.state === 'close') {
        setStatus('disconnected')
        setQrCode(null)
      }
      return false
    } catch (e) {
      console.error(e)
      return false
    }
  }

  const startPolling = () => {
    const interval = setInterval(async () => {
      const isConnected = await checkStatus()
      if (isConnected) {
        clearInterval(interval)
      }
    }, 5000)

    // Clear after 2 minutes to avoid infinite polling if user abandons
    setTimeout(() => {
      clearInterval(interval)
    }, 120000)
  }

  return (
    <div className="p-4 bg-background border border-border rounded-lg space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-primary" /> WhatsApp da Loja
        </span>
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
          status === 'connected' ? 'bg-emerald-500/10 text-emerald-400' :
          status === 'connecting' ? 'bg-amber-500/10 text-amber-400' : 'bg-rose-500/10 text-rose-400'
        }`}>
          {status === 'connected' ? 'Conectado' : status === 'connecting' ? 'Aguardando QR Code...' : 'Desconectado'}
        </span>
      </div>

      {status === 'connected' ? (
        <div className="bg-emerald-500/10 text-emerald-500 p-4 rounded-lg flex flex-col items-center justify-center gap-2 border border-emerald-500/30">
          <CheckCircle className="w-8 h-8" />
          <p className="font-medium text-sm">WhatsApp Conectado com sucesso!</p>
          <Button variant="outline" size="sm" onClick={connectWhatsapp} className="mt-2" disabled={loading}>
            <RefreshCcw className="w-4 h-4 mr-2" /> Reconectar / Trocar Número
          </Button>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center space-y-4">
          {!qrCode && (
            <>
              <p className="text-sm text-muted-foreground text-center">
                Conecte seu WhatsApp escaneando o QR Code para disparar comprovantes automáticos para seus clientes.
              </p>
              <Button onClick={connectWhatsapp} disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
                <QrCode className="w-4 h-4 mr-2" /> 
                {loading ? "Gerando QR Code..." : "Gerar QR Code"}
              </Button>
            </>
          )}

          {qrCode && (
            <div className="flex flex-col items-center justify-center p-4 bg-white rounded-lg space-y-3">
              <img src={qrCode} alt="WhatsApp QR Code" className="w-48 h-48" />
              <p className="text-xs text-black font-semibold text-center">Escaneie o QR Code no seu celular (WhatsApp &gt; Aparelhos Conectados)</p>
            </div>
          )}

          {error && (
            <p className="text-xs text-rose-500 text-center font-medium mt-2">{error}</p>
          )}
        </div>
      )}
    </div>
  )
}
