import { readClosings, saveClosing, type ClosingRecord } from './closings'

type ShiftSession = {
  isOpen: boolean
  openedAt: string
  closedAt: string | null
  shiftId?: string
}

export async function performShiftClosing(session: ShiftSession, options: { currency?: string } = {}): Promise<ClosingRecord> {
  const closedAt = session.closedAt || new Date().toISOString()

  try {
    const record: ClosingRecord = {
      id: `CLOSE-${Date.now()}`,
      type: 'shift',
      openedAt: session.openedAt,
      closedAt,
      shiftId: session.shiftId,
      currency: options.currency || 'EGP',
      // The detailed calculations are now handled by the backend report generator.
      // These fields are kept for potential backwards compatibility, but are not calculated here anymore.
      ordersCount: 0,
      salesWithoutDelivery: 0,
      expensesTotal: 0,
      uncollectedTotal: 0,
      otherPaymentsTotal: 0,
      drawerNet: 0,
    }

    saveClosing(record)
    return record
  } catch (err) {
    console.warn('[shift-closing] performShiftClosing failed', err)
    throw err
  }
}

export default performShiftClosing
