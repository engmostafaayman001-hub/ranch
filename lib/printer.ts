import type { TrackedOrder } from '@/lib/order-tracking'

export type ThermalPrinterRole = 'cashier' | 'kitchen' | 'hall'
export type ThermalConnectionType = 'bluetooth' | 'usb' | 'network' | 'system'
export type ThermalPaperWidth = '58mm' | '80mm' | 58 | 80

export type ThermalPrinterSettings = {
  role: ThermalPrinterRole
  name?: string
  deviceName?: string
  deviceId?: string
  deviceAddress?: string
  method?: ThermalConnectionType
  connectionType?: ThermalConnectionType
  ip?: string
  port?: string
  paperWidth?: ThermalPaperWidth
  fontScale?: number
  retryAttempts?: number
  isEnabled?: boolean
  lastConnected?: string
  printsMainInvoice?: boolean
  printsQr?: boolean
}

export type ReceiptLine = {
  name: string
  quantity: number
  price?: number
  notes?: string
  additions?: string[]
  kind?: 'section' | 'line'
  hidePrice?: boolean
}

export type ReceiptPayload = {
  orderId: string
  orderType?: string
  tableNumber?: string
  createdAt?: string
  customer?: {
    name?: string
    phone?: string
    address?: string
    notes?: string
  }
  lines: ReceiptLine[]
  subtotal?: number
  tax?: number
  discountAmount?: number
  total?: number
  paymentMethod?: string
  currency?: string
  invoiceName?: string
  invoiceAddress?: string
  invoicePhone?: string
  invoiceMessage?: string
  invoiceQrUrl?: string
  invoiceQrUrl2?: string
  logoUrl?: string
  isArabic?: boolean
  summaryLabels?: {
    subtotal?: string
    tax?: string
    discount?: string
    total?: string
  }
}

type PrintJob = {
  role: ThermalPrinterRole
  kind: 'cashier' | 'kitchen' | 'hall' | 'diagnostic'
  payload: ReceiptPayload
  strict?: boolean
  allowDevicePrompt?: boolean
}

type UsbDevice = {
  opened: boolean
  open: () => Promise<void>
  selectConfiguration: (configurationValue: number) => Promise<void>
  claimInterface: (interfaceNumber: number) => Promise<void>
  transferOut: (endpointNumber: number, data: BufferSource) => Promise<unknown>
  vendorId?: number
  productId?: number
  configuration?: {
    configurationValue: number
    interfaces: Array<{
      interfaceNumber: number
      alternates: Array<{ interfaceClass?: number; endpoints: Array<{ direction: string; endpointNumber: number }> }>
    }>
  }
  serialNumber?: string
  productName?: string
}

type UsbOutEndpoint = {
  interfaceNumber: number
  endpointNumber: number
}

type BluetoothCharacteristic = {
  writeValue: (value: BufferSource) => Promise<void>
}

type BluetoothDeviceLike = {
  id?: string
  name?: string
  addEventListener?: (type: string, listener: () => void) => void
  gatt?: {
    connected: boolean
    connect: () => Promise<{
      getPrimaryService: (service: string) => Promise<{
        getCharacteristic: (characteristic: string) => Promise<BluetoothCharacteristic>
      }>
    }>
  }
}

declare global {
  interface Navigator {
    usb?: {
      requestDevice: (options: { filters: Array<Record<string, unknown>> }) => Promise<UsbDevice>
      getDevices: () => Promise<UsbDevice[]>
    }
    bluetooth?: {
      requestDevice: (options: Record<string, unknown>) => Promise<BluetoothDeviceLike>
      getDevices?: () => Promise<BluetoothDeviceLike[]>
    }
  }
}

const STORAGE_KEY = 'baseeta-pos-printer-settings'
const BLUETOOTH_PRINT_SERVICES = ['000018f0-0000-1000-8000-00805f9b34fb', '0000ffe0-0000-1000-8000-00805f9b34fb']
const BLUETOOTH_PRINT_CHARACTERISTICS = ['00002af1-0000-1000-8000-00805f9b34fb', '0000ffe1-0000-1000-8000-00805f9b34fb']
const USB_PRINTER_FILTERS = [
  { classCode: 0x07 },
  { vendorId: 0x04b8 },
  { vendorId: 0x0519 },
  { vendorId: 0x1504 },
  { vendorId: 0x0fe6 },
  { vendorId: 0x1a86 },
  { vendorId: 0x067b },
  { vendorId: 0x10c4 },
  { vendorId: 0x0403 },
]
const defaultPrinters: Record<ThermalPrinterRole, ThermalPrinterSettings> = {
  cashier: {
    role: 'cashier',
    name: 'Cashier Printer',
    deviceName: 'Cashier Printer',
    method: 'network',
    ip: '',
    port: '9100',
    paperWidth: '80mm',
    fontScale: 1,
    retryAttempts: 3,
    isEnabled: false,
    printsMainInvoice: true,
    printsQr: true,
  },
  kitchen: {
    role: 'kitchen',
    name: 'Kitchen Printer',
    deviceName: 'Kitchen Printer',
    method: 'network',
    ip: '',
    port: '9100',
    paperWidth: '58mm',
    fontScale: 1,
    retryAttempts: 3,
    isEnabled: false,
    printsMainInvoice: false,
    printsQr: false,
  },
  hall: {
    role: 'hall',
    name: 'Hall Printer',
    deviceName: 'Hall Printer',
    method: 'network',
    ip: '',
    port: '9100',
    paperWidth: '58mm',
    fontScale: 1,
    retryAttempts: 3,
    isEnabled: false,
    printsMainInvoice: false,
    printsQr: false,
  },
}

