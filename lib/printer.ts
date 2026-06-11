import type { TrackedOrder } from '@/lib/order-tracking'
import QRCode from 'qrcode'

export type ThermalPrinterRole = 'cashier' | 'kitchen' | 'hall'
export type ThermalConnectionType = 'bluetooth' | 'usb' | 'network' | 'system'
export type ThermalPaperWidth = '58mm' | '80mm' | 58 | 80
export type PrinterModelFamily =
  | 'xprinter'
  | 'epson'
  | 'sunmi'
  | 'bixolon'
  | 'rongta'
  | 'goojprt'
  | 'hprt'
  | 'star'
  | 'zebra'
  | 'generic'

export type PrinterCapabilityProfile = {
  modelFamily: PrinterModelFamily
  paperWidth: '58mm' | '80mm'
  supportsCut: boolean
  supportsCashDrawer: boolean
  supportsRasterImage: boolean
  supportsQr: boolean
  codePages: Array<'utf8' | 'cp864' | 'cp720' | 'cp1256'>
  usbChunkSize: number
  bluetoothChunkSize: number
  bluetoothChunkDelayMs: number
}

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
  lastConnectedMethod?: ThermalConnectionType | ''
  lastPrinted?: string
  failedAttempts?: number
  lastError?: string
  printsMainInvoice?: boolean
  printsQr?: boolean
  modelFamily?: PrinterModelFamily
  supportsCut?: boolean
  supportsCashDrawer?: boolean
  supportsQr?: boolean
  codePage?: 'utf8' | 'cp864' | 'cp720' | 'cp1256' | 'auto'
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

export type PrinterDiagnosticEvent = {
  id: string
  at: string
  role: ThermalPrinterRole
  method: ThermalConnectionType | ''
  action: 'settings' | 'connect' | 'health' | 'print' | 'fallback' | 'disconnect'
  status: 'started' | 'ok' | 'failed' | 'skipped'
  endpoint?: string
  jobKind?: PrintJob['kind']
  orderId?: string
  attempt?: number
  durationMs?: number
  message?: string
  error?: string
  stack?: string
  request?: Record<string, unknown>
  response?: Record<string, unknown>
}

export type PrinterRuntimeDiagnostic = {
  role: ThermalPrinterRole
  method: ThermalConnectionType | ''
  status: 'disabled' | 'not_configured' | 'ready' | 'needs_reconnect' | 'unknown'
  endpoint: string
  ip: string
  port: string
  deviceName: string
  deviceId: string
  deviceAddress: string
  lastConnected: string
  lastConnectedMethod: ThermalConnectionType | ''
  lastPrinted: string
  failedAttempts: number
  lastError: string
  recentEvents: PrinterDiagnosticEvent[]
}

export type AvailablePrinterDevice = {
  method: ThermalConnectionType
  id: string
  name: string
  address?: string
  paired: boolean
  detail?: string
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
  writeValueWithResponse?: (value: BufferSource) => Promise<void>
  writeValueWithoutResponse?: (value: BufferSource) => Promise<void>
}

