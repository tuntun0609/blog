'use client'

import {
  CheckIcon,
  CopyIcon,
  ImageIcon,
  LoaderCircleIcon,
  LockKeyholeIcon,
  PaletteIcon,
  RefreshCwIcon,
  UploadIcon,
  XIcon,
} from 'lucide-react'
import Image from 'next/image'
import type { ChangeEvent, CSSProperties } from 'react'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Slider } from '@/components/ui/slider'
import {
  ACCEPTED_IMAGE_TYPES,
  isAcceptedImageFile,
  prepareBrowserImage,
} from '@/lib/browser-image'
import { extractThemePalette } from './color-palette-engine'
import {
  DEFAULT_COLOR_COUNT,
  formatBytes,
  formatCssVariables,
  formatPaletteShare,
  getSliderNumber,
  MAX_COLOR_COUNT,
  MIN_COLOR_COUNT,
  type PaletteColor,
  type PalettePhase,
  type PaletteSource,
} from './color-palette-model'
import styles from './color-palette-tool.module.css'

const COPY_FEEDBACK_DURATION = 1800

type PaletteToolStyle = CSSProperties & {
  '--palette-primary': string
  '--palette-secondary': string
}

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message) {
    return error.message
  }
  return '处理图片时发生未知错误，请更换图片后重试。'
}

const isAbortError = (error: unknown): boolean =>
  error instanceof DOMException && error.name === 'AbortError'

const getStatusMessage = ({
  colorCount,
  paletteSize,
  phase,
}: {
  colorCount: number
  paletteSize: number
  phase: PalettePhase
}): string => {
  if (phase === 'decoding') {
    return '正在浏览器本地读取图片。'
  }
  if (phase === 'extracting') {
    return `正在提取 ${colorCount} 个主题色。`
  }
  if (phase === 'ready') {
    return `已提取 ${paletteSize} 个主题色。`
  }
  return ''
}

type CopyText = (value: string, key: string) => Promise<void>

interface EmptyStateProps {
  errorMessage: string | null
  onPickFile: () => void
  phase: PalettePhase
}

function EmptyState({ errorMessage, onPickFile, phase }: EmptyStateProps) {
  const isDecoding = phase === 'decoding'
  return (
    <div className={styles.emptyState}>
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
            <span>图片只在当前浏览器中处理</span>
          </EmptyContent>
        </Empty>
      </button>
      {errorMessage ? (
        <p className={styles.emptyError} role="alert">
          {errorMessage}
        </p>
      ) : null}
    </div>
  )
}

function DropOverlay() {
  return (
    <div aria-hidden="true" className={styles.dropOverlay}>
      <div>
        <UploadIcon />
        <strong>松开图片，开始提取主题色</strong>
      </div>
    </div>
  )
}

interface PreviewPanelProps {
  phase: PalettePhase
  source: PaletteSource
}

function PreviewPanel({ phase, source }: PreviewPanelProps) {
  const isDecoding = phase === 'decoding'
  return (
    <section aria-label="图片预览" className={styles.previewPanel}>
      <div className={styles.previewToolbar}>
        <strong>{source.fileName}</strong>
        <span>
          {source.dimensions.width} × {source.dimensions.height} ·{' '}
          {formatBytes(source.fileSize)}
        </span>
      </div>
      <div className={styles.imageStage}>
        <Image
          alt={`已选择的图片：${source.fileName}`}
          className={styles.previewImage}
          height={source.dimensions.height}
          priority
          src={source.url}
          unoptimized
          width={source.dimensions.width}
        />
        {isDecoding ? (
          <div className={styles.processingOverlay}>
            <LoaderCircleIcon aria-hidden="true" />
            <strong>正在读取图片</strong>
            <span>所有计算都在当前浏览器中完成</span>
          </div>
        ) : null}
      </div>
      <div className={styles.sourceNote}>
        <LockKeyholeIcon aria-hidden="true" />
        <span>
          图片不会上传到服务器
          {source.frozenAnimation ? ' · 动图按第一帧提取' : ''}
        </span>
      </div>
    </section>
  )
}

interface PaletteRibbonProps {
  palette: PaletteColor[]
}

