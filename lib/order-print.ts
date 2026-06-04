import { TrackedOrder } from '@/lib/order-tracking'

export type InvoicePrintOptions = {
  isArabic: boolean
  currency: string
  title?: string
  printerMethod?: string
  paperWidth?: string
  invoiceName?: string
  invoiceQrUrl?: string
  invoiceMessage?: string
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export function qrImage(url?: string) {
  const trimmed = (url || '').trim()
  if (!trimmed) return ''
  return `https://api.qrserver.com/v1/create-qr-code/?size=132x132&margin=8&data=${encodeURIComponent(trimmed)}`
}

export function printTrackedOrderReceipt(order: TrackedOrder, options: InvoicePrintOptions) {
  const { isArabic, currency } = options
  const direction = isArabic ? 'rtl' : 'ltr'
  const width = options.paperWidth === '58mm' ? '58mm' : '80mm'
  const title = options.title || (isArabic ? 'فاتورة طلب' : 'Order Receipt')
  const invoiceName = options.invoiceName || title
  const qrSrc = qrImage(options.invoiceQrUrl)
  const receiptWindow = window.open('', '_blank', 'width=420,height=720')
  if (!receiptWindow) return false

  receiptWindow.document.write(`
    <!doctype html>
    <html dir="${direction}" lang="${isArabic ? 'ar' : 'en'}">
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(title)} ${escapeHtml(order.id)}</title>
        <style>
          * { box-sizing: border-box; }
          body { font-family: Arial, sans-serif; margin: 0; padding: 16px; color: #111827; background: #fff; }
          .receipt { max-width: ${width}; margin: 0 auto; }
          .brand { text-align: center; border-bottom: 1px dashed #cbd5e1; padding-bottom: 10px; margin-bottom: 10px; }
          .brand-name { margin: 0; font-size: 22px; font-weight: 800; }
          .title { margin-top: 4px; color: #64748b; font-size: 12px; }
          .muted { color: #64748b; font-size: 12px; text-align: center; margin-bottom: 10px; }
          .box { border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; margin: 10px 0; font-size: 13px; }
          .line { display: flex; justify-content: space-between; gap: 12px; margin: 6px 0; }
          .total { font-weight: 800; font-size: 16px; border-top: 1px solid #e2e8f0; padding-top: 8px; }
          .qr { display: flex; justify-content: center; margin: 12px 0 6px; }
          .qr img { width: 100px; height: 100px; }
          .message { border-top: 1px dashed #cbd5e1; margin-top: 12px; padding-top: 10px; text-align: center; font-size: 12px; color: #334155; }
          @media print {
            @page { size: ${width} auto; margin: 4mm; }
            body { padding: 0; }
            .receipt { max-width: none; }
          }
        </style>
      </head>
      <body>
        <div class="receipt">
          <div class="brand">
            <h1 class="brand-name">${escapeHtml(invoiceName)}</h1>
            <div class="title">${escapeHtml(title)}</div>
          </div>
          <div class="muted">${escapeHtml(order.id)} - ${new Date(order.createdAt || Date.now()).toLocaleString(isArabic ? 'ar-EG' : 'en-US')}</div>
          <div class="box">
            <div>${isArabic ? 'العميل' : 'Customer'}: ${escapeHtml(order.customer || '-')}</div>
            <div>${isArabic ? 'الهاتف' : 'Phone'}: ${escapeHtml(order.phone || '-')}</div>
            <div>${isArabic ? 'العنوان / المكان' : 'Address / Place'}: ${escapeHtml(order.address || '-')}</div>
            <div>${isArabic ? 'الحالة' : 'Status'}: ${escapeHtml(order.status || '-')}</div>
            <div>${isArabic ? 'الدفع' : 'Payment'}: ${escapeHtml(order.payment?.method || '-')} - ${escapeHtml(order.payment?.status || '-')}</div>
          </div>
          ${order.notes ? `<div class="box"><strong>${isArabic ? 'ملاحظات' : 'Notes'}:</strong> ${escapeHtml(order.notes)}</div>` : ''}
          <div class="box">
            <div class="line"><span>${isArabic ? 'عدد المنتجات' : 'Items'}</span><span>${Number(order.items || 0)}</span></div>
            ${order.discount ? `<div class="line"><span>${isArabic ? 'خصم' : 'Discount'} ${escapeHtml(order.discount.code)}</span><span>-${Number(order.discount.amount || 0).toFixed(2)} ${currency}</span></div>` : ''}
            <div class="line total"><span>${isArabic ? 'الإجمالي' : 'Total'}</span><span>${Number(order.total || 0).toFixed(2)} ${currency}</span></div>
          </div>
          ${qrSrc ? `<div class="qr"><img src="${qrSrc}" alt="QR" /></div>` : ''}
          ${options.invoiceMessage ? `<div class="message">${escapeHtml(options.invoiceMessage)}</div>` : ''}
          <div class="muted">${isArabic ? 'طريقة الطباعة' : 'Printer method'}: ${escapeHtml(options.printerMethod || (isArabic ? 'المتصفح' : 'Browser'))}</div>
        </div>
        <script>
          window.onload = () => {
            window.print();
            setTimeout(() => window.close(), 500);
          };
        </script>
      </body>
    </html>
  `)
  receiptWindow.document.close()
  return true
}

export function printPrinterTest(options: { isArabic: boolean; printerMethod: string; paperWidth: string; printerName?: string; invoiceName?: string; invoiceQrUrl?: string; invoiceMessage?: string }) {
  const fakeOrder: TrackedOrder = {
    id: 'TEST-PRINT',
    customer: options.isArabic ? 'اختبار الطابعة' : 'Printer Test',
    customerEmail: '',
    phone: options.printerName || '-',
    address: options.isArabic ? 'رسالة تأكيد الاتصال' : 'Connection test message',
    total: 0,
    items: 0,
    status: 'received',
    createdAt: new Date().toISOString(),
    estimatedDelivery: '-',
    driver: { name: '-', phone: '-', rating: 0 },
    payment: { method: 'test', status: 'paid' },
    notes: options.isArabic ? 'إذا ظهرت هذه الفاتورة فالطباعة عبر المتصفح تعمل.' : 'If this receipt appears, browser printing is working.',
    history: [{ status: 'received', at: new Date().toISOString() }],
  }

  return printTrackedOrderReceipt(fakeOrder, {
    isArabic: options.isArabic,
    currency: '',
    title: options.isArabic ? 'اختبار اتصال الطابعة' : 'Printer Connection Test',
    printerMethod: options.printerMethod,
    paperWidth: options.paperWidth,
    invoiceName: options.invoiceName,
    invoiceQrUrl: options.invoiceQrUrl,
    invoiceMessage: options.invoiceMessage,
  })
}
