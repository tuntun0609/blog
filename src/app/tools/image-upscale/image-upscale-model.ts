export const IMAGE_UPSCALE_MODEL_ID = 'Xenova/swin2SR-lightweight-x2-64'
export const IMAGE_UPSCALE_MODEL_REVISION =
  '92a21aca5713f20faf9a87590cdfbdce2e34112c'
export const AI_UPSCALE_FACTOR = 2
export const MAX_INPUT_EDGE = 8192
export const MAX_INPUT_PIXELS = 10_000_000
export const MAX_AI_INPUT_PIXELS = 4_000_000
export const MAX_OUTPUT_EDGE = 16_384
export const MAX_OUTPUT_PIXELS = 40_000_000

export const MODEL_DOWNLOAD_BYTES = {
  wasm: 8_080_000,
  webgpu: 7_520_000,
} as const

export type ImageUpscaleMode = 'ai' | 'standard'
export type InterpolationMode = 'pixelated' | 'smooth'
export type OutputFormat = 'jpeg' | 'png' | 'webp'
export type ProcessingBackend = keyof typeof MODEL_DOWNLOAD_BYTES
export type ResizePreset = '2' | '3' | '4' | 'custom'
export type ToolPhase =
  | 'decoding'
  | 'error'
  | 'idle'
  | 'processing'
  | 'ready'
  | 'result'

export type ProcessingStage =
  | 'downloading'
  | 'encoding'
  | 'initializing'
  | 'resizing'
  | 'upscaling'

export type WorkerErrorCode =
  | 'inference-failed'
  | 'model-download-failed'
  | 'out-of-memory'
  | 'webgpu-unavailable'
  | 'worker-failed'

export interface ImageDimensions {
  height: number
  width: number
}

export interface DimensionDraft {
  height: string
  width: string
}

export interface SourceImage {
  dimensions: ImageDimensions
  fileName: string
  fileSize: number
  frozenAnimation: boolean
  mimeType: string
  sourceBlob: Blob
  url: string
}

export interface UpscaleResult {
  backend: ProcessingBackend | null
  blob: Blob
  dimensions: ImageDimensions
  fileName: string
  format: OutputFormat
  mode: ImageUpscaleMode
  url: string
}

export interface ToolError {
  code: WorkerErrorCode | 'invalid-image' | 'invalid-settings'
  message: string
}

export interface ProgressState {
  backend: ProcessingBackend | null
  completedTiles?: number
  progress: number | null
  stage: ProcessingStage
  totalTiles?: number
}

export interface WorkerProcessRequest {
  backend: ProcessingBackend
  height: number
  requestId: number
  rgba: ArrayBuffer
  type: 'process'
  width: number
}

export interface WorkerProgressResponse {
  backend: ProcessingBackend
  completedTiles?: number
  progress: number | null
  requestId: number
  stage: 'downloading' | 'initializing' | 'upscaling'
  totalTiles?: number
  type: 'progress'
}

export interface WorkerCompleteResponse {
  backend: ProcessingBackend
  height: number
  requestId: number
  rgba: ArrayBuffer
  type: 'complete'
  width: number
}

export interface WorkerErrorResponse {
  code: WorkerErrorCode
  message: string
  recoverable: boolean
  requestId: number
  type: 'error'
}

export type ImageUpscaleWorkerRequest = WorkerProcessRequest
export type ImageUpscaleWorkerResponse =
  | WorkerCompleteResponse
  | WorkerErrorResponse
  | WorkerProgressResponse

const FILE_EXTENSION_PATTERN = /\.[^.]+$/
const JPEG_EXTENSION_PATTERN = /\.jpe?g$/i
const PNG_EXTENSION_PATTERN = /\.png$/i
const WEBP_EXTENSION_PATTERN = /\.webp$/i
const MEMORY_ERROR_PATTERN =
  /(allocation|allocate|buffer size|memory|out of memory)/
const NETWORK_ERROR_PATTERN = /(connection|download|fetch|http|network)/
const WEBGPU_ERROR_PATTERN =
  /(gpu adapter|gpuadapter|requestadapter|shader-f16|webgpu)/

export const clampComparisonPosition = (position: number): number =>
  Math.min(100, Math.max(0, Math.round(position)))

export const getComparisonPositionForKey = ({
  key,
  position,
  shiftKey,
}: {
  key: string
  position: number
  shiftKey: boolean
}): number | null => {
  if (key === 'Home') {
    return 0
  }
  if (key === 'End') {
    return 100
  }
  if (!['ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowUp'].includes(key)) {
    return null
  }

  const direction = key === 'ArrowDown' || key === 'ArrowLeft' ? -1 : 1
  const step = shiftKey ? 10 : 1
  return clampComparisonPosition(position + direction * step)
}

export const selectProcessingBackend = (
  hasWebGpu: boolean
): ProcessingBackend => (hasWebGpu ? 'webgpu' : 'wasm')

export const getPresetDimensions = (
  source: ImageDimensions,
  preset: Exclude<ResizePreset, 'custom'>
): ImageDimensions => {
  const scale = Number.parseInt(preset, 10)
  return {
    height: Math.round(source.height * scale),
    width: Math.round(source.width * scale),
  }
}

export const getInitialDimensionDraft = (
  source: ImageDimensions
): DimensionDraft => {
  const dimensions = getPresetDimensions(source, '2')
  return {
    height: String(dimensions.height),
    width: String(dimensions.width),
  }
}

