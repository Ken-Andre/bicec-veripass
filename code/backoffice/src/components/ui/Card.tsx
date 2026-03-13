import { cn } from '../../lib/utils'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {}

export function Card({ className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-lg border bg-white text-gray-950 shadow-sm',
        className
      )}
      {...props}
    />
  )
}

interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {}

export function CardHeader({ className, ...props }: CardHeaderProps) {
  return (
    <div
      className={cn('flex flex-col space-y-1.5 p-6', className)}
      {...props}
    />
  )
}

interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {}

export function CardTitle({ className, ...props }: CardTitleProps) {
  return (
    <h3
      className={cn('text-lg font-semibold leading-none tracking-tight', className)}
      {...props}
    />
  )
}

interface CardDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {}

export function CardDescription({ className, ...props }: CardDescriptionProps) {
  return (
    <p
      className={cn('text-sm text-gray-500', className)}
      {...props}
    />
  )
}

interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {}

export function CardContent({ className, ...props }: CardContentProps) {
  return (
    <div className={cn('p-6 pt-0', className)} {...props} />
  )
}

interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {}

export function CardFooter({ className, ...props }: CardFooterProps) {
  return (
    <div
      className={cn('flex items-center p-6 pt-0', className)}
      {...props}
    />
  )
}
</content>
<write_to_file>
<path>code/backoffice/src/components/ui/Button.tsx</parameter>
<content>import { forwardRef } from 'react'
import { cn } from '../../lib/utils'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'link' | 'danger'
  size?: 'default' | 'sm' | 'lg' | 'icon'
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    return (
      <button
        className={cn(
          'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none',
          {
            'bg-blue-600 text-white hover:bg-blue-700': variant === 'default',
            'border border-gray-300 bg-white hover:bg-gray-50': variant === 'outline',
            'bg-gray-100 text-gray-900 hover:bg-gray-200': variant === 'secondary',
            'hover:bg-gray-100': variant === 'ghost',
            'text-blue-600 underline-offset-4 hover:underline': variant === 'link',
            'bg-red-600 text-white hover:bg-red-700': variant === 'danger',
          },
          {
            'h-10 px-4 py-2': size === 'default',
            'h-9 rounded-md px-3': size === 'sm',
            'h-11 rounded-md px-8': size === 'lg',
            'h-10 w-10': size === 'icon',
          },
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'

export { Button }
</content>
<write_to_file>
<path>code/backoffice/src/components/ui/Badge.tsx</path>
<content>import { cn } from '../../lib/utils'

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'secondary' | 'success' | 'warning' | 'danger'
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors',
        {
          'bg-blue-100 text-blue-800': variant === 'default',
          'bg-gray-100 text-gray-800': variant === 'secondary',
          'bg-green-100 text-green-800': variant === 'success',
          'bg-yellow-100 text-yellow-800': variant === 'warning',
          'bg-red-100 text-red-800': variant === 'danger',
        },
        className
      )}
      {...props}
    />
  )
}
</content>
<write_to_file>
<path>code/backoffice/src/components/ui/Input.tsx</path>
<content>import { forwardRef } from 'react'
import { cn } from '../../lib/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = 'Input'

export { Input }
</content>
<write_to_file>
<path>code/backoffice/src/test/App.test.tsx</path>
<content>import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from '../App'
import { AuthProvider } from '../contexts/AuthContext'

function renderApp() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

describe('App', () => {
  it('renders login page when not authenticated', () => {
    renderApp()
    expect(screen.getByText(/BICEC VeriPass/i)).toBeInTheDocument()
    expect(screen.getByText(/Back Office - Connexion/i)).toBeInTheDocument()
  })

  it('renders email input', () => {
    renderApp()
    expect(screen.getByLabelText(/Email/i)).toBeInTheDocument()
  })

  it('renders password input', () => {
    renderApp()
    expect(screen.getByLabelText(/Mot de passe/i)).toBeInTheDocument()
  })

  it('renders submit button', () => {
    renderApp()
    expect(screen.getByRole('button', { name: /Se connecter/i })).toBeInTheDocument()
  })
})
</content>
<write_to_file>
<path>code/backoffice/src/test/e2e/backoffice.spec.ts</path>
<content>import { test, expect } from '@playwright/test'

