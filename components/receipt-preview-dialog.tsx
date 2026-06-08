'use client'

import { Download, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'

type ReceiptPreview = {
  url: string
  title: string
  name?: string
}

type ReceiptPreviewDialogProps = {
  receipt: ReceiptPreview | null
  onClose: () => void
  isArabic: boolean
}

function isPdfReceipt(url: string) {
  return url.startsWith('data:application/pdf') || /\.pdf($|[?#])/i.test(url)
}

export function ReceiptPreviewDialog({ receipt, onClose, isArabic }: ReceiptPreviewDialogProps) {
  if (!receipt) return null

  const isPdf = isPdfReceipt(receipt.url)

  return (
    <Dialog role="dialog" aria-modal="true" aria-labelledby="receipt-preview-title" className="flex items-center justify-center overflow-hidden p-2 sm:p-4">
      <div className="flex max-h-[92vh] w-full max-w-[calc(100vw-1rem)] flex-col overflow-hidden rounded-md bg-white shadow-2xl dark:bg-slate-950 sm:max-w-5xl">
        <div className="flex min-w-0 items-center justify-between gap-2 border-b px-3 py-3 dark:border-slate-800 sm:gap-3 sm:px-4">
          <div className="min-w-0">
            <h3 id="receipt-preview-title" className="truncate text-base font-semibold">{receipt.title}</h3>
            {receipt.name && <p className="truncate text-xs text-slate-500">{receipt.name}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button asChild type="button" size="sm" variant="outline" className="max-w-10 gap-2 overflow-hidden px-2 sm:max-w-none sm:px-3">
              <a href={receipt.url} download={receipt.name || 'receipt'}>
                <Download className="h-4 w-4" />
                {isArabic ? 'تحميل' : 'Download'}
              </a>
            </Button>
            <Button type="button" size="icon" variant="ghost" onClick={onClose} title={isArabic ? 'إغلاق' : 'Close'}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="flex min-h-[280px] min-w-0 flex-1 items-center justify-center overflow-hidden bg-slate-100 p-2 dark:bg-slate-900 sm:min-h-[320px] sm:p-3">
          {isPdf ? (
            <iframe title={receipt.title} src={receipt.url} className="h-[72vh] w-full rounded-md border-0 bg-white" />
          ) : (
            // Uploaded payment receipts may be data URLs, so keep the browser's native image renderer.
            // eslint-disable-next-line @next/next/no-img-element
            <img alt={receipt.title} src={receipt.url} className="max-h-[72vh] max-w-full rounded-md bg-white object-contain shadow-lg" />
          )}
        </div>
      </div>
    </Dialog>
  )
}
