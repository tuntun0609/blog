/// <reference lib="webworker" />

import type {
  ImageUpscaleWorkerRequest,
  ImageUpscaleWorkerResponse,
  ProcessingBackend,
} from './image-upscale-model'
import {
  AI_UPSCALE_FACTOR,
  classifyWorkerError,
  IMAGE_UPSCALE_MODEL_ID,
  IMAGE_UPSCALE_MODEL_REVISION,
  normalizeModelProgress,
} from './image-upscale-model'

interface UpscaledImage {
  channels: number
  data: Uint8Array | Uint8ClampedArray
  height: number
  width: number
}

type ImageUpscaler = (image: unknown) => Promise<UpscaledImage>

const TILE_OVERLAP = 8
const TILE_CORE_SIZE: Record<ProcessingBackend, number> = {
  wasm: 96,
  webgpu: 192,
}

const upscalers = new Map<ProcessingBackend, Promise<ImageUpscaler>>()

const postResponse = (
  response: ImageUpscaleWorkerResponse,
  transfer: Transferable[] = []
): void => {
  self.postMessage(response, transfer)
}

const loadUpscaler = async (
  backend: ProcessingBackend,
  requestId: number
): Promise<ImageUpscaler> => {
  const existing = upscalers.get(backend)
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

    const upscaler = await pipeline('image-to-image', IMAGE_UPSCALE_MODEL_ID, {
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
      revision: IMAGE_UPSCALE_MODEL_REVISION,
    })
    postResponse({
      backend,
      progress: 100,
      requestId,
      stage: 'initializing',
      type: 'progress',
    })
    return upscaler as ImageUpscaler
  })()

  upscalers.set(backend, loading)
  try {
    return await loading
  } catch (error) {
    upscalers.delete(backend)
    throw error
  }
}

const createTile = ({
  coreX,
  coreY,
  height,
  rgba,
  tileSize,
  width,
}: {
  coreX: number
  coreY: number
  height: number
  rgba: Uint8ClampedArray
  tileSize: number
  width: number
}): Uint8ClampedArray => {
  const tile = new Uint8ClampedArray(tileSize * tileSize * 4)
  for (let tileY = 0; tileY < tileSize; tileY += 1) {
    const sourceY = Math.min(
      height - 1,
      Math.max(0, coreY + tileY - TILE_OVERLAP)
    )
    for (let tileX = 0; tileX < tileSize; tileX += 1) {
      const sourceX = Math.min(
        width - 1,
        Math.max(0, coreX + tileX - TILE_OVERLAP)
      )
      const sourceIndex = (sourceY * width + sourceX) * 4
      const tileIndex = (tileY * tileSize + tileX) * 4
      tile[tileIndex] = rgba[sourceIndex]
      tile[tileIndex + 1] = rgba[sourceIndex + 1]
      tile[tileIndex + 2] = rgba[sourceIndex + 2]
      tile[tileIndex + 3] = rgba[sourceIndex + 3]
    }
  }
  return tile
}

const getAlpha = ({
  outputX,
  outputY,
  rgba,
  sourceHeight,
  sourceWidth,
}: {
  outputX: number
  outputY: number
  rgba: Uint8ClampedArray
  sourceHeight: number
  sourceWidth: number
}): number => {
  const sourceX = Math.min(
    sourceWidth - 1,
    Math.max(0, Math.floor(outputX / AI_UPSCALE_FACTOR))
  )
  const sourceY = Math.min(
    sourceHeight - 1,
    Math.max(0, Math.floor(outputY / AI_UPSCALE_FACTOR))
  )
  return rgba[(sourceY * sourceWidth + sourceX) * 4 + 3]
}

