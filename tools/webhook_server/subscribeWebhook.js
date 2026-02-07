import 'dotenv/config'
import axios from 'axios'

const {API_BASE_URL, API_KEY, ACCEPT_VERSION, WEBHOOK_SUBSCRIBE_URL,} = process.env

if (!API_BASE_URL || !API_KEY || !ACCEPT_VERSION || !WEBHOOK_SUBSCRIBE_URL) 
{
    console.error('Missing required env variables')
    process.exit(1)
}

async function subscribeWebhook() 
{
    try 
    {
        const response = await axios.post(`${API_BASE_URL}/webhooks`,
        {
            subscriberUrl: WEBHOOK_SUBSCRIBE_URL,
        },
        {
            headers: 
            {
                'x-reap-api-key': API_KEY,
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
