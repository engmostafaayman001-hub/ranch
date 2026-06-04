import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createSupabaseAdminClient } from '@/lib/supabase'

const DATA_DIR = process.env.VERCEL ? '/tmp/ranch-data' : join(process.cwd(), 'data')
const EXPENSES_FILE = join(DATA_DIR, 'expenses.json')
const EXPENSES_KEY = 'expenses'

export type ServerExpense = {
  id: string
  name: string
  amount: number
  date: string
  note: string
  createdAt: string
}

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
    await readFile(EXPENSES_FILE, 'utf8')
  } catch {
    await writeFile(EXPENSES_FILE, '[]', 'utf8')
  }
}

export async function readServerExpenses(): Promise<ServerExpense[]> {
  if (canUseSupabaseRuntimeTables()) {
    const supabase = createSupabaseAdminClient()
    const { data, error } = await supabase
      .from('app_data')
      .select('data')
      .eq('key', EXPENSES_KEY)
      .maybeSingle()
    if (!error && Array.isArray(data?.data)) return data.data as ServerExpense[]
  }

  await ensureDataFile()
  try {
    const raw = await readFile(EXPENSES_FILE, 'utf8')
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

async function writeServerExpenses(expenses: ServerExpense[]) {
  if (canUseSupabaseRuntimeTables()) {
    const supabase = createSupabaseAdminClient()
    const { error } = await supabase.from('app_data').upsert({
      key: EXPENSES_KEY,
      data: expenses,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'key' })
    if (!error) return
  }

  await ensureDataFile()
  await writeFile(EXPENSES_FILE, JSON.stringify(expenses, null, 2), 'utf8')
}

export async function createServerExpense(input: Omit<ServerExpense, 'id' | 'createdAt'>) {
  const expenses = await readServerExpenses()
  const expense: ServerExpense = {
    ...input,
    id: `EXP${Date.now()}`,
    createdAt: new Date().toISOString(),
  }
  const updated = [expense, ...expenses]
  await writeServerExpenses(updated)
  return expense
}

export async function deleteServerExpense(id: string) {
  const expenses = await readServerExpenses()
  const updated = expenses.filter((expense) => expense.id !== id)
  await writeServerExpenses(updated)
  return updated.length !== expenses.length
}
