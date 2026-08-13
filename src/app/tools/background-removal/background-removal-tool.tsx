'use client'

import type { ChangeEvent, KeyboardEvent } from 'react'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { isAcceptedImageFile, prepareBrowserImage } from '@/lib/browser-image'
import {
  composeTransparentPng,
  createInferenceInput,
} from './background-removal-engine'
import {
  clampComparisonPosition,
  createBackgroundRemovalFileName,
  getComparisonPositionForKey,
  type ProcessingBackend,
  type ProgressState,
  type RemovalResult,
  type SourceImage,
  selectProcessingBackend,
  type ToolError,
  type ToolPhase,
} from './background-removal-model'
import {
  BackgroundRemovalRunError,
  runBackgroundRemoval,
} from './background-removal-runner'
import { BackgroundRemovalView } from './background-removal-view'

const DEFAULT_COMPARISON_POSITION = 50

const STAGE_LABELS = {
  composing: '正在生成透明 PNG',
  downloading: '正在下载背景识别模型',
  initializing: '正在初始化本地模型',
  segmenting: '正在识别图片主体',
} as const

const BACKEND_LABELS: Record<ProcessingBackend, string> = {
  wasm: '兼容模式',
  webgpu: 'WebGPU',
}

const getInitialBackend = (): ProcessingBackend =>
  selectProcessingBackend(
    typeof navigator !== 'undefined' && 'gpu' in navigator
  )

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message) {
    return error.message
  }
  return '读取图片时发生未知错误，请更换文件后重试。'
}

const getProcessingError = (error: unknown): ToolError => {
  const message = getErrorMessage(error)
  if (error instanceof BackgroundRemovalRunError) {
    return { code: error.code, message }
  }
  return { code: 'inference-failed', message }
}

const getStatusMessage = ({
  phase,
  progress,
  result,
}: {
  phase: ToolPhase
  progress: ProgressState | null
  result: RemovalResult | null
}): string => {
  if (progress) {
    const progressLabel =
      progress.progress === null ? '' : `，${progress.progress}%`
    return `${STAGE_LABELS[progress.stage]}，${BACKEND_LABELS[progress.backend]}${progressLabel}`
  }
  if (phase === 'result' && result) {
    return `背景已去除，已生成 ${result.fileName}。`
  }
  return phase === 'decoding' ? '正在浏览器本地读取图片。' : ''
}