const copyTileCore = ({
  coreHeight,
  coreWidth,
  coreX,
  coreY,
  output,
  rgba,
  sourceHeight,
  sourceWidth,
  upscaled,
}: {
  coreHeight: number
  coreWidth: number
  coreX: number
  coreY: number
  output: Uint8ClampedArray
  rgba: Uint8ClampedArray
  sourceHeight: number
  sourceWidth: number
  upscaled: UpscaledImage
}): void => {
  const outputWidth = sourceWidth * AI_UPSCALE_FACTOR
  const offset = TILE_OVERLAP * AI_UPSCALE_FACTOR
  const copiedWidth = coreWidth * AI_UPSCALE_FACTOR
  const copiedHeight = coreHeight * AI_UPSCALE_FACTOR

  for (let localY = 0; localY < copiedHeight; localY += 1) {
    const outputY = coreY * AI_UPSCALE_FACTOR + localY
    const tileY = offset + localY
    for (let localX = 0; localX < copiedWidth; localX += 1) {
      const outputX = coreX * AI_UPSCALE_FACTOR + localX
      const tileX = offset + localX
      const sourceIndex = (tileY * upscaled.width + tileX) * upscaled.channels
      const outputIndex = (outputY * outputWidth + outputX) * 4
      output[outputIndex] = upscaled.data[sourceIndex]
      output[outputIndex + 1] = upscaled.data[sourceIndex + 1]
      output[outputIndex + 2] = upscaled.data[sourceIndex + 2]
      output[outputIndex + 3] = getAlpha({
        outputX,
        outputY,
        rgba,
        sourceHeight,
        sourceWidth,
      })
    }
  }
}

const processTiles = async ({
  coreSize,
  currentTile,
  output,
  request,
  rows,
  source,
  tileSize,
  totalTiles,
  upscaler,
}: {
  coreSize: number
  currentTile: number
  output: Uint8ClampedArray
  request: ImageUpscaleWorkerRequest
  rows: number
  source: Uint8ClampedArray
  tileSize: number
  totalTiles: number
  upscaler: ImageUpscaler
}): Promise<void> => {
  if (currentTile >= totalTiles) {
    return
  }

  const columns = totalTiles / rows
  const row = Math.floor(currentTile / columns)
  const column = currentTile % columns
  const coreX = column * coreSize
  const coreY = row * coreSize
  const coreWidth = Math.min(coreSize, request.width - coreX)
  const coreHeight = Math.min(coreSize, request.height - coreY)
  const tile = createTile({
    coreX,
    coreY,
    height: request.height,
    rgba: source,
    tileSize,
    width: request.width,
  })
  const { RawImage } = await import('@huggingface/transformers')
  const image = new RawImage(tile, tileSize, tileSize, 4)
  const upscaled = await upscaler(image)
  if (
    upscaled.width < (TILE_OVERLAP + coreWidth) * AI_UPSCALE_FACTOR ||
    upscaled.height < (TILE_OVERLAP + coreHeight) * AI_UPSCALE_FACTOR ||
    upscaled.channels < 3
  ) {
    throw new Error('The super-resolution model returned invalid data.')
  }
  copyTileCore({
    coreHeight,
    coreWidth,
    coreX,
    coreY,
    output,
    rgba: source,
    sourceHeight: request.height,
    sourceWidth: request.width,
    upscaled,
  })
  const completedTiles = currentTile + 1
  postResponse({
    backend: request.backend,
    completedTiles,
    progress: Math.round((completedTiles / totalTiles) * 100),
    requestId: request.requestId,
    stage: 'upscaling',
    totalTiles,
    type: 'progress',
  })
  await processTiles({
    coreSize,
    currentTile: completedTiles,
    output,
    request,
    rows,
    source,
    tileSize,
    totalTiles,
    upscaler,
  })
}

const processRequest = async (
  request: ImageUpscaleWorkerRequest
): Promise<void> => {
  try {
    const upscaler = await loadUpscaler(request.backend, request.requestId)
    const source = new Uint8ClampedArray(request.rgba)
    const outputWidth = request.width * AI_UPSCALE_FACTOR
    const outputHeight = request.height * AI_UPSCALE_FACTOR
    const output = new Uint8ClampedArray(outputWidth * outputHeight * 4)
    const coreSize = TILE_CORE_SIZE[request.backend]
    const tileSize = coreSize + TILE_OVERLAP * 2
    const columns = Math.ceil(request.width / coreSize)
    const rows = Math.ceil(request.height / coreSize)
    const totalTiles = columns * rows
    postResponse({
      backend: request.backend,
      completedTiles: 0,
      progress: 0,
      requestId: request.requestId,
      stage: 'upscaling',
      totalTiles,
      type: 'progress',
    })

    await processTiles({
      coreSize,
      currentTile: 0,
      output,
      request,
      rows,
      source,
      tileSize,
      totalTiles,
      upscaler,
    })

    postResponse(
      {
        backend: request.backend,
        height: outputHeight,
        requestId: request.requestId,
        rgba: output.buffer,
        type: 'complete',
        width: outputWidth,
      },
      [output.buffer]
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
  async (event: MessageEvent<ImageUpscaleWorkerRequest>) => {
    await processRequest(event.data)
  }
)
