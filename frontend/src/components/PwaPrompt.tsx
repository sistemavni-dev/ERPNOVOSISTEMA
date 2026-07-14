/// <reference types="vite-plugin-pwa/client" />
import { useEffect, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { Button } from './ui/button'
import { Download, X } from 'lucide-react'

export function PwaPrompt() {
  // O hook gerencia se há alguma atualização disponível ou se precisa recarregar
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r: any) {
      console.log('SW Registered: ' + r)
    },
    onRegisterError(error: any) {
      console.log('SW registration error', error)
    },
  })

  // Lógica nativa de PWA install prompt (para Chrome/Android)
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [showInstallPrompt, setShowInstallPrompt] = useState(false)

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault() // Evita o prompt nativo automático (mini-infobar)
      setDeferredPrompt(e)
      // Checa se o usuário já dispensou antes (opcional, mas bom pra UX)
      if (!localStorage.getItem('pwa-prompt-dismissed')) {
        setShowInstallPrompt(true)
      }
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    // Detecta se já está no modo PWA (standalone)
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setShowInstallPrompt(false)
    }

    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      console.log('User accepted the install prompt')
    } else {
      console.log('User dismissed the install prompt')
    }
    setDeferredPrompt(null)
    setShowInstallPrompt(false)
  }

  const dismissInstall = () => {
    setShowInstallPrompt(false)
    localStorage.setItem('pwa-prompt-dismissed', 'true')
  }

  // Se precisar atualizar a versão do app
  if (needRefresh) {
    return (
      <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-indigo-900 border border-indigo-700 text-white p-4 rounded-xl shadow-2xl z-50 flex flex-col gap-3">
        <div>
          <h3 className="font-bold text-sm">Nova atualização disponível!</h3>
          <p className="text-xs text-indigo-300 mt-1">Clique para atualizar a versão do NexERP e receber as últimas novidades.</p>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setNeedRefresh(false)} className="text-indigo-300 hover:text-white">Agora Não</Button>
          <Button size="sm" onClick={() => updateServiceWorker(true)} className="bg-indigo-600 hover:bg-indigo-500 text-white">Recarregar</Button>
        </div>
      </div>
    )
  }

  // Banner de Instalação (PWA)
  if (showInstallPrompt) {
    return (
      <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-slate-900 border border-purple-500/30 text-white p-4 rounded-xl shadow-2xl z-50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-purple-600 to-indigo-600 p-2 rounded-lg">
            <Download className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-sm">Instalar NexERP</h3>
            <p className="text-xs text-zinc-400 mt-0.5">Tenha o sistema no seu celular.</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" onClick={handleInstall} className="bg-purple-600 hover:bg-purple-500 text-white text-xs px-3">Instalar</Button>
          <Button size="icon" variant="ghost" onClick={dismissInstall} className="text-zinc-400 hover:text-white w-8 h-8 rounded-full">
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
    )
  }

  return null
}
