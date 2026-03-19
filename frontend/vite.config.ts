import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

export default defineConfig(({ mode }) => {
  const env    = loadEnv(mode, process.cwd(), '')
  const apiUrl = env.VITE_API_URL || 'http://localhost:8080'

  return {
    plugins: [tailwindcss(), react()],
    resolve: {
      alias: { '@': resolve(import.meta.dirname, './src') },
    },
    server: {
      port: 5151,
      proxy: {
        '/vectorize': { target: apiUrl, changeOrigin: true },
        '/health':    { target: apiUrl, changeOrigin: true },
      },
    },
    build: {
      outDir: '../dist',
      emptyOutDir: true,
    },
  }
})
