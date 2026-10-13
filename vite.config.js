
import react from '@vitejs/plugin-react'
import base44 from '@base44/vite-plugin'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const gatewayUrl = env.GATEWAY_URL || process.env.GATEWAY_URL || 'http://localhost:8098';
  const gatewayApiKey = env.GATEWAY_API_KEY || process.env.GATEWAY_API_KEY || 'f358885b7f1f9ac6dd97201ee6323caa43e431a9b043e421a184f5246b9d5722';

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
    ],
    server: {
      proxy: {
        '/api/gateway': {
          target: gatewayUrl,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/gateway/, ''),
          headers: {
            apikey: gatewayApiKey
          }
        }
      }
    }
  };
});