function normalizePrinter(input: Partial<ThermalPrinterSettings> | undefined, role: ThermalPrinterRole): ThermalPrinterSettings {
  const next = { ...defaultPrinters[role], ...(input || {}) }
  const method = next.method || next.connectionType
  return {
    ...next,
    role,
    method: method === 'bluetooth' || method === 'usb' || method === 'network' || method === 'system' ? method : 'network',
    connectionType: method === 'bluetooth' || method === 'usb' || method === 'network' || method === 'system' ? method : 'network',
    deviceName: next.deviceName || next.name || defaultPrinters[role].deviceName,
    retryAttempts: Math.max(1, Number(next.retryAttempts || 3)),
    fontScale: Math.min(1.6, Math.max(0.75, Number(next.fontScale || 1))),
    isEnabled: next.isEnabled === true,
  }
}

function normalizePrinters(printers?: Partial<Record<ThermalPrinterRole, Partial<ThermalPrinterSettings>>>) {
  return {
    cashier: normalizePrinter(printers?.cashier, 'cashier'),
    kitchen: normalizePrinter(printers?.kitchen, 'kitchen'),
    hall: normalizePrinter(printers?.hall, 'hall'),
  }
}

function browserStorageAvailable() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function money(value: number | undefined, currency: string) {
  return `${Number(value || 0).toFixed(2)} ${currency}`.trim()
}

function isDeviceChooserCancelled(error: unknown) {
  if (!(error instanceof Error)) return false
  return error.name === 'NotFoundError' || /cancelled|canceled|requestDevice/i.test(error.message)
}

function isReconnectRequired(error: unknown) {
  if (!(error instanceof Error)) return false
  return /needs reconnect|user gesture|requestDevice/i.test(error.message)
}

function isUsbAccessDenied(error: unknown) {
  if (!(error instanceof Error)) return false
  return error.name === 'NotAllowedError' || /access denied|permission denied|open.*usbdevice/i.test(error.message)
}

function usbAccessDeniedError(error: unknown) {
  const detail = error instanceof Error ? error.message : String(error || '')
  return new Error(`تعذر فتح طابعة USB. افصل الكابل ثم وصله، أغلق أي برنامج يستخدم الطابعة، وتأكد من تشغيل Chrome كمسؤول أو تثبيت تعريف WinUSB/USB للطابعة. ${detail}`)
}

function normalizeNetworkPrintEndpoint(printer: ThermalPrinterSettings) {
  const rawAddress = (printer.ip || printer.deviceAddress || '').trim()
  if (!rawAddress) return ''

  if (/^https?:\/\//i.test(rawAddress)) {
    try {
      const url = new URL(rawAddress)
      const port = String(printer.port || '').trim()
      if (!url.port && port) url.port = port
      if (!url.pathname || url.pathname === '/') url.pathname = '/print'
      return url.toString()
    } catch {
      const port = String(printer.port || '').trim()
      const withPath = rawAddress.endsWith('/print') ? rawAddress : `${rawAddress.replace(/\/+$/, '')}/print`
      return port && !/:\d+(?:\/|$)/.test(rawAddress.replace(/^https?:\/\//i, '')) ? withPath.replace(/^https?:\/\/([^/]+)/i, (match) => `${match}:${port}`) : withPath
    }
  }

  const port = String(printer.port || '').trim()
  return `http://${rawAddress}${port ? `:${port}` : ''}/print`
}

async function checkNetworkPrintEndpoint(printer: ThermalPrinterSettings) {
  const endpoint = normalizeNetworkPrintEndpoint(printer)
  if (!endpoint) throw new Error('Enter the printer IP or Network Bridge URL.')
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 3500)
  try {
    const response = await fetch(endpoint, {
      method: 'OPTIONS',
      cache: 'no-store',
      signal: controller.signal,
    })
    if (response.status >= 500) throw new Error(`Network bridge responded with ${response.status}`)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || '')
    throw new Error(`Could not reach Network Bridge at ${endpoint}. ${message}`)
  } finally {
    window.clearTimeout(timeout)
  }
}

function qrUrl(value?: string) {
  const trimmed = (value || '').trim()
  if (!trimmed) return ''
  return `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=8&data=${encodeURIComponent(trimmed)}`
}

async function loadImage(url?: string) {
  if (!url) return null
  return new Promise<HTMLImageElement | null>((resolve) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => resolve(image)
    image.onerror = () => resolve(null)
    image.src = url
  })
}

