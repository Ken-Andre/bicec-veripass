import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import { ToastProvider } from './contexts/ToastContext'
import ToastContainer from './components/ui/ToastContainer'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import { RoleRedirect } from './components/auth/RoleRedirect'
import MainLayout from './components/layout/MainLayout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import ValidationQueuePage from './pages/validation/ValidationQueuePage'
import EvidenceViewerPage from './pages/validation/EvidenceViewerPage'
import ComplianceDashboard from './pages/compliance/ComplianceDashboard'
import AmlAlertDetailPage from './pages/compliance/AmlAlertDetailPage'
import ConflictResolverPage from './pages/compliance/ConflictResolverPage'
import AdminPage from '@/pages/admin/AdminPage'
import CommandCenterPage from '@/pages/command-center/CommandCenterPage'
import UnauthorizedPage from '@/pages/UnauthorizedPage'
import NotFoundPage from '@/pages/NotFoundPage'

function App() {
  const { isAuthenticated } = useAuth()

  return (
    <ToastProvider>
      <ToastContainer />
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
          <Route index element={<RoleRedirect />} />

          <Route
            path="validation"
            element={
              <ProtectedRoute allowedRoles={['JEAN']}>
                <ValidationQueuePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="validation/dossier/:id"
            element={
              <ProtectedRoute allowedRoles={['JEAN']}>
                <EvidenceViewerPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="compliance"
            element={
              <ProtectedRoute allowedRoles={['THOMAS']}>
                <ComplianceDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="compliance/alert/:id"
            element={
              <ProtectedRoute allowedRoles={['THOMAS']}>
                <AmlAlertDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="compliance/duplicates"
            element={
              <ProtectedRoute allowedRoles={['THOMAS']}>
                <ConflictResolverPage />
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
    </ToastProvider>
  )
}

export default App
