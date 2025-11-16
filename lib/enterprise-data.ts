// Sample enterprise data

export interface Employee {
  id: string
  name: string
  department: string
  position: string
  email: string
  salary: number
  hireDate: string
}

export interface FinancialData {
  id: string
  quarter: string
  revenue: number
  expenses: number
  profit: number
  department: string
}

export interface KPIData {
  id: string
  metric: string
  value: number
  target: number
  trend: "up" | "down" | "stable"
  period: string
}

// Adding Salesforce data interface
export interface SalesforceData {
  id: string
  opportunityName: string
  accountName: string
  stage: string
  amount: number
  closeDate: string
  probability: number
}

// Sample HR Data
export const HR_DATA: Employee[] = [
  {
    id: "emp001",
    name: "Alice Johnson",
    department: "Engineering",
    position: "Senior Software Engineer",
    email: "alice.johnson@company.com",
    salary: 145000,
    hireDate: "2020-03-15",
  },
  {
    id: "emp002",
    name: "Bob Smith",
    department: "Finance",
    position: "Financial Analyst",
    email: "bob.smith@company.com",
    salary: 95000,
    hireDate: "2021-06-01",
  },
  {
    id: "emp003",
    name: "Carol Williams",
    department: "Marketing",
    position: "Marketing Manager",
    email: "carol.williams@company.com",
    salary: 120000,
    hireDate: "2019-11-20",
  },
  {
    id: "emp004",
    name: "David Brown",
    department: "Engineering",
    position: "DevOps Engineer",
    email: "david.brown@company.com",
    salary: 130000,
    hireDate: "2020-08-10",
  },
  {
    id: "emp005",
    name: "Emma Davis",
    department: "HR",
    position: "HR Director",
    email: "emma.davis@company.com",
    salary: 135000,
    hireDate: "2018-01-05",
  },
]

// Sample Financial Data
export const FINANCIAL_DATA: FinancialData[] = [
  {
    id: "fin001",
    quarter: "Q1 2025",
    revenue: 2500000,
    expenses: 1800000,
    profit: 700000,
    department: "Company-wide",
  },
  {
    id: "fin002",
    quarter: "Q4 2024",
    revenue: 2300000,
    expenses: 1700000,
    profit: 600000,
    department: "Company-wide",
  },
  {
    id: "fin003",
    quarter: "Q1 2025",
    revenue: 800000,
    expenses: 500000,
    profit: 300000,
    department: "Engineering",
  },
  {
    id: "fin004",
    quarter: "Q1 2025",
    revenue: 900000,
    expenses: 600000,
    profit: 300000,
    department: "Sales",
  },
  {
    id: "fin005",
    quarter: "Q1 2025",
    revenue: 800000,
    expenses: 700000,
    profit: 100000,
    department: "Marketing",
  },
]

// Sample KPI Data
export const KPI_DATA: KPIData[] = [
  {
    id: "kpi001",
    metric: "Customer Satisfaction",
    value: 87,
    target: 85,
    trend: "up",
    period: "March 2025",
  },
  {
    id: "kpi002",
    metric: "Employee Retention",
    value: 92,
    target: 90,
    trend: "up",
    period: "Q1 2025",
  },
  {
    id: "kpi003",
    metric: "Product Delivery Time",
    value: 14,
    target: 15,
    trend: "down",
    period: "March 2025",
  },
  {
    id: "kpi004",
    metric: "Sales Growth",
    value: 23,
    target: 20,
    trend: "up",
    period: "Q1 2025",
  },
  {
    id: "kpi005",
    metric: "Bug Resolution Time",
    value: 3.2,
    target: 4.0,
    trend: "down",
    period: "March 2025",
  },
]

// Sample Salesforce Data
export const SALESFORCE_DATA: SalesforceData[] = [
  {
    id: "sf001",
    opportunityName: "Enterprise Cloud Migration",
    accountName: "Acme Corporation",
    stage: "Proposal/Price Quote",
    amount: 500000,
    closeDate: "2025-04-15",
    probability: 75,
  },
  {
    id: "sf002",
    opportunityName: "Digital Transformation Project",
    accountName: "Global Industries Inc",
    stage: "Negotiation/Review",
    amount: 850000,
    closeDate: "2025-03-30",
    probability: 90,
  },
  {
    id: "sf003",
    opportunityName: "Security Infrastructure Upgrade",
    accountName: "TechStart Solutions",
    stage: "Qualification",
    amount: 250000,
    closeDate: "2025-05-20",
    probability: 50,
  },
  {
    id: "sf004",
    opportunityName: "AI Platform Implementation",
    accountName: "Innovation Labs",
    stage: "Closed Won",
    amount: 1200000,
    closeDate: "2025-02-28",
    probability: 100,
  },
  {
    id: "sf005",
    opportunityName: "Mobile App Development",
    accountName: "Retail Plus",
    stage: "Prospecting",
    amount: 180000,
    closeDate: "2025-06-10",
    probability: 25,
  },
]
