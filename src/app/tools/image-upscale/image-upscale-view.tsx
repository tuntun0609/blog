import {
  ArrowLeftRightIcon,
  DownloadIcon,
  ImageIcon,
  LinkIcon,
  LoaderCircleIcon,
  LockIcon,
  LockOpenIcon,
  Maximize2Icon,
  RotateCcwIcon,
  SparklesIcon,
  UploadIcon,
  XIcon,
} from 'lucide-react'
import type {
  ChangeEvent,
  CSSProperties,
  KeyboardEvent,
  RefObject,
} from 'react'
import { useCallback, useId } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { ACCEPTED_IMAGE_TYPES } from '@/lib/browser-image'
import {
  type DimensionDraft,
  formatBytes,
  type ImageDimensions,
  type ImageUpscaleMode,
  type InterpolationMode,
  MAX_AI_INPUT_PIXELS,
  MAX_INPUT_PIXELS,
  MODEL_DOWNLOAD_BYTES,
  type OutputFormat,
  type ProcessingBackend,
  type ProgressState,
  type ResizePreset,
  type SourceImage,
  type ToolError,
  type ToolPhase,
  type UpscaleResult,
} from './image-upscale-model'
import styles from './image-upscale-tool.module.css'

const BACKEND_LABELS: Record<ProcessingBackend, string> = {
  wasm: '兼容模式',
  webgpu: 'WebGPU',
}

const FORMAT_LABELS: Record<OutputFormat, string> = {
  jpeg: 'JPEG',
  png: 'PNG',
  webp: 'WebP',
}

const STAGE_LABELS = {
  downloading: '正在下载 AI 超分模型',
  encoding: '正在生成结果图片',
  initializing: '正在初始化本地模型',
  resizing: '正在放大图片',
  upscaling: '正在重建图片细节',
} as const

interface ProcessButtonContentProps {
  isBusy: boolean
  mode: ImageUpscaleMode
  phase: ToolPhase
}

const ProcessButtonContent = ({
  isBusy,
  mode,
  phase,
}: ProcessButtonContentProps) => {
  let label = '开始放大'
  let icon = <Maximize2Icon data-icon="inline-start" />

  if (isBusy) {
    label = '正在处理'
    icon = (
      <LoaderCircleIcon
        className={styles.loadingIcon}
        data-icon="inline-start"
      />
    )
  } else if (phase === 'error') {
    label = '重试'
    icon = <RotateCcwIcon data-icon="inline-start" />
  } else if (mode === 'ai') {
    icon = <SparklesIcon data-icon="inline-start" />
  }

  return (
    <>
      {icon}
      {label}
    </>
  )
}

export interface ImageUpscaleViewProps {
  aspectLocked: boolean
  comparisonHelpId: string
  comparisonPosition: number
  defaultBackend: ProcessingBackend
  dimensionDraft: DimensionDraft
  dimensionIssue: string | null
  error: ToolError | null
  fileInputRef: RefObject<HTMLInputElement | null>
  interpolation: InterpolationMode
  isBusy: boolean
  isDragging: boolean
  mode: ImageUpscaleMode
  onAspectLockChange: () => void
  onCancel: () => void
  onComparisonChange: (event: ChangeEvent<HTMLInputElement>) => void
  onComparisonKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void
  onDimensionChange: (field: keyof DimensionDraft, value: string) => void
  onDownload: () => void
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => Promise<void>
  onInterpolationChange: (interpolation: InterpolationMode) => void
  onModeChange: (mode: ImageUpscaleMode) => void
  onOpenFile: () => void
  onProcess: () => Promise<void>
  onResizePresetChange: (preset: ResizePreset) => void
  onRetry: () => Promise<void>
  onShowOriginal: () => void
  onShowResult: () => void
  phase: ToolPhase
  progress: ProgressState | null
  resizePreset: ResizePreset
  result: UpscaleResult | null
  source: SourceImage | null
  statusMessage: string
  targetDimensions: ImageDimensions | null
}

interface ImagePreviewProps {
  comparisonHelpId: string
  comparisonPosition: number
  onCancel: () => void
  onComparisonChange: (event: ChangeEvent<HTMLInputElement>) => void
  onComparisonKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void
  onShowOriginal: () => void
  onShowResult: () => void
  phase: ToolPhase
  progress: ProgressState | null
  result: UpscaleResult | null
  source: SourceImage
}

