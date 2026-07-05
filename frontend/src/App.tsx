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

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/dashboard" element={<TenantDashboard />} />
        <Route path="/pdv" element={<POS />} />
        <Route path="/produtos" element={<Products />} />
        <Route path="/clientes" element={<Customers />} />
        <Route path="/financeiro" element={<Finance />} />
        <Route path="/loja/:slug" element={<Storefront />} />
        <Route path="/super-admin" element={<SuperAdminDashboard />} />
        <Route path="/" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  )
}

export default App
