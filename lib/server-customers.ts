import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { AppCustomer } from '@/lib/customers'

const DATA_DIR = join(process.cwd(), 'data')
const CUSTOMERS_FILE = join(DATA_DIR, 'customers.json')

async function ensureDataFile() {
  await mkdir(DATA_DIR, { recursive: true })
  try {
    await readFile(CUSTOMERS_FILE, 'utf8')
  } catch {
    await writeFile(CUSTOMERS_FILE, '[]', 'utf8')
  }
}

export async function readServerCustomers(): Promise<AppCustomer[]> {
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

