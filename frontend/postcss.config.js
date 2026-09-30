import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))

// Vite se invoca desde la raiz del repositorio, asi que la configuracion de
// Tailwind se indica por ruta absoluta en lugar de dejar que la busque.
export default {
  plugins: {
    tailwindcss: { config: path.join(here, 'tailwind.config.js') },
    autoprefixer: {},
  },
}
