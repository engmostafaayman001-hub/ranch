import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { AppNotification } from '@/lib/notifications'

const DATA_DIR = process.env.VERCEL ? '/tmp/ranch-data' : join(process.cwd(), 'data')
const NOTIFICATIONS_FILE = join(DATA_DIR, 'notifications.json')

async function ensureDataFile() {
  await mkdir(DATA_DIR, { recursive: true })
  try {
    await readFile(NOTIFICATIONS_FILE, 'utf8')
  } catch {
    await writeFile(NOTIFICATIONS_FILE, '[]', 'utf8')
  }
}

export async function readServerNotifications(): Promise<AppNotification[]> {
  await ensureDataFile()
  try {
    const raw = await readFile(NOTIFICATIONS_FILE, 'utf8')
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export async function createServerNotification(input: Pick<AppNotification, 'title' | 'message' | 'code' | 'discountType' | 'discountValue' | 'minSubtotal' | 'active' | 'expiresAt'>) {
  const notifications = await readServerNotifications()
  const notification: AppNotification = {
    id: `NTF${Date.now()}`,
    title: input.title,
    message: input.message,
    code: input.code?.trim().toUpperCase() || undefined,
    discountType: 'discountType' in input && input.discountType === 'fixed' ? 'fixed' : 'percent',
    discountValue: 'discountValue' in input ? Number(input.discountValue) || undefined : undefined,
    minSubtotal: 'minSubtotal' in input ? Number(input.minSubtotal) || 0 : 0,
    active: 'active' in input ? input.active !== false : true,
    expiresAt: 'expiresAt' in input && input.expiresAt ? String(input.expiresAt) : undefined,
    audience: 'all_customers',
    createdAt: new Date().toISOString(),
  }
  const updated = [notification, ...notifications]
  await writeFile(NOTIFICATIONS_FILE, JSON.stringify(updated, null, 2), 'utf8')
  return notification
}
