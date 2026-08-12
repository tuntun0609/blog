import type { CropperSelection } from 'cropperjs'
import type {
  CropRectangle,
  Dimensions,
  ExportOptions,
} from './image-crop-model'
import { getOutputMimeType, mapCropToCanvasSource } from './image-crop-model'

export const ACCEPTED_IMAGE_TYPES =
  'image/jpeg,image/png,image/webp,image/avif,image/gif,image/bmp,.jpg,.jpeg,.png,.webp,.avif,.gif,.bmp'

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

export interface PreparedImage {
  dimensions: Dimensions
  frozenAnimation: boolean
  sourceBlob: Blob
}

export interface ExportedImage {
  blob: Blob
  dimensions: Dimensions
}

const canvasToBlob = (
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality?: number
): Promise<Blob> =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('浏览器无法生成所选格式，请尝试 PNG。'))
          return
        }
        resolve(blob)
      },
      mimeType,
      quality
    )
  })

const loadImage = async (source: Blob): Promise<HTMLImageElement> => {
  const url = URL.createObjectURL(source)
  const image = new Image()
  image.decoding = 'async'
  image.src = url

  try {
    await image.decode()
  } catch {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () =>
        reject(new Error('图片已损坏或浏览器不支持该格式。'))
    })
  } finally {
    URL.revokeObjectURL(url)
  }

  if (!(image.naturalWidth > 0 && image.naturalHeight > 0)) {
    throw new Error('图片没有可读取的画面尺寸。')
  }

  return image
}

const readAscii = (bytes: Uint8Array, start: number, end: number): string =>
  String.fromCharCode(...bytes.subarray(start, end))

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
      return await canvasToBlob(canvas, 'image/png')
    } catch {
      context.drawImage(image, 0, 0)
      return await canvasToBlob(canvas, 'image/png')
    }
  }

  context.drawImage(image, 0, 0)
  return await canvasToBlob(canvas, 'image/png')
}

export const isAcceptedImageFile = (file: File): boolean =>
  ACCEPTED_MIME_TYPES.has(file.type.toLowerCase()) ||
  ACCEPTED_EXTENSIONS.test(file.name)

export const prepareImageFile = async (file: File): Promise<PreparedImage> => {
  if (!isAcceptedImageFile(file)) {
    throw new Error('请选择 JPEG、PNG、WebP、AVIF、GIF 或 BMP 图片。')
  }

  const image = await loadImage(file)
  const isGif =
    file.type.toLowerCase() === 'image/gif' || GIF_EXTENSION.test(file.name)
  const frozenAnimation = isGif || (await isAnimatedWebP(file))
  const sourceBlob = frozenAnimation
    ? await freezeFirstFrame(file, image)
    : file

  return {
    dimensions: {
      height: image.naturalHeight,
      width: image.naturalWidth,
    },
    frozenAnimation,
    sourceBlob,
  }
}

const createOutputCanvas = ({
  height,
  width,
}: Dimensions): HTMLCanvasElement => {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

const drawFinalOutput = ({
  options,
  source,
}: {
  options: ExportOptions
  source: HTMLCanvasElement
}): HTMLCanvasElement => {
  const output = createOutputCanvas(options)
  const context = output.getContext('2d')
  if (!context) {
    throw new Error('浏览器无法创建输出画布。')
  }

  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'

  if (options.format === 'jpeg') {
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, output.width, output.height)
  }

  context.drawImage(source, 0, 0, output.width, output.height)
  return output
}

const applyCircleMask = (canvas: HTMLCanvasElement): void => {
  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('浏览器无法创建圆形裁剪蒙版。')
  }

  context.globalCompositeOperation = 'destination-in'
  context.beginPath()
  context.arc(
    canvas.width / 2,
    canvas.height / 2,
    Math.min(canvas.width, canvas.height) / 2,
    0,
    Math.PI * 2
  )
  context.fill()
  context.globalCompositeOperation = 'source-over'
}

const cropSelectionCanvas = ({
  canvas,
  crop,
  selectionCrop,
}: {
  canvas: HTMLCanvasElement
  crop: CropRectangle
  selectionCrop: CropRectangle
}): HTMLCanvasElement => {
  const source = mapCropToCanvasSource({
    canvas,
    crop,
    selectionCrop,
  })
  const clippedCanvas = createOutputCanvas({
    height: Math.max(1, Math.round(source.height)),
    width: Math.max(1, Math.round(source.width)),
  })
  const context = clippedCanvas.getContext('2d')
  if (!context) {
    throw new Error('浏览器无法截取图片重合区域。')
  }

  context.drawImage(
    canvas,
    source.x,
    source.y,
    source.width,
    source.height,
    0,
    0,
    clippedCanvas.width,
    clippedCanvas.height
  )
  return clippedCanvas
}

export const exportCropSelection = async ({
  crop,
  options,
  selection,
  selectionCrop,
}: {
  crop: CropRectangle
  options: ExportOptions
  selection: CropperSelection
  selectionCrop: CropRectangle
}): Promise<ExportedImage> => {
  const sourceCanvas = await selection.$toCanvas({
    height: Math.max(1, Math.round(selectionCrop.height)),
    width: Math.max(1, Math.round(selectionCrop.width)),
  })
  if (options.shape === 'circle') {
    applyCircleMask(sourceCanvas)
  }
  const clippedCanvas = cropSelectionCanvas({
    canvas: sourceCanvas,
    crop,
    selectionCrop,
  })
  const outputCanvas = drawFinalOutput({ options, source: clippedCanvas })
  const mimeType = getOutputMimeType(options.format)
  const quality = options.format === 'png' ? undefined : options.quality / 100
  const blob = await canvasToBlob(outputCanvas, mimeType, quality)

  if (blob.type && blob.type !== mimeType) {
    throw new Error('当前浏览器不支持所选输出格式，请尝试 PNG。')
  }

  return {
    blob,
    dimensions: { height: outputCanvas.height, width: outputCanvas.width },
  }
}
