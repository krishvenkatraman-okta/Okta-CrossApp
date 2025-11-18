import { NextRequest, NextResponse } from 'next/server'
import { createSalesforceConnection } from '@/lib/salesforce-client'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const accessToken = searchParams.get('accessToken')
    const instanceUrl = searchParams.get('instanceUrl')
    
    if (!accessToken || !instanceUrl) {
      return NextResponse.json(
        { message: 'Missing accessToken or instanceUrl' },
        { status: 400 }
      )
    }
    
    const conn = createSalesforceConnection(instanceUrl, accessToken)
    
    // Query opportunities using JSForce
    const result = await conn.query(
      'SELECT Id, Name, StageName, Amount, CloseDate FROM Opportunity LIMIT 10'
    )
    
    return NextResponse.json({
      totalSize: result.totalSize,
      records: result.records
    })
  } catch (error) {
    console.error('[v0] Salesforce API error:', error)
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Failed to fetch opportunities' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { accessToken, instanceUrl, opportunity } = await request.json()
    
    if (!accessToken || !instanceUrl || !opportunity) {
      return NextResponse.json(
        { message: 'Missing required parameters' },
        { status: 400 }
      )
    }
    
    const conn = createSalesforceConnection(instanceUrl, accessToken)
    
    // Create opportunity using JSForce
    const result = await conn.sobject('Opportunity').create(opportunity)
    
    return NextResponse.json(result)
  } catch (error) {
    console.error('[v0] Salesforce API error:', error)
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Failed to create opportunity' },
      { status: 500 }
    )
  }
}
