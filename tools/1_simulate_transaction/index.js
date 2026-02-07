import 'dotenv/config'
import axios from 'axios'

const { API_BASE_URL, API_KEY, ACCEPT_VERSION } = process.env

if (!API_BASE_URL || !API_KEY || !ACCEPT_VERSION) 
{
    console.error('Missing API_BASE_URL, API_KEY, or ACCEPT_VERSION in root .env')
    process.exit(1)
}

async function run() 
{
    try 
    {
        //STEP 1: Create card
        const createCardResponse = await axios.post(
            `${API_BASE_URL}/cards`,
            {
                cardType: 'Virtual',
                spendLimit: '1000',
                customerType: 'Consumer',
                kyc: 
                {
                    firstName: 'Tc',
                    lastName: 'Pan',
                    dob: '2000-07-22',
                    residentialAddress: 
                    {
                        line1: '75 Test',
                        line2: 'Test Street',
                        city: 'Victoria City',
                        country: 'HKG'
                    },
                    idDocumentType: 'Passport',
                    idDocumentNumber: '1234567',
                },
                preferredCardName: 'Tc Pan',
                meta : 
                {
                    otpPhoneNumber:
                    {
                        dialCode: 60,
                        phoneNumber:'123456789'
                    },
                    id: '1'
                }
            },
            {
                headers: 
                {
                    'x-reap-api-key': API_KEY,
                    'Content-Type': 'application/json',
                    'Accept-Version': ACCEPT_VERSION,
                    accept: 'application/json',
                },
            }
        )

        const cardId = createCardResponse.data.id

        console.log('Card created:', cardId)

        // STEP 2: Simulate authorisation timeout
        const simulateAuthResponse = await axios.post(
            `${API_BASE_URL}/simulate/authorisation`,
            {
                cardID: cardId,
                billAmount: 100,
                transactionCurrency: '840',
                simulateTimeout: true,
            },
            {
                headers: 
                {
                    'x-reap-api-key': API_KEY,
                    'Content-Type': 'application/json',
                    'Accept-Version': ACCEPT_VERSION,
                    accept: 'application/json',
                },
            }
        )

        console.log('Simulated authorisation response:', simulateAuthResponse.status, simulateAuthResponse.data)
    } 
    catch (err) 
    {
        if (err.response) 
        {
            console.error('API error:', err.response.status)
            console.error(err.response.data)
        } 
        else 
        {
            console.error('Request failed:', err.message)
        }
        process.exit(1)
    }
}

run()