function PaletteRibbon({ palette }: PaletteRibbonProps) {
  if (palette.length === 0) {
    return (
      <div className={styles.palettePlaceholder}>
        <PaletteIcon aria-hidden="true" />
        <span>主题色会在这里组成色卡</span>
      </div>
    )
  }

  return (
    <div
      aria-label="按画面占比排列的主题色色带"
      className={styles.paletteRibbon}
      key={palette.map((color) => color.hex).join('-')}
      role="img"
    >
      {palette.map((color, index) => (
        <span
          key={`${color.hex}-${index}`}
          style={{
            backgroundColor: color.hex,
            flexGrow: Math.max(color.proportion, 0.08),
          }}
          title={`${color.hex} · ${formatPaletteShare(color.proportion)}`}
        />
      ))}
    </div>
  )
}

interface ColorCardProps {
  color: PaletteColor
  copied: boolean
  index: number
  onCopy: CopyText
}

function ColorCard({ color, copied, index, onCopy }: ColorCardProps) {
  const copyKey = `color-${index}`
  const handleCopy = useCallback(async (): Promise<void> => {
    await onCopy(color.hex, copyKey)
  }, [color.hex, copyKey, onCopy])

  return (
    <button
      aria-label={
        copied
          ? `已复制主题色 ${index + 1}：${color.hex}`
          : `复制主题色 ${index + 1}：${color.hex}`
      }
      className={styles.colorCard}
      onClick={handleCopy}
      style={{
        backgroundColor: color.hex,
        color: color.textColor,
      }}
      title={`${color.rgb} · ${color.oklch}`}
      type="button"
    >
      <span className={styles.colorCardTopline}>
        <span>主题色 {index + 1}</span>
        {copied ? (
          <CheckIcon aria-hidden="true" />
        ) : (
          <CopyIcon aria-hidden="true" />
        )}
      </span>
      <strong>{copied ? '已复制' : color.hex}</strong>
      <span className={styles.colorShare}>
        画面占比 {formatPaletteShare(color.proportion)}
      </span>
    </button>
  )
}

interface PalettePanelProps {
  colorCountHelpId: string
  copiedKey: string | null
  errorMessage: string | null
  onCopy: CopyText
  onRetry: () => void
  onSliderChange: (value: number | readonly number[]) => void
  onSliderCommit: (value: number | readonly number[]) => void
  palette: PaletteColor[]
  phase: PalettePhase
  sliderColorCount: number
}

function PalettePanel({
  colorCountHelpId,
  copiedKey,
  errorMessage,
  onCopy,
  onRetry,
  onSliderChange,
  onSliderCommit,
  palette,
  phase,
  sliderColorCount,
}: PalettePanelProps) {
  const colorCountLabelId = useId()
  const cssVariables = formatCssVariables(palette)
  const isCssCopied = copiedKey === 'css'
  const handleCopyAll = useCallback(async (): Promise<void> => {
    await onCopy(cssVariables, 'css')
  }, [cssVariables, onCopy])

  return (
    <aside aria-label="主题色色卡" className={styles.palettePanel}>
      <div className={styles.palettePanelBody}>
        <div className={styles.resultHeader}>
          <div>
            <h2>主题色色卡</h2>
            <p>点击色卡复制 HEX 色值。</p>
          </div>
          {phase === 'ready' ? <span>{palette.length} 色</span> : null}
        </div>

        <PaletteRibbon palette={palette} />

        <Field className={styles.countField}>
          <div className={styles.fieldHeader}>
            <FieldLabel id={colorCountLabelId}>色卡数量</FieldLabel>
            <output htmlFor="palette-color-count">{sliderColorCount} 色</output>
          </div>
          <Slider
            aria-describedby={colorCountHelpId}
            aria-labelledby={colorCountLabelId}
            className={styles.colorSlider}
            id="palette-color-count"
            max={MAX_COLOR_COUNT}
            min={MIN_COLOR_COUNT}
            onValueChange={onSliderChange}
            onValueCommitted={onSliderCommit}
            step={1}
            value={[sliderColorCount]}
          />
          <FieldDescription id={colorCountHelpId}>
            可提取 {MIN_COLOR_COUNT} 至 {MAX_COLOR_COUNT}{' '}
            个主色，松开后重新分析。
          </FieldDescription>
        </Field>

        {errorMessage ? (
          <div className={styles.errorMessage} role="alert">
            <span>{errorMessage}</span>
            {phase === 'error' ? (
              <Button onClick={onRetry} size="sm" variant="outline">
                <RefreshCwIcon aria-hidden="true" data-icon="inline-start" />
                重试
              </Button>
            ) : null}
          </div>
        ) : null}

        {palette.length > 0 ? (
          <div className={styles.paletteGrid}>
            {palette.map((color, index) => (
              <ColorCard
                color={color}
                copied={copiedKey === `color-${index}`}
                index={index}
                key={`${color.hex}-${index}`}
                onCopy={onCopy}
              />
            ))}
          </div>
        ) : null}
      </div>

      <footer className={styles.palettePanelFooter}>
        <Button
          className={styles.copyAllButton}
          disabled={palette.length === 0 || phase === 'extracting'}
          onClick={handleCopyAll}
          size="lg"
        >
          {isCssCopied ? (
            <CheckIcon aria-hidden="true" data-icon="inline-start" />
          ) : (
            <CopyIcon aria-hidden="true" data-icon="inline-start" />
          )}
          {isCssCopied ? 'CSS 变量已复制' : '复制整组 CSS 变量'}
        </Button>
      </footer>
    </aside>
  )
}

