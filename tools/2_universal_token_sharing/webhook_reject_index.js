import 'dotenv/config'
import axios from 'axios'
import fs from 'fs'
import path from 'path'
import FormData from 'form-data'

const { API_BASE_URL_SANDBOX, API_KEY_SANDBOX, API_BASE_URL_STAGING, API_KEY_STAGING, ACCEPT_VERSION } = process.env

if (!API_BASE_URL_SANDBOX || !API_KEY_SANDBOX || !API_BASE_URL_STAGING || !API_KEY_STAGING || !ACCEPT_VERSION) 
{
    console.error('Missing variables in .env')
    process.exit(1)
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

function makeSandboxClient() 
{
    return axios.create({
        baseURL: API_BASE_URL_SANDBOX,
        headers: 
        {
            'x-reap-api-key': API_KEY_SANDBOX,
            Accept: 'application/json',
        },
        timeout: 30_000,
    })
}

function makeStagingClient() 
{
    return axios.create
    ({
        baseURL: API_BASE_URL_STAGING,
        headers: 
        {
            'x-reap-api-key': API_KEY_STAGING,
            Accept: 'application/json',
        },
        timeout: 30_000,
    })
}

function assertFileExists(filePath, friendlyName) 
{
    if (!fs.existsSync(filePath)) 
    {
        console.error(`Missing ${friendlyName}: ${filePath}`)
        process.exit(1)
    }
}

async function run() 
{
    const stagingClient = makeStagingClient()
    const sandboxClient = makeSandboxClient()
    let kycPayload
    const filesDir = path.resolve(process.cwd(), 'universal_token_sharing_files')

    const passportPath = path.join(filesDir, 'passport.pdf')
    const utilityBillPath = path.join(filesDir, 'utilitybill.pdf')

    assertFileExists(passportPath, 'passport.pdf (place it in /universal_token_sharing_files/)')
    assertFileExists(utilityBillPath, 'utilitybill.pdf (place it in /universal_token_sharing_files/)')

    try 
    {
        // STEP 1: Create Entity
        const createEntityResponse = await stagingClient.post('/entity', 
        {
            externalId: 'CUSTOMER-TEST-0000408',
            type: 'INDIVIDUAL',
        })

        console.log('\nEntity created successfully')
        console.log('Status:', createEntityResponse.status)
        console.log('Response Data:', createEntityResponse.data)

        const entityId = createEntityResponse?.data?.id
        if (!entityId) 
        {
            throw new Error('Missing entityId from create entity response')
        }

        // STEP 2: Submit KYC Token (Requirement)
        const canonicalValue = 
        {
            externalUserId: 'demo2-universal-kyc-ingestinon-entity-1x2',
            provider: 
            {
                name: 'sumsub',
                status: 'APPROVED',
                data: 
                [{
                    applicantId: '65f1c2b3a4d5e67890123456',
                    levelName: 'poa_idv_level_v1',
                    verificationStatus: 'reviewed',
                    verifiedAt: '2025-01-15T10:22:11Z',
                    webhook: 
                    {
                        eventType: 'applicantReviewed',
                        receivedAt: '2025-01-15T10:22:14Z',
                        payload: 
                        {
                            reviewStatus: 'completed',
                            reviewResult: 
                            {
                                reviewAnswer: 'GREEN',
                            },
                        },
                    },
                    metadata: 
                    {
                        sumsubCorrelationId: 'b3a7c1f2-2d6a-4f1d-9a3e-0f1a2b3c4d5e',
                    },
                    },],
            },
            identity: 
            {
                firstName: 'Aarav',
                middleName: 'Test',
                lastName: 'Sharma',
                fullName: 'Aarav Test Sharma',
                dob: '1994-06-18',
                nationality: 'IND',
            },
            document: 
            [{
                type: 'PASSPORT',
                number: 'N1234567',
                country: 'IND',
                issuingDate: '2019-03-10',
                expiryDate: '2029-03-09',
            },],
            address: 
            {
                country: 'IND',
                postCode: '560001',
                town: 'Bengaluru',
                street: 'MG Road',
                subStreet: 'Ashok Nagar',
                state: 'Karnataka',
                buildingName: 'Prestige Meridian',
                flatNumber: '12B',
                buildingNumber: '1',
                formattedAddress: 'Flat 12B, Prestige Meridian, 1 MG Road, Ashok Nagar, Bengaluru, Karnataka 560001, India',
            },
            liveness: 
            {
                result: 'APPROVED',
                checkedAt: '2025-01-15T10:19:40Z',
            },
        }

        const submitRequirementResponse = await stagingClient.post(
            `/entity/${encodeURIComponent(entityId)}/requirement`,
            {
                requirementSlug: 'ukyc-canonical-kyc-data',
                value: JSON.stringify(canonicalValue), 
            }
        )

        console.log('\nKYC requirement submitted successfully')
        console.log('Status:', submitRequirementResponse.status)
        console.log('Response Data:', submitRequirementResponse.data)

        // STEP 3: Upload Identity Document (ukyc-id-document)
        {
            const form = new FormData()
            form.append('files', fs.createReadStream(passportPath))

            const res = await stagingClient.post(`/entity/${encodeURIComponent(entityId)}/requirement-slug/ukyc-id-document/upload`, form,
            {
                headers: 
                {
                    ...form.getHeaders(),
                },
            })

            console.log('\nIdentity document uploaded successfully')
            console.log('Status:', res.status)
            console.log('Response Data:', res.data)
        }

        // STEP 4: Upload Proof of Address (ukyc-proof-of-address-document)
        {
            const form = new FormData()
            form.append('files', fs.createReadStream(utilityBillPath))

            const res = await stagingClient.post(
            `/entity/${encodeURIComponent(entityId)}/requirement-slug/ukyc-proof-of-address-document/upload`, form,
            {
                headers: 
                {
                    ...form.getHeaders(),
                },
            })

            console.log('\nProof of address uploaded successfully')
            console.log('Status:', res.status)
            console.log('Response Data:', res.data)

            console.log('\nWaiting 1 minute before fetching signed payload...')
            await sleep(60_000) // 60 seconds
        }

        // STEP 5: Fetch Signed Payload
        {
            const featureSlug = 'universal-kyc-card-issuance-kyc-api'

            const res = await stagingClient.get(
                `/entity/${encodeURIComponent(entityId)}/signed-payload`,
                {
                    params:
                    {
                        featureSlug,
                    }
                }
            )

            kycPayload = res.data
            console.log('\nSigned payload fetched successfully')
            console.log('Status:', res.status)
            console.log('Response Data:', res.data)
        }

        // STEP 6: Card creation
        {
        const createCardRes = await sandboxClient.post(
            '/cards',
            {
            cardType: 'Virtual',
            spendLimit: 1000,
            customerType: 'Consumer',
            kyc: kycPayload,

            preferredCardName: 'Tc Pan',
            meta: {
                otpPhoneNumber: {
                dialCode: 60,
                phoneNumber: '123456789',
                },
                id: '1',
            },
            },
            {
            headers: 
            {
                'Accept-Version': ACCEPT_VERSION,
            },
            }
        )

        console.log('\n✅ Card created successfully')
        console.log('Status:', createCardRes.status)
        console.log('Card ID:', createCardRes.data?.id)
        console.log('Response Data:', createCardRes.data)
        }

        console.log('\n✅ All steps completed successfully')
        console.log('Entity ID:', entityId)
    } 
    catch (err) 
    {
        if (err.response) 
        {
            console.error('\nAPI error:', err.response.status)
            console.error(JSON.stringify(err.response.data, null, 2))
        } 
        else 
        {
            console.error('\nRequest failed:', err.message)
        }
        process.exit(1)
    }
}

run()