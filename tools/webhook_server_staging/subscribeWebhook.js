import 'dotenv/config'
import axios from 'axios'

const {
  API_BASE_URL_STAGING,
  API_KEY_STAGING,
  WEBHOOK_SUBSCRIBE_URL_STAGING,
} = process.env

if (!API_BASE_URL_STAGING || !API_KEY_STAGING || !WEBHOOK_SUBSCRIBE_URL_STAGING) {
  console.error('Missing required env variables:')
  console.error('- API_BASE_URL_STAGING')
  console.error('- API_KEY_STAGING')
  console.error('- WEBHOOK_SUBSCRIBE_URL_STAGING')
  process.exit(1)
}

async function subscribeWebhook() {
  try {
    const response = await axios.post(
      `${API_BASE_URL_STAGING}/notification`,
      {
        webhookUrl: WEBHOOK_SUBSCRIBE_URL_STAGING,
        notificationChannel: 'WEBHOOK',
        notificationTypes: ['account_status_change'],
      },
      {
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          'x-reap-api-key': API_KEY_STAGING,
        },
        timeout: 15000,
      }
    )

    console.log('✅ Webhook registered successfully')
    console.log('Notification ID:', response.data.id)
    console.log(JSON.stringify(response.data, null, 2))
  } catch (err) {
    if (err.response) {
      console.error('❌ Registration failed:', err.response.status)
      console.error(JSON.stringify(err.response.data, null, 2))
    } else {
      console.error('❌ Request error:', err.message)
    }
    process.exit(1)
  }
}

subscribeWebhook()