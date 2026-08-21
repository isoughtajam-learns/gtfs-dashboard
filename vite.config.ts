import { readFileSync } from 'node:fs'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// version.json lives at the repo root, outside tsconfig's `include: ["src"]`,
// so it's read here (a Node context, not part of the app's TS program) and
// injected as a compile-time constant rather than imported directly in src/.
const { version } = JSON.parse(readFileSync(new URL('./version.json', import.meta.url), 'utf-8'))

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
    define: {
      __APP_VERSION__: JSON.stringify(version),
    },
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
