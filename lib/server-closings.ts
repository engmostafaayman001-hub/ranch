import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { ClosingRecord } from '@/lib/closings'
import { createSupabaseAdminClient } from '@/lib/supabase'

const DATA_DIR = process.env.VERCEL ? '/tmp/ranch-data' : join(process.cwd(), 'data')
const CLOSINGS_FILE = join(DATA_DIR, 'closings.json')
const CLOSINGS_KEY = 'closings'
const CLOSINGS_CACHE_MS = 60000

let closingsCache: { data: ClosingRecord[]; at: number } | null = null
let closingsReadPromise: Promise<ClosingRecord[]> | null = null

function setClosingsCache(closings: ClosingRecord[]) {
  closingsCache = { data: closings, at: Date.now() }
}

function clearClosingsCache() {
  closingsCache = null
  closingsReadPromise = null
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

async function ensureDataFile() {
  await mkdir(DATA_DIR, { recursive: true })
  try {
    await readFile(CLOSINGS_FILE, 'utf8')
  } catch {
    await writeFile(CLOSINGS_FILE, '[]', 'utf8')
  }
}

function sortClosings(closings: ClosingRecord[]) {
  return [...closings].sort((first, second) => new Date(second.closedAt || second.openedAt).getTime() - new Date(first.closedAt || first.openedAt).getTime())
}

export async function readServerClosings(): Promise<ClosingRecord[]> {
  if (closingsCache && Date.now() - closingsCache.at < CLOSINGS_CACHE_MS) return closingsCache.data
  if (closingsReadPromise) return closingsReadPromise

  closingsReadPromise = readServerClosingsFresh().finally(() => {
    closingsReadPromise = null
  })

  return closingsReadPromise
}

async function readServerClosingsFresh(): Promise<ClosingRecord[]> {
  if (canUseSupabaseRuntimeTables()) {
    const supabase = createSupabaseAdminClient()
    const { data, error } = await supabase.from('app_data').select('data').eq('key', CLOSINGS_KEY).maybeSingle()
    if (!error && Array.isArray(data?.data)) {
      const closings = sortClosings(data.data as ClosingRecord[])
      setClosingsCache(closings)
      return closings
    }
    if (error && shouldRequireSupabaseRuntimeTables()) {
      throw new Error(`Could not read closings from Supabase: ${getSupabaseErrorMessage(error)}`)
    }
  }

  await ensureDataFile()
  try {
    const raw = await readFile(CLOSINGS_FILE, 'utf8')
    const parsed = JSON.parse(raw)
    const closings = sortClosings(Array.isArray(parsed) ? parsed as ClosingRecord[] : [])
    setClosingsCache(closings)
    return closings
  } catch {
    return []
  }
}

async function writeServerClosings(closings: ClosingRecord[]) {
  const sorted = sortClosings(closings)
  if (canUseSupabaseRuntimeTables()) {
    const supabase = createSupabaseAdminClient()
    const { error } = await supabase.from('app_data').upsert({
      key: CLOSINGS_KEY,
      data: sorted,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'key' })
    if (!error) return sorted
    if (shouldRequireSupabaseRuntimeTables()) {
      throw new Error(`Could not save closings to Supabase: ${getSupabaseErrorMessage(error)}`)
    }
  }

  await ensureDataFile()
  await writeFile(CLOSINGS_FILE, JSON.stringify(sorted, null, 2), 'utf8')
  return sorted
}

export async function saveServerClosing(record: ClosingRecord) {
  const closings = await readServerClosings()
  const next = [record, ...closings.filter((closing) => closing.id !== record.id)]
  await writeServerClosings(next)
  clearClosingsCache()
  return record
}

export async function clearServerClosings() {
  const current = await readServerClosings()
  await writeServerClosings([])
  clearClosingsCache()
  return current.length
}
