import type { ImageDimensions, OutputFormat } from './image-upscale-model'
import { getOutputMimeType } from './image-upscale-model'

export interface InferenceInput extends ImageDimensions {
  rgba: ArrayBuffer
}

export interface EncodedImage {
  blob: Blob
  format: OutputFormat
}

const OUTPUT_QUALITY = 0.92

const loadImageBitmap = async (source: Blob): Promise<ImageBitmap> => {
  if (!('createImageBitmap' in window)) {
    throw new Error('当前浏览器无法创建图片位图。')
  }
  return await createImageBitmap(source)
}

const getActualFormat = (blob: Blob): OutputFormat => {
  if (blob.type === 'image/jpeg') {
    return 'jpeg'
  }
  if (blob.type === 'image/webp') {
    return 'webp'
  }
  return 'png'
}

const canvasToBlob = (
  canvas: HTMLCanvasElement,
  format: OutputFormat
): Promise<EncodedImage> =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('浏览器无法生成放大后的图片。'))
          return
        }
        resolve({ blob, format: getActualFormat(blob) })
      },
      getOutputMimeType(format),
      OUTPUT_QUALITY
    )
  })

export const createInferenceInput = async (
  source: Blob,
  dimensions: ImageDimensions
): Promise<InferenceInput> => {
  const bitmap = await loadImageBitmap(source)
  const canvas = document.createElement('canvas')
  canvas.width = dimensions.width
  canvas.height = dimensions.height
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) {
    bitmap.close()
    throw new Error('浏览器无法创建推理画布。')
  }

  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
  return {
    height: canvas.height,
    rgba: imageData.data.buffer.slice(0) as ArrayBuffer,
    width: canvas.width,
  }
}

export const resizeBrowserImage = async ({
  dimensions,
  format,
  smooth,
  source,
}: {
  dimensions: ImageDimensions
  format: OutputFormat
  smooth: boolean
  source: Blob
}): Promise<EncodedImage> => {
  const bitmap = await loadImageBitmap(source)
  const canvas = document.createElement('canvas')
  canvas.width = dimensions.width
  canvas.height = dimensions.height
  const context = canvas.getContext('2d')
  if (!context) {
    bitmap.close()
    throw new Error('浏览器无法创建输出画布。')
  }

  context.imageSmoothingEnabled = smooth
  if (smooth) {
    context.imageSmoothingQuality = 'high'
  }
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return await canvasToBlob(canvas, format)
}

export const encodeRgbaImage = async ({
  dimensions,
  format,
  rgba,
}: {
  dimensions: ImageDimensions
  format: OutputFormat
  rgba: ArrayBuffer
}): Promise<EncodedImage> => {
  const pixels = new Uint8ClampedArray(rgba)
  const expectedLength = dimensions.width * dimensions.height * 4
  if (pixels.length !== expectedLength) {
    throw new Error('模型返回了无效的图片数据。')
  }

  const canvas = document.createElement('canvas')
  canvas.width = dimensions.width
  canvas.height = dimensions.height
  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('浏览器无法创建输出画布。')
  }
  context.putImageData(
    new ImageData(pixels, dimensions.width, dimensions.height),
    0,
    0
  )
  return await canvasToBlob(canvas, format)
}

export const downloadBrowserBlob = (blob: Blob, fileName: string): void => {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.download = fileName
  anchor.href = url
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
