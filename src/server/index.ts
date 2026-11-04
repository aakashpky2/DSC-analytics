import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
dotenv.config()

import express from 'express'
import cors from 'cors'
import next from 'next'
import { apiRouter } from './routes/api'

const dev = process.env.NODE_ENV !== 'production'
const hostname = process.env.HOSTNAME || '0.0.0.0'
const port = parseInt(process.env.PORT || '3000', 10)

// Initialize Next.js app with SSR
const nextApp = next({ dev, hostname, port })
const handle = nextApp.getRequestHandler()

async function startServer() {
  await nextApp.prepare()

  const server = express()

  server.use(cors())
  server.use(express.json())
  server.use(express.urlencoded({ extended: true }))

  // Backend API endpoints mounted on /api
  server.use('/api', apiRouter)

  // Next.js handles all other page rendering via Server-Side Rendering (SSR)
  server.all('*', (req, res) => {
    return handle(req, res)
  })

  server.listen(port, () => {
    console.log(`> [DSC Analytics] Server running on http://${hostname}:${port}`)
    console.log(`> Backend API routes mounted at /api/*`)
    console.log(`> Next.js SSR frontend handling page routes`)
  })
}

startServer().catch((err) => {
  console.error('Server failed to start:', err)
  process.exit(1)
})

