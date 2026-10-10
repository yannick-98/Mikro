import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))

// El proyecto es un unico paquete con la raiz en la carpeta del repositorio,
// asi que vite se invoca desde alli y aqui se fija su raiz y su salida.
export default defineConfig({
  root: here,
  // El .env del proyecto vive en la raiz del repositorio, no en frontend/.
  // Sin esto, vite busca las variables VITE_* al lado de este fichero y no
  // las encuentra: la clave publica de Shopify llegaba vacia al compilar.
  envDir: path.dirname(here),
  plugins: [react()],
  build: {
    outDir: path.join(here, 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      // Dos entradas: la web y la app incrustada en Shopify. La segunda existe
      // para poder cargar App Bridge en su head sin meterlo en la web publica.
      input: {
        main: path.join(here, 'index.html'),
        shopify: path.join(here, 'shopify.html'),
      },
    },
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
