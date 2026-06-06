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
    <Dialog role="dialog" aria-modal="true" aria-labelledby="receipt-preview-title" className="flex items-center justify-center p-4">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-md bg-white shadow-2xl dark:bg-slate-950">
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3 dark:border-slate-800">
          <div className="min-w-0">
            <h3 id="receipt-preview-title" className="truncate text-base font-semibold">{receipt.title}</h3>
            {receipt.name && <p className="truncate text-xs text-slate-500">{receipt.name}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button asChild type="button" size="sm" variant="outline" className="gap-2">
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
        <div className="flex min-h-[320px] flex-1 items-center justify-center bg-slate-100 p-3 dark:bg-slate-900">
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
