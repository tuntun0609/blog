import type { Color } from 'colorthief'
import type { ImageDimensions } from '@/lib/browser-image'
import type { PaletteColor } from './color-palette-model'

const MAX_SAMPLE_EDGE = 1200
const SAMPLE_QUALITY = 4

const getSampleDimensions = ({
  height,
  width,
}: ImageDimensions): ImageDimensions => {
  const scale = Math.min(1, MAX_SAMPLE_EDGE / Math.max(height, width))
  return {
    height: Math.max(1, Math.round(height * scale)),
    width: Math.max(1, Math.round(width * scale)),
  }
}

const loadImageElement = async (blob: Blob): Promise<HTMLImageElement> => {
  const url = URL.createObjectURL(blob)
  const image = new Image()
  image.decoding = 'async'
  image.src = url

  try {
    await image.decode()
    return image
  } catch (error) {
    throw new Error('浏览器无法读取图片像素，请更换图片后重试。', {
      cause: error,
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}

const createSampleBitmap = async (
  blob: Blob,
  dimensions: ImageDimensions
): Promise<ImageBitmap> => {
  try {
    return await createImageBitmap(blob, {
      resizeHeight: dimensions.height,
      resizeQuality: 'high',
      resizeWidth: dimensions.width,
    })
  } catch {
    return await createImageBitmap(blob)
  }
}

const createSampleImageData = async (
  blob: Blob,
  dimensions: ImageDimensions,
  signal: AbortSignal
): Promise<ImageData> => {
  signal.throwIfAborted()
  const sampleDimensions = getSampleDimensions(dimensions)
  const canvas = document.createElement('canvas')
  canvas.width = sampleDimensions.width
  canvas.height = sampleDimensions.height
  const context = canvas.getContext('2d', { alpha: true })
  if (!context) {
    throw new Error('浏览器无法创建图片取色画布。')
  }

  if ('createImageBitmap' in globalThis) {
    const bitmap = await createSampleBitmap(blob, sampleDimensions)
    try {
      signal.throwIfAborted()
      context.drawImage(
        bitmap,
        0,
        0,
        sampleDimensions.width,
        sampleDimensions.height
      )
    } finally {
      bitmap.close()
    }
  } else {
    const image = await loadImageElement(blob)
    signal.throwIfAborted()
    context.drawImage(
      image,
      0,
      0,
      sampleDimensions.width,
      sampleDimensions.height
    )
  }

  return context.getImageData(
    0,
    0,
    sampleDimensions.width,
    sampleDimensions.height
  )
}

const toPaletteColor = (color: Color): PaletteColor => ({
  hex: color.hex().toUpperCase(),
  hsl: color.css('hsl'),
  oklch: color.css('oklch'),
  population: color.population,
  proportion: color.proportion,
  rgb: color.css('rgb'),
  textColor: color.textColor,
})

export const extractThemePalette = async ({
  blob,
  colorCount,
  dimensions,
  signal,
}: {
  blob: Blob
  colorCount: number
  dimensions: ImageDimensions
  signal: AbortSignal
}): Promise<PaletteColor[]> => {
  const imageData = await createSampleImageData(blob, dimensions, signal)
  signal.throwIfAborted()
  const { getPalette } = await import('colorthief')
  const colors = await getPalette(imageData, {
    colorCount,
    colorSpace: 'oklch',
    gamut: 'srgb',
    ignoreWhite: false,
    quality: SAMPLE_QUALITY,
    signal,
  })
  signal.throwIfAborted()

  if (!colors?.length) {
    throw new Error('没有从图片中识别到可用颜色，请尝试另一张图片。')
  }

  return [...colors]
    .sort((first, second) => second.population - first.population)
    .map(toPaletteColor)
}
