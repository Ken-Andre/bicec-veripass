import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import MainLayout from './components/layout/MainLayout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import ValidationDeskPage from './pages/validation/ValidationDeskPage'
import CompliancePage from './pages/compliance/CompliancePage'
import AdminPage from './pages/admin/AdminPage'
import AnalyticsPage from './pages/analytics/AnalyticsPage'
import CommandCenterPage from './pages/command-center/CommandCenterPage'
import NotFoundPage from './pages/NotFoundPage'

function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles?: string[] }) {
  const { user, isAuthenticated } = useAuth()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

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
              <ValidationDeskPage />
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

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

export default App
</content>
<write_to_file>
<path>code/backoffice/src/lib/utils.ts</path>
<content>import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
</content>
<write_to_file>
<path>code/backoffice/src/vite-env.d.ts</path>
<content>/// <reference types="vite/client" />
</content>
<write_to_file>
<path>code/backoffice/tailwind.config.ts</path>
<content>import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}

export default config
</content>
<write_to_file>
<path>code/backoffice/vitest.config.ts</path>
<content>import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
</content>
<write_to_file>
<path>code/backoffice/playwright.config.ts</path>
<content>import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './src/test/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3001',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3001',
    reuseExistingServer: !process.env.CI,
  },
})
</content>
<write_to_file>
<path>code/backoffice/.env</path>
<content>VITE_API_URL=http://localhost:8000/api/v1
VITE_PORT=3001
</content>
<write_to_file>
<path>code/backoffice/.gitignore</path>
<content># Logs
logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
lerna-debug.log*

node_modules
dist
dist-ssr
*.local

# Editor directories and files
.vscode/*
!.vscode/extensions.json
.idea
.DS_Store
*.suo
*.ntvs*
*.njsproj
*.sln
*.sw?

# Environment
.env.local
.env.*.local

# Test coverage
coverage
</content>
<write_to_file>
<path>code/backoffice/src/test/setup.ts</path>
<content>import '@testing-library/jest-dom'
</content>
<write_to_file>
<path>code/backoffice/README.md</path>
<content># BICEC VeriPass - Back Office

Back-office SPA pour la plateforme KYC digitale BICEC VeriPass.

## Architecture

- **Framework**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS v4
- **State**: React Context (Auth, RBAC)
- **Routing**: React Router v6
- **Testing**: Vitest + Playwright

## Rôles utilisateurs

| Rôle | Email | Accès |
|------|-------|-------|
| JEAN | jean@bicec.cm | Validation KYC |
| THOMAS | thomas@bicec.cm | Conformité AML |
| SYLVIE | sylvie@bicec.cm | Command Center, Analytics |
| ADMIN_IT | admin@bicec.cm | Administration |

## Démarrage

```bash
npm install
npm run dev
```

## Tests

```bash
npm run test        # Unit tests
npm run test:e2e    # E2E tests