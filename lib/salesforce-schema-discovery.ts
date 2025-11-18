import { createSalesforceConnection } from './salesforce-client'

export interface SalesforceSchema {
  objects: {
    name: string
    label: string
    fields: Array<{
      name: string
      label: string
      type: string
    }>
    queryable: boolean
    createable: boolean
  }[]
}

export async function discoverSalesforceSchema(instanceUrl: string, accessToken: string) {
  try {
    const conn = createSalesforceConnection(instanceUrl, accessToken)
    
    // Get global describe to see all available objects
    const describe = await conn.describeGlobal()
    
    // Filter to commonly used objects or all queryable objects
    const relevantObjects = describe.sobjects.filter(
      obj => obj.queryable && (
        obj.name === 'Opportunity' ||
        obj.name === 'Account' ||
        obj.name === 'Lead' ||
        obj.name === 'Contact' ||
        obj.name === 'Case' ||
        obj.name === 'Task'
      )
    )
    
    // Get detailed schema for each object
    const schemaPromises = relevantObjects.map(async obj => {
      const detailedDescribe = await conn.sobject(obj.name).describe()
      return {
        name: obj.name,
        label: obj.label,
        fields: detailedDescribe.fields.map(field => ({
          name: field.name,
          label: field.label,
          type: field.type
        })),
        queryable: obj.queryable,
        createable: obj.createable
      }
    })
    
    const objects = await Promise.all(schemaPromises)
    
    return { objects }
  } catch (error) {
    console.error('[v0] Error discovering Salesforce schema:', error)
    throw error
  }
}

export function generateSalesforceToolDescription(schema: SalesforceSchema): string {
  const objectDescriptions = schema.objects.map(obj => {
    const fieldList = obj.fields.slice(0, 10).map(f => f.name).join(', ')
    return `- ${obj.label} (${obj.name}): Fields include ${fieldList}`
  })
  
  return `Available Salesforce objects:\n${objectDescriptions.join('\n')}`
}
