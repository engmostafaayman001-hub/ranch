import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { AppSettings, defaultCategories, defaultPrinters, defaultProducts, defaultSettings, DeliveryDriver, MenuCategory, MenuProduct, PrinterRole } from '@/lib/app-data'
import { createSupabaseAdminClient } from '@/lib/supabase'

const DATA_DIR = process.env.VERCEL ? '/tmp/ranch-data' : join(process.cwd(), 'data')
const APP_DATA_FILE = join(DATA_DIR, 'app-data.json')
const APP_DATA_KEY = 'shared_app_data'
const APP_DATA_CACHE_MS = 10000
const SUPABASE_READ_TIMEOUT_MS = Number(process.env.SUPABASE_APP_DATA_READ_TIMEOUT_MS || 30000)
const SUPABASE_COOLDOWN_MS = 45000

let appDataCache: { data: SharedAppData; at: number } | null = null
let appDataReadPromise: Promise<SharedAppData> | null = null
let supabaseAppDataCooldownUntil = 0

export type SharedAppData = {
  categories: MenuCategory[]
  products: MenuProduct[]
  drivers: DeliveryDriver[]
  settings: AppSettings
}

const fallbackData: SharedAppData = {
  categories: defaultCategories,
  products: defaultProducts,
  drivers: [],
  settings: defaultSettings,
}

function canUseSupabaseRuntimeTables() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

function shouldRequireSupabaseRuntimeTables() {
  return process.env.SUPABASE_REQUIRE_RUNTIME_TABLES === 'true' && canUseSupabaseRuntimeTables()
}

function getSupabaseErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'message' in error) return String((error as { message?: unknown }).message || error)
  return String(error || 'Unknown Supabase error')
}

function isRecoverableSupabaseError(error: unknown) {
  const message = getSupabaseErrorMessage(error).toLowerCase()
  return message.includes('could not find the table')
    || message.includes('does not exist')
    || message.includes('relation')
    || message.includes('pgrst205')
    || message.includes('failed to fetch')
    || message.includes('timed out')
}

function normalizeSharedData(data: Partial<SharedAppData> | null | undefined): SharedAppData {
  const repaired = repairMojibake(data) as Partial<SharedAppData> | null | undefined
  const printers = repaired?.settings?.printers as Partial<AppSettings['printers']> | undefined
  const normalizePrinter = (role: PrinterRole) => {
    const incoming = (printers?.[role] || {}) as Partial<AppSettings['printers'][PrinterRole]>
    const rawMethod = incoming.method || incoming.connectionType
    const method = rawMethod === 'bluetooth' || rawMethod === 'usb' || rawMethod === 'network' || rawMethod === 'system'
      ? rawMethod
      : defaultPrinters[role].method
    return {
      ...defaultPrinters[role],
      ...incoming,
      method,
      connectionType: method,
      lastConnectedMethod: incoming.lastConnectedMethod === method ? incoming.lastConnectedMethod : '',
      deviceName: incoming.deviceName || incoming.name || defaultPrinters[role].deviceName,
    }
  }
  return {
    categories: Array.isArray(repaired?.categories) ? repaired.categories : [],
    products: Array.isArray(repaired?.products) ? repaired.products : [],
    drivers: Array.isArray(repaired?.drivers) ? repaired.drivers : [],
    settings: {
      ...defaultSettings,
      ...(repaired?.settings || {}),
      printers: {
        cashier: normalizePrinter('cashier'),
        kitchen: normalizePrinter('kitchen'),
        hall: normalizePrinter('hall'),
      } as Record<PrinterRole, AppSettings['printers'][PrinterRole]>,
    },
  }
}

function repairMojibake(value: unknown): unknown {
  if (typeof value === 'string') {
    if (!/[ØÙÃÂâðï�]/.test(value)) return value
    try {
      return Buffer.from(value, 'latin1').toString('utf8')
    } catch {
      return value
    }
  }

  if (Array.isArray(value)) return value.map(repairMojibake)

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, repairMojibake(item)])
    )
  }

  return value
}

async function ensureDataFile() {
  await mkdir(DATA_DIR, { recursive: true })
  try {
    await readFile(APP_DATA_FILE, 'utf8')
  } catch {
    await writeFile(APP_DATA_FILE, JSON.stringify(fallbackData, null, 2), 'utf8')
  }
}

function setAppDataCache(data: SharedAppData) {
  appDataCache = { data, at: Date.now() }
}

function isFreshAppDataCache() {
  return appDataCache && Date.now() - appDataCache.at < APP_DATA_CACHE_MS
}

function withTimeout<T>(promise: PromiseLike<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`Supabase app data read timed out after ${ms}ms`)), ms)
    }),
  ])
}

async function readAppDataFile() {
  try {
    const raw = await readFile(APP_DATA_FILE, 'utf8')
    const parsed = JSON.parse(raw) as Partial<SharedAppData>
    return normalizeSharedData(parsed)
  } catch {
    return fallbackData
  }
}

