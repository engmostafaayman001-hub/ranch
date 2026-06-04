import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { AppNotification } from '@/lib/notifications'
import { normalizeDiscountCode } from '@/lib/discounts'
import { createSupabaseAdminClient } from '@/lib/supabase'

const DATA_DIR = process.env.VERCEL ? '/tmp/ranch-data' : join(process.cwd(), 'data')
const NOTIFICATIONS_FILE = join(DATA_DIR, 'notifications.json')
const NOTIFICATIONS_KEY = 'notifications'

function canUseSupabaseRuntimeTables() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

async function ensureDataFile() {
  await mkdir(DATA_DIR, { recursive: true })
  try {
    await readFile(NOTIFICATIONS_FILE, 'utf8')
  } catch {
    await writeFile(NOTIFICATIONS_FILE, '[]', 'utf8')
  }
}

export async function readServerNotifications(): Promise<AppNotification[]> {
  if (canUseSupabaseRuntimeTables()) {
    const supabase = createSupabaseAdminClient()
    const { data, error } = await supabase
      .from('app_data')
      .select('data')
      .eq('key', NOTIFICATIONS_KEY)
      .maybeSingle()
    if (!error && Array.isArray(data?.data)) return data.data as AppNotification[]
  }

  await ensureDataFile()
  try {
    const raw = await readFile(NOTIFICATIONS_FILE, 'utf8')
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

async function writeServerNotifications(notifications: AppNotification[]) {
  if (canUseSupabaseRuntimeTables()) {
    const supabase = createSupabaseAdminClient()
    const { error } = await supabase.from('app_data').upsert({
      key: NOTIFICATIONS_KEY,
      data: notifications,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'key' })
    if (!error) return
  }

  await ensureDataFile()
  await writeFile(NOTIFICATIONS_FILE, JSON.stringify(notifications, null, 2), 'utf8')
}

export async function createServerNotification(input: Pick<AppNotification, 'title' | 'message' | 'code' | 'discountType' | 'discountValue' | 'minSubtotal' | 'active' | 'expiresAt'>) {
  const notifications = await readServerNotifications()
  const notification: AppNotification = {
    id: `NTF${Date.now()}`,
    title: input.title,
    message: input.message,
    code: input.code ? normalizeDiscountCode(input.code) || undefined : undefined,
    discountType: 'discountType' in input && input.discountType === 'fixed' ? 'fixed' : 'percent',
    discountValue: 'discountValue' in input ? Number(input.discountValue) || undefined : undefined,
    minSubtotal: 'minSubtotal' in input ? Number(input.minSubtotal) || 0 : 0,
    active: 'active' in input ? input.active !== false : true,
    expiresAt: 'expiresAt' in input && input.expiresAt ? String(input.expiresAt) : undefined,
    audience: 'all_customers',
    createdAt: new Date().toISOString(),
  }
  const updated = [notification, ...notifications]
  await writeServerNotifications(updated)
  return notification
}
