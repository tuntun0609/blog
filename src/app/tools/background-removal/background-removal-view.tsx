import {
  ArrowLeftRightIcon,
  DownloadIcon,
  ImageIcon,
  LoaderCircleIcon,
  RotateCcwIcon,
  UploadIcon,
  XIcon,
} from 'lucide-react'
import type {
  ChangeEvent,
  CSSProperties,
  KeyboardEvent,
  RefObject,
} from 'react'
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
import { Input } from '@/components/ui/input'
import { ACCEPTED_IMAGE_TYPES } from '@/lib/browser-image'
import {
  formatBytes,
  MODEL_DOWNLOAD_BYTES,
  type ProcessingBackend,
  type ProgressState,
  type RemovalResult,
  type SourceImage,
  type ToolError,
  type ToolPhase,
} from './background-removal-model'
import styles from './background-removal-tool.module.css'

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

interface BackgroundRemovalViewProps {
  comparisonHelpId: string
  comparisonPosition: number
  defaultBackend: ProcessingBackend
  error: ToolError | null
  fileInputRef: RefObject<HTMLInputElement | null>
  isBusy: boolean
  isDragging: boolean
  onCancel: () => void
  onComparisonChange: (event: ChangeEvent<HTMLInputElement>) => void
  onComparisonKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void
  onDownload: () => void
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => Promise<void>
  onOpenFile: () => void
  onProcessCompatibility: () => Promise<void>
  onProcessDefault: () => Promise<void>
  onRetry: () => Promise<void>
  onShowOriginal: () => void
  onShowResult: () => void
  phase: ToolPhase
  progress: ProgressState | null
  result: RemovalResult | null
  source: SourceImage | null
  statusMessage: string
}

interface PreviewProps {
  comparisonHelpId: string
  comparisonPosition: number
  onCancel: () => void
  onComparisonChange: (event: ChangeEvent<HTMLInputElement>) => void
  onComparisonKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void
  onShowOriginal: () => void
  onShowResult: () => void
  phase: ToolPhase
  progress: ProgressState | null
  result: RemovalResult | null
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
}: PreviewProps) => {
  const sourceAspectRatio = source.dimensions.width / source.dimensions.height
  const comparisonStyle = {
    '--comparison-position': `${comparisonPosition}%`,
    '--preview-compact-max-width': `${62 * sourceAspectRatio}svh`,
    '--preview-max-width': `${66 * sourceAspectRatio}svh`,
    aspectRatio: `${source.dimensions.width} / ${source.dimensions.height}`,
  } as CSSProperties

  return (
    <div className={styles.previewColumn}>
      {result ? (
        <div className={styles.comparisonToolbar}>
          <div className={styles.viewButtons}>
            <Button
              aria-pressed={comparisonPosition === 0}
              onClick={onShowOriginal}
              size="sm"
              variant="outline"
            >
              原图
            </Button>
            <Button
              aria-pressed={comparisonPosition === 100}
              onClick={onShowResult}
              size="sm"
              variant="outline"
            >
              去背图
            </Button>
          </div>
          <span>拖动手柄比较</span>
        </div>
      ) : null}

      <div
        className={styles.previewStage}
        data-comparison-edge={
          comparisonPosition === 0 || comparisonPosition === 100
            ? 'true'
            : undefined
        }
        data-has-result={result ? 'true' : 'false'}
        style={comparisonStyle}
      >
        <img
          alt="原图预览"
          className={styles.sourceImage}
          height={source.dimensions.height}
          src={source.url}
          width={source.dimensions.width}
        />
        {result ? (
          <>
            <img
              alt="去除背景后的图片"
              className={styles.resultImage}
              height={source.dimensions.height}
              src={result.url}
              width={source.dimensions.width}
            />
            <div aria-hidden="true" className={styles.compareDivider}>
              <span>
                <ArrowLeftRightIcon />
              </span>
            </div>
            <input
              aria-describedby={comparisonHelpId}
              aria-label="原图与去背图比较位置"
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
            <strong>{STAGE_LABELS[progress.stage]}</strong>
            <span>{BACKEND_LABELS[progress.backend]}</span>
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
          方向键每次移动 1%，按住 Shift 每次移动 10%。
        </p>
      ) : null}
    </div>
  )
}