function wrapText(context: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = String(text || '').split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word
    if (context.measureText(candidate).width <= maxWidth || !line) {
      line = candidate
    } else {
      lines.push(line)
      line = word
    }
  }
  if (line) lines.push(line)
  return lines.length ? lines : ['']
}

async function renderReceiptImage(job: PrintJob, printer: ThermalPrinterSettings) {
  if (typeof document === 'undefined') throw new Error('الطباعة تحتاج متصفح يدعم Canvas.')

  const isArabic = job.payload.isArabic !== false
  const width = printer.paperWidth === 58 || printer.paperWidth === '58mm' ? 384 : 576
  const scale = Number(printer.fontScale || 1)
  const padding = width === 384 ? 18 : 24
  const lineHeight = Math.round(25 * scale)
  const smallHeight = Math.round(20 * scale)
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  if (!context) throw new Error('تعذر تجهيز صورة الطباعة.')

  canvas.width = width
  canvas.height = 3600
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.fillStyle = '#111111'
  context.textBaseline = 'top'
  context.direction = isArabic ? 'rtl' : 'ltr'
  context.textAlign = isArabic ? 'right' : 'left'

  let y = padding
  const left = padding
  const right = width - padding
  const textX = isArabic ? right : left
  const center = width / 2

  const setFont = (size: number, weight = 700) => {
    context.font = `${weight} ${Math.round(size * scale)}px Arial, Tahoma, sans-serif`
  }
  const drawText = (text: string, options: { size?: number; weight?: number; align?: CanvasTextAlign; maxWidth?: number; gap?: number } = {}) => {
    setFont(options.size || 22, options.weight ?? 700)
    const oldAlign = context.textAlign
    context.textAlign = options.align || (isArabic ? 'right' : 'left')
    const x = options.align === 'center' ? center : textX
    for (const line of wrapText(context, text, options.maxWidth || width - padding * 2)) {
      context.fillText(line, x, y)
      y += options.size && options.size <= 18 ? smallHeight : lineHeight
    }
    context.textAlign = oldAlign
    y += options.gap ?? 4
  }
  const divider = () => {
    y += 5
    context.setLineDash([8, 6])
    context.beginPath()
    context.moveTo(left, y)
    context.lineTo(right, y)
    context.strokeStyle = '#111111'
    context.stroke()
    context.setLineDash([])
    y += 14
  }
  const twoCol = (label: string, value: string, strong = false) => {
    setFont(strong ? 24 : 20, strong ? 800 : 700)
    context.textAlign = isArabic ? 'right' : 'left'
    context.fillText(label, isArabic ? right : left, y)
    context.textAlign = isArabic ? 'left' : 'right'
    context.fillText(value, isArabic ? left : right, y)
    context.textAlign = isArabic ? 'right' : 'left'
    y += strong ? lineHeight + 4 : lineHeight
  }

  const logo = await loadImage(job.kind === 'cashier' ? job.payload.logoUrl : undefined)
  if (logo) {
    const logoSize = width === 384 ? 86 : 108
    context.drawImage(logo, center - logoSize / 2, y, logoSize, logoSize)
    y += logoSize + 10
  }

  drawText(job.payload.invoiceName || (isArabic ? 'فاتورة طلب' : 'Order Receipt'), { size: 27, weight: 900, align: 'center' })
  if (job.payload.invoiceAddress) {
    drawText(job.payload.invoiceAddress, { size: 17, weight: 700, align: 'center' })
  }
  if (job.payload.invoicePhone) {
    drawText(job.payload.invoicePhone, { size: 17, weight: 700, align: 'center' })
  }
  drawText(job.kind === 'cashier' ? (isArabic ? 'فاتورة كاشير' : 'Cashier Receipt') : job.kind === 'kitchen' ? (isArabic ? 'تذكرة مطبخ' : 'Kitchen Ticket') : (isArabic ? 'تذكرة صالة' : 'Hall Ticket'), { size: 18, weight: 700, align: 'center' })
  divider()
  twoCol(isArabic ? 'رقم الطلب' : 'Order', job.payload.orderId || '-')
  twoCol(isArabic ? 'الوقت' : 'Time', new Date(job.payload.createdAt || Date.now()).toLocaleString(isArabic ? 'ar-EG' : 'en-US'))
  if (job.payload.orderType) twoCol(isArabic ? 'نوع الطلب' : 'Order type', job.payload.orderType)
  if (job.kind === 'hall' && job.payload.tableNumber) twoCol(isArabic ? 'الترابيزة' : 'Table', job.payload.tableNumber)

  if (job.kind === 'cashier') {
    divider()
    twoCol(isArabic ? 'العميل' : 'Customer', job.payload.customer?.name || '-')
    twoCol(isArabic ? 'الهاتف' : 'Phone', job.payload.customer?.phone || '-')
    twoCol(isArabic ? 'المكان' : 'Place', job.payload.customer?.address || '-')
    if (job.payload.paymentMethod) twoCol(isArabic ? 'الدفع' : 'Payment', job.payload.paymentMethod)
  }

  if (job.payload.customer?.notes) {
    divider()
    drawText(`${isArabic ? 'ملاحظات' : 'Notes'}: ${job.payload.customer.notes}`, { size: 19, weight: 700 })
  }

  divider()
  drawText(isArabic ? 'الأصناف' : 'Items', { size: 22, weight: 900, align: 'center' })
  for (const line of job.payload.lines) {
    if (line.kind === 'section') {
      divider()
      drawText(line.name, { size: 21, weight: 900, align: 'center' })
      continue
    }
    const qty = `x${Number(line.quantity || 0)}`
    const price = job.kind === 'cashier' && !line.hidePrice ? money(Number(line.price || 0) * Number(line.quantity || 0), job.payload.currency || '') : ''
    twoCol(`${qty} ${line.name}`, price, job.kind === 'cashier')
    if (line.notes) drawText(`${isArabic ? 'ملاحظة' : 'Note'}: ${line.notes}`, { size: 17, weight: 600 })
    if (line.additions?.length) drawText(`${isArabic ? 'إضافات' : 'Additions'}: ${line.additions.join(', ')}`, { size: 17, weight: 600 })
  }

  if (job.kind === 'cashier') {
    divider()
    twoCol(job.payload.summaryLabels?.subtotal || (isArabic ? 'المجموع' : 'Subtotal'), money(job.payload.subtotal, job.payload.currency || ''), false)
    twoCol(job.payload.summaryLabels?.tax || (isArabic ? 'الضريبة' : 'Tax'), money(job.payload.tax, job.payload.currency || ''), false)
    twoCol(job.payload.summaryLabels?.discount || (isArabic ? 'الخصم' : 'Discount'), `-${money(job.payload.discountAmount, job.payload.currency || '')}`, false)
    twoCol(job.payload.summaryLabels?.total || (isArabic ? 'الإجمالي' : 'Total'), money(job.payload.total, job.payload.currency || ''), true)
    const qrImages = (await Promise.all([
      loadImage(qrUrl(job.payload.invoiceQrUrl)),
      loadImage(qrUrl(job.payload.invoiceQrUrl2)),
    ])).filter(Boolean) as HTMLImageElement[]
    if (qrImages.length) {
      y += 10
      const qrSize = qrImages.length > 1 ? (width === 384 ? 116 : 138) : 138
      const gap = width === 384 ? 16 : 26
      const totalWidth = qrImages.length * qrSize + (qrImages.length - 1) * gap
      let x = center - totalWidth / 2
      for (const qr of qrImages) {
        context.drawImage(qr, x, y, qrSize, qrSize)
        x += qrSize + gap
      }
      y += qrSize + 8
    }
    if (job.payload.invoiceMessage) {
      divider()
      drawText(job.payload.invoiceMessage, { size: 18, weight: 700, align: 'center' })
    }
    drawText('https://markode.co - +0201090886364', { size: 15, weight: 600, align: 'center' })
  }

  y += 32
  const finalCanvas = document.createElement('canvas')
  finalCanvas.width = width
  finalCanvas.height = y
  const finalContext = finalCanvas.getContext('2d')
  if (!finalContext) throw new Error('تعذر تجهيز صورة الطباعة.')
  finalContext.fillStyle = '#ffffff'
  finalContext.fillRect(0, 0, finalCanvas.width, finalCanvas.height)
  finalContext.drawImage(canvas, 0, 0)
  return finalCanvas
}

