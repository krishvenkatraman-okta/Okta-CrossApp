import jsforce from 'jsforce'

export interface SalesforceConfig {
  instanceUrl: string
  accessToken: string
}

export class SalesforceClient {
  private conn: jsforce.Connection

  constructor(config: SalesforceConfig) {
    this.conn = new jsforce.Connection({
      instanceUrl: config.instanceUrl,
      accessToken: config.accessToken,
      version: '62.0'
    })
  }

  async describeOpportunity() {
    return await this.conn.sobject('Opportunity').describe()
  }

  async queryOpportunities(limit = 10) {
    return await this.conn.query(
      `SELECT Id, Name, StageName, Amount, CloseDate FROM Opportunity LIMIT ${limit}`
    )
  }

  async createOpportunity(opportunity: {
    Name: string
    StageName: string
    CloseDate: string
    Amount?: number
  }) {
    return await this.conn.sobject('Opportunity').create(opportunity)
  }

  async getOpportunity(id: string) {
    return await this.conn.sobject('Opportunity').retrieve(id)
  }
}

export function createSalesforceConnection(instanceUrl: string, accessToken: string) {
  return new jsforce.Connection({
    instanceUrl,
    accessToken,
    version: '62.0'
  })
}