const ImagePreview = ({
  comparisonHelpId,
  comparisonPosition,
  onCancel,
  onComparisonChange,
  onComparisonKeyDown,
  onShowOriginal,
  onShowResult,
  phase,
  progress,
  result,
  source,
}: ImagePreviewProps) => {
  const previewDimensions = result?.dimensions ?? source.dimensions
  const aspectRatio = previewDimensions.width / previewDimensions.height
  const previewStyle = {
    '--comparison-position': `${comparisonPosition}%`,
    '--preview-compact-max-width': `${58 * aspectRatio}svh`,
    '--preview-max-width': `${62 * aspectRatio}svh`,
    aspectRatio: `${previewDimensions.width} / ${previewDimensions.height}`,
  } as CSSProperties
  let progressLabel = progress ? STAGE_LABELS[progress.stage] : ''
  if (
    progress?.completedTiles !== undefined &&
    progress.totalTiles !== undefined
  ) {
    progressLabel = `${progressLabel} · ${progress.completedTiles}/${progress.totalTiles}`
  }

  return (
    <div className={styles.previewColumn}>
      <div className={styles.previewToolbar}>
        <div className={styles.previewIdentity}>
          <ImageIcon aria-hidden="true" />
          <span>{result ? '处理结果' : '原图预览'}</span>
        </div>
        {result ? (
          <div className={styles.viewButtons}>
            <Button
              aria-pressed={comparisonPosition === 100}
              onClick={onShowOriginal}
              size="sm"
              variant="outline"
            >
              原图
            </Button>
            <Button
              aria-pressed={comparisonPosition === 0}
              onClick={onShowResult}
              size="sm"
              variant="outline"
            >
              结果
            </Button>
          </div>
        ) : (
          <Badge variant="secondary">
            {source.dimensions.width.toLocaleString('zh-CN')} ×{' '}
            {source.dimensions.height.toLocaleString('zh-CN')}
          </Badge>
        )}
      </div>

      <div
        className={styles.previewStage}
        data-comparison-edge={
          comparisonPosition === 0 || comparisonPosition === 100
            ? 'true'
            : undefined
        }
        data-has-result={result ? 'true' : 'false'}
        style={previewStyle}
      >
        <img
          alt="待放大的原图预览"
          className={styles.sourceImage}
          height={previewDimensions.height}
          src={source.url}
          width={previewDimensions.width}
        />
        {result ? (
          <>
            <img
              alt="放大后的结果图片"
              className={styles.resultImage}
              height={result.dimensions.height}
              src={result.url}
              width={result.dimensions.width}
            />
            <Badge className={styles.originalBadge} variant="secondary">
              原图
            </Badge>
            <Badge className={styles.resultBadge} variant="secondary">
              结果
            </Badge>
            <div aria-hidden="true" className={styles.compareDivider}>
              <span>
                <ArrowLeftRightIcon />
              </span>
            </div>
            <input
              aria-describedby={comparisonHelpId}
              aria-label="原图与放大结果的比较位置"
              className={styles.compareRange}
              max={100}
              min={0}
              onChange={onComparisonChange}
              onKeyDown={onComparisonKeyDown}
              type="range"
              value={comparisonPosition}
            />
          </>
        ) : null}

        {phase === 'processing' && progress ? (
          <div className={styles.processingOverlay}>
            <LoaderCircleIcon aria-hidden="true" />
            <strong>{progressLabel}</strong>
            <span>
              {progress.backend
                ? BACKEND_LABELS[progress.backend]
                : '浏览器本地处理'}
            </span>
            <progress
              aria-label={STAGE_LABELS[progress.stage]}
              max={100}
              value={progress.progress ?? undefined}
            />
            <Button onClick={onCancel} size="sm" variant="outline">
              <XIcon data-icon="inline-start" />
              取消
            </Button>
          </div>
        ) : null}
      </div>

      {result ? (
        <p className={styles.compareHelp} id={comparisonHelpId}>
          拖动分隔线比较；方向键每次移动 1%，按住 Shift 移动 10%。
        </p>
      ) : (
        <p className={styles.compareHelp}>调整右侧设置，然后开始放大。</p>
      )}
    </div>
  )
}