function canvasToRasterEscPos(canvas: HTMLCanvasElement) {
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Could not read the print image.')
  const { data, width, height } = context.getImageData(0, 0, canvas.width, canvas.height)
  const bytesPerRow = Math.ceil(width / 8)
  const bands: Uint8Array[] = [new Uint8Array([0x1b, 0x40])]
  const bandHeight = 128

  for (let yStart = 0; yStart < height; yStart += bandHeight) {
    const currentHeight = Math.min(bandHeight, height - yStart)
    const raster = new Uint8Array(bytesPerRow * currentHeight)
    for (let y = 0; y < currentHeight; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const offset = ((yStart + y) * width + x) * 4
        const alpha = data[offset + 3] / 255
        const luminance = (data[offset] * 0.299 + data[offset + 1] * 0.587 + data[offset + 2] * 0.114) * alpha + 255 * (1 - alpha)
        if (luminance < 172) raster[y * bytesPerRow + (x >> 3)] |= 0x80 >> (x & 7)
      }
    }
    bands.push(new Uint8Array([0x1d, 0x76, 0x30, 0x00, bytesPerRow & 0xff, (bytesPerRow >> 8) & 0xff, currentHeight & 0xff, (currentHeight >> 8) & 0xff]))
    bands.push(raster)
  }

  bands.push(new Uint8Array([0x0a, 0x0a, 0x0a, 0x1d, 0x56, 0x42, 0x00]))
  const output = new Uint8Array(bands.reduce((total, band) => total + band.length, 0))
  let outputOffset = 0
  for (const band of bands) {
    output.set(band, outputOffset)
    outputOffset += band.length
  }
  return output
}
function bytesToBase64(bytes: Uint8Array) {
  let binary = ''
  const chunk = 0x8000
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.slice(index, index + chunk))
  }
  return btoa(binary)
}