test.describe('Back Office Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3001')
  })

  test('should display login page', async ({ page }) => {
    await expect(page.getByText('BICEC VeriPass')).toBeVisible()
    await expect(page.getByText('Back Office - Connexion')).toBeVisible()
  })

  test('should login as Jean (KYC Validator)', async ({ page }) => {
    await page.fill('input[name="email"]', 'jean@bicec.cm')
    await page.fill('input[name="password"]', 'password')
    await page.click('button[type="submit"]')
    
    await expect(page.getByText('Bienvenue, Jean Dupont')).toBeVisible()
    await expect(page.getByText('Validation KYC')).toBeVisible()
  })

  test('should login as Thomas (AML Compliance)', async ({ page }) => {
    await page.fill('input[name="email"]', 'thomas@bicec.cm')
    await page.fill('input[name="password"]', 'password')
    await page.click('button[type="submit"]')
    
    await expect(page.getByText('Bienvenue, Thomas Martin')).toBeVisible()
    await expect(page.getByText('Conformité AML')).toBeVisible()
  })

  test('should login as Sylvie (Manager)', async ({ page }) => {
    await page.fill('input[name="email"]', 'sylvie@bicec.cm')
    await page.fill('input[name="password"]', 'password')
    await page.click('button[type="submit"]')
    
    await expect(page.getByText('Bienvenue, Sylvie Bernard')).toBeVisible()
    await expect(page.getByText('Command Center')).toBeVisible()
  })

  test('should login as Admin IT', async ({ page }) => {
    await page.fill('input[name="email"]', 'admin@bicec.cm')
    await page.fill('input[name="password"]', 'password')
    await page.click('button[type="submit"]')
    
    await expect(page.getByText('Bienvenue, Admin IT')).toBeVisible()
    await expect(page.getByText('Administration')).toBeVisible()
  })

  test('should show error for invalid credentials', async ({ page }) => {
    await page.fill('input[name="email"]', 'invalid@bicec.cm')
    await page.fill('input[name="password"]', 'wrong')
    await page.click('button[type="submit"]')
    
    await expect(page.getByText('Email ou mot de passe incorrect')).toBeVisible()
  })
})

test.describe('RBAC Navigation', () => {
  test('Jean should access validation desk', async ({ page }) => {
    await page.goto('http://localhost:3001')
    await page.fill('input[name="email"]', 'jean@bicec.cm')
    await page.fill('input[name="password"]', 'password')
    await page.click('button[type="submit"]')
    
    await page.click('text=Validation KYC')
    await expect(page.getByText('Examinez et validez les dossiers KYC')).toBeVisible()
  })

  test('Jean should not access compliance page', async ({ page }) => {
    await page.goto('http://localhost:3001')
    await page.fill('input[name="email"]', 'jean@bicec.cm')
    await page.fill('input[name="password"]', 'password')
    await page.click('button[type="submit"]')
    
    await page.goto('http://localhost:3001/compliance')
    await expect(page).toHaveURL('http://localhost:3001/')
  })

  test('Thomas should access compliance page', async ({ page }) => {
    await page.goto('http://localhost:3001')
    await page.fill('input[name="email"]', 'thomas@bicec.cm')
    await page.fill('input[name="password"]', 'password')
    await page.click('button[type="submit"]')
    
    await page.click('text=Conformité AML')
    await expect(page.getByText('Examinez les alertes PEP et sanctions')).toBeVisible()
  })
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
<path>code/backoffice/README.md</path>
<content># BICEC VeriPass - Back Office

Back-office SPA pour la plateforme KYC digitale BICEC VeriPass.

## Architecture

- **Framework**: React 19 + TypeScript
- **Build**: Vite 8
- **Styling**: Tailwind CSS 4
- **Routing**: React Router DOM 7
- **State Management**: TanStack React Query
- **Testing**: Vitest + Playwright

## Port

- **Développement**: 3001
- **Production**: 3001

## Rôles RBAC

| Rôle | Description | Pages accessibles |
|------|-------------|-------------------|
| `JEAN` | Agent KYC - Validation dossiers | Dashboard, Validation KYC |
| `THOMAS` | Superviseur AML/CFT | Dashboard, Conformité AML, Analytics |
| `SYLVIE` | Manager - Command Center | Dashboard, Command Center, Analytics |
| `ADMIN_IT` | Administrateur système | Dashboard, Administration |

## Comptes de démonstration

- `jean@bicec.cm` - Jean Dupont (JEAN)
- `thomas@bicec.cm` - Thomas Martin (THOMAS)
- `sylvie@bicec.cm` - Sylvie Bernard (SYLVIE)
- `admin@bicec.cm` - Admin IT (ADMIN_IT)

## Scripts

```bash
# Développement
npm run dev

# Build
npm run build

# Tests unitaires
npm run test

# Tests E2E
npm run test:e2e

# Lint
npm run lint
```

## Structure du projet

```
src/
├── components/
│   ├── auth/           # Composants d'authentification
│   ├── layout/         # Layout principal (Sidebar, Header)
│   └── ui/             # Composants UI réutilisables
├── contexts/           # Contextes React
├── hooks/              # Hooks personnalisés
├── lib/                # Utilitaires
├── pages/              # Pages de l'application
│   ├── admin/          # Administration
│   ├── analytics/      # Analytics
│   ├── command-center/ # Command Center
│   ├── compliance/     # Conformité AML
│   └── validation/     # Validation KYC
├── services/           # Services API
├── test/               # Tests
└── types/              # Types TypeScript
```

## Conventions

- Commits conventionnels (feat, chore, test, fix)
- Tests unitaires avec Vitest
- Tests E2E avec Playwright
- RBAC strict par rôle