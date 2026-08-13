/// <reference lib="webworker" />

import type {
  BackgroundRemovalWorkerRequest,
  BackgroundRemovalWorkerResponse,
  ProcessingBackend,
} from './background-removal-model'
import {
  BACKGROUND_REMOVAL_MODEL_ID,
  BACKGROUND_REMOVAL_MODEL_REVISION,
  classifyWorkerError,
  normalizeModelProgress,
} from './background-removal-model'

type Segmenter = (image: unknown) => Promise<{
  data: Uint8Array | Uint8ClampedArray
  height: number
  width: number
}>

const segmenters = new Map<ProcessingBackend, Promise<Segmenter>>()

const postResponse = (
  response: BackgroundRemovalWorkerResponse,
  transfer: Transferable[] = []
): void => {
  self.postMessage(response, transfer)
}

const loadSegmenter = async (
  backend: ProcessingBackend,
  requestId: number
): Promise<Segmenter> => {
  const existing = segmenters.get(backend)
  if (existing) {
    return await existing
  }

  const loading = (async () => {
    postResponse({
      backend,
      progress: 0,
      requestId,
      stage: 'initializing',
      type: 'progress',
    })
    const { env, pipeline } = await import('@huggingface/transformers')
    env.allowLocalModels = false
    env.useBrowserCache = true

    const segmenter = await pipeline(
      'background-removal',
      BACKGROUND_REMOVAL_MODEL_ID,
      {
        device: backend,
        dtype: backend === 'webgpu' ? 'fp16' : 'fp32',
        progress_callback: (event: unknown) => {
          postResponse({
            backend,
            progress: normalizeModelProgress(event),
            requestId,
            stage: 'downloading',
            type: 'progress',
          })
        },
        revision: BACKGROUND_REMOVAL_MODEL_REVISION,
      }
    )
    postResponse({
      backend,
      progress: 100,
      requestId,
      stage: 'initializing',
      type: 'progress',
    })
    return segmenter as Segmenter
  })()

  segmenters.set(backend, loading)
  try {
    return await loading
  } catch (error) {
    segmenters.delete(backend)
    throw error
  }
}

const processRequest = async (
  request: BackgroundRemovalWorkerRequest
): Promise<void> => {
  try {
    const { RawImage } = await import('@huggingface/transformers')
    const segmenter = await loadSegmenter(request.backend, request.requestId)
    postResponse({
      backend: request.backend,
      progress: null,
      requestId: request.requestId,
      stage: 'segmenting',
      type: 'progress',
    })
    const image = new RawImage(
      new Uint8ClampedArray(request.rgba),
      request.width,
      request.height,
      4
    )
    const result = await segmenter(image)
    const mask = new Uint8ClampedArray(result.width * result.height)
    for (let index = 0; index < mask.length; index += 1) {
      mask[index] = result.data[index * 4 + 3]
    }

    postResponse(
      {
        backend: request.backend,
        height: result.height,
        mask: mask.buffer,
        requestId: request.requestId,
        type: 'complete',
        width: result.width,
      },
      [mask.buffer]
    )
  } catch (error) {
    postResponse({
      ...classifyWorkerError(error, request.backend),
      requestId: request.requestId,
      type: 'error',
    })
  }
}

self.addEventListener(
  'message',
  async (event: MessageEvent<BackgroundRemovalWorkerRequest>) => {
    await processRequest(event.data)
  }
)