function toArrayBuffer(bytes: Uint8Array) {
  const copy = new Uint8Array(bytes.length)
  copy.set(bytes)
  return copy.buffer
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

export function trackedOrderToReceiptPayload(order: TrackedOrder, options: Partial<ReceiptPayload> = {}): ReceiptPayload {
  const orderWithPossibleLines = order as TrackedOrder & {
    lines?: ReceiptLine[]
    orderLines?: ReceiptLine[]
    cartItems?: ReceiptLine[]
    products?: ReceiptLine[]
    itemsList?: ReceiptLine[]
  }
  const maybeLines = [
    orderWithPossibleLines.lines,
    orderWithPossibleLines.orderLines,
    orderWithPossibleLines.cartItems,
    orderWithPossibleLines.products,
    orderWithPossibleLines.itemsList,
  ].find((lines) => Array.isArray(lines) && lines.length)
  return {
    orderId: order.id,
    createdAt: order.createdAt,
    orderType: order.estimatedDelivery,
    customer: {
      name: order.customer,
      phone: order.phone,
      address: order.address,
      notes: order.notes,
    },
    lines: Array.isArray(maybeLines) && maybeLines.length
      ? maybeLines
      : [{
          name: options.isArabic === false
            ? `Order details unavailable (${Number(order.items || 0)} items)`
            : `تفاصيل الأصناف غير محفوظة (${Number(order.items || 0)} عنصر)`,
          quantity: 1,
          price: Number(order.total || 0),
        }],
    total: Number(order.total || 0),
    paymentMethod: order.payment?.method,
    ...options,
  }
}

export class PrinterManager {
  private settings: Record<ThermalPrinterRole, ThermalPrinterSettings>
  private queue: Promise<unknown> = Promise.resolve()
  private usbDevices: Partial<Record<ThermalPrinterRole, UsbDevice>> = {}
  private usbClaimedInterfaces: Partial<Record<ThermalPrinterRole, number>> = {}
  private bluetoothDevices: Partial<Record<ThermalPrinterRole, BluetoothDeviceLike>> = {}
  private bluetoothCharacteristics: Partial<Record<ThermalPrinterRole, BluetoothCharacteristic>> = {}

  constructor(printers?: Partial<Record<ThermalPrinterRole, Partial<ThermalPrinterSettings>>>) {
    this.settings = normalizePrinters(printers || this.loadSettings())
  }

  getPrinters() {
    return this.settings
  }

  setPrinters(printers: Partial<Record<ThermalPrinterRole, Partial<ThermalPrinterSettings>>>) {
    this.settings = normalizePrinters(printers)
    this.saveSettings()
  }

  async testConnection(role: ThermalPrinterRole) {
    const printer = this.settings[role]
    await this.connect(role, printer, true)
    printer.lastConnected = new Date().toISOString()
    this.saveSettings()
    return { ok: true, message: 'تم الاتصال بالطابعة بنجاح.', printer: { ...printer } }
  }

  async connectPrinter(role: ThermalPrinterRole) {
    const printer = this.settings[role]
    await this.connect(role, printer, true)
    printer.lastConnected = new Date().toISOString()
    this.saveSettings()
    return { ok: true, printer: { ...printer } }
  }

  printCashierReceipt(payload: ReceiptPayload) {
    return this.enqueue({ role: 'cashier', kind: 'cashier', payload })
  }

  printKitchenTicket(payload: ReceiptPayload) {
    return this.enqueue({ role: 'kitchen', kind: 'kitchen', payload })
  }

  printHallTicket(payload: ReceiptPayload) {
    return this.enqueue({ role: 'hall', kind: 'hall', payload })
  }

  printTest(role: ThermalPrinterRole, kind: PrintJob['kind'] = 'diagnostic', payload?: Partial<ReceiptPayload>) {
    return this.enqueue({
      role,
      kind: kind === 'diagnostic' ? (role === 'cashier' ? 'cashier' : role) : kind,
      strict: true,
      allowDevicePrompt: true,
      payload: {
        orderId: `TEST-${role.toUpperCase()}`,
        orderType: role === 'hall' ? 'DINE_IN' : 'TEST',
        tableNumber: '1',
        createdAt: new Date().toISOString(),
        customer: { name: 'اختبار الطابعة', phone: '01000000000', address: 'اختبار الاتصال', notes: 'النص العربي يجب أن يظهر واضحا بدون رموز مشوهة.' },
        lines: [
          { name: 'برجر دجاج', quantity: 2, price: 95, notes: 'بدون بصل', additions: ['جبنة', 'صوص'] },
          { name: 'بطاطس', quantity: 1, price: 35 },
        ],
        subtotal: 225,
        tax: 22.5,
        discountAmount: 10,
        total: 237.5,
        paymentMethod: 'Cash',
        currency: 'ج.م',
        invoiceName: 'Baseeta POS',
        invoiceAddress: 'Cairo, Egypt',
        invoiceMessage: 'شكرا لطلبك',
        invoiceQrUrl: 'https://markode.co',
        invoiceQrUrl2: '',
        isArabic: true,
        ...payload,
      },
    })
  }

  private enqueue(job: PrintJob) {
    const task = this.queue.then(() => this.printWithRetry(job))
    this.queue = task.catch(() => undefined)
    return task
  }

  private async printWithRetry(job: PrintJob) {
    const printer = this.settings[job.role]
    if (!printer.isEnabled) {
      console.info(`[PrinterManager] ${job.role} disabled. Skipping print job.`)
      return { ok: true, skipped: true, reason: `${job.role} printer is disabled` }
    }
    const configurationIssue = this.getConfigurationIssue(printer)
    if (configurationIssue) {
      if (job.strict) throw new Error(configurationIssue)
      console.info(`[PrinterManager] ${job.role} is not configured. Skipping print job: ${configurationIssue}`)
      return { ok: true, skipped: true, reason: configurationIssue }
    }
    let lastError: unknown
    const method = printer.method || printer.connectionType
    const attempts = method === 'system' ? 1 : Math.max(1, Number(printer.retryAttempts || 3))
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        console.info(`[PrinterManager] Printing ${job.kind} on ${job.role}. Attempt ${attempt}/${attempts}.`)
        const promptAlreadyHandled = job.allowDevicePrompt === true && (method === 'usb' || method === 'bluetooth')
        if (promptAlreadyHandled) {
          await this.connect(job.role, printer, true)
        }
        await this.print(job, printer, promptAlreadyHandled ? false : job.allowDevicePrompt === true)
        printer.lastConnected = new Date().toISOString()
        this.saveSettings()
        return { ok: true }
      } catch (error) {
        lastError = error
        if (isReconnectRequired(error)) {
          const reason = error instanceof Error ? error.message : 'Printer needs reconnect'
          if (job.strict) throw new Error(reason)
          return { ok: true, skipped: true, needsReconnect: true, reason }
        }
        if (isDeviceChooserCancelled(error)) {
          throw new Error('تم إلغاء اختيار الطابعة. افتح نافذة الاختيار مرة أخرى واختر الجهاز عند الطباعة.')
        }
        console.error(`[PrinterManager] ${job.role} print failed:`, error)
        await this.disconnect(job.role)
        if (attempt < attempts) await new Promise((resolve) => window.setTimeout(resolve, 350 * attempt))
      }
    }
    throw lastError instanceof Error ? lastError : new Error('تعذر إرسال أمر الطباعة.')
  }

  private async print(job: PrintJob, printer: ThermalPrinterSettings, allowDevicePrompt = false) {
    const canvas = await renderReceiptImage(job, printer)
    const bytes = canvasToRasterEscPos(canvas)
    const method = printer.method || printer.connectionType
    if (method === 'network') return this.printNetwork(printer, bytes, canvas)
    if (method === 'system') return this.printSystem(printer, canvas)
    if (method === 'usb') return this.printUsb(job.role, printer, bytes, allowDevicePrompt)
    if (method === 'bluetooth') return this.printBluetooth(job.role, printer, bytes, allowDevicePrompt)
    throw new Error('طريقة الاتصال غير مدعومة.')
  }

  private async printSystem(printer: ThermalPrinterSettings, canvas: HTMLCanvasElement) {
    const imageDataUrl = canvas.toDataURL('image/png')
    const width = printer.paperWidth === 58 || printer.paperWidth === '58mm' ? '58mm' : '80mm'
    const iframe = document.createElement('iframe')
    iframe.setAttribute('aria-hidden', 'true')
    iframe.style.position = 'fixed'
    iframe.style.right = '0'
    iframe.style.bottom = '0'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = '0'
    iframe.style.opacity = '0'
    document.body.appendChild(iframe)

    const printWindow = iframe.contentWindow
    const printDocument = printWindow?.document
    if (!printWindow || !printDocument) {
      iframe.remove()
      throw new Error('Could not prepare the Windows/XPrinter print frame.')
    }

    printDocument.open()
    printDocument.write(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${printer.deviceName || printer.name || 'Receipt'}</title>
  <style>
    @page { size: ${width} auto; margin: 0; }
    html, body { margin: 0; padding: 0; background: #fff; }
    body { display: flex; justify-content: center; }
    img { width: ${width}; max-width: 100%; height: auto; display: block; }
  </style>
</head>
<body>
  <img src="${imageDataUrl}" alt="Receipt" />
</body>
</html>`)
    printDocument.close()

    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error('Receipt image did not load for printing.')), 5000)
      const image = printDocument.querySelector('img')
      if (!image) {
        window.clearTimeout(timeout)
        reject(new Error('Could not prepare the receipt image for printing.'))
        return
      }
      image.onload = () => {
        window.clearTimeout(timeout)
        resolve()
      }
      image.onerror = () => {
        window.clearTimeout(timeout)
        reject(new Error('Could not load the receipt image for printing.'))
      }
      if (image.complete) {
        window.clearTimeout(timeout)
        resolve()
      }
    })

    printWindow.focus()
    printWindow.print()
    window.setTimeout(() => iframe.remove(), 1000)
  }
  private async printNetwork(printer: ThermalPrinterSettings, bytes: Uint8Array, canvas: HTMLCanvasElement) {
    const endpoint = normalizeNetworkPrintEndpoint(printer)
    if (!endpoint) throw new Error('Enter the printer IP or Network Bridge URL.')
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        printer: printer.deviceName || printer.name,
        format: 'escpos-raster',
        escposBase64: bytesToBase64(bytes),
        imageDataUrl: canvas.toDataURL('image/png'),
      }),
    })
    if (!response.ok) throw new Error(`Network print bridge failed: ${response.status} at ${endpoint}`)
  }
  private async printUsb(role: ThermalPrinterRole, printer: ThermalPrinterSettings, bytes: Uint8Array, allowDevicePrompt = false) {
    if (!navigator.usb) throw new Error('هذا المتصفح لا يدعم WebUSB.')
    let device = this.usbDevices[role] || await this.getUsbDevice(role, printer, allowDevicePrompt)
    if (!device.opened) {
      try {
        await device.open()
      } catch (error) {
        delete this.usbDevices[role]
        delete this.usbClaimedInterfaces[role]
        if (!allowDevicePrompt || !isUsbAccessDenied(error)) throw usbAccessDeniedError(error)
        device = await navigator.usb.requestDevice({ filters: USB_PRINTER_FILTERS })
        try {
          await device.open()
        } catch (retryError) {
          throw usbAccessDeniedError(retryError)
        }
      }
    }
    if (!device.configuration) await device.selectConfiguration(1)
    const endpoint = this.findUsbOutEndpoint(device)
    if (!endpoint) throw new Error('تعذر قراءة منفذ إرسال USB للطابعة. اختر طابعة USB حرارية أو جرّب تعريف/كابل آخر.')

    if (this.usbClaimedInterfaces[role] !== endpoint.interfaceNumber) {
      try {
        await device.claimInterface(endpoint.interfaceNumber)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error || '')
        if (!/already claimed/i.test(message)) throw error
      }
      this.usbClaimedInterfaces[role] = endpoint.interfaceNumber
    }

    const chunkSize = 4096
    for (let index = 0; index < bytes.length; index += chunkSize) {
      await device.transferOut(endpoint.endpointNumber, toArrayBuffer(bytes.slice(index, index + chunkSize)))
      if (index + chunkSize < bytes.length) await wait(8)
    }
    this.usbDevices[role] = device
    printer.deviceId = device.serialNumber || printer.deviceId || ''
    printer.deviceName = device.productName || printer.deviceName
    printer.deviceAddress = device.vendorId && device.productId
      ? `${device.vendorId.toString(16).padStart(4, '0')}:${device.productId.toString(16).padStart(4, '0')}`
      : printer.deviceAddress
  }

  private getConfigurationIssue(printer: ThermalPrinterSettings) {
    const method = printer.method || printer.connectionType
    if (method === 'network' && !(printer.ip || printer.deviceAddress || '').trim()) {
      return 'أدخل IP الطابعة أو عنوان bridge الشبكي من إعدادات الطابعات.'
    }
    return ''
  }

  private async getUsbDevice(role: ThermalPrinterRole, printer: ThermalPrinterSettings, allowDevicePrompt: boolean) {
    const storedDeviceId = (printer.deviceId || '').trim()
    const configuredDeviceName = (printer.deviceName || printer.name || '').trim()
    const defaultDeviceName = (defaultPrinters[role].deviceName || defaultPrinters[role].name || '').trim()
    const storedDeviceName = configuredDeviceName && configuredDeviceName !== defaultDeviceName ? configuredDeviceName : ''
    const storedAddress = (printer.deviceAddress || '').trim().toLowerCase()

    if (typeof navigator.usb?.getDevices === 'function') {
      const devices = await navigator.usb.getDevices().catch(() => [])
      const restored = devices.find((device) =>
        (storedDeviceId && device.serialNumber === storedDeviceId) ||
        (storedDeviceName && device.productName === storedDeviceName) ||
        (storedAddress && device.vendorId && device.productId && `${device.vendorId.toString(16).padStart(4, '0')}:${device.productId.toString(16).padStart(4, '0')}` === storedAddress)
      ) || (!storedDeviceId && !storedDeviceName && !storedAddress && devices.length === 1 ? devices[0] : undefined)

      if (restored) return restored
    }

    if (!allowDevicePrompt) {
      throw new Error('USB printer needs reconnect')
    }

    return navigator.usb!.requestDevice({ filters: USB_PRINTER_FILTERS })
  }

  private findUsbOutEndpoint(device: UsbDevice): UsbOutEndpoint | null {
    const interfaces = device.configuration?.interfaces || []
    for (const usbInterface of interfaces) {
      const printerAlternate = usbInterface.alternates.find((alternate) =>
        alternate.interfaceClass === 0x07 &&
        alternate.endpoints.some((endpoint) => endpoint.direction === 'out')
      )
      const fallbackAlternate = usbInterface.alternates.find((alternate) =>
        alternate.endpoints.some((endpoint) => endpoint.direction === 'out')
      )
      const alternate = printerAlternate || fallbackAlternate
      const endpoint = alternate?.endpoints.find((item) => item.direction === 'out')
      if (endpoint) {
        return {
          interfaceNumber: usbInterface.interfaceNumber,
          endpointNumber: endpoint.endpointNumber,
        }
      }
    }

    return null
  }

  private async printBluetooth(role: ThermalPrinterRole, printer: ThermalPrinterSettings, bytes: Uint8Array, allowDevicePrompt = false) {
    const characteristic = this.bluetoothCharacteristics[role] || await this.connectBluetooth(role, printer, allowDevicePrompt)
    const chunkSize = 180
    for (let index = 0; index < bytes.length; index += chunkSize) {
      await characteristic.writeValue(toArrayBuffer(bytes.slice(index, index + chunkSize)))
    }
  }

  private async connect(role: ThermalPrinterRole, printer: ThermalPrinterSettings, allowDevicePrompt = false) {
    const method = printer.method || printer.connectionType
    if (method === 'system') return
    if (method === 'network') {
      await checkNetworkPrintEndpoint(printer)
      return
    }
    if (method === 'usb') {
      await this.printUsb(role, printer, new Uint8Array([0x1b, 0x40]), allowDevicePrompt)
      return
    }
    if (method === 'bluetooth') {
      await this.connectBluetooth(role, printer, allowDevicePrompt)
      return
    }
  }

  private async connectBluetooth(role: ThermalPrinterRole, printer: ThermalPrinterSettings, allowDevicePrompt = false) {
    if (!navigator.bluetooth) throw new Error('هذا المتصفح لا يدعم Web Bluetooth.')
    const device = await this.getBluetoothDevice(role, printer, allowDevicePrompt)
    if (!device.gatt) throw new Error('تعذر فتح اتصال Bluetooth.')
    this.bluetoothDevices[role] = device
    device.addEventListener?.('gattserverdisconnected', () => {
      delete this.bluetoothCharacteristics[role]
      console.info(`[PrinterManager] ${role} Bluetooth disconnected. Reconnect will reuse the selected device while this page remains open.`)
    })
    const server = await device.gatt.connect()
    for (const serviceId of BLUETOOTH_PRINT_SERVICES) {
      try {
        const service = await server.getPrimaryService(serviceId)
        for (const charId of BLUETOOTH_PRINT_CHARACTERISTICS) {
          try {
            const characteristic = await service.getCharacteristic(charId)
            this.bluetoothCharacteristics[role] = characteristic
            printer.deviceId = device.id || printer.deviceId
            printer.deviceName = device.name || printer.deviceName
            printer.lastConnected = new Date().toISOString()
            this.saveSettings()
            return characteristic
          } catch {}
        }
      } catch {}
    }
    throw new Error('لم يتم العثور على characteristic للطباعة عبر Bluetooth.')
  }

  private async getBluetoothDevice(role: ThermalPrinterRole, printer: ThermalPrinterSettings, allowDevicePrompt: boolean) {
    const currentDevice = this.bluetoothDevices[role]
    if (currentDevice?.gatt) return currentDevice

    const storedDeviceId = (printer.deviceId || '').trim()
    const storedDeviceName = (printer.deviceName || printer.name || '').trim()

    if (typeof navigator.bluetooth?.getDevices === 'function') {
      const devices = await navigator.bluetooth.getDevices().catch(() => [])
      const restored = devices.find((device) =>
        (storedDeviceId && device.id === storedDeviceId) ||
        (storedDeviceName && device.name === storedDeviceName)
      ) || (!storedDeviceId && !storedDeviceName && devices.length === 1 ? devices[0] : undefined)

      if (restored?.gatt) {
        this.bluetoothDevices[role] = restored
        printer.deviceId = restored.id || printer.deviceId
        printer.deviceName = restored.name || printer.deviceName
        this.saveSettings()
        return restored
      }
    }

    if (!allowDevicePrompt) {
      throw new Error('Bluetooth printer needs reconnect')
    }

    const selected = await navigator.bluetooth!.requestDevice({
      acceptAllDevices: true,
      optionalServices: BLUETOOTH_PRINT_SERVICES,
    })
    this.bluetoothDevices[role] = selected
    printer.deviceId = selected.id || printer.deviceId
    printer.deviceName = selected.name || printer.deviceName
    this.saveSettings()
    return selected
  }

  private async disconnect(role: ThermalPrinterRole) {
    delete this.bluetoothCharacteristics[role]
    delete this.usbClaimedInterfaces[role]
  }

  private loadSettings() {
    if (!browserStorageAvailable()) return defaultPrinters
    try {
      const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || 'null')
      return parsed && typeof parsed === 'object' ? parsed : defaultPrinters
    } catch {
      return defaultPrinters
    }
  }

  private saveSettings() {
    if (!browserStorageAvailable()) return
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings))
  }
}

export const printerManager = new PrinterManager()

export function syncPrinterManagerSettings(printers: Partial<Record<ThermalPrinterRole, Partial<ThermalPrinterSettings>>>) {
  printerManager.setPrinters(printers)
}
