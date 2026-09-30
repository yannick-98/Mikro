import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))

// El proyecto es un unico paquete con la raiz en la carpeta del repositorio,
// asi que vite se invoca desde alli y aqui se fija su raiz y su salida.
export default defineConfig({
  root: here,
  plugins: [react()],
  build: {
    outDir: path.join(here, 'dist'),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
})
