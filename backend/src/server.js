import 'dotenv/config'
import { createApp } from './app.js'

const port = Number(process.env.PORT) || 4000
const app = createApp()

app.listen(port, () => {
  console.log(`\n  Mikro API escuchando en http://localhost:${port}`)
  console.log(`  Salud: http://localhost:${port}/api/health\n`)
})
