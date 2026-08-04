import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { AppCustomer } from '@/lib/customers'
import { createSupabaseAdminClient } from '@/lib/supabase'

const DATA_DIR = process.env.VERCEL ? '/tmp/ranch-data' : join(process.cwd(), 'data')
const CUSTOMERS_FILE = join(DATA_DIR, 'customers.json')
const CUSTOMERS_CACHE_MS = 60000

let customersCache: { data: AppCustomer[]; at: number } | null = null
let customersReadPromise: Promise<AppCustomer[]> | null = null

function setCustomersCache(data: AppCustomer[]) {
  customersCache = { data, at: Date.now() }
}

function clearCustomersCache() {
  customersCache = null
  customersReadPromise = null
}

function canUseSupabaseRuntimeTables() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

function shouldRequireSupabaseRuntimeTables() {
  return Boolean(process.env.VERCEL && canUseSupabaseRuntimeTables())
}

function getSupabaseErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'message' in error) return String((error as { message?: unknown }).message || error)
  return String(error || 'Unknown Supabase error')
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

  try {
    const supabase = createSupabaseAdminClient()
    const teamUserIds = new Set<string>()
    const { data: teamMembers, error: teamError } = await supabase.from('team_members').select('user_id')
    if (teamError) throw teamError

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
      if (error) throw error
      if (!Array.isArray(data.users) || data.users.length === 0) break

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
  } catch (error) {
    if (shouldRequireSupabaseRuntimeTables()) throw error
    return []
  }
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
  if (customersCache && Date.now() - customersCache.at < CUSTOMERS_CACHE_MS) return customersCache.data
  if (customersReadPromise) return customersReadPromise

  customersReadPromise = readServerCustomersFresh().finally(() => {
    customersReadPromise = null
  })

  return customersReadPromise
}

async function readServerCustomersFresh(): Promise<AppCustomer[]> {
  const registeredCustomers = await readRegisteredAuthCustomers()

  if (canUseSupabaseRuntimeTables()) {
    const supabase = createSupabaseAdminClient()
    const { data, error } = await supabase
      .from('app_customers')
      .select('*')
      .order('updated_at', { ascending: false })

    if (!error && Array.isArray(data)) {
      const customers = mergeCustomers((data as AppCustomerRow[]).map(fromRow), registeredCustomers)
      setCustomersCache(customers)
      return customers
    }

    if (shouldRequireSupabaseRuntimeTables()) {
      throw new Error(`Could not read customers from Supabase: ${getSupabaseErrorMessage(error)}`)
    }
  }

  await ensureDataFile()
  try {
    const raw = await readFile(CUSTOMERS_FILE, 'utf8')
    const parsed = JSON.parse(raw)
    const customers = mergeCustomers(Array.isArray(parsed) ? parsed : [], registeredCustomers)
    setCustomersCache(customers)
    return customers
  } catch {
    setCustomersCache(registeredCustomers)
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
      clearCustomersCache()
      return fromRow(data as AppCustomerRow)
    }

    if (shouldRequireSupabaseRuntimeTables()) {
      throw new Error(`Could not save customer to Supabase: ${getSupabaseErrorMessage(error)}`)
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
  clearCustomersCache()
  return customer
}

export async function deleteServerCustomer(input: {
  id?: string
  email?: string
  phone?: string
}) {
  const id = input.id?.trim()
  const email = input.email?.trim().toLowerCase()
  const phone = input.phone?.replace(/\D/g, '')

  if (!id && !email && !phone) {
    throw new Error('Customer id, email, or phone is required')
  }

  if (canUseSupabaseRuntimeTables()) {
    const supabase = createSupabaseAdminClient()
    const customers = await readServerCustomers()
    const matches = customers.filter((customer) => {
      const customerPhone = customer.phone?.replace(/\D/g, '')
      return (
        (id && customer.id === id) ||
        (email && customer.email?.toLowerCase() === email) ||
        (phone && customerPhone === phone)
      )
    })

    const appCustomerIds = matches
      .filter((customer) => customer.id?.startsWith('CUS'))
      .map((customer) => customer.id)

    if (appCustomerIds.length > 0) {
      const { error } = await supabase.from('app_customers').delete().in('id', appCustomerIds)
      if (error && shouldRequireSupabaseRuntimeTables()) {
        throw new Error(`Could not delete customer from Supabase: ${getSupabaseErrorMessage(error)}`)
      }
    }

    clearCustomersCache()
    return { deleted: appCustomerIds.length }
  }

  await ensureDataFile()
  const customers = await readServerCustomers()
  const kept = customers.filter((customer) => {
    const customerPhone = customer.phone?.replace(/\D/g, '')
    return !(
      (id && customer.id === id) ||
      (email && customer.email?.toLowerCase() === email) ||
      (phone && customerPhone === phone)
    )
  })

  await writeFile(CUSTOMERS_FILE, JSON.stringify(kept, null, 2), 'utf8')
  clearCustomersCache()
  return { deleted: customers.length - kept.length }
}
