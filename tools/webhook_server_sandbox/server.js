import 'dotenv/config'
import express from 'express'

const app = express()

app.use(express.json({ type: '*/*' }))

const PORT = process.env.WEBHOOK_PORT || 3001

app.post('/webhook/reap', (req, res) => 
{
    console.log('--- WEBHOOK RECEIVED ---')
    console.log('Headers:', req.headers)
    console.log('Body:', JSON.stringify(req.body, null, 2))

    res.status(200).json({ received: true })
})

app.get('/health', (req, res) => 
{
    res.status(200).send('ok')
})

app.listen(PORT, () => 
{
    console.log(`Webhook server listening on http://localhost:${PORT}`)
    console.log(`POST endpoint: http://localhost:${PORT}/webhook/reap`)
})