interface WorkspaceProps extends PalettePanelProps {
  onClear: () => void
  onPickFile: () => void
  source: PaletteSource
}

function Workspace({
  onClear,
  onPickFile,
  source,
  ...palettePanelProps
}: WorkspaceProps) {
  return (
    <div className={styles.workspace}>
      <header className={styles.workspaceHeader}>
        <div className={styles.workspaceActions}>
          <Button onClick={onPickFile} variant="outline">
            <UploadIcon aria-hidden="true" data-icon="inline-start" />
            更换图片
          </Button>
          <Button
            aria-label="清除当前图片"
            onClick={onClear}
            size="icon"
            variant="ghost"
          >
            <XIcon aria-hidden="true" />
          </Button>
        </div>
      </header>

      <div className={styles.editor}>
        <PreviewPanel phase={palettePanelProps.phase} source={source} />
        <PalettePanel {...palettePanelProps} />
      </div>
    </div>
  )
}

export function ColorPaletteTool() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const sourceRef = useRef<PaletteSource | null>(null)
  const sourceUrlRef = useRef<string | null>(null)
  const loadRequestRef = useRef(0)
  const extractionRequestRef = useRef(0)
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [phase, setPhase] = useState<PalettePhase>('idle')
  const [source, setSource] = useState<PaletteSource | null>(null)
  const [palette, setPalette] = useState<PaletteColor[]>([])
  const [colorCount, setColorCount] = useState(DEFAULT_COLOR_COUNT)
  const [sliderColorCount, setSliderColorCount] = useState(DEFAULT_COLOR_COUNT)
  const [retryKey, setRetryKey] = useState(0)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [copyAnnouncement, setCopyAnnouncement] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const colorCountHelpId = useId()

  sourceRef.current = source

  const revokeSourceUrl = useCallback((): void => {
    if (sourceUrlRef.current) {
      URL.revokeObjectURL(sourceUrlRef.current)
      sourceUrlRef.current = null
    }
  }, [])

  const clearCopyTimer = useCallback((): void => {
    if (copyTimerRef.current) {
      clearTimeout(copyTimerRef.current)
      copyTimerRef.current = null
    }
  }, [])

  useEffect(
    () => () => {
      clearCopyTimer()
      revokeSourceUrl()
    },
    [clearCopyTimer, revokeSourceUrl]
  )

  const openFilePicker = useCallback((): void => {
    fileInputRef.current?.click()
  }, [])

  const loadFile = useCallback(
    async (file: File): Promise<void> => {
      loadRequestRef.current += 1
      const requestId = loadRequestRef.current
      setPhase('decoding')
      setErrorMessage(null)
      setCopiedKey(null)
      setCopyAnnouncement('')

      try {
        const prepared = await prepareBrowserImage(file)
        if (requestId !== loadRequestRef.current) {
          return
        }

        revokeSourceUrl()
        const url = URL.createObjectURL(prepared.sourceBlob)
        sourceUrlRef.current = url
        const nextSource: PaletteSource = {
          dimensions: prepared.dimensions,
          fileName: file.name || 'image.png',
          fileSize: file.size,
          frozenAnimation: prepared.frozenAnimation,
          sourceBlob: prepared.sourceBlob,
          url,
        }
        sourceRef.current = nextSource
        setSource(nextSource)
        setPalette([])
        setPhase('extracting')
      } catch (error) {
        if (requestId !== loadRequestRef.current) {
          return
        }
        setErrorMessage(getErrorMessage(error))
        setPhase(sourceRef.current ? 'ready' : 'idle')
      } finally {
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
      }
    },
    [revokeSourceUrl]
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
    if (!source) {
      return
    }

    extractionRequestRef.current += 1
    const requestId = extractionRequestRef.current
    const abortController = new AbortController()
    setPhase('extracting')
    setErrorMessage(null)

    const runExtraction = async (): Promise<void> => {
      try {
        const nextPalette = await extractThemePalette({
          blob: source.sourceBlob,
          colorCount,
          dimensions: source.dimensions,
          signal: abortController.signal,
        })
        if (requestId !== extractionRequestRef.current) {
          return
        }
        setPalette(nextPalette)
        setPhase('ready')
      } catch (error) {
        if (
          abortController.signal.aborted ||
          requestId !== extractionRequestRef.current ||
          isAbortError(error)
        ) {
          return
        }
        setErrorMessage(getErrorMessage(error))
        setPhase('error')
      }
    }

    runExtraction().catch(() => undefined)
    return () => abortController.abort()
  }, [colorCount, retryKey, source])

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
        setErrorMessage('拖入的内容中没有可读取的图片。')
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

  const clearSource = useCallback((): void => {
    loadRequestRef.current += 1
    extractionRequestRef.current += 1
    revokeSourceUrl()
    sourceRef.current = null
    setSource(null)
    setPalette([])
    setErrorMessage(null)
    setCopiedKey(null)
    setCopyAnnouncement('')
    setPhase('idle')
  }, [revokeSourceUrl])

  const handleSliderChange = useCallback(
    (value: number | readonly number[]): void => {
      setSliderColorCount(getSliderNumber(value))
    },
    []
  )

  const handleSliderCommit = useCallback(
    (value: number | readonly number[]): void => {
      const nextValue = getSliderNumber(value)
      setSliderColorCount(nextValue)
      setColorCount(nextValue)
    },
    []
  )

  const retryExtraction = useCallback((): void => {
    setRetryKey((current) => current + 1)
  }, [])

  const copyText = useCallback(
    async (value: string, key: string): Promise<void> => {
      try {
        if (!navigator.clipboard?.writeText) {
          throw new Error('当前浏览器不支持剪贴板写入。')
        }
        await navigator.clipboard.writeText(value)
        clearCopyTimer()
        setCopiedKey(key)
        setCopyAnnouncement(
          key === 'css' ? '已复制整组 CSS 变量。' : `已复制 ${value}。`
        )
        setErrorMessage(null)
        copyTimerRef.current = setTimeout(() => {
          setCopiedKey(null)
          setCopyAnnouncement('')
          copyTimerRef.current = null
        }, COPY_FEEDBACK_DURATION)
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? `${error.message} 请检查浏览器权限后重试。`
            : '复制失败，请检查浏览器权限后重试。'
        )
      }
    },
    [clearCopyTimer]
  )

  const primaryColor = palette[0]?.hex ?? 'var(--primary)'
  const secondaryColor = palette[1]?.hex ?? primaryColor
  const toolStyle: PaletteToolStyle = {
    '--palette-primary': primaryColor,
    '--palette-secondary': secondaryColor,
  }
  const statusMessage =
    copyAnnouncement ||
    getStatusMessage({
      colorCount,
      paletteSize: palette.length,
      phase,
    })

  return (
    <section
      className={styles.tool}
      data-dragging={isDragging ? '' : undefined}
      data-has-palette={palette.length > 0 ? '' : undefined}
      style={toolStyle}
    >
      <h1 className={styles.visuallyHidden}>图片主题色提取</h1>
      <input
        accept={ACCEPTED_IMAGE_TYPES}
        className={styles.fileInput}
        onChange={handleFileChange}
        ref={fileInputRef}
        type="file"
      />
      <p aria-live="polite" className={styles.srStatus} role="status">
        {statusMessage}
      </p>

      {source ? (
        <Workspace
          colorCountHelpId={colorCountHelpId}
          copiedKey={copiedKey}
          errorMessage={errorMessage}
          onClear={clearSource}
          onCopy={copyText}
          onPickFile={openFilePicker}
          onRetry={retryExtraction}
          onSliderChange={handleSliderChange}
          onSliderCommit={handleSliderCommit}
          palette={palette}
          phase={phase}
          sliderColorCount={sliderColorCount}
          source={source}
        />
      ) : (
        <EmptyState
          errorMessage={errorMessage}
          onPickFile={openFilePicker}
          phase={phase}
        />
      )}

      {isDragging ? <DropOverlay /> : null}
    </section>
  )
}
