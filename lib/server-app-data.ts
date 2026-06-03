import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { AppSettings, defaultCategories, defaultProducts, defaultSettings, MenuCategory, MenuProduct } from '@/lib/app-data'
import { createSupabaseAdminClient } from '@/lib/supabase'

const DATA_DIR = process.env.VERCEL ? '/tmp/ranch-data' : join(process.cwd(), 'data')
const APP_DATA_FILE = join(DATA_DIR, 'app-data.json')
const APP_DATA_KEY = 'shared_app_data'

export type SharedAppData = {
  categories: MenuCategory[]
  products: MenuProduct[]
  settings: AppSettings
}

const fallbackData: SharedAppData = {
  categories: defaultCategories,
  products: defaultProducts,
  settings: defaultSettings,
}

function canUseSupabaseRuntimeTables() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

function normalizeSharedData(data: Partial<SharedAppData> | null | undefined): SharedAppData {
  const repaired = repairMojibake(data) as Partial<SharedAppData> | null | undefined
  return {
    categories: Array.isArray(repaired?.categories) ? repaired.categories : [],
    products: Array.isArray(repaired?.products) ? repaired.products : [],
    settings: { ...defaultSettings, ...(repaired?.settings || {}) },
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

export async function readSharedAppData(): Promise<SharedAppData> {
  if (canUseSupabaseRuntimeTables()) {
    const supabase = createSupabaseAdminClient()
    const { data, error } = await supabase
      .from('app_data')
      .select('data')
      .eq('key', APP_DATA_KEY)
      .maybeSingle()

    if (!error && data?.data) return normalizeSharedData(data.data as Partial<SharedAppData>)
    if (!error && !data) return fallbackData
  }

  try {
    const raw = await readFile(APP_DATA_FILE, 'utf8')
    const parsed = JSON.parse(raw) as Partial<SharedAppData>
    return normalizeSharedData(parsed)
  } catch {
    return fallbackData
  }
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

    if (!error) return normalized
  }

  await ensureDataFile()
  await writeFile(APP_DATA_FILE, JSON.stringify(normalized, null, 2), 'utf8')
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
  return writeSharedAppData({
    ...current,
    settings: { ...current.settings, ...settings },
  })
}
