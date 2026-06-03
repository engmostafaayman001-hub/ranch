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

export async function createServerNotification(input: Pick<AppNotification, 'title' | 'message' | 'code'>) {
  const notifications = await readServerNotifications()
  const notification: AppNotification = {
    id: `NTF${Date.now()}`,
    title: input.title,
    message: input.message,
    code: input.code,
    audience: 'all_customers',
    createdAt: new Date().toISOString(),
  }
  const updated = [notification, ...notifications]
  await writeFile(NOTIFICATIONS_FILE, JSON.stringify(updated, null, 2), 'utf8')
  return notification
}
