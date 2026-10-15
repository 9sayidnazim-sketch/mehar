import react from '@vitejs/plugin-react'
import base44 from '@base44/vite-plugin'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig(() => {
  return {
    plugins: [
      base44({
        legacySDKImports: process.env.BASE44_LEGACY_SDK_IMPORTS === 'true',
        hmrNotifier: false,
        navigationNotifier: false,
        analyticsTracker: false,
        visualEditAgent: false
      }),
      react(),
    ]
  };
});