interface InspectorProps {
  defaultBackend: ProcessingBackend
  error: ToolError | null
  isBusy: boolean
  onDownload: () => void
  onOpenFile: () => void
  onProcessCompatibility: () => Promise<void>
  onProcessDefault: () => Promise<void>
  onRetry: () => Promise<void>
  phase: ToolPhase
  result: RemovalResult | null
  source: SourceImage
}

const Inspector = ({
  defaultBackend,
  error,
  isBusy,
  onDownload,
  onOpenFile,
  onProcessCompatibility,
  onProcessDefault,
  onRetry,
  phase,
  result,
  source,
}: InspectorProps) => (
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
    </div>

    {source.frozenAnimation ? (
      <p className={styles.notice}>动画图片已按首帧载入，输出为静态 PNG。</p>
    ) : null}

    {error ? (
      <div className={styles.errorMessage} role="alert">
        <strong>处理没有完成</strong>
        <p>{error.message}</p>
        <div className={styles.errorActions}>
          {error.code === 'invalid-image' ? (
            <Button onClick={onOpenFile}>重新选择图片</Button>
          ) : null}
          {error.code === 'webgpu-unavailable' ? (
            <Button onClick={onProcessCompatibility}>使用兼容模式</Button>
          ) : null}
          {error.code !== 'invalid-image' &&
          error.code !== 'webgpu-unavailable' ? (
            <Button onClick={onRetry}>
              <RotateCcwIcon data-icon="inline-start" />
              重试
            </Button>
          ) : null}
          {error.code === 'invalid-image' ? null : (
            <Button onClick={onOpenFile} variant="outline">
              更换图片
            </Button>
          )}
        </div>
      </div>
    ) : null}

    {result ? (
      <div className={styles.resultActions}>
        <div className={styles.resultHeading}>
          <div>
            <h2>透明 PNG 已生成</h2>
            <p>
              {formatBytes(result.blob.size)} · {BACKEND_LABELS[result.backend]}
            </p>
          </div>
          <Badge variant="secondary">完成</Badge>
        </div>
        <Button onClick={onDownload} size="lg">
          <DownloadIcon data-icon="inline-start" />
          下载透明 PNG
        </Button>
        <Button onClick={onOpenFile} size="lg" variant="outline">
          换一张图片
        </Button>
      </div>
    ) : (
      <div className={styles.startPanel}>
        <div>
          <h2>准备去除背景</h2>
          <p>首次使用会下载并缓存模型，之后再次使用无需重复下载。</p>
        </div>
        <dl>
          <div>
            <dt>推荐</dt>
            <dd>WebGPU · 约 {formatBytes(MODEL_DOWNLOAD_BYTES.webgpu)}</dd>
          </div>
          <div>
            <dt>兼容模式</dt>
            <dd>WASM · 约 {formatBytes(MODEL_DOWNLOAD_BYTES.wasm)}</dd>
          </div>
        </dl>
        <Button disabled={isBusy} onClick={onProcessDefault} size="lg">
          {phase === 'decoding' ? (
            <LoaderCircleIcon
              className={styles.loadingIcon}
              data-icon="inline-start"
            />
          ) : null}
          {defaultBackend === 'webgpu' ? '去除背景' : '使用兼容模式'}
        </Button>
        {defaultBackend === 'wasm' ? (
          <p className={styles.compatibilityNote}>
            当前环境没有 WebGPU，将下载更大的兼容模型。
          </p>
        ) : null}
      </div>
    )}
  </aside>
)

interface WorkspaceProps extends Omit<BackgroundRemovalViewProps, 'source'> {
  source: SourceImage
}