export const parseDimensionDraft = (
  draft: DimensionDraft
): ImageDimensions | null => {
  const height = Number(draft.height)
  const width = Number(draft.width)
  if (!(Number.isFinite(height) && Number.isFinite(width))) {
    return null
  }
  if (!(height >= 1 && width >= 1)) {
    return null
  }
  return { height: Math.round(height), width: Math.round(width) }
}

export const updateLinkedDimensionDraft = ({
  draft,
  field,
  locked,
  source,
  value,
}: {
  draft: DimensionDraft
  field: keyof DimensionDraft
  locked: boolean
  source: ImageDimensions
  value: string
}): DimensionDraft => {
  const nextDraft = { ...draft, [field]: value }
  const numericValue = Number(value)
  if (!(locked && Number.isFinite(numericValue) && numericValue >= 1)) {
    return nextDraft
  }

  if (field === 'width') {
    nextDraft.height = String(
      Math.max(1, Math.round((numericValue * source.height) / source.width))
    )
  } else {
    nextDraft.width = String(
      Math.max(1, Math.round((numericValue * source.width) / source.height))
    )
  }
  return nextDraft
}

export const getDimensionIssue = ({
  mode,
  source,
  target,
}: {
  mode: ImageUpscaleMode
  source: ImageDimensions
  target: ImageDimensions | null
}): string | null => {
  if (!target) {
    return '请输入有效的目标宽度和高度。'
  }
  if (mode === 'ai' && source.width * source.height > MAX_AI_INPUT_PIXELS) {
    return 'AI 超分适合不超过 400 万像素的原图；请改用普通放大或换一张较小的图片。'
  }
  if (target.width < source.width || target.height < source.height) {
    return '目标宽度和高度都不能小于原图。'
  }
  if (Math.max(target.width, target.height) > MAX_OUTPUT_EDGE) {
    return `输出图片单边不能超过 ${MAX_OUTPUT_EDGE.toLocaleString('zh-CN')} 像素。`
  }
  if (target.width * target.height > MAX_OUTPUT_PIXELS) {
    return '输出图片不能超过 4000 万像素。'
  }
  return null
}

export const getOutputFormat = ({
  fileName,
  mimeType,
}: {
  fileName: string
  mimeType: string
}): OutputFormat => {
  const normalizedMimeType = mimeType.toLowerCase()
  if (
    normalizedMimeType === 'image/jpeg' ||
    JPEG_EXTENSION_PATTERN.test(fileName)
  ) {
    return 'jpeg'
  }
  if (
    normalizedMimeType === 'image/webp' ||
    WEBP_EXTENSION_PATTERN.test(fileName)
  ) {
    return 'webp'
  }
  if (
    normalizedMimeType === 'image/png' ||
    PNG_EXTENSION_PATTERN.test(fileName)
  ) {
    return 'png'
  }
  return 'png'
}

export const getOutputMimeType = (format: OutputFormat): string =>
  `image/${format}`

export const createUpscaleFileName = ({
  dimensions,
  fileName,
  format,
  mode,
}: {
  dimensions: ImageDimensions
  fileName: string
  format: OutputFormat
  mode: ImageUpscaleMode
}): string => {
  const baseName = fileName.replace(FILE_EXTENSION_PATTERN, '').trim()
  const extension = format === 'jpeg' ? 'jpg' : format
  const operation = mode === 'ai' ? 'upscaled' : 'resized'
  return `${baseName || 'image'}-${operation}-${dimensions.width}x${dimensions.height}.${extension}`
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

export const normalizeModelProgress = (value: unknown): number | null => {
  if (!(value && typeof value === 'object')) {
    return null
  }

  const progressEvent = value as {
    loaded?: unknown
    progress?: unknown
    total?: unknown
  }
  if (
    typeof progressEvent.progress === 'number' &&
    Number.isFinite(progressEvent.progress)
  ) {
    return clampComparisonPosition(progressEvent.progress)
  }
  if (
    typeof progressEvent.loaded === 'number' &&
    typeof progressEvent.total === 'number' &&
    progressEvent.total > 0
  ) {
    return clampComparisonPosition(
      (progressEvent.loaded / progressEvent.total) * 100
    )
  }
  return null
}

export const classifyWorkerError = (
  error: unknown,
  backend: ProcessingBackend
): Omit<WorkerErrorResponse, 'requestId' | 'type'> => {
  const rawMessage = error instanceof Error ? error.message : String(error)
  const message = rawMessage.toLowerCase()

  if (backend === 'webgpu' && WEBGPU_ERROR_PATTERN.test(message)) {
    return {
      code: 'webgpu-unavailable',
      message: '当前浏览器无法启动 WebGPU，正在尝试兼容模式。',
      recoverable: true,
    }
  }
  if (NETWORK_ERROR_PATTERN.test(message)) {
    return {
      code: 'model-download-failed',
      message: '模型下载失败，请检查网络后重试。图片没有离开当前浏览器。',
      recoverable: true,
    }
  }
  if (MEMORY_ERROR_PATTERN.test(message)) {
    return {
      code: 'out-of-memory',
      message: '浏览器内存不足，请关闭其他页面或换一张更小的图片。',
      recoverable: true,
    }
  }
  return {
    code: 'inference-failed',
    message: 'AI 超分没有完成，请重试或改用普通放大。',
    recoverable: true,
  }
}
