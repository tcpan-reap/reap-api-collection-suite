import 'dotenv/config'
import axios from 'axios'

const {API_BASE_URL_SANDBOX, API_KEY_SANDBOX, ACCEPT_VERSION, WEBHOOK_SUBSCRIBE_URL_SANDBOX,} = process.env

if (!API_BASE_URL_SANDBOX || !API_KEY_SANDBOX || !ACCEPT_VERSION || !WEBHOOK_SUBSCRIBE_URL_SANDBOX) 
{
    console.error('Missing required env variables')
    process.exit(1)
}

async function subscribeWebhook() 
{
    try 
    {
        const response = await axios.post(`${API_BASE_URL_SANDBOX}/webhooks`,
        {
            subscriberUrl: WEBHOOK_SUBSCRIBE_URL_SANDBOX,
        },
        {
            headers: 
            {
                'x-reap-api-key': API_KEY_SANDBOX,
                'Accept-Version': ACCEPT_VERSION,
                'Content-Type': 'application/json',
                accept: 'application/json',
            },
        })

        console.log('✅ Webhook subscribed successfully')
        console.log('Webhook ID:', response.data.id)
    } 
    catch (err) 
    {
        if (err.response) 
        {
            console.error('❌ Subscription failed:', err.response.status)
            console.error(err.response.data)
        } 
        else 
        {
            console.error('❌ Request error:', err.message)
        }
        process.exit(1)
    }
}

subscribeWebhook()
