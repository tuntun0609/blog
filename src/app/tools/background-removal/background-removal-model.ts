export const BACKGROUND_REMOVAL_MODEL_ID = 'imgly/isnet-general-onnx'
export const BACKGROUND_REMOVAL_MODEL_REVISION =
  '440dea96dd4a3b06bbbf5abec3e26569dd7ec49f'
export const MAX_INFERENCE_EDGE = 1536

export const MODEL_DOWNLOAD_BYTES = {
  wasm: 176_149_806,
  webgpu: 88_152_708,
} as const

export type ProcessingBackend = keyof typeof MODEL_DOWNLOAD_BYTES
export type ProcessingStage =
  | 'composing'
  | 'downloading'
  | 'initializing'
  | 'segmenting'

export type WorkerErrorCode =
  | 'inference-failed'
  | 'model-download-failed'
  | 'out-of-memory'
  | 'webgpu-unavailable'
  | 'worker-failed'

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
  progress: number | null
  requestId: number
  stage: Exclude<ProcessingStage, 'composing'>
  type: 'progress'
}

export interface WorkerCompleteResponse {
  backend: ProcessingBackend
  height: number
  mask: ArrayBuffer
  requestId: number
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

export type BackgroundRemovalWorkerRequest = WorkerProcessRequest
export type BackgroundRemovalWorkerResponse =
  | WorkerCompleteResponse
  | WorkerErrorResponse
  | WorkerProgressResponse

export interface InferenceDimensions {
  height: number
  width: number
}

export interface SourceImage {
  dimensions: InferenceDimensions
  fileName: string
  fileSize: number
  frozenAnimation: boolean
  sourceBlob: Blob
  url: string
}

export interface RemovalResult {
  backend: ProcessingBackend
  blob: Blob
  fileName: string
  url: string
}

export interface ToolError {
  code: WorkerErrorCode | 'invalid-image'
  message: string
}

export interface ProgressState {
  backend: ProcessingBackend
  progress: number | null
  stage: ProcessingStage
}

export type ToolPhase =
  | 'decoding'
  | 'error'
  | 'idle'
  | 'processing'
  | 'ready'
  | 'result'

const FILE_EXTENSION_PATTERN = /\.[^.]+$/
const WEBGPU_ERROR_PATTERN =
  /(webgpu|gpu adapter|gpuadapter|requestadapter|shader-f16)/
const NETWORK_ERROR_PATTERN = /(fetch|network|download|http|connection)/
const MEMORY_ERROR_PATTERN =
  /(memory|allocation|allocate|buffer size|out of memory)/

export const clampComparisonPosition = (position: number): number =>
  Math.min(100, Math.max(0, Math.round(position)))

export const selectProcessingBackend = (
  hasWebGpu: boolean
): ProcessingBackend => (hasWebGpu ? 'webgpu' : 'wasm')

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

  const direction = key === 'ArrowLeft' || key === 'ArrowDown' ? -1 : 1
  const step = shiftKey ? 10 : 1
  return clampComparisonPosition(position + direction * step)
}

export const createBackgroundRemovalFileName = (fileName: string): string => {
  const baseName = fileName.replace(FILE_EXTENSION_PATTERN, '').trim()
  return `${baseName || 'image'}-no-bg.png`
}

export const fitInferenceDimensions = ({
  height,
  width,
}: InferenceDimensions): InferenceDimensions => {
  const longestEdge = Math.max(height, width)
  if (longestEdge <= MAX_INFERENCE_EDGE) {
    return { height, width }
  }

  const scale = MAX_INFERENCE_EDGE / longestEdge
  return {
    height: Math.max(1, Math.round(height * scale)),
    width: Math.max(1, Math.round(width * scale)),
  }
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

export const isCurrentWorkerResponse = (
  currentRequestId: number,
  response: Pick<BackgroundRemovalWorkerResponse, 'requestId'>
): boolean => currentRequestId === response.requestId

export const classifyWorkerError = (
  error: unknown,
  backend: ProcessingBackend
): Omit<WorkerErrorResponse, 'requestId' | 'type'> => {
  const rawMessage = error instanceof Error ? error.message : String(error)
  const message = rawMessage.toLowerCase()

  if (backend === 'webgpu' && WEBGPU_ERROR_PATTERN.test(message)) {
    return {
      code: 'webgpu-unavailable',
      message: '当前浏览器无法启动 WebGPU，可以改用兼容模式继续。',
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
    message: '背景识别没有完成，请重试或更换图片。',
    recoverable: true,
  }
}
