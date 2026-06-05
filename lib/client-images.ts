const IMAGE_EXTENSION_PATTERN = /\.(avif|bmp|gif|jpeg|jpg|png|svg|webp)$/i
const UNSUPPORTED_BROWSER_IMAGE_PATTERN = /\.(heic|heif)$/i

export function isAcceptedImageFile(file: File) {
  if (UNSUPPORTED_BROWSER_IMAGE_PATTERN.test(file.name)) return false
  return file.type.startsWith('image/') || IMAGE_EXTENSION_PATTERN.test(file.name)
}

export function isDisplayableImage(value: string) {
  return value.startsWith('data:image') || value.startsWith('http') || value.startsWith('/')
}

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Could not read image'))
    reader.readAsDataURL(file)
  })
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Could not load image'))
    image.src = src
  })
}

async function assertDisplayableImage(src: string) {
  const image = await loadImage(src)
  const width = image.naturalWidth || image.width
  const height = image.naturalHeight || image.height
  if (width <= 0 || height <= 0) {
    throw new Error('Image has no visible dimensions')
  }
  return image
}

export async function imageFileToOptimizedDataUrl(file: File, options: { maxSize?: number; quality?: number } = {}) {
  if (!isAcceptedImageFile(file)) {
    throw new Error('Unsupported image file')
  }

  const source = await readAsDataUrl(file)
  const lowerName = file.name.toLowerCase()
  if (file.type.includes('svg') || lowerName.endsWith('.svg') || file.type.includes('gif') || lowerName.endsWith('.gif')) {
    await assertDisplayableImage(source)
    return source
  }

  const maxSize = options.maxSize || 1600
  const quality = options.quality || 0.86
  const image = await assertDisplayableImage(source)
  const ratio = Math.min(1, maxSize / Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height))
  const width = Math.max(1, Math.round((image.naturalWidth || image.width) * ratio))
  const height = Math.max(1, Math.round((image.naturalHeight || image.height) * ratio))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Could not prepare image')
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, width, height)
  context.drawImage(image, 0, 0, width, height)
  const optimized = canvas.toDataURL('image/webp', quality)
  await assertDisplayableImage(optimized)
  return optimized
}
