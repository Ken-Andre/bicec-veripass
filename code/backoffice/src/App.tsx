import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import { ToastProvider } from './contexts/ToastContext'
import ToastContainer from './components/ui/ToastContainer'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import { RoleRedirect } from './components/auth/RoleRedirect'
import MainLayout from './components/layout/MainLayout'
import { PageLoader } from './components/PageLoader'

const LoginPage = lazy(() => import('./pages/LoginPage'))
const ValidationQueuePage = lazy(() => import('./pages/validation/ValidationQueuePage'))
const EvidenceViewerPage = lazy(() => import('./pages/validation/EvidenceViewerPage'))
const ComplianceDashboard = lazy(() => import('./pages/compliance/ComplianceDashboard'))
const AmlAlertDetailPage = lazy(() => import('./pages/compliance/AmlAlertDetailPage'))
const ConflictResolverPage = lazy(() => import('./pages/compliance/ConflictResolverPage'))
const AmlListsPage = lazy(() => import('./pages/compliance/AmlListsPage'))
const AdminPage = lazy(() => import('@/pages/admin/AdminPage'))
const SystemLogsPage = lazy(() => import('@/pages/admin/SystemLogsPage'))
const LegalDocumentsPage = lazy(() => import('@/pages/admin/LegalDocumentsPage'))
const CommandCenterPage = lazy(() => import('@/pages/command-center/CommandCenterPage'))
const AnalyticsPage = lazy(() => import('@/pages/analytics/AnalyticsPage'))
const ProfilePage = lazy(() => import('@/pages/ProfilePage'))
const UnauthorizedPage = lazy(() => import('@/pages/UnauthorizedPage'))
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'))

function App() {
  const { isAuthenticated } = useAuth()

  return (
    <ToastProvider>
      <ToastContainer />
      <Suspense fallback={<PageLoader />}>
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
                <ProtectedRoute allowedRoles={['JEAN', 'THOMAS']}>
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
              path="compliance/lists"
              element={
                <ProtectedRoute allowedRoles={['THOMAS', 'SYLVIE', 'ADMIN_IT']}>
                  <AmlListsPage />
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
                <ProtectedRoute allowedRoles={['SYLVIE', 'THOMAS', 'ADMIN_IT']}>
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
            <Route
              path="admin/audit"
              element={
                <ProtectedRoute allowedRoles={['ADMIN_IT', 'SYLVIE']}>
                  <SystemLogsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/legal"
              element={
                <ProtectedRoute allowedRoles={['ADMIN_IT']}>
                  <LegalDocumentsPage />
                </ProtectedRoute>
              }
            />

            <Route path="profile" element={<ProfilePage />} />
          </Route>

          <Route path="/unauthorized" element={<UnauthorizedPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </ToastProvider>
  )
}

export default App