interface InspectorProps {
  aspectLocked: boolean
  defaultBackend: ProcessingBackend
  dimensionDraft: DimensionDraft
  dimensionIssue: string | null
  error: ToolError | null
  interpolation: InterpolationMode
  isBusy: boolean
  mode: ImageUpscaleMode
  onAspectLockChange: () => void
  onDimensionChange: (field: keyof DimensionDraft, value: string) => void
  onDownload: () => void
  onInterpolationChange: (interpolation: InterpolationMode) => void
  onModeChange: (mode: ImageUpscaleMode) => void
  onOpenFile: () => void
  onProcess: () => Promise<void>
  onResizePresetChange: (preset: ResizePreset) => void
  onRetry: () => Promise<void>
  phase: ToolPhase
  resizePreset: ResizePreset
  result: UpscaleResult | null
  source: SourceImage
  targetDimensions: ImageDimensions | null
}

interface DimensionControlsProps {
  aspectLocked: boolean
  dimensionDraft: DimensionDraft
  dimensionIssue: string | null
  isBusy: boolean
  mode: ImageUpscaleMode
  onAspectLockChange: () => void
  onDimensionChange: (field: keyof DimensionDraft, value: string) => void
  targetDimensions: ImageDimensions | null
}

const DimensionControls = ({
  aspectLocked,
  dimensionDraft,
  dimensionIssue,
  isBusy,
  mode,
  onAspectLockChange,
  onDimensionChange,
  targetDimensions,
}: DimensionControlsProps) => {
  const widthInputId = useId()
  const heightInputId = useId()
  const isInvalid = dimensionIssue !== null
  const inputsDisabled = isBusy || mode === 'ai'
  let widthValue = dimensionDraft.width
  let heightValue = dimensionDraft.height
  if (mode === 'ai') {
    widthValue = String(targetDimensions?.width ?? '')
    heightValue = String(targetDimensions?.height ?? '')
  }
  const handleWidthChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>): void => {
      onDimensionChange('width', event.currentTarget.value)
    },
    [onDimensionChange]
  )
  const handleHeightChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>): void => {
      onDimensionChange('height', event.currentTarget.value)
    },
    [onDimensionChange]
  )

  return (
    <Field data-invalid={isInvalid || undefined}>
      <div className={styles.dimensionHeading}>
        <FieldLabel>输出尺寸</FieldLabel>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                aria-label={aspectLocked ? '解锁宽高比' : '锁定宽高比'}
                disabled={inputsDisabled}
                onClick={onAspectLockChange}
                size="icon-xs"
                type="button"
                variant="ghost"
              />
            }
          >
            {aspectLocked ? <LockIcon /> : <LockOpenIcon />}
          </TooltipTrigger>
          <TooltipContent>
            {aspectLocked ? '宽高比已锁定' : '宽高可独立修改'}
          </TooltipContent>
        </Tooltip>
      </div>
      <div className={styles.dimensionInputs}>
        <Field>
          <FieldLabel className="sr-only" htmlFor={widthInputId}>
            输出宽度
          </FieldLabel>
          <Input
            aria-invalid={isInvalid || undefined}
            disabled={inputsDisabled}
            id={widthInputId}
            inputMode="numeric"
            min={1}
            onChange={handleWidthChange}
            type="number"
            value={widthValue}
          />
          <span aria-hidden="true">宽</span>
        </Field>
        <LinkIcon aria-hidden="true" />
        <Field>
          <FieldLabel className="sr-only" htmlFor={heightInputId}>
            输出高度
          </FieldLabel>
          <Input
            aria-invalid={isInvalid || undefined}
            disabled={inputsDisabled}
            id={heightInputId}
            inputMode="numeric"
            min={1}
            onChange={handleHeightChange}
            type="number"
            value={heightValue}
          />
          <span aria-hidden="true">高</span>
        </Field>
      </div>
      {dimensionIssue ? <FieldError>{dimensionIssue}</FieldError> : null}
    </Field>
  )
}

interface InspectorActionsProps {
  defaultBackend: ProcessingBackend
  dimensionIssue: string | null
  isBusy: boolean
  mode: ImageUpscaleMode
  onDownload: () => void
  onOpenFile: () => void
  onProcess: () => Promise<void>
  onRetry: () => Promise<void>
  phase: ToolPhase
  result: UpscaleResult | null
}

