import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/auth/Login'
import Register from './pages/auth/Register'

import SuperAdminDashboard from './pages/admin/SuperAdminDashboard'
import TenantDashboard from './pages/tenant/TenantDashboard'
import Storefront from './pages/public/Storefront'
import POS from './pages/tenant/POS'
import Products from './pages/tenant/Products'
import Customers from './pages/tenant/Customers'
import Finance from './pages/tenant/Finance'
import Settings from './pages/tenant/Settings'
import Plans from './pages/tenant/Plans'
import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'

// Guard para verificar se a assinatura está ativa
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<'loading' | 'active' | 'pending' | 'unauthorized'>('loading')

  useEffect(() => {
    checkAccess()
  }, [])

  const checkAccess = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setStatus('unauthorized')
      return
    }

    const { data } = await supabase.from('tenants').select('status').eq('id', user.id).single()
    if (data?.status === 'active') {
      setStatus('active')
    } else {
      setStatus('pending')
    }
  }

  if (status === 'loading') return <div className="min-h-screen bg-background text-foreground flex items-center justify-center">Verificando acesso...</div>
  if (status === 'unauthorized') return <Navigate to="/login" replace />
  if (status === 'pending') return <Navigate to="/planos" replace />
  
  return children
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/dashboard" element={<ProtectedRoute><TenantDashboard /></ProtectedRoute>} />
        <Route path="/pdv" element={<ProtectedRoute><POS /></ProtectedRoute>} />
        <Route path="/produtos" element={<ProtectedRoute><Products /></ProtectedRoute>} />
        <Route path="/clientes" element={<ProtectedRoute><Customers /></ProtectedRoute>} />
        <Route path="/financeiro" element={<ProtectedRoute><Finance /></ProtectedRoute>} />
        <Route path="/configuracoes" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
        <Route path="/planos" element={<Plans />} />
        <Route path="/loja/:slug" element={<Storefront />} />
        <Route path="/super-admin" element={<SuperAdminDashboard />} />
        <Route path="/" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  )
}

export default App
