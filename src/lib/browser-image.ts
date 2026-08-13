export interface ImageDimensions {
  height: number
  width: number
}

export interface PreparedBrowserImage {
  dimensions: ImageDimensions
  frozenAnimation: boolean
  sourceBlob: Blob
}

interface PrepareBrowserImageOptions {
  maxEdge?: number
  maxPixels?: number
}

export const ACCEPTED_IMAGE_TYPES =
  'image/jpeg,image/png,image/webp,image/avif,image/gif,image/bmp,.jpg,.jpeg,.png,.webp,.avif,.gif,.bmp'

export const MAX_IMAGE_EDGE = 16_384
export const MAX_IMAGE_PIXELS = 40_000_000

const ACCEPTED_MIME_TYPES = new Set([
  'image/avif',
  'image/bmp',
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/x-ms-bmp',
])

const ACCEPTED_EXTENSIONS = /\.(?:avif|bmp|gif|jpe?g|png|webp)$/i
const GIF_EXTENSION = /\.gif$/i
const WEBP_EXTENSION = /\.webp$/i
const WEBP_ANIMATION_FLAG = 0x02
const WEBP_EXTENDED_HEADER = 'VP8X'
const WEBP_RIFF_HEADER_SIZE = 12
const WEBP_RIFF_SIGNATURE = 'RIFF'
const WEBP_SIGNATURE = 'WEBP'

const canvasToPngBlob = (canvas: HTMLCanvasElement): Promise<Blob> =>
  new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('浏览器无法读取这张图片，请更换文件后重试。'))
        return
      }
      resolve(blob)
    }, 'image/png')
  })

const loadImage = async (source: Blob): Promise<HTMLImageElement> => {
  const url = URL.createObjectURL(source)
  const image = new Image()
  image.decoding = 'async'
  const loaded = new Promise<void>((resolve, reject) => {
    image.onload = () => resolve()
    image.onerror = () => reject(new Error('图片已损坏或浏览器不支持该格式。'))
  })
  image.src = url

  try {
    await image.decode()
  } catch {
    await loaded
  } finally {
    image.onload = null
    image.onerror = null
    URL.revokeObjectURL(url)
  }

  if (!(image.naturalWidth > 0 && image.naturalHeight > 0)) {
    throw new Error('图片没有可读取的画面尺寸。')
  }

  return image
}

const readAscii = (bytes: Uint8Array, start: number, end: number): string =>
  String.fromCharCode(...bytes.subarray(start, end))

const freezeFirstFrame = async (
  file: File,
  image: HTMLImageElement
): Promise<Blob> => {
  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight
  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('浏览器无法创建图片画布。')
  }

  if ('createImageBitmap' in window) {
    try {
      const bitmap = await createImageBitmap(file)
      context.drawImage(bitmap, 0, 0)
      bitmap.close()
      return await canvasToPngBlob(canvas)
    } catch {
      context.drawImage(image, 0, 0)
      return await canvasToPngBlob(canvas)
    }
  }

  context.drawImage(image, 0, 0)
  return await canvasToPngBlob(canvas)
}

export const isAcceptedImageFile = (
  file: Pick<File, 'name' | 'type'>
): boolean =>
  ACCEPTED_MIME_TYPES.has(file.type.toLowerCase()) ||
  ACCEPTED_EXTENSIONS.test(file.name)

export const isAnimatedWebP = async (file: File): Promise<boolean> => {
  const isWebP =
    file.type.toLowerCase() === 'image/webp' || WEBP_EXTENSION.test(file.name)
  if (!isWebP || file.size < WEBP_RIFF_HEADER_SIZE + 9) {
    return false
  }

  const header = new Uint8Array(
    await file.slice(0, WEBP_RIFF_HEADER_SIZE + 9).arrayBuffer()
  )
  const hasWebPSignature =
    readAscii(header, 0, 4) === WEBP_RIFF_SIGNATURE &&
    readAscii(header, 8, 12) === WEBP_SIGNATURE
  if (!hasWebPSignature) {
    return false
  }

  const isExtendedWebP =
    readAscii(header, WEBP_RIFF_HEADER_SIZE, WEBP_RIFF_HEADER_SIZE + 4) ===
    WEBP_EXTENDED_HEADER
  const hasAnimationFlag =
    Math.floor(header[20] / WEBP_ANIMATION_FLAG) % 2 === 1
  return isExtendedWebP && hasAnimationFlag
}

export const validateImageDimensions = (
  dimensions: ImageDimensions,
  options: PrepareBrowserImageOptions = {}
): void => {
  const maxEdge = options.maxEdge ?? MAX_IMAGE_EDGE
  const maxPixels = options.maxPixels ?? MAX_IMAGE_PIXELS
  const longestEdge = Math.max(dimensions.width, dimensions.height)
  const pixels = dimensions.width * dimensions.height

  if (longestEdge > maxEdge) {
    throw new Error(
      `图片单边不能超过 ${maxEdge.toLocaleString('zh-CN')} 像素，请先缩小图片。`
    )
  }
  if (pixels > maxPixels) {
    throw new Error(
      `图片不能超过 ${Math.round(maxPixels / 1_000_000)} 百万像素，请先缩小图片。`
    )
  }
}

export const prepareBrowserImage = async (
  file: File,
  options: PrepareBrowserImageOptions = {}
): Promise<PreparedBrowserImage> => {
  if (!isAcceptedImageFile(file)) {
    throw new Error('请选择 JPEG、PNG、WebP、AVIF、GIF 或 BMP 图片。')
  }

  const image = await loadImage(file)
  const dimensions = {
    height: image.naturalHeight,
    width: image.naturalWidth,
  }
  validateImageDimensions(dimensions, options)

  const isGif =
    file.type.toLowerCase() === 'image/gif' || GIF_EXTENSION.test(file.name)
  const frozenAnimation = isGif || (await isAnimatedWebP(file))
  const sourceBlob = frozenAnimation
    ? await freezeFirstFrame(file, image)
    : file

  return { dimensions, frozenAnimation, sourceBlob }
}