export function BackgroundRemovalTool() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const workerRef = useRef<Worker | null>(null)
  const taskAbortControllerRef = useRef<AbortController | null>(null)
  const sourceRef = useRef<SourceImage | null>(null)
  const sourceUrlRef = useRef<string | null>(null)
  const resultUrlRef = useRef<string | null>(null)
  const activeRequestIdRef = useRef(0)
  const loadRequestIdRef = useRef(0)
  const lastBackendRef = useRef<ProcessingBackend>(getInitialBackend())
  const phaseRef = useRef<ToolPhase>('idle')
  const [phase, setPhase] = useState<ToolPhase>('idle')
  const [source, setSource] = useState<SourceImage | null>(null)
  const [result, setResult] = useState<RemovalResult | null>(null)
  const [progress, setProgress] = useState<ProgressState | null>(null)
  const [error, setError] = useState<ToolError | null>(null)
  const [comparisonPosition, setComparisonPosition] = useState(
    DEFAULT_COMPARISON_POSITION
  )
  const [isDragging, setIsDragging] = useState(false)
  const comparisonHelpId = useId()

  sourceRef.current = source
  phaseRef.current = phase

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

  const stopWorker = useCallback((): void => {
    taskAbortControllerRef.current?.abort()
    taskAbortControllerRef.current = null
    workerRef.current?.terminate()
    workerRef.current = null
    activeRequestIdRef.current += 1
  }, [])

  const createWorker = useCallback((): Worker => {
    const existing = workerRef.current
    if (existing) {
      return existing
    }

    const worker = new Worker(
      new URL('./background-removal-worker.ts', import.meta.url)
    )
    workerRef.current = worker
    return worker
  }, [])

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
        const prepared = await prepareBrowserImage(file)
        if (loadRequestId !== loadRequestIdRef.current) {
          return
        }
        revokeSourceUrl()
        const url = URL.createObjectURL(prepared.sourceBlob)
        sourceUrlRef.current = url
        setSource({
          dimensions: prepared.dimensions,
          fileName: file.name || 'image.png',
          fileSize: file.size,
          frozenAnimation: prepared.frozenAnimation,
          sourceBlob: prepared.sourceBlob,
          url,
        })
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

  const processImage = useCallback(
    async (backend: ProcessingBackend): Promise<void> => {
      const currentSource = sourceRef.current
      if (!currentSource) {
        return
      }

      if (backend === 'webgpu' && !('gpu' in navigator)) {
        setError({
          code: 'webgpu-unavailable',
          message: '当前浏览器不支持 WebGPU，可以改用兼容模式继续。',
        })
        setPhase('error')
        return
      }

      lastBackendRef.current = backend
      setError(null)
      setResult(null)
      revokeResultUrl()
      setPhase('processing')
      setProgress({ backend, progress: null, stage: 'initializing' })
      activeRequestIdRef.current += 1
      const requestId = activeRequestIdRef.current
      const abortController = new AbortController()
      taskAbortControllerRef.current = abortController

      try {
        const input = await createInferenceInput(
          currentSource.sourceBlob,
          currentSource.dimensions
        )
        abortController.signal.throwIfAborted()
        const worker = createWorker()
        const response = await runBackgroundRemoval({
          backend,
          height: input.height,
          onProgress: (nextProgress) => {
            if (requestId !== activeRequestIdRef.current) {
              return
            }
            setProgress({
              backend: nextProgress.backend,
              progress: nextProgress.progress,
              stage: nextProgress.stage,
            })
          },
          requestId,
          rgba: input.rgba,
          signal: abortController.signal,
          width: input.width,
          worker,
        })
        abortController.signal.throwIfAborted()

        setProgress({
          backend: response.backend,
          progress: null,
          stage: 'composing',
        })
        const blob = await composeTransparentPng({
          dimensions: currentSource.dimensions,
          mask: new Uint8ClampedArray(response.mask),
          maskDimensions: { height: response.height, width: response.width },
          source: currentSource.sourceBlob,
        })
        abortController.signal.throwIfAborted()

        revokeResultUrl()
        const url = URL.createObjectURL(blob)
        resultUrlRef.current = url
        setResult({
          backend: response.backend,
          blob,
          fileName: createBackgroundRemovalFileName(currentSource.fileName),
          url,
        })
        setComparisonPosition(DEFAULT_COMPARISON_POSITION)
        setError(null)
        setProgress(null)
        setPhase('result')
      } catch (processError) {
        if (abortController.signal.aborted) {
          return
        }
        const nextError = getProcessingError(processError)
        if (nextError.code === 'worker-failed') {
          workerRef.current?.terminate()
          workerRef.current = null
        }
        setError(nextError)
        setProgress(null)
        setPhase('error')
      } finally {
        if (taskAbortControllerRef.current === abortController) {
          taskAbortControllerRef.current = null
        }
      }
    },
    [createWorker, revokeResultUrl]
  )

  const cancelProcessing = useCallback((): void => {
    stopWorker()
    setProgress(null)
    setError(null)
    setPhase(sourceRef.current ? 'ready' : 'idle')
  }, [stopWorker])

  const downloadResult = useCallback((): void => {
    if (!result) {
      return
    }
    const anchor = document.createElement('a')
    anchor.download = result.fileName
    anchor.href = result.url
    anchor.click()
  }, [result])

  const handleComparisonChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>): void => {
      setComparisonPosition(clampComparisonPosition(Number(event.target.value)))
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

  const showOriginal = useCallback((): void => {
    setComparisonPosition(0)
  }, [])

  const showResult = useCallback((): void => {
    setComparisonPosition(100)
  }, [])

  const processWithDefaultBackend = useCallback(async (): Promise<void> => {
    await processImage(getInitialBackend())
  }, [processImage])

  const processWithCompatibilityBackend =
    useCallback(async (): Promise<void> => {
      await processImage('wasm')
    }, [processImage])

  const retryProcessing = useCallback(async (): Promise<void> => {
    await processImage(lastBackendRef.current)
  }, [processImage])

  const isBusy = phase === 'decoding' || phase === 'processing'
  const defaultBackend = getInitialBackend()
  const statusMessage = getStatusMessage({ phase, progress, result })

  return (
    <BackgroundRemovalView
      comparisonHelpId={comparisonHelpId}
      comparisonPosition={comparisonPosition}
      defaultBackend={defaultBackend}
      error={error}
      fileInputRef={fileInputRef}
      isBusy={isBusy}
      isDragging={isDragging}
      onCancel={cancelProcessing}
      onComparisonChange={handleComparisonChange}
      onComparisonKeyDown={handleComparisonKeyDown}
      onDownload={downloadResult}
      onFileChange={handleFileChange}
      onOpenFile={openFilePicker}
      onProcessCompatibility={processWithCompatibilityBackend}
      onProcessDefault={processWithDefaultBackend}
      onRetry={retryProcessing}
      onShowOriginal={showOriginal}
      onShowResult={showResult}
      phase={phase}
      progress={progress}
      result={result}
      source={source}
      statusMessage={statusMessage}
    />
  )
}
