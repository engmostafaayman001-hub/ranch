import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { AppCustomer } from '@/lib/customers'
import { createSupabaseAdminClient } from '@/lib/supabase'

const DATA_DIR = process.env.VERCEL ? '/tmp/ranch-data' : join(process.cwd(), 'data')
const CUSTOMERS_FILE = join(DATA_DIR, 'customers.json')

function canUseSupabaseRuntimeTables() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

type AppCustomerRow = {
  id: string
  name: string
  email: string
  phone: string
  address: string
  created_at: string
  updated_at: string
}

function fromRow(row: AppCustomerRow): AppCustomer {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    address: row.address,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

async function ensureDataFile() {
  await mkdir(DATA_DIR, { recursive: true })
  try {
    await readFile(CUSTOMERS_FILE, 'utf8')
  } catch {
    await writeFile(CUSTOMERS_FILE, '[]', 'utf8')
  }
}

export async function readServerCustomers(): Promise<AppCustomer[]> {
  if (canUseSupabaseRuntimeTables()) {
    const supabase = createSupabaseAdminClient()
    const { data, error } = await supabase
      .from('app_customers')
      .select('*')
      .order('updated_at', { ascending: false })

    if (!error && Array.isArray(data)) {
      return (data as AppCustomerRow[]).map(fromRow)
    }
  }

  await ensureDataFile()
  try {
    const raw = await readFile(CUSTOMERS_FILE, 'utf8')
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export async function upsertServerCustomer(input: {
  name?: string
  email: string
  phone?: string
  address?: string
}) {
  const email = input.email.trim().toLowerCase()
  const now = new Date().toISOString()

  if (canUseSupabaseRuntimeTables()) {
    const supabase = createSupabaseAdminClient()
    const id = `CUS${Buffer.from(email).toString('base64url').slice(0, 24)}`
    const { data, error } = await supabase
      .from('app_customers')
      .upsert({
        id,
        name: input.name?.trim() || email.split('@')[0],
        email,
        phone: input.phone?.trim() || '',
        address: input.address?.trim() || '',
        updated_at: now,
      }, { onConflict: 'email' })
      .select('*')
      .single()

    if (!error && data) {
      return fromRow(data as AppCustomerRow)
    }
  }

  const customers = await readServerCustomers()
  const existing = customers.find((customer) => customer.email.toLowerCase() === email)

  let customer: AppCustomer
  if (existing) {
    customer = {
      ...existing,
      name: input.name?.trim() || existing.name,
      phone: input.phone?.trim() || existing.phone,
      address: input.address?.trim() || existing.address,
      updatedAt: now,
    }
  } else {
    customer = {
      id: `CUS${Date.now()}`,
      name: input.name?.trim() || email.split('@')[0],
      email,
      phone: input.phone?.trim() || '',
      address: input.address?.trim() || '',
      createdAt: now,
      updatedAt: now,
    }
  }

  const updated = existing
    ? customers.map((item) => (item.email.toLowerCase() === email ? customer : item))
    : [customer, ...customers]

  await writeFile(CUSTOMERS_FILE, JSON.stringify(updated, null, 2), 'utf8')
  return customer
}
