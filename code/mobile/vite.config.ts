import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(async ({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const plugins = [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      strategies: 'injectManifest',
      srcDir: 'public',
      filename: 'sw.js',
      manifest: {
        name: 'BICEC VeriPass',
        short_name: 'VeriPass',
        description: 'BICEC VeriPass - Ouverture de compte digitale',
        start_url: '/mobile/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#1A0F00',
        theme_color: '#1A0F00',
        icons: [
          {
            src: 'favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,jpg,jpeg,webp}'],
        globIgnores: ['**/sw.js', '**/workbox-*.js', '**/startup/**'],
      }
    })
  ]

  if (env.SENTRY_AUTH_TOKEN && env.SENTRY_ORG && env.SENTRY_PROJECT) {
    try {
      const dynamicImport = new Function('m', 'return import(m)') as (m: string) => Promise<Record<string, unknown>>
      const sentryModule = await dynamicImport('@sentry/vite-plugin')
      const sentryVitePlugin = sentryModule.sentryVitePlugin as (options: Record<string, unknown>) => unknown
      plugins.push(
        sentryVitePlugin({
          authToken: env.SENTRY_AUTH_TOKEN,
          org: env.SENTRY_ORG,
          project: env.SENTRY_PROJECT,
          release: {
            name: env.VITE_APP_VERSION ? `veripass-mobile@${env.VITE_APP_VERSION}` : undefined,
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
    base: '/mobile/',
    plugins,
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
      fileParallelism: false,
    },
    build: {
      sourcemap: mode === 'production',
    },
    server: {
      port: 3000,
      host: true
    },
    preview: {
      port: 3000,
      host: true
    }
  }
})
