import type { CornerEditor, CornerEditorOptions } from 'scanic'
import type {
  CalibrationCorners,
  Dimensions,
  OutputFormat,
} from './document-calibration-model'
import {
  createOutputFileName,
  getOutputDimensions,
  getOutputMimeType,
  getPreviewScale,
  getSafeOutputDimensions,
  scaleCorners,
  validateCorners,
} from './document-calibration-model'

interface PreparedPreviewSource {
  canvas: HTMLCanvasElement
  scale: number
}

const SCANIC_MODULE_URL =
  'https://cdn.jsdelivr.net/npm/scanic@1.6.0/dist/scanic.js'
const SCANIC_ML_ASSET_BASE_URL =
  'https://cdn.jsdelivr.net/npm/scanic-ml@0.2.0/dist/'

type ScanicModule = typeof import('scanic')

interface ExportCalibrationOptions {
  corners: CalibrationCorners
  fileName: string
  format: OutputFormat
  image: HTMLImageElement
  quality: number
}

export interface ExportedCalibration {
  blob: Blob
  dimensions: Dimensions
  fileName: string
  limited: boolean
}

let scanicModulePromise: Promise<ScanicModule> | null = null

const loadScanic = async (): Promise<ScanicModule> => {
  scanicModulePromise ??= import(
    /* webpackIgnore: true */ SCANIC_MODULE_URL
  ) as Promise<ScanicModule>
  return await scanicModulePromise
}

const getCanvasContext = (
  canvas: HTMLCanvasElement,
  options?: CanvasRenderingContext2DSettings
): CanvasRenderingContext2D => {
  const context = canvas.getContext('2d', options)
  if (!context) {
    throw new Error('浏览器无法创建图片处理画布。')
  }
  return context
}

const createScaledSourceCanvas = (
  image: HTMLImageElement,
  scale: number
): HTMLCanvasElement => {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.floor(image.naturalWidth * scale))
  canvas.height = Math.max(1, Math.floor(image.naturalHeight * scale))
  const context = getCanvasContext(canvas)
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  return canvas
}

const isCanvasOutput = (
  output: HTMLCanvasElement | ImageData | string | null
): output is HTMLCanvasElement => output instanceof HTMLCanvasElement

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

const flattenForJpeg = (source: HTMLCanvasElement): HTMLCanvasElement => {
  const canvas = document.createElement('canvas')
  canvas.width = source.width
  canvas.height = source.height
  const context = getCanvasContext(canvas)
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(source, 0, 0)
  return canvas
}

export const createCalibrationEditor = async (
  options: CornerEditorOptions
): Promise<CornerEditor> => {
  const { createCornerEditor } = await loadScanic()
  return createCornerEditor(options)
}

export const detectDocumentCorners = async (
  image: HTMLImageElement
): Promise<CalibrationCorners> => {
  const { scanDocument } = await loadScanic()
  const result = await scanDocument(image, {
    detector: 'ml',
    ml: {
      assetBaseUrl: SCANIC_ML_ASSET_BASE_URL,
      modelFetchTimeoutMs: 30_000,
    },
    mode: 'detect',
  })
  if (!(result.success && result.corners)) {
    throw new Error('没有识别到完整文档，请保持当前点位并手动调整。')
  }
  return result.corners
}

export const preparePreviewSource = (
  image: HTMLImageElement
): PreparedPreviewSource => {
  const scale = getPreviewScale({
    height: image.naturalHeight,
    width: image.naturalWidth,
  })
  return {
    canvas: createScaledSourceCanvas(image, scale),
    scale,
  }
}

export const renderCalibrationPreview = async ({
  corners,
  preparedSource,
  target,
}: {
  corners: CalibrationCorners
  preparedSource: PreparedPreviewSource
  target: HTMLCanvasElement
}): Promise<Dimensions> => {
  const validationMessage = validateCorners(corners)
  if (validationMessage) {
    throw new Error(validationMessage)
  }

  const { extractDocument } = await loadScanic()
  const result = await extractDocument(
    preparedSource.canvas,
    scaleCorners(corners, preparedSource.scale),
    { output: 'canvas' }
  )
  if (!(result.success && isCanvasOutput(result.output))) {
    throw new Error('当前点位无法生成校准结果，请重新调整四个角点。')
  }

  target.width = result.output.width
  target.height = result.output.height
  const context = getCanvasContext(target)
  context.clearRect(0, 0, target.width, target.height)
  context.drawImage(result.output, 0, 0)
  return { height: target.height, width: target.width }
}

export const exportCalibratedDocument = async ({
  corners,
  fileName,
  format,
  image,
  quality,
}: ExportCalibrationOptions): Promise<ExportedCalibration> => {
  const validationMessage = validateCorners(corners)
  if (validationMessage) {
    throw new Error(validationMessage)
  }

  const rawDimensions = getOutputDimensions(corners)
  const safeDimensions = getSafeOutputDimensions(rawDimensions)
  const source = safeDimensions.limited
    ? createScaledSourceCanvas(image, safeDimensions.scale)
    : image
  const extractionCorners = safeDimensions.limited
    ? scaleCorners(corners, safeDimensions.scale)
    : corners
  const { extractDocument } = await loadScanic()
  const result = await extractDocument(source, extractionCorners, {
    output: 'canvas',
  })
  if (!(result.success && isCanvasOutput(result.output))) {
    throw new Error('校准结果生成失败，请重新调整点位后再试。')
  }

  const outputCanvas =
    format === 'jpeg' ? flattenForJpeg(result.output) : result.output
  const mimeType = getOutputMimeType(format)
  const blob = await canvasToBlob(
    outputCanvas,
    mimeType,
    format === 'png' ? undefined : quality / 100
  )
  if (blob.type && blob.type !== mimeType) {
    throw new Error('当前浏览器不支持所选输出格式，请尝试 PNG。')
  }

  const dimensions = {
    height: outputCanvas.height,
    width: outputCanvas.width,
  }
  return {
    blob,
    dimensions,
    fileName: createOutputFileName({
      fileName,
      format,
      ...dimensions,
    }),
    limited: safeDimensions.limited,
  }
}

export const downloadCalibration = ({
  blob,
  fileName,
}: Pick<ExportedCalibration, 'blob' | 'fileName'>): void => {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.download = fileName
  anchor.href = url
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
