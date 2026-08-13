import type {
  BackgroundRemovalWorkerResponse,
  ProcessingBackend,
  WorkerCompleteResponse,
  WorkerErrorCode,
  WorkerProgressResponse,
} from './background-removal-model'

export class BackgroundRemovalRunError extends Error {
  readonly code: WorkerErrorCode

  constructor(code: WorkerErrorCode, message: string) {
    super(message)
    this.name = 'BackgroundRemovalRunError'
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
      listener: (event: MessageEvent<BackgroundRemovalWorkerResponse>) => void,
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
      listener: (event: MessageEvent<BackgroundRemovalWorkerResponse>) => void,
      options?: EventListenerOptions | boolean
    ): void
  }
  terminate: () => void
}

interface RunBackgroundRemovalOptions {
  backend: ProcessingBackend
  height: number
  onProgress?: (response: WorkerProgressResponse) => void
  requestId: number
  rgba: ArrayBuffer
  signal?: AbortSignal
  width: number
  worker: WorkerLike
}

export const runBackgroundRemoval = ({
  backend,
  height,
  onProgress,
  requestId,
  rgba,
  signal,
  width,
  worker,
}: RunBackgroundRemovalOptions): Promise<WorkerCompleteResponse> =>
  new Promise((resolve, reject) => {
    const cleanup = (): void => {
      worker.removeEventListener('message', handleMessage)
      worker.removeEventListener('error', handleError)
      signal?.removeEventListener('abort', handleAbort)
    }
    const handleMessage = (
      event: MessageEvent<BackgroundRemovalWorkerResponse>
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
        reject(new BackgroundRemovalRunError(response.code, response.message))
        return
      }
      cleanup()
      resolve(response)
    }
    const handleError = (): void => {
      cleanup()
      reject(
        new BackgroundRemovalRunError(
          'worker-failed',
          '本地处理器意外停止，请重试。'
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
