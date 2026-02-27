import 'dotenv/config'
import axios from 'axios'
import fs from 'fs'
import path from 'path'
import FormData from 'form-data'

const { API_BASE_URL_STAGING, API_KEY_STAGING } = process.env

if (!API_BASE_URL_STAGING || !API_KEY_STAGING) 
{
    console.error('Missing API_BASE_URL_STAGING or API_KEY_STAGING in root .env')
    process.exit(1)
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

function makeClient() 
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
    const client = makeClient()
    const filesDir = path.resolve(process.cwd(), 'universal_token_sharing_files')

    const passportPath = path.join(filesDir, 'passport.pdf')
    const utilityBillPath = path.join(filesDir, 'utilitybill.pdf')

    assertFileExists(passportPath, 'passport.pdf (place it in /universal_token_sharing_files/)')
    assertFileExists(utilityBillPath, 'utilitybill.pdf (place it in /universal_token_sharing_files/)')

    try 
    {
        // STEP 1: Create Entity
        const createEntityResponse = await client.post('/entity', 
        {
            externalId: 'CUSTOMER-TEST-0000301',
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
                    applicantId: '7c9e4a1f2b6d8e3a5c0f9b12',
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
                        sumsubCorrelationId: '9f3c2a7b-1d4e-4c8f-a2b6-5e7d9c1f0a3b',
                    },
                }],
            },

            identity: 
            {
                firstName: 'Tc',
                middleName: 'Test',
                lastName: 'Pan',
                fullName: 'Tc Test Pan',
                dob: '1994-06-18',
                nationality: 'CAN',
            },

            document: 
            [{
                type: 'PASSPORT',
                number: 'K1234567',
                country: 'CAN',
                issuingDate: '2019-03-10',
                expiryDate: '2029-03-09',
            }],

            address: 
            {
                country: 'CAN',
                postCode: 'M5V 3L9',
                town: 'Toronto',
                street: 'King Street West',
                subStreet: 'Downtown',
                state: 'ON',
                buildingName: 'TIFF Bell Lightbox',
                flatNumber: '1208',
                buildingNumber: '350',
                formattedAddress: 'Unit 1208, 350 King Street West, Toronto, ON M5V 3L9, Canada',
            },

            liveness: 
            {
                result: 'APPROVED',
                checkedAt: '2025-01-15T10:19:40Z',
            },
        }

        const submitRequirementResponse = await client.post(
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

            const res = await client.post(`/entity/${encodeURIComponent(entityId)}/requirement-slug/ukyc-id-document/upload`, form,
            {
                headers: 
                {
                    ...form.getHeaders(),
                    'x-reap-api-key': API_KEY_STAGING,
                    Accept: 'application/json',
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

            const res = await client.post(
            `/entity/${encodeURIComponent(entityId)}/requirement-slug/ukyc-proof-of-address-document/upload`, form,
            {
                headers: 
                {
                    ...form.getHeaders(),
                    'x-reap-api-key': API_KEY_STAGING,
                    Accept: 'application/json',
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

            const res = await client.get(
                `/entity/${encodeURIComponent(entityId)}/signed-payload`,
                {
                    params:
                    {
                        featureSlug,
                    },
                    headers:
                    {
                        Accept: 'application/json',
                        'Content-Type': 'application/json',
                        featureSlug,
                        'x-reap-api-key': API_KEY_STAGING,
                    },
                }
            )

            console.log('\nSigned payload fetched successfully')
            console.log('Status:', res.status)
            console.log('Response Data:', res.data)
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