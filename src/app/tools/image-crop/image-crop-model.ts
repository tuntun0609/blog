export type AspectPreset =
  | 'free'
  | 'original'
  | 'square'
  | '4:3'
  | '3:4'
  | '16:9'
  | '9:16'
  | 'custom'

export type CropField = 'height' | 'width' | 'x' | 'y'
export type CropShape = 'circle' | 'rectangle'
export type OutputFormat = 'jpeg' | 'png' | 'webp'
export type ProcessingPhase =
  | 'decoding'
  | 'editing'
  | 'error'
  | 'exporting'
  | 'idle'
  | 'result'

export type TransformMatrix = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
]

export interface Dimensions {
  height: number
  width: number
}

export interface CropRectangle extends Dimensions {
  x: number
  y: number
}

export interface EditorSnapshot {
  aspectPreset: AspectPreset
  customAspect: Dimensions
  flipHorizontal: boolean
  flipVertical: boolean
  matrix: TransformMatrix
  rotation: number
  selection: CropRectangle
  shape: CropShape
}

export interface ExportOptions {
  format: OutputFormat
  height: number
  quality: number
  shape: CropShape
  width: number
}

export interface HistoryState {
  entries: EditorSnapshot[]
  index: number
}

export interface NaturalCropMapping {
  crop: CropRectangle | null
  frame: Dimensions
  scale: number
  selectionCrop: CropRectangle
}

interface Bounds extends Dimensions {
  x?: number
  y?: number
}

interface NaturalMappingInput {
  canvasBounds: Pick<DOMRectReadOnly, 'left' | 'top'>
  imageBounds: Pick<DOMRectReadOnly, 'height' | 'left' | 'top' | 'width'>
  matrix: TransformMatrix
  naturalDimensions: Dimensions
  selection: CropRectangle
}

export const MAX_HISTORY_ENTRIES = 50
export const MAX_OUTPUT_EDGE = 16_384
export const MAX_OUTPUT_PIXELS = 40_000_000
export const MIN_CROP_SIZE = 1

const FULL_CIRCLE_DEGREES = 360
const MATRIX_EPSILON = 0.000_001
const FILE_EXTENSION_PATTERN = /\.[^.]+$/

export const ASPECT_PRESET_LABELS: Record<AspectPreset, string> = {
  '3:4': '3:4 竖向',
  '4:3': '4:3 横向',
  '9:16': '9:16 竖向',
  '16:9': '16:9 横向',
  custom: '自定义',
  free: '自由比例',
  original: '原图比例',
  square: '1:1 正方形',
}

export const clamp = (
  value: number,
  minimum: number,
  maximum: number
): number => Math.min(Math.max(value, minimum), maximum)

export const roundDimension = (value: number): number =>
  Math.max(1, Math.round(value))

export const normalizeRotation = (degrees: number): number => {
  const normalized = degrees % FULL_CIRCLE_DEGREES
  if (normalized > 180) {
    return normalized - FULL_CIRCLE_DEGREES
  }
  if (normalized <= -180) {
    return normalized + FULL_CIRCLE_DEGREES
  }
  return normalized
}

export const getMatrixScale = (matrix: TransformMatrix): number => {
  const [a, b] = matrix
  return Math.max(MATRIX_EPSILON, Math.hypot(a, b))
}

export const getMatrixRotation = (matrix: TransformMatrix): number => {
  const [a, b] = matrix
  return normalizeRotation((Math.atan2(b, a) * 180) / Math.PI)
}

export const getRotatedFrameDimensions = (
  naturalDimensions: Dimensions,
  matrix: TransformMatrix
): Dimensions => {
  const [a, b] = matrix
  const scale = getMatrixScale(matrix)
  const cosine = Math.abs(a / scale)
  const sine = Math.abs(b / scale)

  return {
    height: naturalDimensions.width * sine + naturalDimensions.height * cosine,
    width: naturalDimensions.width * cosine + naturalDimensions.height * sine,
  }
}

