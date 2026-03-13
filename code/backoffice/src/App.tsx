import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import MainLayout from './components/layout/MainLayout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import ValidationDesk from './pages/validation/ValidationDesk'
import CompliancePage from './pages/compliance/CompliancePage'
import AdminPage from '@/pages/admin/AdminPage'
import AnalyticsPage from '@/pages/analytics/AnalyticsPage'
import CommandCenterPage from '@/pages/command-center/CommandCenterPage'
import UnauthorizedPage from '@/pages/UnauthorizedPage'
import NotFoundPage from '@/pages/NotFoundPage'

function App() {
  const { isAuthenticated } = useAuth()

  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />} />
      
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        
        <Route
          path="validation"
          element={
            <ProtectedRoute allowedRoles={['JEAN']}>
              <ValidationDesk />
            </ProtectedRoute>
          }
        />
        
        <Route
          path="compliance"
          element={
            <ProtectedRoute allowedRoles={['THOMAS']}>
              <CompliancePage />
            </ProtectedRoute>
          }
        />
        
        <Route
          path="command-center"
          element={
            <ProtectedRoute allowedRoles={['SYLVIE']}>
              <CommandCenterPage />
            </ProtectedRoute>
          }
        />
        
        <Route
          path="analytics"
          element={
            <ProtectedRoute allowedRoles={['SYLVIE', 'THOMAS']}>
              <AnalyticsPage />
            </ProtectedRoute>
          }
        />
        
        <Route
          path="admin"
          element={
            <ProtectedRoute allowedRoles={['ADMIN_IT']}>
              <AdminPage />
            </ProtectedRoute>
          }
        />
      </Route>

      <Route path="/unauthorized" element={<UnauthorizedPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

export default App