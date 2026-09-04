'use client'

import type { ChangeEvent, KeyboardEvent } from 'react'
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { isAcceptedImageFile, prepareBrowserImage } from '@/lib/browser-image'
import {
  createInferenceInput,
  downloadBrowserBlob,
  type EncodedImage,
  encodeRgbaImage,
  resizeBrowserImage,
} from './image-upscale-engine'
import {
  AI_UPSCALE_FACTOR,
  clampComparisonPosition,
  createUpscaleFileName,
  type DimensionDraft,
  getComparisonPositionForKey,
  getDimensionIssue,
  getInitialDimensionDraft,
  getOutputFormat,
  getPresetDimensions,
  type ImageDimensions,
  type ImageUpscaleMode,
  type InterpolationMode,
  MAX_INPUT_EDGE,
  MAX_INPUT_PIXELS,
  type ProcessingBackend,
  type ProgressState,
  parseDimensionDraft,
  type ResizePreset,
  type SourceImage,
  selectProcessingBackend,
  type ToolError,
  type ToolPhase,
  type UpscaleResult,
  updateLinkedDimensionDraft,
  type WorkerCompleteResponse,
  type WorkerErrorCode,
  type WorkerProgressResponse,
} from './image-upscale-model'
import { ImageUpscaleRunError, runImageUpscale } from './image-upscale-runner'
import { ImageUpscaleView } from './image-upscale-view'

const DEFAULT_COMPARISON_POSITION = 50

const STAGE_LABELS = {
  downloading: '正在下载 AI 超分模型',
  encoding: '正在生成结果图片',
  initializing: '正在初始化本地模型',
  resizing: '正在放大图片',
  upscaling: '正在分块重建图片细节',
} as const

const BACKEND_LABELS: Record<ProcessingBackend, string> = {
  wasm: '兼容模式',
  webgpu: 'WebGPU',
}

const getInitialBackend = (): ProcessingBackend =>
  selectProcessingBackend(
    typeof navigator !== 'undefined' && 'gpu' in navigator
  )

const isAbortError = (error: unknown): boolean =>
  error instanceof DOMException && error.name === 'AbortError'

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message) {
    return error.message
  }
  return '读取图片时发生未知错误，请更换文件后重试。'
}

const getProcessingError = (error: unknown): ToolError => {
  if (error instanceof ImageUpscaleRunError) {
    return { code: error.code, message: error.message }
  }
  return { code: 'inference-failed', message: getErrorMessage(error) }
}

const canFallbackToWasm = (code: WorkerErrorCode): boolean =>
  code === 'inference-failed' ||
  code === 'webgpu-unavailable' ||
  code === 'worker-failed'

const getStatusMessage = ({
  phase,
  progress,
  result,
}: {
  phase: ToolPhase
  progress: ProgressState | null
  result: UpscaleResult | null
}): string => {
  if (progress) {
    const backend = progress.backend
      ? `，${BACKEND_LABELS[progress.backend]}`
      : ''
    let tileProgress = ''
    if (
      progress.completedTiles !== undefined &&
      progress.totalTiles !== undefined
    ) {
      tileProgress = `，${progress.completedTiles}/${progress.totalTiles} 块`
    } else if (progress.progress !== null) {
      tileProgress = `，${progress.progress}%`
    }
    return `${STAGE_LABELS[progress.stage]}${backend}${tileProgress}`
  }
  if (phase === 'result' && result) {
    return `图片已放大，已生成 ${result.fileName}。`
  }
  return phase === 'decoding' ? '正在浏览器本地读取图片。' : ''
}

