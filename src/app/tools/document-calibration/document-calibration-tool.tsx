'use client'

import {
  DownloadIcon,
  ImageIcon,
  LoaderCircleIcon,
  RefreshCcwIcon,
  ScanLineIcon,
  UploadIcon,
} from 'lucide-react'
import type { ChangeEvent, RefObject } from 'react'
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ACCEPTED_IMAGE_TYPES,
  isAcceptedImageFile,
  prepareBrowserImage,
} from '@/lib/browser-image'
import {
  detectDocumentCorners,
  downloadCalibration,
  exportCalibratedDocument,
  preparePreviewSource,
  renderCalibrationPreview,
} from './document-calibration-engine'
import type {
  CalibrationCorners,
  CalibrationSource,
  Dimensions,
  OutputFormat,
  PreviewPhase,
  ToolPhase,
} from './document-calibration-model'
import {
  createInitialCorners,
  formatBytes,
  getOutputDimensions,
  getSafeOutputDimensions,
  validateCorners,
} from './document-calibration-model'
import {
  type CornerEditorControls,
  DocumentCornerEditor,
} from './document-corner-editor'
import styles from './document-calibration-tool.module.css'

interface PreviewState {
  dimensions: Dimensions | null
  message: string | null
  phase: PreviewPhase
}

type AutoLocatePhase = 'confirming' | 'idle' | 'locating'

interface ImageIngressOptions {
  loadFile: (file: File) => Promise<void>
  onInvalidFile: () => void
}

interface UploadStateProps {
  onPickFile: () => void
  phase: ToolPhase
}

interface PreviewPanelProps {
  canvasRef: RefObject<HTMLCanvasElement | null>
  cornersError: string | null
  dimensions: Dimensions
  exportPreset: ExportPreset
  isExporting: boolean
  onDownload: () => Promise<void>
  onExportPresetChange: (preset: ExportPreset | null) => void
  preview: PreviewState
}

type ExportPreset =
  | 'jpeg-high'
  | 'jpeg-compact'
  | 'png-lossless'
  | 'webp-high'
  | 'webp-compact'

const EXPORT_PRESET_ITEMS: { label: string; value: ExportPreset }[] = [
  { label: 'JPEG · 高质量', value: 'jpeg-high' },
  { label: 'JPEG · 较小文件', value: 'jpeg-compact' },
  { label: 'WebP · 高质量', value: 'webp-high' },
  { label: 'WebP · 较小文件', value: 'webp-compact' },
  { label: 'PNG · 无损', value: 'png-lossless' },
]

const EXPORT_SETTINGS: Record<
  ExportPreset,
  { format: OutputFormat; quality: number }
> = {
  'jpeg-compact': { format: 'jpeg', quality: 80 },
  'jpeg-high': { format: 'jpeg', quality: 92 },
  'png-lossless': { format: 'png', quality: 100 },
  'webp-compact': { format: 'webp', quality: 78 },
  'webp-high': { format: 'webp', quality: 90 },
}

const EMPTY_PREVIEW: PreviewState = {
  dimensions: null,
  message: null,
  phase: 'empty',
}

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message) {
    return error.message
  }
  return '处理图片时发生未知错误，请更换图片后重试。'
}

const getPastedImage = (event: ClipboardEvent): File | null => {
  for (const item of Array.from(event.clipboardData?.items ?? [])) {
    if (item.type.startsWith('image/')) {
      return item.getAsFile()
    }
  }
  return null
}

