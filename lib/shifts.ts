import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const DATA_DIR = process.env.VERCEL ? '/tmp/ranch-data' : join(process.cwd(), 'data')
const SHIFTS_FILE = join(DATA_DIR, 'shifts.json')

export type ShiftState = 'opened' | 'active' | 'ready_to_close' | 'confirmed' | 'closed' | 'locked'

export type ShiftRecord = {
  id: string
  openedAt: string
  closedAt?: string | null
  lockedAt?: string | null
  openedBy?: string | null
  confirmedBy?: string | null
  state: ShiftState
  openingBalance?: number
  closingBalance?: number | null
  metadata?: Record<string, unknown>
}

async function ensureDataFile() {
  await mkdir(DATA_DIR, { recursive: true })
  try {
    await readFile(SHIFTS_FILE, 'utf8')
  } catch {
    await writeFile(SHIFTS_FILE, '[]', 'utf8')
  }
}

export async function readShifts(): Promise<ShiftRecord[]> {
  await ensureDataFile()
  try {
    const raw = await readFile(SHIFTS_FILE, 'utf8')
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as ShiftRecord[]) : []
  } catch {
    return []
  }
}

async function writeShifts(shifts: ShiftRecord[]) {
  await ensureDataFile()
  await writeFile(SHIFTS_FILE, JSON.stringify(shifts, null, 2), 'utf8')
}

export async function getShift(id: string): Promise<ShiftRecord | undefined> {
  if (!id) return undefined
  const shifts = await readShifts()
  return shifts.find((s) => s.id === id)
}

export async function getCurrentOpenShift(): Promise<ShiftRecord | undefined> {
  const shifts = await readShifts()
  return shifts.find((shift) => shift.state === 'opened' || shift.state === 'active' || shift.state === 'ready_to_close' || shift.state === 'confirmed')
}

export async function createShift(openedBy?: string | null, initial?: Partial<ShiftRecord>): Promise<ShiftRecord> {
  const shifts = await readShifts()
  const requestedId = initial?.id
  if (requestedId) {
    const existing = shifts.find((shift) => shift.id === requestedId)
    if (existing) return existing
  }
  const now = new Date().toISOString()
  const shift: ShiftRecord = {
    id: requestedId || `SHIFT-${Date.now()}`,
    openedAt: initial?.openedAt || now,
    closedAt: null,
    lockedAt: null,
    openedBy: openedBy || null,
    confirmedBy: initial?.confirmedBy || null,
    state: initial?.state || 'opened',
    openingBalance: typeof initial?.openingBalance === 'number' ? initial!.openingBalance : undefined,
    closingBalance: null,
    metadata: initial?.metadata || {},
  }
  const next = [shift, ...shifts]
  await writeShifts(next)
  return shift
}

export async function updateShift(id: string, patch: Partial<ShiftRecord>): Promise<ShiftRecord | null> {
  const shifts = await readShifts()
  const idx = shifts.findIndex((s) => s.id === id)
  if (idx === -1) return null
  const updated: ShiftRecord = { ...shifts[idx], ...patch }
  shifts[idx] = updated
  await writeShifts(shifts)
  return updated
}

export async function closeShift(id: string, closedAt?: string, closedBy?: string | null): Promise<ShiftRecord | null> {
  const patch: Partial<ShiftRecord> = { state: 'closed', closedAt: closedAt || new Date().toISOString(), confirmedBy: closedBy || null }
  return updateShift(id, patch)
}

export async function lockShift(id: string, lockedAt?: string): Promise<ShiftRecord | null> {
  const patch: Partial<ShiftRecord> = { state: 'locked', lockedAt: lockedAt || new Date().toISOString() }
  return updateShift(id, patch)
}

export function isShiftActiveState(state?: ShiftState): boolean {
  return state === 'opened' || state === 'active' || state === 'ready_to_close' || state === 'confirmed'
}

export async function isShiftActive(id?: string | null): Promise<boolean> {
  if (!id) return false
  const shift = await getShift(id)
  return Boolean(shift && isShiftActiveState(shift.state))
}

export async function isShiftLocked(id?: string | null): Promise<boolean> {
  if (!id) return false
  const shift = await getShift(id)
  if (!shift) return false
  return shift.state === 'closed' || shift.state === 'locked'
}

export async function ensureShiftExists(id?: string | null): Promise<boolean> {
  if (!id) return false
  const existing = await getShift(id)
  return Boolean(existing)
}

const shiftsApi = {
  readShifts,
  getShift,
  getCurrentOpenShift,
  createShift,
  updateShift,
  closeShift,
  lockShift,
  isShiftActive,
  isShiftLocked,
  ensureShiftExists,
}

export default shiftsApi