const Workspace = ({
  comparisonHelpId,
  comparisonPosition,
  defaultBackend,
  error,
  isBusy,
  onCancel,
  onComparisonChange,
  onComparisonKeyDown,
  onDownload,
  onOpenFile,
  onProcessCompatibility,
  onProcessDefault,
  onRetry,
  onShowOriginal,
  onShowResult,
  phase,
  progress,
  result,
  source,
}: WorkspaceProps) => (
  <main className={styles.workspace}>
    <header className={styles.workspaceHeader}>
      <div>
        <h1>去除图片背景</h1>
        <p>模型在浏览器中运行，原图不会上传。</p>
      </div>
      <Button disabled={isBusy} onClick={onOpenFile} variant="outline">
        <ImageIcon data-icon="inline-start" />
        换一张
      </Button>
    </header>

    <section aria-label="图片处理工作区" className={styles.editor}>
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
        defaultBackend={defaultBackend}
        error={error}
        isBusy={isBusy}
        onDownload={onDownload}
        onOpenFile={onOpenFile}
        onProcessCompatibility={onProcessCompatibility}
        onProcessDefault={onProcessDefault}
        onRetry={onRetry}
        phase={phase}
        result={result}
        source={source}
      />
    </section>

    <footer className={styles.dataBoundary}>
      <p>
        图片始终留在当前浏览器。模型会从 Hugging Face 的固定版本地址下载并缓存。
      </p>
      <p>
        推理：Transformers.js（Apache-2.0） · 模型：ISNet general-use（MIT）
      </p>
    </footer>
  </main>
)

const EmptyState = ({
  error,
  onOpenFile,
  phase,
}: Pick<BackgroundRemovalViewProps, 'error' | 'onOpenFile' | 'phase'>) => (
  <main className={styles.emptyState}>
    <header className={styles.intro}>
      <h1>去除图片背景</h1>
      <p>选择一张图片，在浏览器本地识别主体并导出透明 PNG。</p>
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
            支持 JPEG、PNG、WebP、AVIF、GIF 和 BMP，最大 40MP。
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <span className={styles.pickFileLabel}>选择一张图片</span>
          <span>图片不会上传，点击处理后才下载模型。</span>
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

export function BackgroundRemovalView({
  comparisonHelpId,
  comparisonPosition,
  defaultBackend,
  error,
  fileInputRef,
  isBusy,
  isDragging,
  onCancel,
  onComparisonChange,
  onComparisonKeyDown,
  onDownload,
  onFileChange,
  onOpenFile,
  onProcessCompatibility,
  onProcessDefault,
  onRetry,
  onShowOriginal,
  onShowResult,
  phase,
  progress,
  result,
  source,
  statusMessage,
}: BackgroundRemovalViewProps) {
  return (
    <div className={styles.tool} data-dragging={isDragging || undefined}>
      <Input
        accept={ACCEPTED_IMAGE_TYPES}
        aria-label="选择要去除背景的图片"
        className={styles.fileInput}
        onChange={onFileChange}
        ref={fileInputRef}
        type="file"
      />

      {source ? (
        <Workspace
          comparisonHelpId={comparisonHelpId}
          comparisonPosition={comparisonPosition}
          defaultBackend={defaultBackend}
          error={error}
          fileInputRef={fileInputRef}
          isBusy={isBusy}
          isDragging={isDragging}
          onCancel={onCancel}
          onComparisonChange={onComparisonChange}
          onComparisonKeyDown={onComparisonKeyDown}
          onDownload={onDownload}
          onFileChange={onFileChange}
          onOpenFile={onOpenFile}
          onProcessCompatibility={onProcessCompatibility}
          onProcessDefault={onProcessDefault}
          onRetry={onRetry}
          onShowOriginal={onShowOriginal}
          onShowResult={onShowResult}
          phase={phase}
          progress={progress}
          result={result}
          source={source}
          statusMessage={statusMessage}
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
  )
}
