import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// Mirrors the container's nginx /api/ proxy so the app can use one relative URL
// everywhere. Override with BACKEND_URL when the API isn't on the host directly.
export default defineConfig(({ mode }) => {
  // Load env file based on the current 'mode' (development, production, etc.)
  // process.cwd() provides the path to your project root
  const env = loadEnv(mode, process.cwd(), '');
  const backendUrl = env.LOCAL_API_URL ?? env.BACKEND_URL;
  console.log("post-injection backendUrl: " + backendUrl)
  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': {
          target: backendUrl,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },
  }
})
