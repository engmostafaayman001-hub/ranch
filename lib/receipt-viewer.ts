function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export function openReceiptViewer(receiptUrl: string | undefined, title = 'Receipt') {
  if (!receiptUrl || typeof window === 'undefined') return false

  if (!receiptUrl.startsWith('data:')) {
    window.open(receiptUrl, '_blank', 'noopener,noreferrer')
    return true
  }

  const viewer = window.open('', '_blank')
  if (!viewer) return false
  viewer.opener = null

  const safeTitle = escapeHtml(title)
  const source = JSON.stringify(receiptUrl)
  const isPdf = receiptUrl.startsWith('data:application/pdf')
  const isImage = receiptUrl.startsWith('data:image/')
  const body = isPdf
    ? `<iframe title="${safeTitle}" src=${source}></iframe>`
    : isImage
      ? `<img alt="${safeTitle}" src=${source} />`
      : `<a href=${source} download>Download receipt</a>`

  viewer.document.write(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${safeTitle}</title>
  <style>
    html, body { margin: 0; min-height: 100%; background: #f8fafc; color: #0f172a; font-family: Arial, sans-serif; }
    body { display: flex; align-items: center; justify-content: center; padding: 18px; }
    iframe { width: min(100%, 980px); height: calc(100vh - 36px); border: 0; border-radius: 8px; background: white; box-shadow: 0 10px 30px rgba(15, 23, 42, 0.16); }
    img { max-width: min(100%, 980px); max-height: calc(100vh - 36px); object-fit: contain; border-radius: 8px; background: white; box-shadow: 0 10px 30px rgba(15, 23, 42, 0.16); }
    a { color: #dc2626; font-weight: 700; }
  </style>
</head>
<body>${body}</body>
</html>`)
  viewer.document.close()
  return true
}