export function ImageUpscaleTool() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const workerRef = useRef<Worker | null>(null)
  const taskAbortControllerRef = useRef<AbortController | null>(null)
  const sourceRef = useRef<SourceImage | null>(null)
  const sourceUrlRef = useRef<string | null>(null)
  const resultUrlRef = useRef<string | null>(null)
  const activeRequestIdRef = useRef(0)
  const loadRequestIdRef = useRef(0)
  const phaseRef = useRef<ToolPhase>('idle')
  const [phase, setPhase] = useState<ToolPhase>('idle')
  const [source, setSource] = useState<SourceImage | null>(null)
  const [result, setResult] = useState<UpscaleResult | null>(null)
  const [progress, setProgress] = useState<ProgressState | null>(null)
  const [error, setError] = useState<ToolError | null>(null)
  const [mode, setMode] = useState<ImageUpscaleMode>('ai')
  const [resizePreset, setResizePreset] = useState<ResizePreset>('2')
  const [dimensionDraft, setDimensionDraft] = useState<DimensionDraft>({
    height: '',
    width: '',
  })
  const [aspectLocked, setAspectLocked] = useState(true)
  const [interpolation, setInterpolation] =
    useState<InterpolationMode>('smooth')
  const [comparisonPosition, setComparisonPosition] = useState(
    DEFAULT_COMPARISON_POSITION
  )
  const [isDragging, setIsDragging] = useState(false)
  const [defaultBackend] = useState<ProcessingBackend>(getInitialBackend)
  const comparisonHelpId = useId()

  sourceRef.current = source
  phaseRef.current = phase

  const targetDimensions = useMemo<ImageDimensions | null>(() => {
    if (!source) {
      return null
    }
    if (mode === 'ai') {
      return {
        height: source.dimensions.height * AI_UPSCALE_FACTOR,
        width: source.dimensions.width * AI_UPSCALE_FACTOR,
      }
    }
    return parseDimensionDraft(dimensionDraft)
  }, [dimensionDraft, mode, source])

  const dimensionIssue = useMemo(
    () =>
      source
        ? getDimensionIssue({
            mode,
            source: source.dimensions,
            target: targetDimensions,
          })
        : null,
    [mode, source, targetDimensions]
  )

  const revokeSourceUrl = useCallback((): void => {
    if (sourceUrlRef.current) {
      URL.revokeObjectURL(sourceUrlRef.current)
      sourceUrlRef.current = null
    }
  }, [])

  const revokeResultUrl = useCallback((): void => {
    if (resultUrlRef.current) {
      URL.revokeObjectURL(resultUrlRef.current)
      resultUrlRef.current = null
    }
  }, [])

  const resetWorker = useCallback((): void => {
    workerRef.current?.terminate()
    workerRef.current = null
  }, [])

  const stopWorker = useCallback((): void => {
    taskAbortControllerRef.current?.abort()
    taskAbortControllerRef.current = null
    resetWorker()
    activeRequestIdRef.current += 1
  }, [resetWorker])

  const createWorker = useCallback((): Worker => {
    const existing = workerRef.current
    if (existing) {
      return existing
    }
    const worker = new Worker(
      new URL('./image-upscale-worker.ts', import.meta.url)
    )
    workerRef.current = worker
    return worker
  }, [])

  const clearResult = useCallback((): void => {
    revokeResultUrl()
    setResult(null)
    setError(null)
    setProgress(null)
    if (sourceRef.current) {
      setPhase('ready')
    }
  }, [revokeResultUrl])

  useEffect(
    () => () => {
      stopWorker()
      revokeSourceUrl()
      revokeResultUrl()
    },
    [revokeResultUrl, revokeSourceUrl, stopWorker]
  )

  const openFilePicker = useCallback((): void => {
    fileInputRef.current?.click()
  }, [])

  const loadFile = useCallback(
    async (file: File): Promise<void> => {
      loadRequestIdRef.current += 1
      const loadRequestId = loadRequestIdRef.current
      if (phaseRef.current === 'processing') {
        stopWorker()
      } else {
        activeRequestIdRef.current += 1
      }
      setPhase('decoding')
      setError(null)
      setProgress(null)
      revokeResultUrl()
      setResult(null)

      try {
        const prepared = await prepareBrowserImage(file, {
          maxEdge: MAX_INPUT_EDGE,
          maxPixels: MAX_INPUT_PIXELS,
        })
        if (loadRequestId !== loadRequestIdRef.current) {
          return
        }
        revokeSourceUrl()
        const url = URL.createObjectURL(prepared.sourceBlob)
        sourceUrlRef.current = url
        const nextSource: SourceImage = {
          dimensions: prepared.dimensions,
          fileName: file.name || 'image.png',
          fileSize: file.size,
          frozenAnimation: prepared.frozenAnimation,
          mimeType: prepared.sourceBlob.type || file.type,
          sourceBlob: prepared.sourceBlob,
          url,
        }
        setSource(nextSource)
        setMode('ai')
        setResizePreset('2')
        setDimensionDraft(getInitialDimensionDraft(nextSource.dimensions))
        setAspectLocked(true)
        setInterpolation('smooth')
        setComparisonPosition(DEFAULT_COMPARISON_POSITION)
        setPhase('ready')
      } catch (loadError) {
        if (loadRequestId !== loadRequestIdRef.current) {
          return
        }
        setError({ code: 'invalid-image', message: getErrorMessage(loadError) })
        setPhase(sourceRef.current ? 'error' : 'idle')
      } finally {
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
      }
    },
    [revokeResultUrl, revokeSourceUrl, stopWorker]
  )

  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
      const file = event.currentTarget.files?.[0]
      if (file) {
        await loadFile(file)
      }
    },
    [loadFile]
  )

  useEffect(() => {
    let dragDepth = 0
    const handleDragEnter = (event: globalThis.DragEvent): void => {
      if (!event.dataTransfer?.types.includes('Files')) {
        return
      }
      event.preventDefault()
      dragDepth += 1
      setIsDragging(true)
    }
    const handleDragOver = (event: globalThis.DragEvent): void => {
      if (!event.dataTransfer?.types.includes('Files')) {
        return
      }
      event.preventDefault()
      event.dataTransfer.dropEffect = 'copy'
    }
    const handleDragLeave = (event: globalThis.DragEvent): void => {
      event.preventDefault()
      dragDepth = Math.max(0, dragDepth - 1)
      if (dragDepth === 0) {
        setIsDragging(false)
      }
    }
    const handleDrop = async (event: globalThis.DragEvent): Promise<void> => {
      event.preventDefault()
      dragDepth = 0
      setIsDragging(false)
      const file = Array.from(event.dataTransfer?.files ?? []).find(
        isAcceptedImageFile
      )
      if (!file) {
        setError({
          code: 'invalid-image',
          message: '拖入的内容中没有可读取的图片。',
        })
        return
      }
      await loadFile(file)
    }

    window.addEventListener('dragenter', handleDragEnter)
    window.addEventListener('dragover', handleDragOver)
    window.addEventListener('dragleave', handleDragLeave)
    window.addEventListener('drop', handleDrop)
    return () => {
      window.removeEventListener('dragenter', handleDragEnter)
      window.removeEventListener('dragover', handleDragOver)
      window.removeEventListener('dragleave', handleDragLeave)
      window.removeEventListener('drop', handleDrop)
    }
  }, [loadFile])

  const runAiAttempt = useCallback(
    async ({
      backend,
      signal,
      sourceImage,
    }: {
      backend: ProcessingBackend
      signal: AbortSignal
      sourceImage: SourceImage
    }): Promise<WorkerCompleteResponse> => {
      const input = await createInferenceInput(
        sourceImage.sourceBlob,
        sourceImage.dimensions
      )
      activeRequestIdRef.current += 1
      const requestId = activeRequestIdRef.current
      return await runImageUpscale({
        backend,
        height: input.height,
        onProgress: (response: WorkerProgressResponse) => {
          if (requestId !== activeRequestIdRef.current) {
            return
          }
          setProgress({
            backend: response.backend,
            completedTiles: response.completedTiles,
            progress: response.progress,
            stage: response.stage,
            totalTiles: response.totalTiles,
          })
        },
        requestId,
        rgba: input.rgba,
        signal,
        width: input.width,
        worker: createWorker(),
      })
    },
    [createWorker]
  )

  const runAiWithFallback = useCallback(
    async ({
      controller,
      sourceImage,
    }: {
      controller: AbortController
      sourceImage: SourceImage
    }): Promise<WorkerCompleteResponse> => {
      try {
        return await runAiAttempt({
          backend: defaultBackend,
          signal: controller.signal,
          sourceImage,
        })
      } catch (runError) {
        const shouldFallback =
          defaultBackend === 'webgpu' &&
          runError instanceof ImageUpscaleRunError &&
          canFallbackToWasm(runError.code) &&
          !controller.signal.aborted
        if (!shouldFallback) {
          throw runError
        }
        resetWorker()
        setProgress({
          backend: 'wasm',
          progress: 0,
          stage: 'initializing',
        })
        return await runAiAttempt({
          backend: 'wasm',
          signal: controller.signal,
          sourceImage,
        })
      }
    },
    [defaultBackend, resetWorker, runAiAttempt]
  )

  const processImage = useCallback(async (): Promise<void> => {
    const currentSource = sourceRef.current
    if (!(currentSource && targetDimensions)) {
      return
    }
    const issue = getDimensionIssue({
      mode,
      source: currentSource.dimensions,
      target: targetDimensions,
    })
    if (issue) {
      setError({ code: 'invalid-settings', message: issue })
      setPhase('error')
      return
    }

    taskAbortControllerRef.current?.abort()
    taskAbortControllerRef.current = null
    activeRequestIdRef.current += 1
    const controller = new AbortController()
    taskAbortControllerRef.current = controller
    revokeResultUrl()
    setResult(null)
    setError(null)
    setPhase('processing')

    try {
      const requestedFormat = getOutputFormat({
        fileName: currentSource.fileName,
        mimeType: currentSource.mimeType,
      })
      let encodedImage: EncodedImage
      let resultBackend: ProcessingBackend | null = null

      if (mode === 'standard') {
        setProgress({
          backend: null,
          progress: null,
          stage: 'resizing',
        })
        encodedImage = await resizeBrowserImage({
          dimensions: targetDimensions,
          format: requestedFormat,
          smooth: interpolation === 'smooth',
          source: currentSource.sourceBlob,
        })
      } else {
        const response = await runAiWithFallback({
          controller,
          sourceImage: currentSource,
        })
        resultBackend = response.backend
        setProgress({
          backend: response.backend,
          progress: null,
          stage: 'encoding',
        })
        encodedImage = await encodeRgbaImage({
          dimensions: { height: response.height, width: response.width },
          format: requestedFormat,
          rgba: response.rgba,
        })
      }

      if (controller.signal.aborted) {
        return
      }
      const url = URL.createObjectURL(encodedImage.blob)
      resultUrlRef.current = url
      const fileName = createUpscaleFileName({
        dimensions: targetDimensions,
        fileName: currentSource.fileName,
        format: encodedImage.format,
        mode,
      })
      setResult({
        backend: resultBackend,
        blob: encodedImage.blob,
        dimensions: targetDimensions,
        fileName,
        format: encodedImage.format,
        mode,
        url,
      })
      setComparisonPosition(DEFAULT_COMPARISON_POSITION)
      setProgress(null)
      setPhase('result')
    } catch (processError) {
      if (isAbortError(processError)) {
        return
      }
      setError(getProcessingError(processError))
      setProgress(null)
      setPhase('error')
    } finally {
      if (taskAbortControllerRef.current === controller) {
        taskAbortControllerRef.current = null
      }
    }
  }, [
    interpolation,
    mode,
    revokeResultUrl,
    runAiWithFallback,
    targetDimensions,
  ])

  const handleCancel = useCallback((): void => {
    stopWorker()
    setProgress(null)
    setError(null)
    setPhase(sourceRef.current ? 'ready' : 'idle')
  }, [stopWorker])

  const handleModeChange = useCallback(
    (nextMode: ImageUpscaleMode): void => {
      if (nextMode === mode) {
        return
      }
      clearResult()
      if (nextMode === 'standard') {
        resetWorker()
      }
      setMode(nextMode)
    },
    [clearResult, mode, resetWorker]
  )

  const handleResizePresetChange = useCallback(
    (preset: ResizePreset): void => {
      const currentSource = sourceRef.current
      if (!currentSource) {
        return
      }
      clearResult()
      setResizePreset(preset)
      if (preset !== 'custom') {
        const dimensions = getPresetDimensions(currentSource.dimensions, preset)
        setDimensionDraft({
          height: String(dimensions.height),
          width: String(dimensions.width),
        })
      }
    },
    [clearResult]
  )

  const handleDimensionChange = useCallback(
    (field: keyof DimensionDraft, value: string): void => {
      const currentSource = sourceRef.current
      if (!currentSource) {
        return
      }
      clearResult()
      setResizePreset('custom')
      setDimensionDraft((currentDraft) =>
        updateLinkedDimensionDraft({
          draft: currentDraft,
          field,
          locked: aspectLocked,
          source: currentSource.dimensions,
          value,
        })
      )
    },
    [aspectLocked, clearResult]
  )

  const handleAspectLockChange = useCallback((): void => {
    const nextLocked = !aspectLocked
    const currentSource = sourceRef.current
    clearResult()
    setAspectLocked(nextLocked)
    if (nextLocked && currentSource) {
      setDimensionDraft((currentDraft) =>
        updateLinkedDimensionDraft({
          draft: currentDraft,
          field: 'width',
          locked: true,
          source: currentSource.dimensions,
          value: currentDraft.width,
        })
      )
    }
  }, [aspectLocked, clearResult])

  const handleInterpolationChange = useCallback(
    (nextInterpolation: InterpolationMode): void => {
      if (nextInterpolation === interpolation) {
        return
      }
      clearResult()
      setInterpolation(nextInterpolation)
    },
    [clearResult, interpolation]
  )

  const handleComparisonChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>): void => {
      setComparisonPosition(Number(event.currentTarget.value))
    },
    []
  )

  const handleComparisonKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>): void => {
      const nextPosition = getComparisonPositionForKey({
        key: event.key,
        position: comparisonPosition,
        shiftKey: event.shiftKey,
      })
      if (nextPosition === null) {
        return
      }
      event.preventDefault()
      setComparisonPosition(nextPosition)
    },
    [comparisonPosition]
  )

  const handleDownload = useCallback((): void => {
    if (result) {
      downloadBrowserBlob(result.blob, result.fileName)
    }
  }, [result])

  const handleShowOriginal = useCallback((): void => {
    setComparisonPosition(100)
  }, [])

  const handleShowResult = useCallback((): void => {
    setComparisonPosition(0)
  }, [])

  const statusMessage = getStatusMessage({ phase, progress, result })
  const isBusy = phase === 'decoding' || phase === 'processing'

  return (
    <ImageUpscaleView
      aspectLocked={aspectLocked}
      comparisonHelpId={comparisonHelpId}
      comparisonPosition={clampComparisonPosition(comparisonPosition)}
      defaultBackend={defaultBackend}
      dimensionDraft={dimensionDraft}
      dimensionIssue={dimensionIssue}
      error={error}
      fileInputRef={fileInputRef}
      interpolation={interpolation}
      isBusy={isBusy}
      isDragging={isDragging}
      mode={mode}
      onAspectLockChange={handleAspectLockChange}
      onCancel={handleCancel}
      onComparisonChange={handleComparisonChange}
      onComparisonKeyDown={handleComparisonKeyDown}
      onDimensionChange={handleDimensionChange}
      onDownload={handleDownload}
      onFileChange={handleFileChange}
      onInterpolationChange={handleInterpolationChange}
      onModeChange={handleModeChange}
      onOpenFile={openFilePicker}
      onProcess={processImage}
      onResizePresetChange={handleResizePresetChange}
      onRetry={processImage}
      onShowOriginal={handleShowOriginal}
      onShowResult={handleShowResult}
      phase={phase}
      progress={progress}
      resizePreset={resizePreset}
      result={result}
      source={source}
      statusMessage={statusMessage}
      targetDimensions={targetDimensions}
    />
  )
}
