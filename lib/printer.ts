import type { TrackedOrder } from '@/lib/order-tracking'

export type ThermalPrinterRole = 'cashier' | 'kitchen' | 'hall'
export type ThermalConnectionType = 'bluetooth' | 'usb' | 'network'
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
  invoiceMessage?: string
  invoiceQrUrl?: string
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
}

type UsbDevice = {
  opened: boolean
  open: () => Promise<void>
  selectConfiguration: (configurationValue: number) => Promise<void>
  claimInterface: (interfaceNumber: number) => Promise<void>
  transferOut: (endpointNumber: number, data: BufferSource) => Promise<unknown>
  configuration?: {
    configurationValue: number
    interfaces: Array<{
      interfaceNumber: number
      alternates: Array<{ endpoints: Array<{ direction: string; endpointNumber: number }> }>
    }>
  }
  serialNumber?: string
  productName?: string
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
  const method = next.connectionType || next.method
  return {
    ...next,
    role,
    method: method === 'bluetooth' || method === 'usb' || method === 'network' ? method : 'network',
    connectionType: method === 'bluetooth' || method === 'usb' || method === 'network' ? method : 'network',
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
    const qr = await loadImage(qrUrl(job.payload.invoiceQrUrl))
    if (qr) {
      y += 10
      const qrSize = 138
      context.drawImage(qr, center - qrSize / 2, y, qrSize, qrSize)
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
  if (!context) throw new Error('تعذر قراءة صورة الطباعة.')
  const { data, width, height } = context.getImageData(0, 0, canvas.width, canvas.height)
  const bytesPerRow = Math.ceil(width / 8)
  const raster = new Uint8Array(bytesPerRow * height)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4
      const luminance = data[offset] * 0.299 + data[offset + 1] * 0.587 + data[offset + 2] * 0.114
      if (luminance < 180) raster[y * bytesPerRow + (x >> 3)] |= 0x80 >> (x & 7)
    }
  }
  const header = new Uint8Array([0x1b, 0x40, 0x1d, 0x76, 0x30, 0x00, bytesPerRow & 0xff, (bytesPerRow >> 8) & 0xff, height & 0xff, (height >> 8) & 0xff])
  const feedAndCut = new Uint8Array([0x0a, 0x0a, 0x0a, 0x1d, 0x56, 0x42, 0x00])
  const output = new Uint8Array(header.length + raster.length + feedAndCut.length)
  output.set(header, 0)
  output.set(raster, header.length)
  output.set(feedAndCut, header.length + raster.length)
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
      : [{ name: options.isArabic === false ? 'Items count' : 'عدد الأصناف', quantity: Number(order.items || 0), price: Number(order.total || 0) }],
    total: Number(order.total || 0),
    paymentMethod: order.payment?.method,
    ...options,
  }
}

