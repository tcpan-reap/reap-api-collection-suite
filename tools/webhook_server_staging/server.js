import 'dotenv/config'
import express from 'express'
import crypto from 'crypto'

const app = express()

/**
 * Capture raw body for signature verification.
 * MUST verify against raw bytes, not JSON.stringify(req.body).
 */
app.use(
  express.json({
    type: '*/*',
    verify: (req, res, buf) => {
      req.rawBody = buf // Buffer
    },
  })
)

const PORT = 3001

function getPublicKeyFromEnv() {
  const key = process.env.WEBHOOK_PUBLIC_KEY_STAGING
  if (!key) {
    throw new Error('Missing WEBHOOK_PUBLIC_KEY_STAGING in env')
  }

  // Allow storing as a single-line env var with \n sequences
  // e.g. "-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"
  return key.includes('\\n') ? key.replace(/\\n/g, '\n') : key
}

function verifyWebhookSignature({ rawBody, signatureBase64, publicKeyPem }) {
  if (!signatureBase64) return false
  if (!rawBody || !Buffer.isBuffer(rawBody)) return false

  const verifier = crypto.createVerify('RSA-SHA512')
  verifier.update(rawBody)
  verifier.end()

  return verifier.verify(publicKeyPem, signatureBase64, 'base64')
}

app.post('/webhook/reap', (req, res) => {
  const requestId = req.headers['x-request-id'] || req.headers['x-correlation-id'] || ''

  console.log('--- COMPLIANCE WEBHOOK RECEIVED ---')
  if (requestId) console.log('Request ID:', requestId)
  console.log('Headers:', req.headers)
  console.log('Body:', JSON.stringify(req.body, null, 2))

  const signature = req.headers['reap-signature']

  let publicKeyPem
  try {
    publicKeyPem = getPublicKeyFromEnv()
  } catch (e) {
    console.error('❌ Server misconfigured:', e.message)
    // Misconfiguration: fail closed
    return res.status(500).send('Server misconfigured')
  }

  const ok = verifyWebhookSignature({
    rawBody: req.rawBody,
    signatureBase64: signature,
    publicKeyPem,
  })

  if (!ok) {
    console.error('❌ Invalid webhook signature')
    return res.status(401).send('Invalid signature')
  }

  console.log('✅ Webhook signature verified')

  // TODO: process the event (idempotently) here
  // Keep it fast; respond within 5 seconds.
  return res.status(200).send('OK')
})

app.get('/health', (req, res) => {
  res.status(200).send('ok')
})

app.listen(PORT, () => {
  console.log(`Compliance webhook server listening on http://localhost:${PORT}`)
  console.log(`POST endpoint: http://localhost:${PORT}/webhook/reap`)
})