async function readSharedAppDataFresh(): Promise<SharedAppData> {
  const requireSupabase = shouldRequireSupabaseRuntimeTables()
  if (canUseSupabaseRuntimeTables() && (requireSupabase || Date.now() >= supabaseAppDataCooldownUntil)) {
    const supabase = createSupabaseAdminClient()
    try {
      const { data: row, error } = await withTimeout(
        supabase
          .from('app_data')
          .select('data')
          .eq('key', APP_DATA_KEY)
          .maybeSingle<{ data: Partial<SharedAppData> | null }>(),
        SUPABASE_READ_TIMEOUT_MS
      )

      if (error) throw error

      if (row?.data) {
        const normalized = normalizeSharedData(row.data)
        setAppDataCache(normalized)
        return normalized
      }
      if (!error && !row) {
        const normalized = normalizeSharedData(fallbackData)
        const { error: upsertError } = await supabase.from('app_data').upsert({
          key: APP_DATA_KEY,
          data: normalized,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'key' })
        if (upsertError) throw upsertError
        setAppDataCache(normalized)
        return normalized
      }
    } catch (error) {
      console.warn('[server-app-data] Falling back after Supabase read failed:', getSupabaseErrorMessage(error))
      supabaseAppDataCooldownUntil = Date.now() + SUPABASE_COOLDOWN_MS
      if (appDataCache) return appDataCache.data
      if (requireSupabase && !isRecoverableSupabaseError(error)) {
        throw error
      }
    }
  }

  if (appDataCache) return appDataCache.data
  if (requireSupabase) {
    throw new Error('Supabase app data is required but no shared data could be loaded')
  }
  const data = await readAppDataFile()
  setAppDataCache(data)
  return data
}

export async function readSharedAppData(): Promise<SharedAppData> {
  if (isFreshAppDataCache()) return appDataCache!.data
  if (appDataReadPromise) return appDataReadPromise

  appDataReadPromise = readSharedAppDataFresh().finally(() => {
    appDataReadPromise = null
  })
  return appDataReadPromise
}

export async function writeSharedAppData(data: SharedAppData) {
  const normalized = normalizeSharedData(data)

  if (canUseSupabaseRuntimeTables()) {
    const supabase = createSupabaseAdminClient()
    const { error } = await supabase.from('app_data').upsert({
      key: APP_DATA_KEY,
      data: normalized,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'key' })

    if (!error) {
      setAppDataCache(normalized)
      return normalized
    }

    if (shouldRequireSupabaseRuntimeTables() && !isRecoverableSupabaseError(error)) {
      throw new Error(`Could not save app data to Supabase: ${getSupabaseErrorMessage(error)}`)
    }

    if (isRecoverableSupabaseError(error)) {
      console.warn('[server-app-data] Falling back to local file after Supabase write failed:', getSupabaseErrorMessage(error))
    }
  }

  await ensureDataFile()
  await writeFile(APP_DATA_FILE, JSON.stringify(normalized, null, 2), 'utf8')
  setAppDataCache(normalized)
  return normalized
}

export async function updateSharedCatalog(catalog: Pick<SharedAppData, 'categories' | 'products'>) {
  const current = await readSharedAppData()
  return writeSharedAppData({
    ...current,
    categories: catalog.categories,
    products: catalog.products,
  })
}

export async function updateSharedSettings(settings: Partial<AppSettings>) {
  const current = await readSharedAppData()
  const { printers: _ignoredPrinters, ...sharedSettings } = settings
  void _ignoredPrinters
  return writeSharedAppData({
    ...current,
    settings: {
      ...current.settings,
      ...sharedSettings,
      printers: current.settings.printers,
    },
  })
}

function mergeDriverRecords(existingDrivers: DeliveryDriver[], incomingDrivers: Array<Partial<DeliveryDriver>> = []): DeliveryDriver[] {
  const normalizedExisting = existingDrivers.map((driver) => ({
    ...driver,
    id: driver.id || `driver-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: typeof driver.name === 'string' ? driver.name.trim() : '',
    email: typeof driver.email === 'string' ? driver.email.trim() : '',
    phone: typeof driver.phone === 'string' ? driver.phone.trim() : '',
    area: typeof driver.area === 'string' ? driver.area.trim() : '',
    status: (driver.status === 'inactive' ? 'inactive' : 'active') as DeliveryDriver['status'],
  }))

  const map = new Map<string, DeliveryDriver>()

  const addDriver = (driver: DeliveryDriver) => {
    const key = driver.id || `${driver.email || ''}:${driver.phone || ''}:${driver.name || ''}`
    const existing = map.get(key)
    if (existing) {
      map.set(key, {
        ...existing,
        ...driver,
        name: (driver.name || existing.name || '').trim() || 'Driver',
        email: (driver.email || existing.email || '').trim(),
        phone: (driver.phone || existing.phone || '').trim(),
        area: (driver.area || existing.area || '').trim(),
        status: driver.status === 'inactive' ? 'inactive' : (existing.status === 'inactive' ? 'inactive' : 'active'),
      })
      return
    }
    map.set(key, driver)
  }

  normalizedExisting.forEach(addDriver)
  incomingDrivers.forEach((driver) => {
    addDriver({
      id: driver.id || `driver-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: typeof driver.name === 'string' ? driver.name.trim() : '',
      email: typeof driver.email === 'string' ? driver.email.trim() : '',
      phone: typeof driver.phone === 'string' ? driver.phone.trim() : '',
      area: typeof driver.area === 'string' ? driver.area.trim() : '',
      status: (driver.status === 'inactive' ? 'inactive' : 'active') as DeliveryDriver['status'],
    })
  })

  return Array.from(map.values()).map((driver, index) => ({ ...driver, id: driver.id || `driver-${index + 1}` }))
}

export async function updateSharedDrivers(drivers: DeliveryDriver[]) {
  const current = await readSharedAppData()
  return writeSharedAppData({
    ...current,
    drivers: mergeDriverRecords(current.drivers, drivers),
  })
}