export const clampCropRectangle = (
  rectangle: CropRectangle,
  bounds: Bounds,
  minimumSize = MIN_CROP_SIZE
): CropRectangle => {
  const boundsX = bounds.x ?? 0
  const boundsY = bounds.y ?? 0
  const safeMinimumWidth = Math.min(minimumSize, bounds.width)
  const safeMinimumHeight = Math.min(minimumSize, bounds.height)
  const width = clamp(
    Number.isFinite(rectangle.width) ? rectangle.width : safeMinimumWidth,
    safeMinimumWidth,
    bounds.width
  )
  const height = clamp(
    Number.isFinite(rectangle.height) ? rectangle.height : safeMinimumHeight,
    safeMinimumHeight,
    bounds.height
  )
  const x = clamp(
    Number.isFinite(rectangle.x) ? rectangle.x : boundsX,
    boundsX,
    boundsX + bounds.width - width
  )
  const y = clamp(
    Number.isFinite(rectangle.y) ? rectangle.y : boundsY,
    boundsY,
    boundsY + bounds.height - height
  )

  return { height, width, x, y }
}

export const intersectCropRectangles = (
  rectangle: CropRectangle,
  bounds: Bounds
): CropRectangle | null => {
  const boundsX = bounds.x ?? 0
  const boundsY = bounds.y ?? 0
  const left = Math.max(rectangle.x, boundsX)
  const top = Math.max(rectangle.y, boundsY)
  const right = Math.min(rectangle.x + rectangle.width, boundsX + bounds.width)
  const bottom = Math.min(
    rectangle.y + rectangle.height,
    boundsY + bounds.height
  )

  if (right <= left || bottom <= top) {
    return null
  }

  return {
    height: bottom - top,
    width: right - left,
    x: left,
    y: top,
  }
}

export const mapCropToCanvasSource = ({
  canvas,
  crop,
  selectionCrop,
}: {
  canvas: Dimensions
  crop: CropRectangle
  selectionCrop: CropRectangle
}): CropRectangle => {
  const scaleX = canvas.width / selectionCrop.width
  const scaleY = canvas.height / selectionCrop.height

  return {
    height: crop.height * scaleY,
    width: crop.width * scaleX,
    x: (crop.x - selectionCrop.x) * scaleX,
    y: (crop.y - selectionCrop.y) * scaleY,
  }
}

export const fitAspectCrop = ({
  aspectRatio,
  bounds,
  coverage = 0.8,
}: {
  aspectRatio: number
  bounds: Dimensions
  coverage?: number
}): CropRectangle => {
  const safeAspect =
    Number.isFinite(aspectRatio) && aspectRatio > 0
      ? aspectRatio
      : bounds.width / bounds.height
  const availableWidth = bounds.width * clamp(coverage, 0.1, 1)
  const availableHeight = bounds.height * clamp(coverage, 0.1, 1)
  let width = availableWidth
  let height = width / safeAspect

  if (height > availableHeight) {
    height = availableHeight
    width = height * safeAspect
  }

  return {
    height,
    width,
    x: (bounds.width - width) / 2,
    y: (bounds.height - height) / 2,
  }
}

export const getAspectRatio = ({
  customAspect,
  naturalDimensions,
  preset,
}: {
  customAspect: Dimensions
  naturalDimensions: Dimensions
  preset: AspectPreset
}): number | null => {
  switch (preset) {
    case 'free':
      return null
    case 'original':
      return naturalDimensions.width / naturalDimensions.height
    case 'square':
      return 1
    case '4:3':
      return 4 / 3
    case '3:4':
      return 3 / 4
    case '16:9':
      return 16 / 9
    case '9:16':
      return 9 / 16
    case 'custom':
      return customAspect.width / customAspect.height
    default:
      return null
  }
}

export const mapSelectionToNaturalCrop = ({
  canvasBounds,
  imageBounds,
  matrix,
  naturalDimensions,
  selection,
}: NaturalMappingInput): NaturalCropMapping => {
  const scale = getMatrixScale(matrix)
  const frame = getRotatedFrameDimensions(naturalDimensions, matrix)
  const imageX = imageBounds.left - canvasBounds.left
  const imageY = imageBounds.top - canvasBounds.top
  const selectionCrop = {
    height: selection.height / scale,
    width: selection.width / scale,
    x: (selection.x - imageX) / scale,
    y: (selection.y - imageY) / scale,
  }
  const crop = intersectCropRectangles(selectionCrop, frame)

  return { crop, frame, scale, selectionCrop }
}

