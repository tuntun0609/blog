import type { ImageDimensions } from '@/lib/browser-image'
import {
  fitInferenceDimensions,
  type InferenceDimensions,
} from './background-removal-model'

export interface InferenceInput extends InferenceDimensions {
  rgba: ArrayBuffer
}

const loadImageBitmap = async (source: Blob): Promise<ImageBitmap> => {
  if (!('createImageBitmap' in window)) {
    throw new Error('当前浏览器无法创建图片位图。')
  }
  return await createImageBitmap(source)
}

const canvasToPngBlob = (canvas: HTMLCanvasElement): Promise<Blob> =>
  new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('浏览器无法生成透明 PNG，请更换图片后重试。'))
        return
      }
      resolve(blob)
    }, 'image/png')
  })

export const createInferenceInput = async (
  source: Blob,
  dimensions: ImageDimensions
): Promise<InferenceInput> => {
  const inferenceDimensions = fitInferenceDimensions(dimensions)
  const bitmap = await loadImageBitmap(source)
  const canvas = document.createElement('canvas')
  canvas.width = inferenceDimensions.width
  canvas.height = inferenceDimensions.height
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) {
    bitmap.close()
    throw new Error('浏览器无法创建推理画布。')
  }

  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height)

  return {
    height: canvas.height,
    rgba: imageData.data.buffer.slice(0) as ArrayBuffer,
    width: canvas.width,
  }
}

export const composeTransparentPng = async ({
  dimensions,
  mask,
  maskDimensions,
  source,
}: {
  dimensions: ImageDimensions
  mask: Uint8ClampedArray
  maskDimensions: ImageDimensions
  source: Blob
}): Promise<Blob> => {
  if (mask.length !== maskDimensions.width * maskDimensions.height) {
    throw new Error('模型返回了无效蒙版，请重新处理。')
  }

  const bitmap = await loadImageBitmap(source)
  const outputCanvas = document.createElement('canvas')
  outputCanvas.width = dimensions.width
  outputCanvas.height = dimensions.height
  const outputContext = outputCanvas.getContext('2d')
  if (!outputContext) {
    bitmap.close()
    throw new Error('浏览器无法创建输出画布。')
  }

  outputContext.drawImage(bitmap, 0, 0)
  bitmap.close()

  const maskCanvas = document.createElement('canvas')
  maskCanvas.width = maskDimensions.width
  maskCanvas.height = maskDimensions.height
  const maskContext = maskCanvas.getContext('2d')
  if (!maskContext) {
    throw new Error('浏览器无法创建蒙版画布。')
  }

  const maskImage = maskContext.createImageData(
    maskDimensions.width,
    maskDimensions.height
  )
  for (let index = 0; index < mask.length; index += 1) {
    const pixelIndex = index * 4
    maskImage.data[pixelIndex] = 255
    maskImage.data[pixelIndex + 1] = 255
    maskImage.data[pixelIndex + 2] = 255
    maskImage.data[pixelIndex + 3] = mask[index]
  }
  maskContext.putImageData(maskImage, 0, 0)

  outputContext.globalCompositeOperation = 'destination-in'
  outputContext.imageSmoothingEnabled = true
  outputContext.imageSmoothingQuality = 'high'
  outputContext.drawImage(
    maskCanvas,
    0,
    0,
    outputCanvas.width,
    outputCanvas.height
  )
  outputContext.globalCompositeOperation = 'source-over'
  return await canvasToPngBlob(outputCanvas)
}