const InspectorActions = ({
  defaultBackend,
  dimensionIssue,
  isBusy,
  mode,
  onDownload,
  onOpenFile,
  onProcess,
  onRetry,
  phase,
  result,
}: InspectorActionsProps) => {
  if (result) {
    return (
      <div className={styles.resultActions}>
        <div className={styles.resultHeading}>
          <div>
            <h2>图片已放大</h2>
            <p>
              {result.dimensions.width.toLocaleString('zh-CN')} ×{' '}
              {result.dimensions.height.toLocaleString('zh-CN')} px ·{' '}
              {FORMAT_LABELS[result.format]} · {formatBytes(result.blob.size)}
            </p>
          </div>
          <Badge variant="secondary">完成</Badge>
        </div>
        <Button onClick={onDownload} size="lg">
          <DownloadIcon data-icon="inline-start" />
          下载图片
        </Button>
        <Button onClick={onOpenFile} size="lg" variant="outline">
          换一张图片
        </Button>
      </div>
    )
  }

  const action = phase === 'error' ? onRetry : onProcess
  return (
    <div className={styles.processActions}>
      <div className={styles.backendSummary}>
        <span>本地处理</span>
        <Badge variant="outline">
          {mode === 'ai' ? `${BACKEND_LABELS[defaultBackend]} 优先` : 'Canvas'}
        </Badge>
      </div>
      {mode === 'ai' ? (
        <p>
          首次需下载约 {formatBytes(MODEL_DOWNLOAD_BYTES[defaultBackend])}{' '}
          模型，随后复用浏览器缓存。
        </p>
      ) : (
        <p>无需下载模型，图片直接在浏览器画布中处理。</p>
      )}
      <Button
        disabled={isBusy || dimensionIssue !== null}
        onClick={action}
        size="lg"
      >
        <ProcessButtonContent isBusy={isBusy} mode={mode} phase={phase} />
      </Button>
    </div>
  )
}

const Inspector = ({
  aspectLocked,
  defaultBackend,
  dimensionDraft,
  dimensionIssue,
  error,
  interpolation,
  isBusy,
  mode,
  onAspectLockChange,
  onDimensionChange,
  onDownload,
  onInterpolationChange,
  onModeChange,
  onOpenFile,
  onProcess,
  onResizePresetChange,
  onRetry,
  phase,
  resizePreset,
  result,
  source,
  targetDimensions,
}: InspectorProps) => {
  const handleModeValues = (values: string[]): void => {
    const [value] = values
    if (value === 'ai' || value === 'standard') {
      onModeChange(value)
    }
  }
  const handlePresetValues = (values: string[]): void => {
    const [value] = values
    if (value === '2' || value === '3' || value === '4' || value === 'custom') {
      onResizePresetChange(value)
    }
  }
  const handleInterpolationValues = (values: string[]): void => {
    const [value] = values
    if (value === 'pixelated' || value === 'smooth') {
      onInterpolationChange(value)
    }
  }

  return (
    <aside className={styles.inspector}>
      <div className={styles.fileSummary}>
        <div>
          <h2>{source.fileName}</h2>
          <p>
            {source.dimensions.width.toLocaleString('zh-CN')} ×{' '}
            {source.dimensions.height.toLocaleString('zh-CN')} px ·{' '}
            {formatBytes(source.fileSize)}
          </p>
        </div>
        <Button
          aria-label="更换图片"
          disabled={isBusy}
          onClick={onOpenFile}
          size="icon-sm"
          variant="outline"
        >
          <ImageIcon />
        </Button>
      </div>

      <FieldGroup className={styles.settings}>
        <Field>
          <FieldLabel>放大方式</FieldLabel>
          <ToggleGroup
            aria-label="选择放大方式"
            className={styles.segmentedControl}
            disabled={isBusy}
            onValueChange={handleModeValues}
            value={[mode]}
            variant="outline"
          >
            <ToggleGroupItem value="ai">
              <SparklesIcon aria-hidden="true" data-icon="inline-start" />
              AI 超分
            </ToggleGroupItem>
            <ToggleGroupItem value="standard">
              <Maximize2Icon aria-hidden="true" data-icon="inline-start" />
              普通放大
            </ToggleGroupItem>
          </ToggleGroup>
          <FieldDescription>
            {mode === 'ai'
              ? 'Swin2SR 在本地重建细节，固定放大 2×。'
              : '不使用 AI，只按所选插值放大像素。'}
          </FieldDescription>
        </Field>

        <Field>
          <FieldLabel>放大倍率</FieldLabel>
          {mode === 'ai' ? (
            <div className={styles.fixedScale}>
              <strong>2×</strong>
              <span>模型固定倍率</span>
            </div>
          ) : (
            <ToggleGroup
              aria-label="选择普通放大倍率"
              className={styles.scaleControl}
              disabled={isBusy}
              onValueChange={handlePresetValues}
              value={[resizePreset]}
              variant="outline"
            >
              <ToggleGroupItem value="2">2×</ToggleGroupItem>
              <ToggleGroupItem value="3">3×</ToggleGroupItem>
              <ToggleGroupItem value="4">4×</ToggleGroupItem>
              <ToggleGroupItem value="custom">自定义</ToggleGroupItem>
            </ToggleGroup>
          )}
        </Field>

        <DimensionControls
          aspectLocked={aspectLocked}
          dimensionDraft={dimensionDraft}
          dimensionIssue={dimensionIssue}
          isBusy={isBusy}
          mode={mode}
          onAspectLockChange={onAspectLockChange}
          onDimensionChange={onDimensionChange}
          targetDimensions={targetDimensions}
        />

        {mode === 'standard' ? (
          <Field>
            <FieldLabel>插值方式</FieldLabel>
            <ToggleGroup
              aria-label="选择普通放大的插值方式"
              className={styles.segmentedControl}
              disabled={isBusy}
              onValueChange={handleInterpolationValues}
              value={[interpolation]}
              variant="outline"
            >
              <ToggleGroupItem value="smooth">平滑</ToggleGroupItem>
              <ToggleGroupItem value="pixelated">像素清晰</ToggleGroupItem>
            </ToggleGroup>
            <FieldDescription>
              {interpolation === 'smooth'
                ? '适合照片和大多数普通图片。'
                : '使用最近邻放大，保留像素块边缘。'}
            </FieldDescription>
          </Field>
        ) : null}
      </FieldGroup>

      {source.frozenAnimation ? (
        <p className={styles.notice}>动画图片已按首帧载入，输出为静态图片。</p>
      ) : null}

      {error ? (
        <div className={styles.processError} role="alert">
          <strong>处理没有完成</strong>
          <p>{error.message}</p>
        </div>
      ) : null}

      <Separator />

      <InspectorActions
        defaultBackend={defaultBackend}
        dimensionIssue={dimensionIssue}
        isBusy={isBusy}
        mode={mode}
        onDownload={onDownload}
        onOpenFile={onOpenFile}
        onProcess={onProcess}
        onRetry={onRetry}
        phase={phase}
        result={result}
      />
    </aside>
  )
}