type BluetoothDeviceLike = {
  id?: string
  name?: string
  addEventListener?: (type: string, listener: () => void) => void
  gatt?: {
    connected: boolean
    disconnect?: () => void
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

const LEGACY_STORAGE_KEY = 'baseeta-pos-printer-settings'
const BLUETOOTH_PRINT_SERVICES = [
  '000018f0-0000-1000-8000-00805f9b34fb',
  '0000ffe0-0000-1000-8000-00805f9b34fb',
  '0000ff00-0000-1000-8000-00805f9b34fb',
  '49535343-fe7d-4ae5-8fa9-9fafd205e455',
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
]
const BLUETOOTH_PRINT_CHARACTERISTICS = [
  '00002af1-0000-1000-8000-00805f9b34fb',
  '0000ffe1-0000-1000-8000-00805f9b34fb',
  '0000ff01-0000-1000-8000-00805f9b34fb',
  '0000ff02-0000-1000-8000-00805f9b34fb',
  '49535343-8841-43f4-a8d4-ecbe34729bb3',
  'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f',
]
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
const PRINT_EXTERNAL_ASSET_TIMEOUT_MS = 450
const PRINT_LOCAL_ASSET_TIMEOUT_MS = 1200
const NETWORK_HEALTH_CACHE_MS = 45000
const NETWORK_HEALTH_TIMEOUT_MS = 900
const NETWORK_KEEP_ALIVE_MS = 25000
const NETWORK_PRINT_TIMEOUT_MS = 15000
const MAX_DIAGNOSTIC_EVENTS = 80
const printAssetCache = new Map<string, Promise<HTMLImageElement | null>>()
const qrAssetCache = new Map<string, Promise<HTMLImageElement | null>>()
const networkHealthCache = new Map<string, { checkedAt: number; promise?: Promise<void>; token?: symbol }>()
const DUPLICATE_JOB_WINDOW_MS = 1800
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

function inferPrinterModelFamily(printer: Partial<ThermalPrinterSettings> | undefined): PrinterModelFamily {
  const label = `${printer?.modelFamily || ''} ${printer?.deviceName || ''} ${printer?.name || ''}`.toLowerCase()
  if (/xprinter|xp-?|x-print/.test(label)) return 'xprinter'
  if (/epson|tm-/.test(label)) return 'epson'
  if (/sunmi/.test(label)) return 'sunmi'
  if (/bixolon|spp-|srp-/.test(label)) return 'bixolon'
  if (/rongta|rp-/.test(label)) return 'rongta'
  if (/goojprt|gooj/.test(label)) return 'goojprt'
  if (/hprt/.test(label)) return 'hprt'
  if (/star/.test(label)) return 'star'
  if (/zebra|zd|zt|gk|gx/.test(label)) return 'zebra'
  return 'generic'
}

function getPrinterCapabilityProfile(printer: ThermalPrinterSettings): PrinterCapabilityProfile {
  const modelFamily = printer.modelFamily || inferPrinterModelFamily(printer)
  const paperWidth = printer.paperWidth === 58 || printer.paperWidth === '58mm' ? '58mm' : '80mm'
  const conservativeBluetooth = modelFamily === 'goojprt' || modelFamily === 'hprt' || modelFamily === 'generic'
  return {
    modelFamily,
    paperWidth,
    supportsCut: printer.supportsCut ?? (paperWidth === '80mm' && modelFamily !== 'zebra'),
    supportsCashDrawer: printer.supportsCashDrawer ?? (modelFamily !== 'zebra' && modelFamily !== 'sunmi'),
    supportsRasterImage: true,
    supportsQr: printer.supportsQr ?? printer.printsQr !== false,
    codePages: printer.codePage && printer.codePage !== 'auto'
      ? [printer.codePage]
      : ['utf8', 'cp864', 'cp720', 'cp1256'],
    usbChunkSize: modelFamily === 'sunmi' || modelFamily === 'zebra' ? 2048 : 4096,
    bluetoothChunkSize: conservativeBluetooth ? 120 : 180,
    bluetoothChunkDelayMs: conservativeBluetooth ? 12 : 8,
  }
}

function normalizePrinter(input: Partial<ThermalPrinterSettings> | undefined, role: ThermalPrinterRole): ThermalPrinterSettings {
  const next = { ...defaultPrinters[role], ...(input || {}) }
  const method = next.method || next.connectionType
  const modelFamily = next.modelFamily || inferPrinterModelFamily(next)
  return {
    ...next,
    role,
    modelFamily,
    method: method === 'bluetooth' || method === 'usb' || method === 'network' || method === 'system' ? method : 'network',
    connectionType: method === 'bluetooth' || method === 'usb' || method === 'network' || method === 'system' ? method : 'network',
    deviceName: next.deviceName || next.name || defaultPrinters[role].deviceName,
    lastConnectedMethod: next.lastConnectedMethod === method ? next.lastConnectedMethod : '',
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
  const configuredPort = String(printer.port || '').trim()

  if (/^https?:\/\//i.test(rawAddress)) {
    try {
      const url = new URL(rawAddress)
      if (!url.port && configuredPort) url.port = configuredPort
      if (!url.pathname || url.pathname === '/') url.pathname = '/print'
      return url.toString()
    } catch {
      const withPath = rawAddress.endsWith('/print') ? rawAddress : `${rawAddress.replace(/\/+$/, '')}/print`
      return configuredPort && !/:\d+(?:\/|$)/.test(rawAddress.replace(/^https?:\/\//i, '')) ? withPath.replace(/^https?:\/\/([^/]+)/i, (match) => `${match}:${configuredPort}`) : withPath
    }
  }

  const addressWithProtocol = `http://${rawAddress}`
  try {
    const url = new URL(addressWithProtocol)
    if (!url.port && configuredPort) url.port = configuredPort
    if (!url.pathname || url.pathname === '/') url.pathname = '/print'
    return url.toString()
  } catch {
    const hasPort = /:\d+(?:\/|$)/.test(rawAddress)
    const [host = '', ...pathParts] = rawAddress.split('/')
    const path = pathParts.join('/').replace(/^\/+|\/+$/g, '')
    const finalPath = path || 'print'
    return `http://${host}${configuredPort && !hasPort ? `:${configuredPort}` : ''}/${finalPath}`
  }
}

async function checkNetworkPrintEndpoint(printer: ThermalPrinterSettings, options: { force?: boolean } = {}) {
  const endpoint = normalizeNetworkPrintEndpoint(printer)
  if (!endpoint) throw new Error('Enter the printer IP or Network Bridge URL.')
  const cached = networkHealthCache.get(endpoint)
  const now = Date.now()
  if (!options.force && cached?.promise) return cached.promise
  if (!options.force && cached && now - cached.checkedAt < NETWORK_HEALTH_CACHE_MS) return

  const healthEndpoint = new URL(endpoint)
  healthEndpoint.pathname = '/health'
  healthEndpoint.search = ''
  healthEndpoint.hash = ''
  const token = Symbol(endpoint)
  const task = (async () => {
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), NETWORK_HEALTH_TIMEOUT_MS)
    try {
    const response = await fetch(healthEndpoint.toString(), {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`Network bridge responded with ${response.status}`)
      networkHealthCache.set(endpoint, { checkedAt: Date.now() })
    } catch (error) {
      networkHealthCache.delete(endpoint)
      const message = error instanceof Error ? error.message : String(error || '')
      throw new Error(`Could not reach Network Bridge at ${endpoint}. ${message}`)
    } finally {
      window.clearTimeout(timeout)
      const latest = networkHealthCache.get(endpoint)
      if (latest?.token === token) networkHealthCache.delete(endpoint)
    }
  })()
  networkHealthCache.set(endpoint, { checkedAt: cached?.checkedAt || 0, promise: task, token })
  return task
}

function qrValue(value?: string) {
  const trimmed = (value || '').trim()
  return trimmed
}

const APP_LOGO_URL = '/logo.png'

function isLocalAsset(url: string) {
  return /^data:|^blob:/i.test(url) || url.startsWith('/') || (typeof window !== 'undefined' && url.startsWith(window.location.origin))
}

function normalizePrintAssetUrl(url?: string) {
  const trimmed = (url || '').trim()
  if (!trimmed) return ''
  const normalized = trimmed
  if (typeof window === 'undefined' || /^data:|^blob:/i.test(normalized)) return normalized
  try {
    return new URL(normalized, window.location.origin).toString()
  } catch {
    return normalized
  }
}

async function loadImage(url?: string, fallbackUrl?: string): Promise<HTMLImageElement | null> {
  const source = normalizePrintAssetUrl(url)
  if (!source) return fallbackUrl ? loadImage(fallbackUrl) : null
  if (printAssetCache.has(source)) return printAssetCache.get(source) || null
  const task = new Promise<HTMLImageElement | null>((resolve) => {
    const image = new Image()
    let settled = false
    const finish = (value: HTMLImageElement | null) => {
      if (settled) return
      settled = true
      window.clearTimeout(timeout)
      if (!value) printAssetCache.delete(source)
      resolve(value)
    }
    const timeout = window.setTimeout(() => finish(null), isLocalAsset(source) ? PRINT_LOCAL_ASSET_TIMEOUT_MS : PRINT_EXTERNAL_ASSET_TIMEOUT_MS)
    if (!isLocalAsset(source)) image.crossOrigin = 'anonymous'
    image.onload = () => finish(image)
    image.onerror = () => {
      printAssetCache.delete(source)
      if (fallbackUrl && normalizePrintAssetUrl(fallbackUrl) !== source) {
        loadImage(fallbackUrl).then(finish).catch(() => finish(null))
        return
      }
      finish(null)
    }
    image.src = source
  })
  printAssetCache.set(source, task)
  return task
}

async function loadQrImage(value?: string) {
  const trimmed = qrValue(value)
  if (!trimmed) return null
  if (qrAssetCache.has(trimmed)) return qrAssetCache.get(trimmed) || null
  const task = QRCode.toDataURL(trimmed, {
    errorCorrectionLevel: 'M',
    margin: 1,
    scale: 6,
    color: {
      dark: '#000000',
      light: '#ffffff',
    },
  }).then((dataUrl) => loadImage(dataUrl)).catch(() => null)
  qrAssetCache.set(trimmed, task)
  return task
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
  const logoPromise = job.kind === 'cashier' ? loadImage(job.payload.logoUrl, APP_LOGO_URL) : Promise.resolve(null)
  const qrValues = [job.payload.invoiceQrUrl, job.payload.invoiceQrUrl2].map(qrValue).filter(Boolean)
  const qrImagesPromise = job.kind === 'cashier'
    ? Promise.all(qrValues.map((value) => loadQrImage(value))).then((images) => images.filter(Boolean) as HTMLImageElement[])
    : Promise.resolve([] as HTMLImageElement[])

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
  const drawLogo = (image: HTMLImageElement | null) => {
    const logoSize = width === 384 ? 86 : 108
    if (image) {
      const imageWidth = image.naturalWidth || image.width || logoSize
      const imageHeight = image.naturalHeight || image.height || logoSize
      const ratio = Math.min(logoSize / imageWidth, logoSize / imageHeight)
      const drawWidth = Math.max(1, imageWidth * ratio)
      const drawHeight = Math.max(1, imageHeight * ratio)
      context.drawImage(image, center - drawWidth / 2, y + (logoSize - drawHeight) / 2, drawWidth, drawHeight)
    } else {
      context.fillStyle = '#111111'
      context.beginPath()
      context.arc(center, y + logoSize / 2, logoSize / 2, 0, Math.PI * 2)
      context.fill()
      context.fillStyle = '#ffffff'
      context.textAlign = 'center'
      context.textBaseline = 'middle'
      context.font = `900 ${Math.round(logoSize * 0.52)}px Arial, Tahoma, sans-serif`
      context.fillText('R', center, y + logoSize / 2)
      context.textBaseline = 'top'
      context.fillStyle = '#111111'
      context.textAlign = isArabic ? 'right' : 'left'
    }
    y += logoSize + 10
  }

  const logo = await logoPromise
  if (job.kind === 'cashier') drawLogo(logo)

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
    if (job.payload.invoiceMessage) {
      divider()
      drawText(job.payload.invoiceMessage, { size: 18, weight: 700, align: 'center' })
    }
    divider()
    drawText('Powered by markode.co', { size: 15, weight: 800, align: 'center', gap: 0 })
    drawText('+0201090886364', { size: 15, weight: 800, align: 'center', gap: 2 })

    const qrImages = await qrImagesPromise
    if (qrImages.length) {
      y += 8
      const qrSize = qrImages.length > 1 ? (width === 384 ? 104 : 122) : (width === 384 ? 128 : 138)
      const gap = width === 384 ? 14 : 24
      const totalWidth = qrImages.length * qrSize + (qrImages.length - 1) * gap
      let x = center - totalWidth / 2
      for (const qr of qrImages) {
        context.drawImage(qr, x, y, qrSize, qrSize)
        x += qrSize + gap
      }
      y += qrSize
    }
  }

  y += width === 384 ? 28 : 36
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
  const inkThreshold = 198
  const raster = new Uint8Array(bytesPerRow * height)

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4
      const alpha = data[offset + 3] / 255
      const luminance = (data[offset] * 0.299 + data[offset + 1] * 0.587 + data[offset + 2] * 0.114) * alpha + 255 * (1 - alpha)
      if (luminance < inkThreshold) raster[y * bytesPerRow + (x >> 3)] |= 0x80 >> (x & 7)
    }
  }

  const header = new Uint8Array([
    0x1b, 0x40,
    0x1d, 0x76, 0x30, 0x00,
    bytesPerRow & 0xff,
    (bytesPerRow >> 8) & 0xff,
    height & 0xff,
    (height >> 8) & 0xff,
  ])
  const output = new Uint8Array(header.length + raster.length)
  output.set(header, 0)
  output.set(raster, header.length)
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

async function writeBluetoothBytes(characteristic: BluetoothCharacteristic, bytes: Uint8Array) {
  const data = toArrayBuffer(bytes)
  if (typeof characteristic.writeValueWithoutResponse === 'function') {
    await characteristic.writeValueWithoutResponse(data)
    return
  }
  if (typeof characteristic.writeValueWithResponse === 'function') {
    await characteristic.writeValueWithResponse(data)
    return
  }
  await characteristic.writeValue(data)
}

function bluetoothPrintError(error: unknown) {
  const detail = error instanceof Error ? error.message : String(error || '')
  return new Error(`تعذر إرسال أمر الطباعة عبر Bluetooth. أعد ربط الطابعة من الزر، وتأكد أنها ليست متصلة بتطبيق آخر. ${detail}`)
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
  private recentJobSignatures = new Map<string, number>()
  private usbDevices: Partial<Record<ThermalPrinterRole, UsbDevice>> = {}
  private usbClaimedInterfaces: Partial<Record<ThermalPrinterRole, number>> = {}
  private bluetoothDevices: Partial<Record<ThermalPrinterRole, BluetoothDeviceLike>> = {}
  private bluetoothCharacteristics: Partial<Record<ThermalPrinterRole, BluetoothCharacteristic>> = {}
  private networkKeepAliveTimer?: number
  private networkKeepAliveInFlight = false
  private diagnosticEvents: PrinterDiagnosticEvent[] = []

  constructor(printers?: Partial<Record<ThermalPrinterRole, Partial<ThermalPrinterSettings>>>) {
    this.settings = normalizePrinters(printers)
    this.configureNetworkKeepAlive()
  }

  getPrinters() {
    return this.settings
  }

  getDiagnostics(): Record<ThermalPrinterRole, PrinterRuntimeDiagnostic> {
    const entries = Object.entries(this.settings) as Array<[ThermalPrinterRole, ThermalPrinterSettings]>
    return Object.fromEntries(entries.map(([role, printer]) => {
      const method = printer.method || printer.connectionType || ''
      const configurationIssue = this.getConfigurationIssue(printer)
      const reconnectNeeded = (method === 'bluetooth' || method === 'usb') &&
        !printer.lastConnected &&
        !this.bluetoothDevices[role] &&
        !this.usbDevices[role]
      const status: PrinterRuntimeDiagnostic['status'] = !printer.isEnabled
        ? 'disabled'
        : configurationIssue
          ? 'not_configured'
          : reconnectNeeded
            ? 'needs_reconnect'
            : 'ready'
      return [role, {
        role,
        method,
        status,
        endpoint: method === 'network' ? normalizeNetworkPrintEndpoint(printer) : '',
        ip: printer.ip || '',
        port: printer.port || '',
        deviceName: printer.deviceName || printer.name || '',
        deviceId: printer.deviceId || '',
        deviceAddress: printer.deviceAddress || '',
        lastConnected: printer.lastConnected || '',
        lastConnectedMethod: printer.lastConnectedMethod || '',
        lastPrinted: printer.lastPrinted || '',
        failedAttempts: Number(printer.failedAttempts || 0),
        lastError: printer.lastError || '',
        recentEvents: this.diagnosticEvents.filter((event) => event.role === role).slice(-12).reverse(),
      }]
    })) as Record<ThermalPrinterRole, PrinterRuntimeDiagnostic>
  }

  getDiagnosticLog() {
    return [...this.diagnosticEvents].reverse()
  }

  clearDiagnostics(role?: ThermalPrinterRole) {
    this.diagnosticEvents = role
      ? this.diagnosticEvents.filter((event) => event.role !== role)
      : []
  }

  private recordDiagnostic(event: Omit<PrinterDiagnosticEvent, 'id' | 'at'>) {
    const entry: PrinterDiagnosticEvent = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      at: new Date().toISOString(),
      ...event,
    }
    this.diagnosticEvents = [...this.diagnosticEvents, entry].slice(-MAX_DIAGNOSTIC_EVENTS)
    const level = event.status === 'failed' ? 'warn' : 'info'
    console[level]('[PrinterManager]', entry)
    return entry
  }

  private errorDetails(error: unknown) {
    return {
      error: error instanceof Error ? error.message : String(error || ''),
      stack: error instanceof Error ? error.stack : undefined,
    }
  }

  async discoverAvailablePrinters(): Promise<AvailablePrinterDevice[]> {
    const devices: AvailablePrinterDevice[] = []
    if (typeof navigator !== 'undefined' && typeof navigator.usb?.getDevices === 'function') {
      const usbDevices = await navigator.usb.getDevices().catch(() => [])
      devices.push(...usbDevices.map((device) => ({
        method: 'usb' as const,
        id: device.serialNumber || `${device.vendorId || ''}:${device.productId || ''}`,
        name: device.productName || 'USB printer',
        address: device.vendorId && device.productId
          ? `${device.vendorId.toString(16).padStart(4, '0')}:${device.productId.toString(16).padStart(4, '0')}`
          : undefined,
        paired: true,
      })))
    }
    if (typeof navigator !== 'undefined' && typeof navigator.bluetooth?.getDevices === 'function') {
      const bluetoothDevices = await navigator.bluetooth.getDevices().catch(() => [])
      devices.push(...bluetoothDevices.map((device) => ({
        method: 'bluetooth' as const,
        id: device.id || device.name || 'bluetooth-printer',
        name: device.name || 'Bluetooth printer',
        paired: true,
      })))
    }
    await Promise.all((Object.values(this.settings)).map(async (printer) => {
      if ((printer.method || printer.connectionType) !== 'network') return
      const endpoint = normalizeNetworkPrintEndpoint(printer)
      if (!endpoint) return
      const printersEndpoint = new URL(endpoint)
      printersEndpoint.pathname = '/printers'
      printersEndpoint.search = ''
      printersEndpoint.hash = ''
      try {
        await checkNetworkPrintEndpoint(printer, { force: true })
        const bridgePrinters = await fetch(printersEndpoint.toString(), { cache: 'no-store' })
          .then((response) => response.ok ? response.json() : null)
          .catch(() => null) as { printers?: Array<{ Name?: string; Default?: boolean; WorkOffline?: boolean; PortName?: string }> } | null
        if (Array.isArray(bridgePrinters?.printers)) {
          bridgePrinters.printers.forEach((item) => {
            devices.push({
              method: 'system',
              id: item.Name || 'windows-printer',
              name: item.Name || 'Windows printer',
              address: item.PortName,
              paired: item.WorkOffline !== true,
              detail: item.Default ? 'Windows default printer' : 'Windows installed printer',
            })
          })
        }
        devices.push({
          method: 'network',
          id: endpoint,
          name: printer.deviceName || printer.name || 'Network Bridge',
          address: endpoint,
          paired: true,
          detail: 'Health check passed',
        })
      } catch (error) {
        devices.push({
          method: 'network',
          id: endpoint,
          name: printer.deviceName || printer.name || 'Network Bridge',
          address: endpoint,
          paired: false,
          detail: error instanceof Error ? error.message : String(error || ''),
        })
      }
    }))
    return devices
  }

  setPrinters(printers: Partial<Record<ThermalPrinterRole, Partial<ThermalPrinterSettings>>>) {
    const nextSettings = normalizePrinters(printers)
    for (const role of Object.keys(nextSettings) as ThermalPrinterRole[]) {
      const previousPrinter = this.settings[role]
      const nextPrinter = nextSettings[role]
      const previousMethod = this.settings[role]?.method || this.settings[role]?.connectionType
      const nextMethod = nextPrinter?.method || nextPrinter?.connectionType
      if (previousMethod && nextMethod && previousMethod !== nextMethod) {
        void this.disconnect(role)
        this.recordDiagnostic({
          role,
          method: nextMethod,
          action: 'settings',
          status: 'ok',
          message: `Connection method changed from ${previousMethod} to ${nextMethod}`,
        })
        const hasVerifiedConnection = Boolean(nextSettings[role].lastConnected && nextSettings[role].lastConnectedMethod === nextMethod)
        if (!hasVerifiedConnection) {
          nextSettings[role].lastConnected = ''
          nextSettings[role].lastConnectedMethod = ''
        }
      }
      const deviceIdentityChanged = previousMethod === nextMethod &&
        (nextMethod === 'bluetooth' || nextMethod === 'usb') &&
        (
          (previousPrinter?.deviceId || '') !== (nextPrinter?.deviceId || '') ||
          (previousPrinter?.deviceAddress || '') !== (nextPrinter?.deviceAddress || '')
        )
      if (deviceIdentityChanged) void this.disconnect(role)
      if (nextMethod === 'network') {
        delete this.bluetoothCharacteristics[role]
        delete this.bluetoothDevices[role]
        delete this.usbDevices[role]
        delete this.usbClaimedInterfaces[role]
      }
    }
    this.settings = nextSettings
    this.saveSettings()
    this.configureNetworkKeepAlive()
  }

  async testConnection(role: ThermalPrinterRole) {
    const printer = this.settings[role]
    const method = printer.method || printer.connectionType || ''
    const startedAt = Date.now()
    this.recordDiagnostic({ role, method, action: 'connect', status: 'started', endpoint: method === 'network' ? normalizeNetworkPrintEndpoint(printer) : undefined })
    try {
      await this.connect(role, printer, true, true)
      printer.lastConnected = new Date().toISOString()
      printer.lastConnectedMethod = printer.method || printer.connectionType || ''
      printer.failedAttempts = 0
      printer.lastError = ''
      this.saveSettings()
      this.recordDiagnostic({ role, method, action: 'connect', status: 'ok', durationMs: Date.now() - startedAt })
      return { ok: true, message: 'تم الاتصال بالطابعة بنجاح.', printer: { ...printer } }
    } catch (error) {
      const detail = this.errorDetails(error)
      printer.failedAttempts = Number(printer.failedAttempts || 0) + 1
      printer.lastError = detail.error
      this.saveSettings()
      this.recordDiagnostic({ role, method, action: 'connect', status: 'failed', durationMs: Date.now() - startedAt, ...detail })
      throw error
    }
  }

  async connectPrinter(role: ThermalPrinterRole) {
    const printer = this.settings[role]
    const method = printer.method || printer.connectionType || ''
    const startedAt = Date.now()
    this.recordDiagnostic({ role, method, action: 'connect', status: 'started', endpoint: method === 'network' ? normalizeNetworkPrintEndpoint(printer) : undefined })
    try {
      await this.connect(role, printer, true, true)
      printer.lastConnected = new Date().toISOString()
      printer.lastConnectedMethod = printer.method || printer.connectionType || ''
      printer.failedAttempts = 0
      printer.lastError = ''
      this.saveSettings()
      this.recordDiagnostic({ role, method, action: 'connect', status: 'ok', durationMs: Date.now() - startedAt })
      return { ok: true, printer: { ...printer } }
    } catch (error) {
      const detail = this.errorDetails(error)
      printer.failedAttempts = Number(printer.failedAttempts || 0) + 1
      printer.lastError = detail.error
      this.saveSettings()
      this.recordDiagnostic({ role, method, action: 'connect', status: 'failed', durationMs: Date.now() - startedAt, ...detail })
      throw error
    }
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
    const resolvedKind = kind === 'diagnostic' ? (role === 'cashier' ? 'cashier' : role) : kind
    return this.enqueue({
      role,
      kind: resolvedKind,
      strict: true,
      allowDevicePrompt: true,
      payload: {
        orderId: `TEST-${role.toUpperCase()}`,
        orderType: role === 'hall' ? 'DINE_IN' : 'TEST',
        tableNumber: '1',
        createdAt: new Date().toISOString(),
        customer: { name: 'اختبار الطابعة' },
        lines: [
          { name: resolvedKind === 'kitchen' ? 'اختبار مطبخ' : resolvedKind === 'hall' ? 'اختبار صالة' : 'اختبار طباعة', quantity: 1, price: 0, hidePrice: true },
        ],
        subtotal: 0,
        tax: 0,
        discountAmount: 0,
        total: 0,
        paymentMethod: 'Cash',
        currency: 'ج.م',
        invoiceName: 'Baseeta POS',
        invoiceAddress: '',
        invoiceMessage: 'تم اختبار الطابعة بنجاح',
        invoiceQrUrl: '',
        invoiceQrUrl2: '',
        isArabic: true,
        ...payload,
      },
    })
  }

  private configureNetworkKeepAlive() {
    if (typeof window === 'undefined') return
    if (this.networkKeepAliveTimer) {
      window.clearInterval(this.networkKeepAliveTimer)
      this.networkKeepAliveTimer = undefined
    }
    const hasNetworkPrinter = Object.values(this.settings).some((printer) =>
      printer.isEnabled === true &&
      (printer.method || printer.connectionType) === 'network' &&
      Boolean((printer.ip || printer.deviceAddress || '').trim())
    )
    if (!hasNetworkPrinter) return

    void this.keepNetworkPrintersWarm()
    this.networkKeepAliveTimer = window.setInterval(() => {
      void this.keepNetworkPrintersWarm()
    }, NETWORK_KEEP_ALIVE_MS)
  }

  private async keepNetworkPrintersWarm() {
    if (this.networkKeepAliveInFlight) return
    this.networkKeepAliveInFlight = true
    try {
      const entries = Object.entries(this.settings) as Array<[ThermalPrinterRole, ThermalPrinterSettings]>
      await Promise.all(entries.map(async ([role, printer]) => {
        if (!printer.isEnabled || (printer.method || printer.connectionType) !== 'network' || !(printer.ip || printer.deviceAddress || '').trim()) return
        try {
          await checkNetworkPrintEndpoint(printer)
          printer.lastConnected = new Date().toISOString()
          printer.lastConnectedMethod = 'network'
        } catch (error) {
          console.info(`[PrinterManager] ${role} Network Bridge keep-alive missed.`, error)
        }
      }))
      this.saveSettings()
    } finally {
      this.networkKeepAliveInFlight = false
    }
  }

  private enqueue(job: PrintJob) {
    const signature = this.jobSignature(job)
    const now = Date.now()
    const recentAt = this.recentJobSignatures.get(signature) || 0
    if (now - recentAt < DUPLICATE_JOB_WINDOW_MS) {
      console.info(`[PrinterManager] Duplicate ${job.kind} job ${job.payload.orderId || ''} ignored.`)
      return Promise.resolve({ ok: true, skipped: true, duplicate: true, reason: 'Duplicate print request ignored' })
    }
    this.recentJobSignatures.set(signature, now)
    for (const [key, at] of this.recentJobSignatures) {
      if (now - at > DUPLICATE_JOB_WINDOW_MS * 4) this.recentJobSignatures.delete(key)
    }
    const task = this.queue.then(() => this.printWithRetry(job))
    this.queue = task.catch(() => undefined)
    return task
  }

  private jobSignature(job: PrintJob) {
    return [
      job.role,
      job.kind,
      job.payload.orderId || '',
      job.payload.createdAt || '',
      job.payload.total ?? '',
      job.payload.lines.length,
    ].join('|')
  }

  private async printWithRetry(job: PrintJob) {
    const printer = this.settings[job.role]
    const method = printer.method || printer.connectionType || ''
    if (!printer.isEnabled) {
      console.info(`[PrinterManager] ${job.role} disabled. Skipping print job.`)
      this.recordDiagnostic({ role: job.role, method, action: 'print', status: 'skipped', jobKind: job.kind, orderId: job.payload.orderId, message: `${job.role} printer is disabled` })
      if (this.shouldFallbackToCashier(job)) return this.printFallbackToCashier(job, `${job.role} printer is disabled`)
      return { ok: true, skipped: true, reason: `${job.role} printer is disabled` }
    }
    const configurationIssue = this.getConfigurationIssue(printer)
    if (configurationIssue) {
      this.recordDiagnostic({ role: job.role, method, action: 'print', status: 'skipped', jobKind: job.kind, orderId: job.payload.orderId, message: configurationIssue })
      if (job.strict) throw new Error(configurationIssue)
      console.info(`[PrinterManager] ${job.role} is not configured. Skipping print job: ${configurationIssue}`)
      if (this.shouldFallbackToCashier(job)) return this.printFallbackToCashier(job, configurationIssue)
      return { ok: true, skipped: true, reason: configurationIssue }
    }
    let lastError: unknown
    const configuredAttempts = method === 'system' ? 1 : Math.max(1, Number(printer.retryAttempts || 3))
    const attempts = this.shouldFallbackToCashier(job) ? 1 : configuredAttempts
    console.info(`[PrinterManager] جاري الطباعة - ${job.kind} على ${job.role}.`)
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      const startedAt = Date.now()
      this.recordDiagnostic({
        role: job.role,
        method,
        action: 'print',
        status: 'started',
        jobKind: job.kind,
        orderId: job.payload.orderId,
        attempt,
        endpoint: method === 'network' ? normalizeNetworkPrintEndpoint(printer) : undefined,
        request: {
          orderId: job.payload.orderId,
          lineCount: job.payload.lines.length,
          total: job.payload.total,
          strict: job.strict === true,
        },
      })
      try {
        await this.print(job, printer, job.allowDevicePrompt === true)
        printer.lastConnected = new Date().toISOString()
        printer.lastConnectedMethod = method || ''
        printer.lastPrinted = new Date().toISOString()
        printer.failedAttempts = 0
        printer.lastError = ''
        this.saveSettings()
        this.recordDiagnostic({ role: job.role, method, action: 'print', status: 'ok', jobKind: job.kind, orderId: job.payload.orderId, attempt, durationMs: Date.now() - startedAt })
        return { ok: true }
      } catch (error) {
        lastError = error
        const detail = this.errorDetails(error)
        printer.failedAttempts = Number(printer.failedAttempts || 0) + 1
        printer.lastError = detail.error
        this.saveSettings()
        this.recordDiagnostic({ role: job.role, method, action: 'print', status: 'failed', jobKind: job.kind, orderId: job.payload.orderId, attempt, durationMs: Date.now() - startedAt, ...detail })
        if (isReconnectRequired(error)) {
          const reason = error instanceof Error ? error.message : 'Printer needs reconnect'
          if (job.strict) throw new Error(reason)
          return { ok: true, skipped: true, needsReconnect: true, reason }
        }
        if (isDeviceChooserCancelled(error)) {
          throw new Error('تم إلغاء اختيار الطابعة. افتح نافذة الاختيار مرة أخرى واختر الجهاز عند الطباعة.')
        }
        await this.disconnect(job.role)
        if (attempt < attempts) {
          console.warn(`[PrinterManager] جاري الطباعة - يتم استكمال الاتصال بالطابعة.`)
          const retryDelay = Math.min(5000, 350 * (2 ** (attempt - 1)))
          await wait(retryDelay)
        }
      }
    }
    console.error(`[PrinterManager] ${job.role} print failed:`, lastError)
    if (this.shouldFallbackToCashier(job)) {
      const reason = lastError instanceof Error ? lastError.message : `${job.role} printer failed`
      return this.printFallbackToCashier(job, reason)
    }
    throw lastError instanceof Error ? lastError : new Error('تعذر إرسال أمر الطباعة.')
  }

  private shouldFallbackToCashier(job: PrintJob) {
    return !job.strict && job.role !== 'cashier' && (job.kind === 'kitchen' || job.kind === 'hall')
  }

  private async printFallbackToCashier(job: PrintJob, reason: string) {
    const cashier = this.settings.cashier
    const configurationIssue = this.getConfigurationIssue(cashier)
    if (!cashier.isEnabled || configurationIssue) {
      const fallbackReason = !cashier.isEnabled ? 'cashier printer is disabled' : configurationIssue
      console.warn(`[PrinterManager] ${job.role} fallback failed: ${fallbackReason}`)
      return { ok: true, skipped: true, fallbackFailed: true, reason: `${reason}. Fallback unavailable: ${fallbackReason}` }
    }
    console.warn(`[PrinterManager] ${job.role} ${job.kind} routed to cashier fallback: ${reason}`)
    this.recordDiagnostic({ role: job.role, method: cashier.method || cashier.connectionType || '', action: 'fallback', status: 'started', jobKind: job.kind, orderId: job.payload.orderId, message: reason })
    try {
      await this.printWithRetry({
        ...job,
        role: 'cashier',
        strict: false,
        allowDevicePrompt: false,
      })
      this.recordDiagnostic({ role: job.role, method: cashier.method || cashier.connectionType || '', action: 'fallback', status: 'ok', jobKind: job.kind, orderId: job.payload.orderId, message: 'Printed on cashier fallback' })
      return { ok: true, fallback: true, fromRole: job.role, toRole: 'cashier', reason }
    } catch (error) {
      const fallbackReason = error instanceof Error ? error.message : String(error || 'cashier fallback failed')
      this.recordDiagnostic({ role: job.role, method: cashier.method || cashier.connectionType || '', action: 'fallback', status: 'failed', jobKind: job.kind, orderId: job.payload.orderId, ...this.errorDetails(error) })
      return { ok: true, skipped: true, fallbackFailed: true, reason: `${reason}. Fallback failed: ${fallbackReason}` }
    }
  }

  private async print(job: PrintJob, printer: ThermalPrinterSettings, allowDevicePrompt = false) {
    const canvas = await renderReceiptImage(job, printer)
    const bytes = canvasToRasterEscPos(canvas)
    const method = printer.method || printer.connectionType
    if (method === 'network') return this.printNetwork(printer, bytes)
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
  private async printNetwork(printer: ThermalPrinterSettings, bytes: Uint8Array) {
    const endpoint = normalizeNetworkPrintEndpoint(printer)
    if (!endpoint) throw new Error('Enter the printer IP or Network Bridge URL.')
    const profile = getPrinterCapabilityProfile(printer)
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), NETWORK_PRINT_TIMEOUT_MS)
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          printer: printer.deviceName || printer.name,
          paperWidth: printer.paperWidth || '80mm',
          format: 'escpos-raster',
          respondImmediately: false,
          modelFamily: profile.modelFamily,
          capabilities: {
            supportsCut: profile.supportsCut,
            supportsCashDrawer: profile.supportsCashDrawer,
            supportsQr: profile.supportsQr,
            codePages: profile.codePages,
          },
          escposBase64: bytesToBase64(bytes),
        }),
      })
      const detail = await response.json().catch(() => null) as { error?: string; ok?: boolean; printer?: string; jobId?: string } | null
      if (!response.ok) {
        throw new Error(`Network print bridge failed: ${response.status} at ${endpoint}${detail?.error ? `. ${detail.error}` : ''}`)
      }
      if (detail?.ok === false) {
        throw new Error(`Network print bridge rejected the job at ${endpoint}${detail.error ? `. ${detail.error}` : ''}`)
      }
      networkHealthCache.set(endpoint, { checkedAt: Date.now() })
    } catch (error) {
      networkHealthCache.delete(endpoint)
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Network print bridge timed out at ${endpoint} after ${NETWORK_PRINT_TIMEOUT_MS}ms`)
      }
      throw error
    } finally {
      window.clearTimeout(timeout)
    }
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

    const profile = getPrinterCapabilityProfile(printer)
    const chunkSize = profile.usbChunkSize
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
    let characteristic = this.bluetoothCharacteristics[role] || await this.connectBluetooth(role, printer, allowDevicePrompt)
    const profile = getPrinterCapabilityProfile(printer)
    const chunkSize = profile.bluetoothChunkSize
    try {
      for (let index = 0; index < bytes.length; index += chunkSize) {
        await writeBluetoothBytes(characteristic, bytes.slice(index, index + chunkSize))
        if (index + chunkSize < bytes.length) await wait(profile.bluetoothChunkDelayMs)
      }
    } catch (error) {
      delete this.bluetoothCharacteristics[role]
      if (!allowDevicePrompt && this.bluetoothDevices[role]?.gatt) {
        characteristic = await this.connectBluetooth(role, printer, false)
        for (let index = 0; index < bytes.length; index += chunkSize) {
          await writeBluetoothBytes(characteristic, bytes.slice(index, index + chunkSize))
          if (index + chunkSize < bytes.length) await wait(profile.bluetoothChunkDelayMs)
        }
        return
      }
      throw bluetoothPrintError(error)
    }
  }

  private async connect(role: ThermalPrinterRole, printer: ThermalPrinterSettings, allowDevicePrompt = false, forceHealthCheck = false) {
    const method = printer.method || printer.connectionType
    if (method === 'system') return
    if (method === 'network') {
      await checkNetworkPrintEndpoint(printer, { force: forceHealthCheck })
      return
    }
    if (method === 'usb') {
      await this.printUsb(role, printer, new Uint8Array([0x1b, 0x40]), allowDevicePrompt)
      return
    }
    if (method === 'bluetooth') {
      await this.connectBluetooth(role, printer, allowDevicePrompt, forceHealthCheck)
      return
    }
  }

  private async connectBluetooth(role: ThermalPrinterRole, printer: ThermalPrinterSettings, allowDevicePrompt = false, verifyWrite = false) {
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
            if (verifyWrite) {
              await writeBluetoothBytes(characteristic, new Uint8Array([0x1b, 0x40]))
            }
            this.bluetoothCharacteristics[role] = characteristic
            printer.deviceId = device.id || printer.deviceId
            printer.deviceName = device.name || printer.deviceName
            printer.lastConnected = new Date().toISOString()
            printer.lastConnectedMethod = 'bluetooth'
            this.saveSettings()
            return characteristic
          } catch (error) {
            console.info(`[PrinterManager] ${role} Bluetooth characteristic ${charId} is not writable for printing.`, error)
          }
        }
      } catch (error) {
        console.info(`[PrinterManager] ${role} Bluetooth service ${serviceId} is not available.`, error)
      }
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
    const bluetoothDevice = this.bluetoothDevices[role]
    if (bluetoothDevice?.gatt?.connected && typeof bluetoothDevice.gatt.disconnect === 'function') {
      try {
        bluetoothDevice.gatt.disconnect()
      } catch {
        // Ignore disconnect failures; the next connect path will rebuild the session.
      }
    }
    delete this.bluetoothCharacteristics[role]
    delete this.bluetoothDevices[role]
    delete this.usbDevices[role]
    delete this.usbClaimedInterfaces[role]
  }

  private saveSettings() {
    if (!browserStorageAvailable()) return
    window.localStorage.removeItem(LEGACY_STORAGE_KEY)
  }
}

export const printerManager = new PrinterManager()

export function syncPrinterManagerSettings(printers: Partial<Record<ThermalPrinterRole, Partial<ThermalPrinterSettings>>>) {
  printerManager.setPrinters(printers)
}
