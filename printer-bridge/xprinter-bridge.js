/* eslint-disable @typescript-eslint/no-require-imports */
const http = require('http')
const { mkdtemp, writeFile, rm } = require('fs/promises')
const { tmpdir } = require('os')
const { join } = require('path')
const { spawn } = require('child_process')

const port = Number(process.env.XPRINTER_BRIDGE_PORT || 17878)
const defaultPrinter = process.env.XPRINTER_NAME || ''

function send(res, status, body) {
  res.writeHead(status, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  })
  res.end(JSON.stringify(body))
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', (chunk) => {
      raw += chunk
      if (raw.length > 12 * 1024 * 1024) reject(new Error('Payload is too large'))
    })
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {})
      } catch (error) {
        reject(error)
      }
    })
    req.on('error', reject)
  })
}

function runPowerShell(script) {
  return new Promise((resolve, reject) => {
    const child = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], {
      windowsHide: true,
    })
    let stderr = ''
    child.stderr.on('data', (data) => {
      stderr += data.toString()
    })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(stderr || `PowerShell exited with code ${code}`))
    })
  })
}

async function printImage({ imageDataUrl, printer, paperWidth }) {
  const match = String(imageDataUrl || '').match(/^data:image\/png;base64,(.+)$/)
  if (!match) throw new Error('imageDataUrl must be a PNG data URL')

  const dir = await mkdtemp(join(tmpdir(), 'xprinter-bridge-'))
  const imagePath = join(dir, 'receipt.png')
  await writeFile(imagePath, Buffer.from(match[1], 'base64'))

  const printerName = String(printer || defaultPrinter || '').trim()
  const widthMm = String(paperWidth || '').includes('58') ? 58 : 80
  const script = `
Add-Type -AssemblyName System.Drawing
$imagePath = ${JSON.stringify(imagePath)}
$printerName = ${JSON.stringify(printerName)}
$widthMm = ${widthMm}
$image = [System.Drawing.Image]::FromFile($imagePath)
$doc = New-Object System.Drawing.Printing.PrintDocument
if ($printerName) { $doc.PrinterSettings.PrinterName = $printerName }
if (-not $doc.PrinterSettings.IsValid) { throw "Printer not found or invalid: $printerName" }
$doc.DefaultPageSettings.Margins = New-Object System.Drawing.Printing.Margins(0,0,0,0)
$widthHundredths = [int][Math]::Round($widthMm / 25.4 * 100)
$heightHundredths = [int][Math]::Max(100, [Math]::Round($image.Height * $widthHundredths / $image.Width))
$doc.DefaultPageSettings.PaperSize = New-Object System.Drawing.Printing.PaperSize("Receipt", $widthHundredths, $heightHundredths)
$handler = [System.Drawing.Printing.PrintPageEventHandler]{
  param($sender, $event)
  $event.Graphics.PageUnit = [System.Drawing.GraphicsUnit]::Display
  $event.Graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
  $event.Graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $event.Graphics.DrawImage($image, 0, 0, $event.PageBounds.Width, $event.PageBounds.Height)
  $event.HasMorePages = $false
}
$doc.add_PrintPage($handler)
$doc.Print()
$doc.Dispose()
$image.Dispose()
`

  try {
    await runPowerShell(script)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    send(res, 204, { ok: true })
    return
  }

  if (req.method !== 'POST' || req.url !== '/print') {
    send(res, 404, { ok: false, error: 'Not found' })
    return
  }

  try {
    const body = await readJson(req)
    await printImage(body)
    send(res, 200, { ok: true })
  } catch (error) {
    send(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) })
  }
})

server.listen(port, '127.0.0.1', () => {
  console.log(`XPrinter bridge ready: http://127.0.0.1:${port}/print`)
  console.log('Set dashboard printer method to Network Bridge and URL to this address.')
  if (defaultPrinter) console.log(`Default printer: ${defaultPrinter}`)
})