interface WorkspaceProps
  extends Omit<
    ImageUpscaleViewProps,
    'fileInputRef' | 'isDragging' | 'onFileChange' | 'source' | 'statusMessage'
  > {
  source: SourceImage
}

const Workspace = ({
  aspectLocked,
  comparisonHelpId,
  comparisonPosition,
  defaultBackend,
  dimensionDraft,
  dimensionIssue,
  error,
  interpolation,
  isBusy,
  mode,
  onAspectLockChange,
  onCancel,
  onComparisonChange,
  onComparisonKeyDown,
  onDimensionChange,
  onDownload,
  onInterpolationChange,
  onModeChange,
  onOpenFile,
  onProcess,
  onResizePresetChange,
  onRetry,
  onShowOriginal,
  onShowResult,
  phase,
  progress,
  resizePreset,
  result,
  source,
  targetDimensions,
}: WorkspaceProps) => (
  <main className={styles.workspace}>
    <header className={styles.workspaceHeader}>
      <p>AI 超分或普通像素放大，全程在当前浏览器完成。</p>
    </header>

    <section aria-label="图片放大工作区" className={styles.editor}>
      <ImagePreview
        comparisonHelpId={comparisonHelpId}
        comparisonPosition={comparisonPosition}
        onCancel={onCancel}
        onComparisonChange={onComparisonChange}
        onComparisonKeyDown={onComparisonKeyDown}
        onShowOriginal={onShowOriginal}
        onShowResult={onShowResult}
        phase={phase}
        progress={progress}
        result={result}
        source={source}
      />
      <Inspector
        aspectLocked={aspectLocked}
        defaultBackend={defaultBackend}
        dimensionDraft={dimensionDraft}
        dimensionIssue={dimensionIssue}
        error={error}
        interpolation={interpolation}
        isBusy={isBusy}
        mode={mode}
        onAspectLockChange={onAspectLockChange}
        onDimensionChange={onDimensionChange}
        onDownload={onDownload}
        onInterpolationChange={onInterpolationChange}
        onModeChange={onModeChange}
        onOpenFile={onOpenFile}
        onProcess={onProcess}
        onResizePresetChange={onResizePresetChange}
        onRetry={onRetry}
        phase={phase}
        resizePreset={resizePreset}
        result={result}
        source={source}
        targetDimensions={targetDimensions}
      />
    </section>

    <footer className={styles.dataBoundary}>
      <p>图片和结果只保留在当前页面内存中，关闭或刷新后不会保留。</p>
      <p>推理：Transformers.js · 模型：Swin2SR lightweight 2×</p>
    </footer>
  </main>
)

