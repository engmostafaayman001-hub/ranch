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
    'Access-Control-Allow-Private-Network': 'true',
    'Access-Control-Max-Age': '86400',
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

async function printRawEscPos({ escposBase64, printer }) {
  const raw = String(escposBase64 || '').trim()
  if (!raw) throw new Error('escposBase64 is required')

  const dir = await mkdtemp(join(tmpdir(), 'xprinter-bridge-raw-'))
  const rawPath = join(dir, 'receipt.bin')
  await writeFile(rawPath, Buffer.from(raw, 'base64'))

  const printerName = String(printer || defaultPrinter || '').trim()
  const script = `
$printerName = ${JSON.stringify(printerName)}
if (-not $printerName) {
  $printerName = (Get-CimInstance Win32_Printer | Where-Object { $_.Default } | Select-Object -First 1 -ExpandProperty Name)
}
if (-not $printerName) { throw "No default printer is configured." }
$rawPath = ${JSON.stringify(rawPath)}
$definition = @"
using System;
using System.Runtime.InteropServices;

public class RawPrinterBridge {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
  public class DOCINFOA {
    [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
    [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
    [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
  }

  [DllImport("winspool.Drv", EntryPoint = "OpenPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true)]
  public static extern bool OpenPrinter(string szPrinter, out IntPtr phPrinter, IntPtr pd);
  [DllImport("winspool.Drv", EntryPoint = "ClosePrinter", SetLastError = true, ExactSpelling = true)]
  public static extern bool ClosePrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", EntryPoint = "StartDocPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true)]
  public static extern int StartDocPrinter(IntPtr hPrinter, int level, DOCINFOA di);
  [DllImport("winspool.Drv", EntryPoint = "EndDocPrinter", SetLastError = true, ExactSpelling = true)]
  public static extern bool EndDocPrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", EntryPoint = "StartPagePrinter", SetLastError = true, ExactSpelling = true)]
  public static extern bool StartPagePrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", EntryPoint = "EndPagePrinter", SetLastError = true, ExactSpelling = true)]
  public static extern bool EndPagePrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", EntryPoint = "WritePrinter", SetLastError = true, ExactSpelling = true)]
  public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);

  public static void SendBytes(string printerName, byte[] bytes) {
    IntPtr printer;
    if (!OpenPrinter(printerName, out printer, IntPtr.Zero)) throw new Exception("Could not open printer: " + printerName);
    IntPtr unmanagedBytes = IntPtr.Zero;
    try {
      DOCINFOA docInfo = new DOCINFOA();
      docInfo.pDocName = "Ranch receipt";
      docInfo.pDataType = "RAW";
      if (StartDocPrinter(printer, 1, docInfo) == 0) throw new Exception("Could not start RAW print job.");
      if (!StartPagePrinter(printer)) throw new Exception("Could not start RAW print page.");
      unmanagedBytes = Marshal.AllocCoTaskMem(bytes.Length);
      Marshal.Copy(bytes, 0, unmanagedBytes, bytes.Length);
      int written;
      if (!WritePrinter(printer, unmanagedBytes, bytes.Length, out written) || written != bytes.Length) {
        throw new Exception("RAW print write failed.");
      }
      EndPagePrinter(printer);
      EndDocPrinter(printer);
    } finally {
      if (unmanagedBytes != IntPtr.Zero) Marshal.FreeCoTaskMem(unmanagedBytes);
      ClosePrinter(printer);
    }
  }
}
"@
Add-Type -TypeDefinition $definition
$bytes = [System.IO.File]::ReadAllBytes($rawPath)
[RawPrinterBridge]::SendBytes($printerName, $bytes)
`

  try {
    await runPowerShell(script)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
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
$doc.PrintController = New-Object System.Drawing.Printing.StandardPrintController
$doc.DocumentName = "Ranch receipt"
$doc.OriginAtMargins = $false
$doc.DefaultPageSettings.Margins = New-Object System.Drawing.Printing.Margins(0,0,0,0)
$widthHundredths = [int][Math]::Round($widthMm / 25.4 * 100)
$heightHundredths = [int][Math]::Max(100, [Math]::Round($image.Height * $widthHundredths / $image.Width) + 18)
$doc.DefaultPageSettings.PaperSize = New-Object System.Drawing.Printing.PaperSize("Receipt", $widthHundredths, $heightHundredths)
$handler = [System.Drawing.Printing.PrintPageEventHandler]{
  param($sender, $event)
  $event.Graphics.PageUnit = [System.Drawing.GraphicsUnit]::Display
  $event.Graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighSpeed
  $event.Graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
  $event.Graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighSpeed
  $event.Graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::None
  $drawHeight = [int][Math]::Round($image.Height * $event.PageBounds.Width / $image.Width)
  $event.Graphics.DrawImage($image, 0, 0, $event.PageBounds.Width, $drawHeight)
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
    if (body.escposBase64) await printRawEscPos(body)
    else await printImage(body)
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
