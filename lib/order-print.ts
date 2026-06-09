import { TrackedOrder } from '@/lib/order-tracking'
import { printerManager, trackedOrderToReceiptPayload } from '@/lib/printer'

export type InvoicePrintOptions = {
  isArabic: boolean
  currency: string
  title?: string
  printerMethod?: string
  printerName?: string
  paperWidth?: string
  invoiceName?: string
  invoiceAddress?: string
  invoicePhone?: string
  invoiceQrUrl?: string
  invoiceQrUrl2?: string
  invoiceMessage?: string
  logoUrl?: string
  printsMainInvoice?: boolean
  printsQr?: boolean
}

export function qrImage(url?: string) {
  const trimmed = (url || '').trim()
  if (!trimmed) return ''
  return `https://api.qrserver.com/v1/create-qr-code/?size=132x132&margin=8&data=${encodeURIComponent(trimmed)}`
}

export async function printTrackedOrderReceipt(order: TrackedOrder, options: InvoicePrintOptions) {
  const { isArabic, currency } = options
  const title = options.title || (isArabic ? 'فاتورة طلب' : 'Order Receipt')
  const invoiceName = options.invoiceName || title
  try {
    await printerManager.printCashierReceipt(trackedOrderToReceiptPayload(order, {
      isArabic,
      currency,
      invoiceName,
      invoiceAddress: options.invoiceAddress,
      invoicePhone: options.invoicePhone,
      invoiceQrUrl: options.printsQr === false ? undefined : options.invoiceQrUrl,
      invoiceQrUrl2: options.printsQr === false ? undefined : options.invoiceQrUrl2,
      invoiceMessage: options.invoiceMessage,
      logoUrl: options.logoUrl,
    }))
    return true
  } catch (error) {
    console.error('[order-print] Could not print tracked order receipt:', error)
    return false
  }
}

export async function printPrinterTest(options: { isArabic: boolean; printerMethod: string; paperWidth: string; printerName?: string; invoiceName?: string; invoiceAddress?: string; invoicePhone?: string; invoiceQrUrl?: string; invoiceQrUrl2?: string; invoiceMessage?: string; logoUrl?: string; printsMainInvoice?: boolean; printsQr?: boolean }) {
  try {
    await printerManager.printTest('cashier', 'cashier', {
      invoiceName: options.invoiceName,
      invoiceAddress: options.invoiceAddress,
      invoicePhone: options.invoicePhone,
      invoiceQrUrl: options.printsQr === false ? undefined : options.invoiceQrUrl,
      invoiceQrUrl2: options.printsQr === false ? undefined : options.invoiceQrUrl2,
      invoiceMessage: options.invoiceMessage,
      logoUrl: options.logoUrl,
      isArabic: options.isArabic,
    })
    return true
  } catch (error) {
    console.error('[order-print] Could not print test receipt:', error)
    return false
  }
}
