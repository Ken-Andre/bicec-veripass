import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(async ({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const plugins = [react()]

  if (env.SENTRY_AUTH_TOKEN && env.SENTRY_ORG && env.SENTRY_PROJECT) {
    try {
      const dynamicImport = new Function('m', 'return import(m)') as (m: string) => Promise<any>
      const sentryModule = await dynamicImport('@sentry/vite-plugin')
      const sentryVitePlugin = sentryModule.sentryVitePlugin as (options: Record<string, unknown>) => unknown
      plugins.push(
        sentryVitePlugin({
          authToken: env.SENTRY_AUTH_TOKEN,
          org: env.SENTRY_ORG,
          project: env.SENTRY_PROJECT,
          release: {
            name: env.VITE_APP_VERSION ? `veripass-backoffice@${env.VITE_APP_VERSION}` : undefined,
          },
          sourcemaps: {
            assets: './dist/**',
          },
        }) as never
      )
    } catch (error) {
      console.warn('[Sentry] @sentry/vite-plugin not installed; sourcemap upload skipped.', error)
    }
  }

  return {
    base: './',
    plugins,
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    build: {
      sourcemap: mode === 'production',
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (id.includes('node_modules')) return 'vendor';
            if (id.includes('/pages/validation/')) return 'validation-screens';
            if (id.includes('/pages/compliance/')) return 'compliance-screens';
          },
        },
      },
    },
    server: {
      port: 3001,
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:8001',
          changeOrigin: true,
        },
      },
    },
    preview: {
      port: 3001,
    },
  }
})