const EmptyState = ({
  error,
  onOpenFile,
  phase,
}: Pick<ImageUpscaleViewProps, 'error' | 'onOpenFile' | 'phase'>) => (
  <main className={styles.emptyState}>
    <header className={styles.intro}>
      <p>选择一张图片，用 AI 重建细节，或只放大原有像素。</p>
    </header>
    <button
      className={styles.dropButton}
      disabled={phase === 'decoding'}
      onClick={onOpenFile}
      type="button"
    >
      <Empty className={styles.dropZone}>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            {phase === 'decoding' ? (
              <LoaderCircleIcon className={styles.loadingIcon} />
            ) : (
              <UploadIcon />
            )}
          </EmptyMedia>
          <EmptyTitle>
            {phase === 'decoding' ? '正在读取图片' : '拖入图片或点击选择'}
          </EmptyTitle>
          <EmptyDescription>
            支持 JPEG、PNG、WebP、AVIF、GIF 和 BMP，原图最大{' '}
            {Math.round(MAX_INPUT_PIXELS / 1_000_000)}MP。
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <span className={styles.pickFileLabel}>选择一张图片</span>
          <span>
            图片不会上传；AI 超分适合不超过{' '}
            {Math.round(MAX_AI_INPUT_PIXELS / 1_000_000)}MP 的原图。
          </span>
        </EmptyContent>
      </Empty>
    </button>
    {error ? (
      <p className={styles.emptyError} role="alert">
        {error.message}
      </p>
    ) : null}
  </main>
)

export function ImageUpscaleView({
  aspectLocked,
  comparisonHelpId,
  comparisonPosition,
  defaultBackend,
  dimensionDraft,
  dimensionIssue,
  error,
  fileInputRef,
  interpolation,
  isBusy,
  isDragging,
  mode,
  onAspectLockChange,
  onCancel,
  onComparisonChange,
  onComparisonKeyDown,
  onDimensionChange,
  onDownload,
  onFileChange,
  onInterpolationChange,
  onModeChange,
  onOpenFile,
  onProcess,
  onResizePresetChange,
  onRetry,
  onShowOriginal,
  onShowResult,
  phase,
  progress,
  resizePreset,
  result,
  source,
  statusMessage,
  targetDimensions,
}: ImageUpscaleViewProps) {
  return (
    <TooltipProvider>
      <div className={styles.tool} data-dragging={isDragging || undefined}>
        <Input
          accept={ACCEPTED_IMAGE_TYPES}
          aria-label="选择要放大的图片"
          className={styles.fileInput}
          onChange={onFileChange}
          ref={fileInputRef}
          type="file"
        />

        {source ? (
          <Workspace
            aspectLocked={aspectLocked}
            comparisonHelpId={comparisonHelpId}
            comparisonPosition={comparisonPosition}
            defaultBackend={defaultBackend}
            dimensionDraft={dimensionDraft}
            dimensionIssue={dimensionIssue}
            error={error}
            interpolation={interpolation}
            isBusy={isBusy}
            mode={mode}
            onAspectLockChange={onAspectLockChange}
            onCancel={onCancel}
            onComparisonChange={onComparisonChange}
            onComparisonKeyDown={onComparisonKeyDown}
            onDimensionChange={onDimensionChange}
            onDownload={onDownload}
            onInterpolationChange={onInterpolationChange}
            onModeChange={onModeChange}
            onOpenFile={onOpenFile}
            onProcess={onProcess}
            onResizePresetChange={onResizePresetChange}
            onRetry={onRetry}
            onShowOriginal={onShowOriginal}
            onShowResult={onShowResult}
            phase={phase}
            progress={progress}
            resizePreset={resizePreset}
            result={result}
            source={source}
            targetDimensions={targetDimensions}
          />
        ) : (
          <EmptyState error={error} onOpenFile={onOpenFile} phase={phase} />
        )}

        {isDragging ? (
          <div className={styles.dragOverlay}>
            <UploadIcon aria-hidden="true" />
            <strong>松开即可载入图片</strong>
          </div>
        ) : null}

        <p aria-live="polite" className={styles.srStatus}>
          {statusMessage}
        </p>
      </div>
    </TooltipProvider>
  )
}
