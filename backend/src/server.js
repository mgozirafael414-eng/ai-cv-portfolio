import 'dotenv/config'
import { createApp } from './app.js'

const port = Number(process.env.PORT) || 5000
const app = createApp()

app.listen(port, () => {
  console.log(`Backend placeholder listening on http://localhost:${port}`)
})
