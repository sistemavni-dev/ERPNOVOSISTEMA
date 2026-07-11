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
import Suppliers from './pages/tenant/Suppliers'
import SupplierQuotes from './pages/tenant/SupplierQuotes'
import MemberClub from './pages/tenant/MemberClub'
import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'

// Guard para verificar se a assinatura está ativa ou em período de teste
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

    const { data } = await supabase
      .from('tenants')
      .select('status, trial_ends_at, subscription_status')
      .eq('id', user.id)
      .single()

    if (!data) {
      setStatus('pending')
      return
    }

    const trialEnds = data.trial_ends_at ? new Date(data.trial_ends_at) : null
    const isTrialExpired = trialEnds ? trialEnds < new Date() : false

    // Se o trial expirou e o plano não está ativo pago no Asaas, bloqueia
    if (isTrialExpired && data.subscription_status !== 'active') {
      setStatus('pending')
    } else if (data.status === 'active' || (data.subscription_status === 'trialing' && !isTrialExpired)) {
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

// Guard para verificar se o perfil possui acesso administrativo (admin/manager)
function AdminRoute({ children }: { children: React.ReactNode }) {
  const [roleStatus, setRoleStatus] = useState<'loading' | 'allowed' | 'denied'>('loading')

  useEffect(() => {
    checkRole()
  }, [])

  const checkRole = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setRoleStatus('denied')
      return
    }

    const { data } = await supabase.from('tenants').select('role').eq('id', user.id).single()
    if (data && data.role !== 'cashier') {
      setRoleStatus('allowed')
    } else {
      setRoleStatus('denied')
    }
  }

  if (roleStatus === 'loading') return <div className="min-h-screen bg-[#020617] text-white flex items-center justify-center">Verificando permissões...</div>
  if (roleStatus === 'denied') return <Navigate to="/dashboard" replace />
  
  return children
}

// Guard para verificar o plano de assinatura
function PlanRoute({ children, allowedPlans }: { children: React.ReactNode, allowedPlans: string[] }) {
  const [planStatus, setPlanStatus] = useState<'loading' | 'allowed' | 'denied'>('loading')

  useEffect(() => {
    checkPlan()
  }, [])

  const checkPlan = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setPlanStatus('denied')
      return
    }

    const { data } = await supabase.from('tenants').select('plan, subscription_status, trial_ends_at').eq('id', user.id).single()
    if (!data) {
      setPlanStatus('denied')
      return
    }

    // Se estiver em trial válido, libera tudo provisoriamente (opcional)
    const trialEnds = data.trial_ends_at ? new Date(data.trial_ends_at) : null
    const isTrialExpired = trialEnds ? trialEnds < new Date() : false
    
    // Libera se o plano for compatível OU se for um trial ainda válido
    if (allowedPlans.includes(data.plan) || (data.subscription_status === 'trialing' && !isTrialExpired)) {
      setPlanStatus('allowed')
    } else {
      setPlanStatus('denied')
    }
  }

  if (planStatus === 'loading') return <div className="min-h-screen bg-[#020617] text-white flex items-center justify-center">Verificando plano...</div>
  if (planStatus === 'denied') {
    return <Navigate to="/planos?blocked=true" replace />
  }
  
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
        <Route path="/clientes" element={<ProtectedRoute><PlanRoute allowedPlans={['prata', 'ouro']}><Customers /></PlanRoute></ProtectedRoute>} />
        <Route path="/clube-membros" element={<ProtectedRoute><PlanRoute allowedPlans={['ouro']}><MemberClub /></PlanRoute></ProtectedRoute>} />
        <Route path="/financeiro" element={<ProtectedRoute><AdminRoute><PlanRoute allowedPlans={['prata', 'ouro']}><Finance /></PlanRoute></AdminRoute></ProtectedRoute>} />
        <Route path="/fornecedores" element={<ProtectedRoute><PlanRoute allowedPlans={['prata', 'ouro']}><Suppliers /></PlanRoute></ProtectedRoute>} />
        <Route path="/orcamentos" element={<ProtectedRoute><PlanRoute allowedPlans={['prata', 'ouro']}><SupplierQuotes /></PlanRoute></ProtectedRoute>} />
        <Route path="/configuracoes" element={<ProtectedRoute><AdminRoute><Settings /></AdminRoute></ProtectedRoute>} />
        <Route path="/planos" element={<Plans />} />
        <Route path="/loja/:slug" element={<Storefront />} />
        <Route path="/super-admin" element={<SuperAdminDashboard />} />
        <Route path="/" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  )
}

export default App
