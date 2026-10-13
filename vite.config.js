
import react from '@vitejs/plugin-react'
import base44 from '@base44/vite-plugin'
import { defineConfig, loadEnv } from 'vite'
import { whatsappVitePlugin } from './server/whatsappVitePlugin.js'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [
      base44({
        legacySDKImports: process.env.BASE44_LEGACY_SDK_IMPORTS === 'true',
        hmrNotifier: true,
        navigationNotifier: true,
        analyticsTracker: true,
        visualEditAgent: true
      }),
      react(),
      whatsappVitePlugin(env),
    ],
    server: {
      port: 5173
    }
  };
});
