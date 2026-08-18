import type { CornerPoints } from 'scanic'

export type CalibrationCorners = CornerPoints

export interface Dimensions {
  height: number
  width: number
}

export interface CalibrationSource {
  dimensions: Dimensions
  fileName: string
  fileSize: number
  frozenAnimation: boolean
  sourceBlob: Blob
  url: string
}

export interface SafeOutputDimensions extends Dimensions {
  limited: boolean
  scale: number
}

export type OutputFormat = 'jpeg' | 'png' | 'webp'
export type PreviewPhase = 'empty' | 'error' | 'rendering' | 'ready'
export type ToolPhase = 'decoding' | 'editing' | 'exporting' | 'idle'

export const DEFAULT_QUALITY = 92
export const INITIAL_INSET_RATIO = 0.1
export const MAX_OUTPUT_EDGE = 16_384
export const MAX_OUTPUT_PIXELS = 40_000_000
export const PREVIEW_MAX_EDGE = 1200

const FILE_EXTENSION_PATTERN = /\.[^.]+$/
const MIN_AREA = 64
const MIN_EDGE = 4

const distance = (
  first: CalibrationCorners['topLeft'],
  second: CalibrationCorners['topLeft']
): number => Math.hypot(second.x - first.x, second.y - first.y)

const crossProduct = (
  first: CalibrationCorners['topLeft'],
  second: CalibrationCorners['topLeft'],
  third: CalibrationCorners['topLeft']
): number =>
  (second.x - first.x) * (third.y - second.y) -
  (second.y - first.y) * (third.x - second.x)

const getOrderedPoints = (
  corners: CalibrationCorners
): CalibrationCorners['topLeft'][] => [
  corners.topLeft,
  corners.topRight,
  corners.bottomRight,
  corners.bottomLeft,
]

export const createInitialCorners = (
  dimensions: Dimensions,
  insetRatio = INITIAL_INSET_RATIO
): CalibrationCorners => {
  const inset = Math.max(
    8,
    Math.min(dimensions.width, dimensions.height) * insetRatio
  )
  return {
    bottomLeft: { x: inset, y: dimensions.height - inset },
    bottomRight: {
      x: dimensions.width - inset,
      y: dimensions.height - inset,
    },
    topLeft: { x: inset, y: inset },
    topRight: { x: dimensions.width - inset, y: inset },
  }
}

export const getOutputDimensions = (
  corners: CalibrationCorners
): Dimensions => ({
  height: Math.max(
    1,
    Math.round(
      Math.max(
        distance(corners.topRight, corners.bottomRight),
        distance(corners.topLeft, corners.bottomLeft)
      )
    )
  ),
  width: Math.max(
    1,
    Math.round(
      Math.max(
        distance(corners.topLeft, corners.topRight),
        distance(corners.bottomLeft, corners.bottomRight)
      )
    )
  ),
})

export const getSafeOutputDimensions = (
  dimensions: Dimensions,
  maxEdge = MAX_OUTPUT_EDGE,
  maxPixels = MAX_OUTPUT_PIXELS
): SafeOutputDimensions => {
  const edgeScale = Math.min(
    1,
    maxEdge / dimensions.width,
    maxEdge / dimensions.height
  )
  const pixelScale = Math.min(
    1,
    Math.sqrt(maxPixels / (dimensions.width * dimensions.height))
  )
  const scale = Math.min(edgeScale, pixelScale)

  return {
    height: Math.max(1, Math.floor(dimensions.height * scale)),
    limited: scale < 1,
    scale,
    width: Math.max(1, Math.floor(dimensions.width * scale)),
  }
}

export const scaleCorners = (
  corners: CalibrationCorners,
  scale: number
): CalibrationCorners => ({
  bottomLeft: {
    x: corners.bottomLeft.x * scale,
    y: corners.bottomLeft.y * scale,
  },
  bottomRight: {
    x: corners.bottomRight.x * scale,
    y: corners.bottomRight.y * scale,
  },
  topLeft: {
    x: corners.topLeft.x * scale,
    y: corners.topLeft.y * scale,
  },
  topRight: {
    x: corners.topRight.x * scale,
    y: corners.topRight.y * scale,
  },
})

export const validateCorners = (corners: CalibrationCorners): string | null => {
  const points = getOrderedPoints(corners)
  const edges = points.map((point, index) =>
    distance(point, points[(index + 1) % points.length] ?? point)
  )
  if (edges.some((edge) => edge < MIN_EDGE)) {
    return '点位距离太近，请扩大文档选区。'
  }

  const turns = points.map((point, index) =>
    crossProduct(
      point,
      points[(index + 1) % points.length] ?? point,
      points[(index + 2) % points.length] ?? point
    )
  )
  const hasPositiveTurn = turns.some((turn) => turn > 0)
  const hasNegativeTurn = turns.some((turn) => turn < 0)
  if (hasPositiveTurn && hasNegativeTurn) {
    return '四条边不能交叉，请按文档四角重新放置点位。'
  }

  const area = Math.abs(
    points.reduce((sum, point, index) => {
      const next = points[(index + 1) % points.length] ?? point
      return sum + point.x * next.y - next.x * point.y
    }, 0) / 2
  )
  if (area < MIN_AREA) {
    return '文档选区太小，请重新放置四个点位。'
  }

  return null
}

export const getPreviewScale = (dimensions: Dimensions): number =>
  Math.min(1, PREVIEW_MAX_EDGE / Math.max(dimensions.width, dimensions.height))

export const getOutputMimeType = (format: OutputFormat): string =>
  `image/${format}`

export const createOutputFileName = ({
  fileName,
  format,
  height,
  width,
}: {
  fileName: string
  format: OutputFormat
  height: number
  width: number
}): string => {
  const baseName =
    fileName.replace(FILE_EXTENSION_PATTERN, '').trim() || 'document'
  const extension = format === 'jpeg' ? 'jpg' : format
  return `${baseName}-calibrated-${width}x${height}.${extension}`
}

export const getSliderNumber = (value: number | readonly number[]): number => {
  const nextValue =
    typeof value === 'number' ? value : (value[0] ?? DEFAULT_QUALITY)
  return Math.min(100, Math.max(1, Math.round(nextValue)))
}

export const formatBytes = (bytes: number): string => {
  if (bytes < 1024) {
    return `${bytes} B`
  }
  const kibibytes = bytes / 1024
  if (kibibytes < 1024) {
    return `${kibibytes.toFixed(kibibytes >= 100 ? 0 : 1)} KB`
  }
  const mebibytes = kibibytes / 1024
  return `${mebibytes.toFixed(mebibytes >= 100 ? 0 : 1)} MB`
}