export const mapNaturalCropToSelection = ({
  canvasBounds,
  crop,
  imageBounds,
  scale,
}: {
  canvasBounds: Pick<DOMRectReadOnly, 'left' | 'top'>
  crop: CropRectangle
  imageBounds: Pick<DOMRectReadOnly, 'left' | 'top'>
  scale: number
}): CropRectangle => ({
  height: crop.height * scale,
  width: crop.width * scale,
  x: imageBounds.left - canvasBounds.left + crop.x * scale,
  y: imageBounds.top - canvasBounds.top + crop.y * scale,
})

export const updateNaturalCropField = ({
  field,
  frame,
  rectangle,
  value,
}: {
  field: CropField
  frame: Dimensions
  rectangle: CropRectangle
  value: number
}): CropRectangle =>
  clampCropRectangle(
    {
      ...rectangle,
      [field]: Number.isFinite(value) ? value : rectangle[field],
    },
    frame
  )

export const getDefaultOutputDimensions = (
  crop: CropRectangle
): Dimensions => ({
  height: roundDimension(crop.height),
  width: roundDimension(crop.width),
})

export const updateLockedDimensions = ({
  aspectRatio,
  field,
  value,
}: {
  aspectRatio: number
  field: 'height' | 'width'
  value: number
}): Dimensions => {
  const safeValue = roundDimension(value)

  if (field === 'width') {
    return {
      height: roundDimension(safeValue / aspectRatio),
      width: safeValue,
    }
  }

  return {
    height: safeValue,
    width: roundDimension(safeValue * aspectRatio),
  }
}

export const validateOutputDimensions = ({
  height,
  width,
}: Dimensions): string | null => {
  if (!(Number.isInteger(width) && Number.isInteger(height))) {
    return '输出宽高必须是整数。'
  }
  if (width < 1 || height < 1) {
    return '输出宽高必须大于 0。'
  }
  if (width > MAX_OUTPUT_EDGE || height > MAX_OUTPUT_EDGE) {
    return `输出单边不能超过 ${MAX_OUTPUT_EDGE.toLocaleString('zh-CN')} 像素。`
  }
  if (width * height > MAX_OUTPUT_PIXELS) {
    return '输出总像素不能超过 4,000 万，请启用自定义尺寸并缩小结果。'
  }
  return null
}

export const coerceOutputFormat = (
  shape: CropShape,
  format: OutputFormat
): OutputFormat => (shape === 'circle' && format === 'jpeg' ? 'png' : format)

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
    fileName.replace(FILE_EXTENSION_PATTERN, '').trim() || 'image'
  const extension = format === 'jpeg' ? 'jpg' : format
  return `${baseName}-cropped-${width}x${height}.${extension}`
}

export const createHistory = (initial: EditorSnapshot): HistoryState => ({
  entries: [initial],
  index: 0,
})

const snapshotsEqual = (
  first: EditorSnapshot,
  second: EditorSnapshot
): boolean => JSON.stringify(first) === JSON.stringify(second)

export const pushHistory = (
  history: HistoryState,
  snapshot: EditorSnapshot,
  limit = MAX_HISTORY_ENTRIES
): HistoryState => {
  const current = history.entries[history.index]
  if (current && snapshotsEqual(current, snapshot)) {
    return history
  }

  const entries = history.entries.slice(0, history.index + 1)
  entries.push(snapshot)
  const safeLimit = Math.max(1, limit)
  const limitedEntries = entries.slice(-safeLimit)

  return {
    entries: limitedEntries,
    index: limitedEntries.length - 1,
  }
}

export const undoHistory = (
  history: HistoryState
): { history: HistoryState; snapshot: EditorSnapshot | null } => {
  if (history.index <= 0) {
    return { history, snapshot: null }
  }
  const index = history.index - 1
  return {
    history: { ...history, index },
    snapshot: history.entries[index] ?? null,
  }
}

export const redoHistory = (
  history: HistoryState
): { history: HistoryState; snapshot: EditorSnapshot | null } => {
  if (history.index >= history.entries.length - 1) {
    return { history, snapshot: null }
  }
  const index = history.index + 1
  return {
    history: { ...history, index },
    snapshot: history.entries[index] ?? null,
  }
}

export const formatBytes = (bytes: number): string => {
  if (bytes <= 0) {
    return '0 B'
  }
  const units = ['B', 'KB', 'MB', 'GB']
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1
  )
  const value = bytes / 1024 ** index
  return `${value.toFixed(index === 0 || value >= 10 ? 0 : 1)} ${units[index]}`
}
