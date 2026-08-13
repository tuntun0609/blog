import type { CropperSelection } from 'cropperjs'
import { prepareBrowserImage } from '@/lib/browser-image'
import type {
  CropRectangle,
  Dimensions,
  ExportOptions,
} from './image-crop-model'
import { getOutputMimeType, mapCropToCanvasSource } from './image-crop-model'

export { ACCEPTED_IMAGE_TYPES } from '@/lib/browser-image'

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

export const prepareImageFile = async (file: File): Promise<PreparedImage> =>
  await prepareBrowserImage(file)

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
