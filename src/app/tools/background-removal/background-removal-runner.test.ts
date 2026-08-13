import { describe, expect, test } from 'bun:test'
import type {
  BackgroundRemovalWorkerResponse,
  WorkerCompleteResponse,
} from './background-removal-model'
import {
  runBackgroundRemoval,
  type WorkerLike,
} from './background-removal-runner'

class MockWorker implements WorkerLike {
  private readonly errorListeners: Array<(event: Event) => void> = []
  private readonly messageListeners: Array<
    (event: MessageEvent<BackgroundRemovalWorkerResponse>) => void
  > = []

  addEventListener(
    type: 'error' | 'message',
    listener:
      | ((event: Event) => void)
      | ((event: MessageEvent<BackgroundRemovalWorkerResponse>) => void)
  ): void {
    if (type === 'error') {
      this.errorListeners.push(listener as (event: Event) => void)
      return
    }
    this.messageListeners.push(
      listener as (event: MessageEvent<BackgroundRemovalWorkerResponse>) => void
    )
  }

  postMessage(message: unknown): void {
    const request = message as { requestId: number }
    queueMicrotask(() => this.respond(request.requestId))
  }

  removeEventListener(
    type: 'error' | 'message',
    listener:
      | ((event: Event) => void)
      | ((event: MessageEvent<BackgroundRemovalWorkerResponse>) => void)
  ): void {
    const listeners =
      type === 'error' ? this.errorListeners : this.messageListeners
    const index = listeners.indexOf(listener as never)
    if (index >= 0) {
      listeners.splice(index, 1)
    }
  }

  respond(requestId: number): void {
    this.emit({
      backend: 'webgpu',
      height: 1,
      mask: new Uint8ClampedArray([255]).buffer,
      requestId,
      type: 'complete',
      width: 1,
    })
  }

  emit(response: BackgroundRemovalWorkerResponse): void {
    for (const listener of this.messageListeners) {
      listener(new MessageEvent('message', { data: response }))
    }
  }

  terminate(): void {
    this.messageListeners.length = 0
  }
}

class FailureWorker extends MockWorker {
  override respond(requestId: number): void {
    this.emit({
      code: 'model-download-failed',
      message: '模型下载失败，请检查网络后重试。',
      recoverable: true,
      requestId,
      type: 'error',
    })
  }
}

const run = async (worker: WorkerLike): Promise<WorkerCompleteResponse> =>
  await runBackgroundRemoval({
    backend: 'webgpu',
    height: 1,
    requestId: 7,
    rgba: new Uint8ClampedArray([0, 0, 0, 255]).buffer,
    width: 1,
    worker,
  })

describe('background removal runner', () => {
  test('resolves complete worker results', async () => {
    const response = await run(new MockWorker())
    expect(response.type).toBe('complete')
    expect(new Uint8ClampedArray(response.mask)).toEqual(
      new Uint8ClampedArray([255])
    )
  })

  test('rejects stable worker errors', async () => {
    await expect(run(new FailureWorker())).rejects.toThrow('模型下载失败')
  })

  test('ignores replies for older request ids', async () => {
    const worker = new MockWorker()
    const promise = run(worker)
    worker.emit({
      backend: 'webgpu',
      height: 1,
      mask: new Uint8ClampedArray([0]).buffer,
      requestId: 6,
      type: 'complete',
      width: 1,
    })
    expect((await promise).requestId).toBe(7)
  })

  test('rejects and releases listeners when cancelled', async () => {
    const worker = new MockWorker()
    const controller = new AbortController()
    controller.abort()
    const promise = runBackgroundRemoval({
      backend: 'webgpu',
      height: 1,
      requestId: 7,
      rgba: new Uint8ClampedArray([0, 0, 0, 255]).buffer,
      signal: controller.signal,
      width: 1,
      worker,
    })
    await expect(promise).rejects.toThrow('操作已取消')
  })
})