const useImageIngress = ({
  loadFile,
  onInvalidFile,
}: ImageIngressOptions): boolean => {
  const [isDragging, setIsDragging] = useState(false)

  useEffect(() => {
    let dragDepth = 0
    const hasFiles = (event: DragEvent): boolean =>
      event.dataTransfer?.types.includes('Files') ?? false
    const handleDragEnter = (event: DragEvent): void => {
      if (!hasFiles(event)) {
        return
      }
      event.preventDefault()
      dragDepth += 1
      setIsDragging(true)
    }
    const handleDragOver = (event: DragEvent): void => {
      if (!hasFiles(event)) {
        return
      }
      event.preventDefault()
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'copy'
      }
    }
    const handleDragLeave = (event: DragEvent): void => {
      event.preventDefault()
      dragDepth = Math.max(0, dragDepth - 1)
      if (dragDepth === 0) {
        setIsDragging(false)
      }
    }
    const handleDrop = async (event: DragEvent): Promise<void> => {
      if (!hasFiles(event)) {
        return
      }
      event.preventDefault()
      dragDepth = 0
      setIsDragging(false)
      const file = Array.from(event.dataTransfer?.files ?? []).find(
        isAcceptedImageFile
      )
      if (!file) {
        onInvalidFile()
        return
      }
      await loadFile(file)
    }
    const handlePaste = async (event: ClipboardEvent): Promise<void> => {
      const file = getPastedImage(event)
      if (file) {
        await loadFile(file)
      }
    }

    window.addEventListener('dragenter', handleDragEnter)
    window.addEventListener('dragover', handleDragOver)
    window.addEventListener('dragleave', handleDragLeave)
    window.addEventListener('drop', handleDrop)
    window.addEventListener('paste', handlePaste)
    return () => {
      window.removeEventListener('dragenter', handleDragEnter)
      window.removeEventListener('dragover', handleDragOver)
      window.removeEventListener('dragleave', handleDragLeave)
      window.removeEventListener('drop', handleDrop)
      window.removeEventListener('paste', handlePaste)
    }
  }, [loadFile, onInvalidFile])

  return isDragging
}

function UploadState({ onPickFile, phase }: UploadStateProps) {
  const isDecoding = phase === 'decoding'
  return (
    <section className={styles.hero}>
      <button
        className={styles.dropButton}
        disabled={isDecoding}
        onClick={onPickFile}
        type="button"
      >
        <Empty className={styles.dropZone}>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              {isDecoding ? (
                <LoaderCircleIcon
                  aria-hidden="true"
                  className={styles.spinner}
                />
              ) : (
                <ImageIcon aria-hidden="true" />
              )}
            </EmptyMedia>
            <EmptyTitle>
              {isDecoding ? '正在读取图片' : '拖入图片或点击选择'}
            </EmptyTitle>
            <EmptyDescription>
              支持 JPEG、PNG、WebP、AVIF、GIF 和 BMP
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <span className={styles.pickFileLabel}>
              {isDecoding ? '请稍候' : '选择图片'}
            </span>
            <span>也可以直接粘贴剪贴板中的图片</span>
          </EmptyContent>
        </Empty>
      </button>
    </section>
  )
}

function DragOverlay() {
  return (
    <div aria-hidden="true" className={styles.dragOverlay}>
      <UploadIcon />
      <strong>松开图片，开始校准</strong>
    </div>
  )
}

