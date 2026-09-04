import type {
  ImageUpscaleWorkerResponse,
  ProcessingBackend,
  WorkerCompleteResponse,
  WorkerErrorCode,
  WorkerProgressResponse,
} from './image-upscale-model'

export class ImageUpscaleRunError extends Error {
  readonly code: WorkerErrorCode

  constructor(code: WorkerErrorCode, message: string) {
    super(message)
    this.name = 'ImageUpscaleRunError'
    this.code = code
  }
}

export interface WorkerLike {
  addEventListener: {
    (
      type: 'error',
      listener: (event: Event) => void,
      options?: AddEventListenerOptions | boolean
    ): void
    (
      type: 'message',
      listener: (event: MessageEvent<ImageUpscaleWorkerResponse>) => void,
      options?: AddEventListenerOptions | boolean
    ): void
  }
  postMessage: (message: unknown, transfer: Transferable[]) => void
  removeEventListener: {
    (
      type: 'error',
      listener: (event: Event) => void,
      options?: EventListenerOptions | boolean
    ): void
    (
      type: 'message',
      listener: (event: MessageEvent<ImageUpscaleWorkerResponse>) => void,
      options?: EventListenerOptions | boolean
    ): void
  }
  terminate: () => void
}

interface RunImageUpscaleOptions {
  backend: ProcessingBackend
  height: number
  onProgress?: (response: WorkerProgressResponse) => void
  requestId: number
  rgba: ArrayBuffer
  signal?: AbortSignal
  width: number
  worker: WorkerLike
}

export const runImageUpscale = ({
  backend,
  height,
  onProgress,
  requestId,
  rgba,
  signal,
  width,
  worker,
}: RunImageUpscaleOptions): Promise<WorkerCompleteResponse> =>
  new Promise((resolve, reject) => {
    const cleanup = (): void => {
      worker.removeEventListener('message', handleMessage)
      worker.removeEventListener('error', handleError)
      signal?.removeEventListener('abort', handleAbort)
    }
    const handleMessage = (
      event: MessageEvent<ImageUpscaleWorkerResponse>
    ): void => {
      const response = event.data
      if (response.requestId !== requestId) {
        return
      }
      if (response.type === 'progress') {
        onProgress?.(response)
        return
      }
      if (response.type === 'error') {
        cleanup()
        reject(new ImageUpscaleRunError(response.code, response.message))
        return
      }
      cleanup()
      resolve(response)
    }
    const handleError = (): void => {
      cleanup()
      reject(
        new ImageUpscaleRunError(
          'worker-failed',
          '本地 AI 处理器意外停止，请重试或改用普通放大。'
        )
      )
    }
    const handleAbort = (): void => {
      cleanup()
      reject(new DOMException('操作已取消。', 'AbortError'))
    }

    if (signal?.aborted) {
      handleAbort()
      return
    }
    worker.addEventListener('message', handleMessage)
    worker.addEventListener('error', handleError)
    signal?.addEventListener('abort', handleAbort, { once: true })
    try {
      worker.postMessage(
        { backend, height, requestId, rgba, type: 'process', width },
        [rgba]
      )
    } catch (error) {
      cleanup()
      reject(error)
    }
  })