export class PrinterManager {
  private settings: Record<ThermalPrinterRole, ThermalPrinterSettings>
  private queue: Promise<unknown> = Promise.resolve()
  private usbDevices: Partial<Record<ThermalPrinterRole, UsbDevice>> = {}
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
    await this.connect(role, printer)
    printer.lastConnected = new Date().toISOString()
    this.saveSettings()
    return { ok: true, message: 'تم الاتصال بالطابعة بنجاح.' }
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
      return { ok: true, skipped: true }
    }
    const configurationIssue = this.getConfigurationIssue(printer)
    if (configurationIssue) {
      if (job.strict) throw new Error(configurationIssue)
      console.info(`[PrinterManager] ${job.role} is not configured. Skipping print job: ${configurationIssue}`)
      return { ok: true, skipped: true, reason: configurationIssue }
    }
    let lastError: unknown
    const attempts = Math.max(1, Number(printer.retryAttempts || 3))
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        console.info(`[PrinterManager] Printing ${job.kind} on ${job.role}. Attempt ${attempt}/${attempts}.`)
        await this.print(job, printer)
        printer.lastConnected = new Date().toISOString()
        this.saveSettings()
        return { ok: true }
      } catch (error) {
        lastError = error
        console.error(`[PrinterManager] ${job.role} print failed:`, error)
        if (isDeviceChooserCancelled(error)) {
          throw new Error('تم إلغاء اختيار الطابعة. افتح نافذة الاختيار مرة أخرى واختر الجهاز عند الطباعة.')
        }
        await this.disconnect(job.role)
        if (attempt < attempts) await new Promise((resolve) => window.setTimeout(resolve, 350 * attempt))
      }
    }
    throw lastError instanceof Error ? lastError : new Error('تعذر إرسال أمر الطباعة.')
  }

  private async print(job: PrintJob, printer: ThermalPrinterSettings) {
    const canvas = await renderReceiptImage(job, printer)
    const bytes = canvasToRasterEscPos(canvas)
    const method = printer.connectionType || printer.method
    if (method === 'network') return this.printNetwork(printer, bytes, canvas)
    if (method === 'usb') return this.printUsb(job.role, printer, bytes)
    if (method === 'bluetooth') return this.printBluetooth(job.role, printer, bytes)
    throw new Error('طريقة الاتصال غير مدعومة.')
  }

  private async printNetwork(printer: ThermalPrinterSettings, bytes: Uint8Array, canvas: HTMLCanvasElement) {
    const ip = (printer.ip || printer.deviceAddress || '').trim()
    if (!ip) throw new Error('أدخل IP الطابعة أو عنوان bridge الشبكي.')
    const endpoint = ip.startsWith('http://') || ip.startsWith('https://')
      ? ip
      : `http://${ip}${printer.port ? `:${printer.port}` : ''}/print`
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
    if (!response.ok) throw new Error(`فشل bridge الطباعة الشبكية: ${response.status}`)
  }

  private async printUsb(role: ThermalPrinterRole, printer: ThermalPrinterSettings, bytes: Uint8Array) {
    if (!navigator.usb) throw new Error('هذا المتصفح لا يدعم WebUSB.')
    const device = this.usbDevices[role] || await navigator.usb.requestDevice({ filters: [] })
    if (!device.opened) await device.open()
    const configuration = device.configuration
    if (!configuration) await device.selectConfiguration(1)
    const activeConfiguration = device.configuration
    const usbInterface = activeConfiguration?.interfaces?.[0]
    if (!usbInterface) throw new Error('تعذر تحديد واجهة USB للطابعة.')
    await device.claimInterface(usbInterface.interfaceNumber)
    const endpoint = usbInterface.alternates.flatMap((alternate) => alternate.endpoints).find((item) => item.direction === 'out')
    if (!endpoint) throw new Error('تعذر تحديد منفذ إرسال USB.')
    await device.transferOut(endpoint.endpointNumber, toArrayBuffer(bytes))
    this.usbDevices[role] = device
    printer.deviceId = device.serialNumber || printer.deviceId || ''
    printer.deviceName = device.productName || printer.deviceName
  }

  private getConfigurationIssue(printer: ThermalPrinterSettings) {
    const method = printer.connectionType || printer.method
    if (method === 'network' && !(printer.ip || printer.deviceAddress || '').trim()) {
      return 'أدخل IP الطابعة أو عنوان bridge الشبكي من إعدادات الطابعات.'
    }
    return ''
  }

  private async printBluetooth(role: ThermalPrinterRole, printer: ThermalPrinterSettings, bytes: Uint8Array) {
    const characteristic = this.bluetoothCharacteristics[role] || await this.connectBluetooth(role, printer)
    const chunkSize = 180
    for (let index = 0; index < bytes.length; index += chunkSize) {
      await characteristic.writeValue(toArrayBuffer(bytes.slice(index, index + chunkSize)))
    }
  }

  private async connect(role: ThermalPrinterRole, printer: ThermalPrinterSettings) {
    const method = printer.connectionType || printer.method
    if (method === 'network') {
      const ip = (printer.ip || printer.deviceAddress || '').trim()
      if (!ip) throw new Error('أدخل IP الطابعة أو عنوان bridge الشبكي.')
      return
    }
    if (method === 'usb') {
      await this.printUsb(role, printer, new Uint8Array([0x1b, 0x40]))
      return
    }
    if (method === 'bluetooth') {
      await this.connectBluetooth(role, printer)
      return
    }
  }

  private async connectBluetooth(role: ThermalPrinterRole, printer: ThermalPrinterSettings) {
    if (!navigator.bluetooth) throw new Error('هذا المتصفح لا يدعم Web Bluetooth.')
    const device = await this.getBluetoothDevice(role, printer)
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

  private async getBluetoothDevice(role: ThermalPrinterRole, printer: ThermalPrinterSettings) {
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
