import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { AppNotification } from '@/lib/notifications'
import { normalizeDiscountCode } from '@/lib/discounts'
import { createSupabaseAdminClient } from '@/lib/supabase'

const DATA_DIR = process.env.VERCEL ? '/tmp/ranch-data' : join(process.cwd(), 'data')
const NOTIFICATIONS_FILE = join(DATA_DIR, 'notifications.json')
const NOTIFICATIONS_KEY = 'notifications'
const NOTIFICATIONS_CACHE_MS = 10000
const SUPABASE_READ_TIMEOUT_MS = Number(process.env.SUPABASE_NOTIFICATIONS_READ_TIMEOUT_MS || 10000)
const SUPABASE_COOLDOWN_MS = 45000

let notificationsCache: { data: AppNotification[]; at: number } | null = null
let notificationsReadPromise: Promise<AppNotification[]> | null = null
let supabaseNotificationsCooldownUntil = 0

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

async function ensureDataFile() {
  await mkdir(DATA_DIR, { recursive: true })
  try {
    await readFile(NOTIFICATIONS_FILE, 'utf8')
  } catch {
    await writeFile(NOTIFICATIONS_FILE, '[]', 'utf8')
  }
}

function setNotificationsCache(notifications: AppNotification[]) {
  notificationsCache = { data: notifications, at: Date.now() }
}

function isFreshNotificationsCache() {
  return notificationsCache && Date.now() - notificationsCache.at < NOTIFICATIONS_CACHE_MS
}

function withTimeout<T>(promise: PromiseLike<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`Supabase notifications read timed out after ${ms}ms`)), ms)
    }),
  ])
}

async function readNotificationsFile() {
  await ensureDataFile()
  try {
    const raw = await readFile(NOTIFICATIONS_FILE, 'utf8')
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed as AppNotification[] : []
  } catch {
    return []
  }
}

async function readServerNotificationsFresh(): Promise<AppNotification[]> {
  if (canUseSupabaseRuntimeTables() && Date.now() >= supabaseNotificationsCooldownUntil) {
    const supabase = createSupabaseAdminClient()
    try {
      const { data, error } = await withTimeout(
        supabase
          .from('app_data')
          .select('data')
          .eq('key', NOTIFICATIONS_KEY)
          .maybeSingle(),
        SUPABASE_READ_TIMEOUT_MS
      )
      if (error) throw error

      if (Array.isArray(data?.data)) {
        const notifications = data.data as AppNotification[]
        setNotificationsCache(notifications)
        return notifications
      }
    } catch (error) {
      console.warn('[server-notifications] Falling back after Supabase read failed:', getSupabaseErrorMessage(error))
      supabaseNotificationsCooldownUntil = Date.now() + SUPABASE_COOLDOWN_MS
      if (shouldRequireSupabaseRuntimeTables()) throw error
    }
  }

  if (notificationsCache) return notificationsCache.data
  const notifications = await readNotificationsFile()
  setNotificationsCache(notifications)
  return notifications
}

export async function readServerNotifications(): Promise<AppNotification[]> {
  if (isFreshNotificationsCache()) return notificationsCache!.data
  if (notificationsReadPromise) return notificationsReadPromise

  notificationsReadPromise = readServerNotificationsFresh().finally(() => {
    notificationsReadPromise = null
  })
  return notificationsReadPromise
}

async function writeServerNotifications(notifications: AppNotification[]) {
  if (canUseSupabaseRuntimeTables()) {
    const supabase = createSupabaseAdminClient()
    const { error } = await supabase.from('app_data').upsert({
      key: NOTIFICATIONS_KEY,
      data: notifications,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'key' })
    if (!error) {
      setNotificationsCache(notifications)
      return
    }
    if (shouldRequireSupabaseRuntimeTables()) {
      throw new Error(`Could not save notifications to Supabase: ${getSupabaseErrorMessage(error)}`)
    }
  }

  await ensureDataFile()
  await writeFile(NOTIFICATIONS_FILE, JSON.stringify(notifications, null, 2), 'utf8')
  setNotificationsCache(notifications)
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
