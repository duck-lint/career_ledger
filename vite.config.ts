import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react-swc'
import { defineConfig } from 'vite'
import { resolve } from 'path'

const projectRoot = process.env.PROJECT_ROOT || import.meta.dirname

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return
          }

          if (id.includes('lucide-react')) {
            return 'lucide-icons'
          }

          if (id.includes('@radix-ui/')) {
            return 'radix-ui'
          }

          if (id.includes('@tauri-apps/')) {
            return 'tauri-runtime'
          }
        },
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  resolve: {
    alias: {
      '@': resolve(projectRoot, 'src'),
    },
  },
})
