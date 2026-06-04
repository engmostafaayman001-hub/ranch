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

async function readRegisteredAuthCustomers(): Promise<AppCustomer[]> {
  if (!canUseSupabaseRuntimeTables()) return []

  const supabase = createSupabaseAdminClient()
  const teamUserIds = new Set<string>()
  const { data: teamMembers } = await supabase.from('team_members').select('user_id')

  if (Array.isArray(teamMembers)) {
    for (const member of teamMembers) {
      const userId = typeof member.user_id === 'string' ? member.user_id : ''
      if (userId) teamUserIds.add(userId)
    }
  }

  const customers: AppCustomer[] = []
  let page = 1
  const perPage = 1000

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage })
    if (error || !Array.isArray(data.users) || data.users.length === 0) break

    for (const user of data.users) {
      const email = user.email?.trim().toLowerCase()
      if (!email || teamUserIds.has(user.id)) continue

      const metadata = user.user_metadata || {}
      const name = String(metadata.name || metadata.full_name || metadata.display_name || email.split('@')[0]).trim()
      const phone = String(user.phone || metadata.phone || '').trim()
      const address = String(metadata.address || '').trim()
      const createdAt = user.created_at || new Date().toISOString()

      customers.push({
        id: user.id,
        name,
        email,
        phone,
        address,
        createdAt,
        updatedAt: user.updated_at || user.last_sign_in_at || createdAt,
      })
    }

    if (data.users.length < perPage) break
    page += 1
  }

  return customers
}

function mergeCustomers(...groups: AppCustomer[][]) {
  const byEmail = new Map<string, AppCustomer>()

  for (const group of groups) {
    for (const customer of group) {
      const email = customer.email?.trim().toLowerCase()
      if (!email) continue

      const existing = byEmail.get(email)
      if (!existing) {
        byEmail.set(email, { ...customer, email })
        continue
      }

      byEmail.set(email, {
        ...existing,
        id: existing.id || customer.id,
        name: existing.name || customer.name,
        phone: existing.phone || customer.phone,
        address: existing.address || customer.address,
        createdAt: existing.createdAt < customer.createdAt ? existing.createdAt : customer.createdAt,
        updatedAt: existing.updatedAt > customer.updatedAt ? existing.updatedAt : customer.updatedAt,
      })
    }
  }

  return Array.from(byEmail.values()).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
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
  const registeredCustomers = await readRegisteredAuthCustomers()

  if (canUseSupabaseRuntimeTables()) {
    const supabase = createSupabaseAdminClient()
    const { data, error } = await supabase
      .from('app_customers')
      .select('*')
      .order('updated_at', { ascending: false })

    if (!error && Array.isArray(data)) {
      return mergeCustomers((data as AppCustomerRow[]).map(fromRow), registeredCustomers)
    }
  }

  await ensureDataFile()
  try {
    const raw = await readFile(CUSTOMERS_FILE, 'utf8')
    const parsed = JSON.parse(raw)
    return mergeCustomers(Array.isArray(parsed) ? parsed : [], registeredCustomers)
  } catch {
    return registeredCustomers
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
