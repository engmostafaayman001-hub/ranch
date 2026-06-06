import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { AppSettings, defaultCategories, defaultPrinters, defaultProducts, defaultSettings, DeliveryDriver, MenuCategory, MenuProduct, PrinterRole } from '@/lib/app-data'
import { createSupabaseAdminClient } from '@/lib/supabase'

const DATA_DIR = process.env.VERCEL ? '/tmp/ranch-data' : join(process.cwd(), 'data')
const APP_DATA_FILE = join(DATA_DIR, 'app-data.json')
const APP_DATA_KEY = 'shared_app_data'
const APP_DATA_CACHE_MS = 10000
const SUPABASE_READ_TIMEOUT_MS = Number(process.env.SUPABASE_APP_DATA_READ_TIMEOUT_MS || 10000)
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
  return Boolean(process.env.VERCEL && canUseSupabaseRuntimeTables())
}

function getSupabaseErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'message' in error) return String((error as { message?: unknown }).message || error)
  return String(error || 'Unknown Supabase error')
}

function normalizeSharedData(data: Partial<SharedAppData> | null | undefined): SharedAppData {
  const repaired = repairMojibake(data) as Partial<SharedAppData> | null | undefined
  const printers = repaired?.settings?.printers as Partial<AppSettings['printers']> | undefined
  const normalizePrinter = (role: PrinterRole) => {
    const incoming = (printers?.[role] || {}) as Partial<AppSettings['printers'][PrinterRole]>
    const method = incoming.method === 'bluetooth' || incoming.method === 'usb' || incoming.method === 'network'
      ? incoming.method
      : defaultPrinters[role].method
    return {
      ...defaultPrinters[role],
      ...incoming,
      method,
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
  if (canUseSupabaseRuntimeTables() && Date.now() >= supabaseAppDataCooldownUntil) {
    const supabase = createSupabaseAdminClient()
    try {
      const { data, error } = await withTimeout(
        supabase
          .from('app_data')
          .select('data')
          .eq('key', APP_DATA_KEY)
          .maybeSingle(),
        SUPABASE_READ_TIMEOUT_MS
      )

      if (error) throw error

      if (data?.data) {
        const normalized = normalizeSharedData(data.data as Partial<SharedAppData>)
        setAppDataCache(normalized)
        return normalized
      }
      if (!error && !data) return fallbackData
    } catch (error) {
      console.warn('[server-app-data] Falling back after Supabase read failed:', getSupabaseErrorMessage(error))
      supabaseAppDataCooldownUntil = Date.now() + SUPABASE_COOLDOWN_MS
      if (shouldRequireSupabaseRuntimeTables()) throw error
    }
  }

  if (appDataCache) return appDataCache.data
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

    if (shouldRequireSupabaseRuntimeTables()) {
      throw new Error(`Could not save app data to Supabase: ${getSupabaseErrorMessage(error)}`)
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
  const printers = settings.printers
  return writeSharedAppData({
    ...current,
    settings: {
      ...current.settings,
      ...settings,
      printers: printers
        ? {
            cashier: { ...current.settings.printers.cashier, ...(printers.cashier || {}) },
            kitchen: { ...current.settings.printers.kitchen, ...(printers.kitchen || {}) },
            hall: { ...current.settings.printers.hall, ...(printers.hall || {}) },
          }
        : current.settings.printers,
    },
  })
}

export async function updateSharedDrivers(drivers: DeliveryDriver[]) {
  const current = await readSharedAppData()
  return writeSharedAppData({
    ...current,
    drivers,
  })
}