function PreviewStage({
  canvasRef,
  preview,
}: Pick<PreviewPanelProps, 'canvasRef' | 'preview'>) {
  const showCanvas = preview.phase === 'ready'
  return (
    <div className={styles.previewStage}>
      <div className={styles.previewViewport}>
        <canvas
          aria-label="水平校准后的文档预览"
          className={styles.previewCanvas}
          data-visible={showCanvas || undefined}
          ref={canvasRef}
          role="img"
        />
        {showCanvas ? null : (
          <div className={styles.previewPlaceholder}>
            {preview.phase === 'error' ? (
              <ScanLineIcon aria-hidden="true" />
            ) : (
              <LoaderCircleIcon aria-hidden="true" className={styles.spinner} />
            )}
            <strong>
              {preview.phase === 'error' ? '暂时无法生成预览' : '正在校准预览'}
            </strong>
            <span>
              {preview.message ?? '移动四个角点时，结果会在这里实时更新。'}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

function PreviewPanel({
  canvasRef,
  cornersError,
  dimensions,
  exportPreset,
  isExporting,
  onDownload,
  onExportPresetChange,
  preview,
}: PreviewPanelProps) {
  const formatId = useId()
  const safeDimensions = getSafeOutputDimensions(dimensions)

  return (
    <Card className={styles.resultCard}>
      <CardHeader className={styles.cardHeader}>
        <div>
          <CardTitle>校准结果</CardTitle>
          <CardDescription>右侧画面会随四个角点实时更新。</CardDescription>
        </div>
      </CardHeader>
      <CardContent className={styles.resultContent}>
        <PreviewStage canvasRef={canvasRef} preview={preview} />
        {safeDimensions.limited ? (
          <p className={styles.limitNote}>
            原始选区较大，下载时会等比缩小到浏览器安全范围。
          </p>
        ) : null}
      </CardContent>
      <CardFooter className={styles.resultFooter}>
        <FieldGroup className={styles.exportFields}>
          <div className={styles.exportActions}>
            <Field className={styles.formatField}>
              <FieldLabel htmlFor={formatId}>下载格式</FieldLabel>
              <Select
                items={EXPORT_PRESET_ITEMS}
                onValueChange={onExportPresetChange}
                value={exportPreset}
              >
                <SelectTrigger className={styles.formatTrigger} id={formatId}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {EXPORT_PRESET_ITEMS.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Button
              className={styles.downloadButton}
              disabled={
                Boolean(cornersError) ||
                preview.phase !== 'ready' ||
                isExporting
              }
              onClick={onDownload}
              size="lg"
            >
              {isExporting ? (
                <LoaderCircleIcon
                  aria-hidden="true"
                  className={styles.spinner}
                  data-icon="inline-start"
                />
              ) : (
                <DownloadIcon aria-hidden="true" data-icon="inline-start" />
              )}
              {isExporting ? '正在生成下载文件' : '下载校准图片'}
            </Button>
          </div>
        </FieldGroup>
        {cornersError ? (
          <p className={styles.exportError} role="alert">
            {cornersError}
          </p>
        ) : null}
      </CardFooter>
    </Card>
  )
}

export function DocumentCalibrationTool() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const sourceUrlRef = useRef<string | null>(null)
  const sourceImageRef = useRef<HTMLImageElement | null>(null)
  const previewSourceRef = useRef<ReturnType<
    typeof preparePreviewSource
  > | null>(null)
  const editorControlsRef = useRef<CornerEditorControls | null>(null)
  const previewCanvasRef = useRef<HTMLCanvasElement>(null)
  const loadRequestRef = useRef(0)
  const autoLocateRequestRef = useRef(0)
  const previewRequestRef = useRef(0)
  const [phase, setPhase] = useState<ToolPhase>('idle')
  const [source, setSource] = useState<CalibrationSource | null>(null)
  const [corners, setCorners] = useState<CalibrationCorners | null>(null)
  const [imageRevision, setImageRevision] = useState(0)
  const [preview, setPreview] = useState<PreviewState>(EMPTY_PREVIEW)
  const [exportPreset, setExportPreset] = useState<ExportPreset>('jpeg-high')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState('')
  const [autoLocatePhase, setAutoLocatePhase] =
    useState<AutoLocatePhase>('idle')
  const [isAutoLocateModelReady, setIsAutoLocateModelReady] = useState(false)

  useEffect(() => {
    if (errorMessage) {
      toast.error('操作失败', { description: errorMessage })
    }
  }, [errorMessage])

  const replaceSourceUrl = useCallback((blob: Blob | null): string | null => {
    if (sourceUrlRef.current) {
      URL.revokeObjectURL(sourceUrlRef.current)
    }
    const url = blob ? URL.createObjectURL(blob) : null
    sourceUrlRef.current = url
    return url
  }, [])

  const loadFile = useCallback(
    async (file: File): Promise<void> => {
      const requestId = loadRequestRef.current + 1
      loadRequestRef.current = requestId
      setPhase('decoding')
      autoLocateRequestRef.current += 1
      setAutoLocatePhase('idle')
      setErrorMessage(null)
      setStatusMessage('正在浏览器本地读取图片。')

      try {
        const prepared = await prepareBrowserImage(file)
        if (requestId !== loadRequestRef.current) {
          return
        }
        const url = replaceSourceUrl(prepared.sourceBlob)
        if (!url) {
          throw new Error('浏览器无法创建图片预览。')
        }
        const nextSource: CalibrationSource = {
          dimensions: prepared.dimensions,
          fileName: file.name || 'pasted-document.png',
          fileSize: file.size,
          frozenAnimation: prepared.frozenAnimation,
          sourceBlob: prepared.sourceBlob,
          url,
        }
        setSource(nextSource)
        setCorners(createInitialCorners(prepared.dimensions))
        setPreview(EMPTY_PREVIEW)
        setPhase('editing')
        setStatusMessage('图片已读取，请拖动四个角点框住文档。')
      } catch (error) {
        if (requestId === loadRequestRef.current) {
          setErrorMessage(getErrorMessage(error))
          setPhase(source ? 'editing' : 'idle')
        }
      } finally {
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
      }
    },
    [replaceSourceUrl, source]
  )

  const handleInvalidFile = useCallback((): void => {
    setErrorMessage('拖入的内容中没有可读取的图片。')
  }, [])
  const isDragging = useImageIngress({
    loadFile,
    onInvalidFile: handleInvalidFile,
  })

  useEffect(
    () => () => {
      loadRequestRef.current += 1
      autoLocateRequestRef.current += 1
      previewRequestRef.current += 1
      replaceSourceUrl(null)
    },
    [replaceSourceUrl]
  )

  const openFilePicker = useCallback((): void => {
    fileInputRef.current?.click()
  }, [])

  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
      const file = event.currentTarget.files?.[0]
      if (file) {
        await loadFile(file)
      }
    },
    [loadFile]
  )

  const handleCornersChange = useCallback(
    (nextCorners: CalibrationCorners): void => {
      setCorners(nextCorners)
      setErrorMessage(null)
    },
    []
  )

  const handleControlsChange = useCallback(
    (controls: CornerEditorControls | null): void => {
      editorControlsRef.current = controls
    },
    []
  )

  const handleEditorError = useCallback((message: string): void => {
    setErrorMessage(message)
  }, [])

  const handleResetCorners = useCallback((): void => {
    editorControlsRef.current?.reset()
  }, [])

  const runAutoLocate = useCallback(async (): Promise<void> => {
    const image = sourceImageRef.current
    if (!image) {
      setErrorMessage('图片仍在准备中，请稍后再试。')
      return
    }

    const requestId = autoLocateRequestRef.current + 1
    autoLocateRequestRef.current = requestId
    setAutoLocatePhase('locating')
    setErrorMessage(null)
    setStatusMessage(
      isAutoLocateModelReady
        ? '正在浏览器本地识别文档边缘。'
        : '正在下载自动定位模型并识别文档边缘。'
    )

    try {
      const detectedCorners = await detectDocumentCorners(image)
      if (requestId !== autoLocateRequestRef.current) {
        return
      }
      setIsAutoLocateModelReady(true)
      setCorners(detectedCorners)
      editorControlsRef.current?.setCorners(detectedCorners)
      setStatusMessage('已自动定位四个角点，你可以继续拖动微调。')
    } catch (error) {
      if (requestId === autoLocateRequestRef.current) {
        const message = getErrorMessage(error)
        setErrorMessage(
          message.includes('failed to fetch the ML model') ||
            message.includes('timed out')
            ? '模型下载失败，请检查网络后重试；现有点位未被更改。'
            : message
        )
        setStatusMessage('自动定位失败，现有点位未被更改。')
      }
    } finally {
      if (requestId === autoLocateRequestRef.current) {
        setAutoLocatePhase('idle')
      }
    }
  }, [isAutoLocateModelReady])

  const handleAutoLocate = useCallback(async (): Promise<void> => {
    if (isAutoLocateModelReady) {
      await runAutoLocate()
    } else {
      setAutoLocatePhase('confirming')
    }
  }, [isAutoLocateModelReady, runAutoLocate])

  const handleCancelAutoLocate = useCallback((): void => {
    setAutoLocatePhase('idle')
  }, [])

  const handleAutoLocateDialogOpenChange = useCallback(
    (open: boolean): void => {
      if (!open) {
        handleCancelAutoLocate()
      }
    },
    [handleCancelAutoLocate]
  )

  const handleConfirmAutoLocate = useCallback(async (): Promise<void> => {
    await runAutoLocate()
  }, [runAutoLocate])

  const handleImageReady = useCallback(
    (image: HTMLImageElement | null): void => {
      sourceImageRef.current = image
      previewSourceRef.current = image ? preparePreviewSource(image) : null
      setImageRevision((current) => current + 1)
    },
    []
  )

  const cornersError = useMemo(
    () => (corners ? validateCorners(corners) : '请先选择一张文档图片。'),
    [corners]
  )
  const outputDimensions = useMemo(
    () => (corners ? getOutputDimensions(corners) : { height: 1, width: 1 }),
    [corners]
  )

  useEffect(() => {
    const target = previewCanvasRef.current
    const preparedSource = previewSourceRef.current
    if (!(corners && target && preparedSource) || cornersError) {
      return
    }

    const requestId = previewRequestRef.current + 1
    previewRequestRef.current = requestId
    setPreview((current) =>
      current.phase === 'ready'
        ? current
        : { dimensions: null, message: null, phase: 'rendering' }
    )
    const timer = window.setTimeout(() => {
      renderCalibrationPreview({ corners, preparedSource, target })
        .then((dimensions) => {
          if (previewRequestRef.current === requestId) {
            setPreview({ dimensions, message: null, phase: 'ready' })
          }
        })
        .catch((error: unknown) => {
          if (previewRequestRef.current === requestId) {
            setPreview({
              dimensions: null,
              message: getErrorMessage(error),
              phase: 'error',
            })
          }
        })
    }, 48)

    return () => window.clearTimeout(timer)
  }, [corners, cornersError, imageRevision])

  const handleExportPresetChange = useCallback(
    (nextPreset: ExportPreset | null): void => {
      if (nextPreset) {
        setExportPreset(nextPreset)
      }
    },
    []
  )

  const { format, quality } = EXPORT_SETTINGS[exportPreset]

  const handleDownload = useCallback(async (): Promise<void> => {
    const image = sourceImageRef.current
    if (!(source && corners && image) || cornersError) {
      return
    }

    setPhase('exporting')
    setErrorMessage(null)
    setStatusMessage('正在本地生成校准图片。')
    await new Promise<void>((resolve) =>
      window.requestAnimationFrame(() => resolve())
    )
    try {
      const result = await exportCalibratedDocument({
        corners,
        fileName: source.fileName,
        format,
        image,
        quality,
      })
      downloadCalibration(result)
      setStatusMessage(
        `已下载 ${result.fileName}${result.limited ? '，大图已等比缩小。' : '。'}`
      )
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
      setStatusMessage('下载文件生成失败。')
    } finally {
      setPhase('editing')
    }
  }, [corners, cornersError, format, quality, source])

  const initialCorners = useMemo(
    () => (source ? createInitialCorners(source.dimensions) : null),
    [source]
  )
  let autoLocateButtonLabel = '自动定位点位'
  if (autoLocatePhase === 'locating') {
    autoLocateButtonLabel = isAutoLocateModelReady
      ? '正在定位点位'
      : '正在下载并定位'
  }

  return (
    <div className={styles.tool}>
      <input
        accept={ACCEPTED_IMAGE_TYPES}
        className={styles.fileInput}
        onChange={handleFileChange}
        ref={fileInputRef}
        type="file"
      />
      {isDragging ? <DragOverlay /> : null}

      {source && corners && initialCorners ? (
        <section className={styles.workspace}>
          <div className={styles.workspaceGrid}>
            <Card className={styles.editorCard}>
              <CardHeader className={styles.cardHeader}>
                <div>
                  <CardTitle>框住文档四角</CardTitle>
                  <CardDescription>
                    拖动圆点进行调整；聚焦圆点后可用方向键精细移动。
                  </CardDescription>
                </div>
                <div className={styles.workspaceActions}>
                  <Button
                    disabled={
                      phase === 'decoding' ||
                      phase === 'exporting' ||
                      autoLocatePhase === 'locating'
                    }
                    onClick={handleAutoLocate}
                  >
                    {autoLocatePhase === 'locating' ? (
                      <LoaderCircleIcon
                        aria-hidden="true"
                        className={styles.spinner}
                        data-icon="inline-start"
                      />
                    ) : (
                      <ScanLineIcon
                        aria-hidden="true"
                        data-icon="inline-start"
                      />
                    )}
                    {autoLocateButtonLabel}
                  </Button>
                  <Button
                    disabled={
                      phase === 'decoding' ||
                      phase === 'exporting' ||
                      autoLocatePhase === 'locating'
                    }
                    onClick={handleResetCorners}
                    variant="outline"
                  >
                    <RefreshCcwIcon
                      aria-hidden="true"
                      data-icon="inline-start"
                    />
                    重置点位
                  </Button>
                  <Button
                    disabled={
                      phase === 'decoding' ||
                      phase === 'exporting' ||
                      autoLocatePhase === 'locating'
                    }
                    onClick={openFilePicker}
                    variant="outline"
                  >
                    <UploadIcon aria-hidden="true" data-icon="inline-start" />
                    更换图片
                  </Button>
                </div>
              </CardHeader>
              <AlertDialog
                onOpenChange={handleAutoLocateDialogOpenChange}
                open={autoLocatePhase === 'confirming'}
              >
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>需要下载自动定位模型</AlertDialogTitle>
                    <AlertDialogDescription>
                      自动定位需要下载约 3.5 MB
                      的模型。模型下载后将在浏览器本地识别文档边缘，你的图片不会上传。
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel onClick={handleCancelAutoLocate}>
                      暂不使用
                    </AlertDialogCancel>
                    <AlertDialogAction onClick={handleConfirmAutoLocate}>
                      下载并自动定位
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <CardContent className={styles.editorContent}>
                <DocumentCornerEditor
                  initialCorners={initialCorners}
                  onChange={handleCornersChange}
                  onControlsChange={handleControlsChange}
                  onError={handleEditorError}
                  onImageReady={handleImageReady}
                  source={source}
                />
              </CardContent>
              <CardFooter className={styles.editorFooter}>
                <div>
                  <strong>{source.fileName}</strong>
                  <span>
                    {source.dimensions.width} × {source.dimensions.height} ·{' '}
                    {formatBytes(source.fileSize)}
                  </span>
                </div>
                <span>
                  {source.frozenAnimation ? '动图按第一帧处理 · ' : ''}Shift +
                  方向键可快速移动
                </span>
              </CardFooter>
            </Card>

            <PreviewPanel
              canvasRef={previewCanvasRef}
              cornersError={cornersError}
              dimensions={outputDimensions}
              exportPreset={exportPreset}
              isExporting={phase === 'exporting'}
              onDownload={handleDownload}
              onExportPresetChange={handleExportPresetChange}
              preview={preview}
            />
          </div>
        </section>
      ) : (
        <UploadState onPickFile={openFilePicker} phase={phase} />
      )}

      <p aria-live="polite" className={styles.srOnly}>
        {statusMessage}
      </p>
    </div>
  )
}
