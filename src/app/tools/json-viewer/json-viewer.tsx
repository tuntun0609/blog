'use client'

import {
  AlertTriangleIcon,
  BracesIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  ClipboardIcon,
  Code2Icon,
  DownloadIcon,
  EraserIcon,
  FileJsonIcon,
  FolderOpenIcon,
  Redo2Icon,
  RotateCcwIcon,
  SearchIcon,
  SparklesIcon,
  Undo2Icon,
  WrenchIcon,
} from 'lucide-react'
import dynamic from 'next/dynamic'
import { useTheme } from 'next-themes'
import {
  type ChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react'
import type {
  Content,
  JSONEditorSelection,
  OnChangeStatus,
} from 'vanilla-jsoneditor'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useIsMobile } from '@/hooks/use-mobile'
import { copyTextWithFallback } from './json-clipboard'
import { clearJsonDraft, persistJsonDraft, readJsonDraft } from './json-draft'
import type { JsonEditorPaneHandle } from './json-editor-pane'
import {
  createJsonHistory,
  getUtf8Size,
  type JsonChangeOrigin,
  jsonHistoryReducer,
} from './json-history'
import {
  formatJsonValue,
  parseJsonText,
  stringifyJsonPath,
} from './json-operations'
import type {
  JsonOperationError,
  JsonPath,
  JsonWorkerRequest,
  JsonWorkerResponse,
  SearchResult,
} from './json-viewer-types'
import styles from './json-viewer.module.css'

const JsonEditorPane = dynamic(
  () => import('./json-editor-pane').then((module) => module.JsonEditorPane),
  { loading: () => <EditorSkeleton />, ssr: false }
)
const RepairDiff = dynamic(
  () => import('./repair-diff').then((module) => module.RepairDiff),
  { loading: () => <EditorSkeleton />, ssr: false }
)

const SAMPLE_TEXT = `{
  "requestId": 9123372036854000123,
  "service": "catalog-api",
  "ok": true,
  "latency": 2.370,
  "users": [
    {
      "id": "usr_01",
      "name": "Ada",
      "roles": ["developer", "admin"]
    },
    {
      "id": "usr_02",
      "name": "Lin",
      "roles": ["viewer"]
    }
  ],
  "next": null
}`
const SESSION_KEY = 'tools:json-viewer:draft:v1'
const SESSION_BYTE_LIMIT = 1024 * 1024
const LARGE_DOCUMENT_BYTES = 5 * 1024 * 1024
const SESSION_DEBOUNCE_MS = 500
const COPY_RESET_MS = 1600
const ACCEPTED_EXTENSIONS = ['.json', '.jsonl', '.txt'] as const
const FILE_EXTENSION_PATTERN = /\.[^.]+$/u

type OperationType = 'beautify' | 'minify' | 'repair' | 'search'
type DraftStatus = 'idle' | 'restored' | 'saved' | 'skipped' | 'unavailable'

interface PendingWorkerRequest {
  reject: (error: Error) => void
  resolve: (response: JsonWorkerResponse) => void
}

type WorkerRequestWithoutId = JsonWorkerRequest extends infer Request
  ? Request extends unknown
    ? Omit<Request, 'id'>
    : never
  : never

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) {
    return `${bytes} B`
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KiB`
  }
  return `${(bytes / 1024 / 1024).toFixed(1)} MiB`
}

const contentToText = (content: Content): string =>
  'text' in content ? content.text : formatJsonValue(content.json)

const getSelectionPath = (
  selection: JSONEditorSelection | undefined
): JsonPath | null => {
  if (!selection || selection.type === 'text') {
    return null
  }
  if ('path' in selection) {
    return selection.path
  }
  if ('focusPath' in selection) {
    return selection.focusPath
  }
  return null
}

const getErrorDescription = (error: JsonOperationError): string => {
  if (error.line !== undefined && error.column !== undefined) {
    return `第 ${error.line} 行，第 ${error.column} 列：${error.message}`
  }
  return error.message
}

const getDraftStatusText = (status: DraftStatus): string => {
  if (status === 'restored') {
    return '已恢复本标签页草稿'
  }
  if (status === 'saved') {
    return '草稿已保存到本标签页'
  }
  if (status === 'skipped') {
    return '内容超过 1 MiB，未保存草稿'
  }
  if (status === 'unavailable') {
    return '浏览器未能保存草稿'
  }
  return '不会上传内容'
}

const isAcceptedFile = (file: File): boolean => {
  const fileName = file.name.toLocaleLowerCase()
  return ACCEPTED_EXTENSIONS.some((extension) => fileName.endsWith(extension))
}

const createWorkerError = (error: JsonOperationError): Error =>
  new Error(getErrorDescription(error))

const copyToClipboard = async (value: string): Promise<void> => {
  const fallback = (fallbackValue: string): boolean => {
    const textArea = document.createElement('textarea')
    textArea.setAttribute('aria-hidden', 'true')
    textArea.style.position = 'fixed'
    textArea.style.inset = '0 auto auto -9999px'
    textArea.value = fallbackValue
    document.body.append(textArea)
    textArea.select()
    const copied = document.execCommand('copy')
    textArea.remove()
    return copied
  }

  await copyTextWithFallback(
    value,
    (text) => navigator.clipboard.writeText(text),
    fallback
  )
}

const getValidityLabel = (
  parseError: JsonOperationError | null,
  hasContent: boolean
): string => {
  if (parseError) {
    return '语法错误'
  }
  return hasContent ? '有效 JSON' : '等待输入'
}

function EditorSkeleton() {
  return (
    <div className={styles.editorSkeleton}>
      <Skeleton className={styles.skeletonHeading} />
      <Skeleton className={styles.skeletonLine} />
      <Skeleton className={styles.skeletonLine} />
      <Skeleton className={styles.skeletonShortLine} />
    </div>
  )
}

function ToolbarButton({
  children,
  label,
  ...props
}: React.ComponentProps<typeof Button> & { label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger render={<Button {...props} />}>{children}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

interface ViewerToolbarProps {
  busyOperation: OperationType | null
  canRedo: boolean
  canUndo: boolean
  fileInputRef: React.RefObject<HTMLInputElement | null>
  hasContent: boolean
  onBeautify: () => void
  onClear: () => void
  onCopy: () => void
  onDownload: () => void
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void
  onFillSample: () => void
  onImport: () => void
  onMinify: () => void
  onRedo: () => void
  onRepair: () => void
  onUndo: () => void
  parseError: JsonOperationError | null
}

function ViewerToolbar({
  busyOperation,
  canRedo,
  canUndo,
  fileInputRef,
  hasContent,
  onBeautify,
  onClear,
  onCopy,
  onDownload,
  onFileChange,
  onFillSample,
  onImport,
  onMinify,
  onRedo,
  onRepair,
  onUndo,
  parseError,
}: ViewerToolbarProps) {
  const isProcessing = busyOperation !== null

  return (
    <div className={styles.toolbar}>
      <div className={styles.toolbarGroup}>
        <ToolbarButton
          label="选择本地 JSON 文件"
          onClick={onImport}
          size="sm"
          variant="outline"
        >
          <FolderOpenIcon data-icon="inline-start" />
          导入
        </ToolbarButton>
        <input
          accept=".json,.jsonl,.txt,application/json,text/plain"
          className="sr-only"
          onChange={onFileChange}
          ref={fileInputRef}
          type="file"
        />
        <ToolbarButton
          label="载入一个 API 响应示例"
          onClick={onFillSample}
          size="sm"
          variant="ghost"
        >
          <RotateCcwIcon data-icon="inline-start" />
          示例
        </ToolbarButton>
      </div>

      <div className={styles.toolbarGroup}>
        <ToolbarButton
          aria-label="撤销"
          disabled={!canUndo}
          label="撤销（Ctrl/Cmd+Z）"
          onClick={onUndo}
          size="icon-sm"
          variant="ghost"
        >
          <Undo2Icon />
        </ToolbarButton>
        <ToolbarButton
          aria-label="重做"
          disabled={!canRedo}
          label="重做（Ctrl/Cmd+Shift+Z）"
          onClick={onRedo}
          size="icon-sm"
          variant="ghost"
        >
          <Redo2Icon />
        </ToolbarButton>
      </div>

      <div className={styles.toolbarGroup}>
        <ToolbarButton
          disabled={!hasContent || isProcessing}
          label="使用两空格缩进美化"
          onClick={onBeautify}
          size="sm"
          variant="ghost"
        >
          <SparklesIcon data-icon="inline-start" />
          美化
        </ToolbarButton>
        <ToolbarButton
          disabled={!hasContent || isProcessing}
          label="移除所有非必要空白"
          onClick={onMinify}
          size="sm"
          variant="ghost"
        >
          <Code2Icon data-icon="inline-start" />
          压缩
        </ToolbarButton>
        <ToolbarButton
          disabled={!hasContent || isProcessing}
          label="预览并确认 JSON 修复"
          onClick={onRepair}
          size="sm"
          variant={parseError ? 'secondary' : 'ghost'}
        >
          <WrenchIcon data-icon="inline-start" />
          修复
        </ToolbarButton>
      </div>

      <div className={styles.toolbarGroup}>
        <ToolbarButton
          aria-label="复制完整 JSON"
          disabled={!hasContent}
          label="复制完整 JSON"
          onClick={onCopy}
          size="icon-sm"
          variant="ghost"
        >
          <ClipboardIcon />
        </ToolbarButton>
        <ToolbarButton
          aria-label="下载 JSON"
          disabled={!hasContent}
          label="下载为 JSON 文件"
          onClick={onDownload}
          size="icon-sm"
          variant="ghost"
        >
          <DownloadIcon />
        </ToolbarButton>
        <ToolbarButton
          aria-label="清空"
          disabled={!hasContent}
          label="清空内容和本标签页草稿"
          onClick={onClear}
          size="icon-sm"
          variant="ghost"
        >
          <EraserIcon />
        </ToolbarButton>
      </div>
    </div>
  )
}

interface SearchControlsProps {
  currentPathLabel: string
  hasContent: boolean
  hasSelectedPath: boolean
  onCopyPath: () => void
  onNext: () => void
  onPrevious: () => void
  onQueryChange: (event: ChangeEvent<HTMLInputElement>) => void
  onQueryKeyDown: (event: ReactKeyboardEvent<HTMLInputElement>) => void
  parseError: JsonOperationError | null
  query: string
  resultCount: number
  resultIndex: number
  truncated: boolean
}

function SearchControls({
  currentPathLabel,
  hasContent,
  hasSelectedPath,
  onCopyPath,
  onNext,
  onPrevious,
  onQueryChange,
  onQueryKeyDown,
  parseError,
  query,
  resultCount,
  resultIndex,
  truncated,
}: SearchControlsProps) {
  return (
    <div className={styles.searchRow}>
      <InputGroup className={styles.searchInput}>
        <InputGroupAddon>
          <SearchIcon aria-hidden="true" />
        </InputGroupAddon>
        <InputGroupInput
          aria-label="搜索 JSON 键和值"
          disabled={!hasContent || Boolean(parseError)}
          onChange={onQueryChange}
          onKeyDown={onQueryKeyDown}
          placeholder="搜索键和值，按 Enter"
          value={query}
        />
        <InputGroupAddon align="inline-end">
          {resultCount > 0 ? (
            <span className={styles.searchCount}>
              {resultIndex + 1}/{resultCount}
              {truncated ? '+' : ''}
            </span>
          ) : null}
          <InputGroupButton
            aria-label="上一个搜索结果"
            disabled={resultCount === 0}
            onClick={onPrevious}
            size="icon-xs"
          >
            <ChevronUpIcon />
          </InputGroupButton>
          <InputGroupButton
            aria-label="下一个搜索结果"
            disabled={resultCount === 0}
            onClick={onNext}
            size="icon-xs"
          >
            <ChevronDownIcon />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>

      <div className={styles.pathControl}>
        <code>{currentPathLabel}</code>
        <Button
          aria-label="复制当前 JSON Path"
          disabled={!hasSelectedPath}
          onClick={onCopyPath}
          size="icon-xs"
          variant="ghost"
        >
          <ClipboardIcon />
        </Button>
      </div>
    </div>
  )
}

interface DocumentNoticesProps {
  busyOperation: OperationType | null
  documentBytes: number
  isLargeDocument: boolean
  onRepair: () => void
  parseError: JsonOperationError | null
}

function DocumentNotices({
  busyOperation,
  documentBytes,
  isLargeDocument,
  onRepair,
  parseError,
}: DocumentNoticesProps) {
  return (
    <>
      {isLargeDocument ? (
        <div className={styles.warning} role="status">
          <AlertTriangleIcon aria-hidden="true" />
          <span>
            当前文档为 {formatBytes(documentBytes)}
            。双面板会继续运行，但解析、搜索和节点展开可能需要更久；草稿不会写入浏览器存储。
          </span>
        </div>
      ) : null}

      {parseError ? (
        <div className={styles.errorBar} role="alert">
          <AlertTriangleIcon aria-hidden="true" />
          <span>{getErrorDescription(parseError)}</span>
          <Button
            disabled={busyOperation !== null}
            onClick={onRepair}
            size="xs"
            variant="secondary"
          >
            <WrenchIcon data-icon="inline-start" />
            预览修复
          </Button>
        </div>
      ) : null}
    </>
  )
}

interface EditorGridProps {
  hasContent: boolean
  onCollapseTree: () => void
  onExpandTree: () => void
  onSourceChange: (content: Content) => void
  onTreeChange: (content: Content, status: OnChangeStatus) => void
  onTreeSelect: (selection: JSONEditorSelection | undefined) => void
  parseError: JsonOperationError | null
  sourceContent: Content
  themeType: 'dark' | 'light'
  treeContent: Content
  treeEditorRef: React.RefObject<JsonEditorPaneHandle | null>
  validityLabel: string
}

function EditorGrid({
  hasContent,
  onCollapseTree,
  onExpandTree,
  onSourceChange,
  onTreeChange,
  onTreeSelect,
  parseError,
  sourceContent,
  themeType,
  treeContent,
  treeEditorRef,
  validityLabel,
}: EditorGridProps) {
  return (
    <div className={styles.editorGrid}>
      <section className={styles.editorPanel}>
        <header className={styles.panelHeader}>
          <div className={styles.panelTitle}>
            <Code2Icon aria-hidden="true" />
            <h2>源码</h2>
          </div>
          <Badge variant={parseError ? 'destructive' : 'secondary'}>
            {validityLabel}
          </Badge>
        </header>
        <div className={styles.editorViewport}>
          <JsonEditorPane
            ariaLabel="JSON 源码编辑器"
            content={sourceContent}
            mode="text"
            onChange={onSourceChange}
            theme={themeType}
          />
        </div>
      </section>

      <section className={styles.editorPanel}>
        <header className={styles.panelHeader}>
          <div className={styles.panelTitle}>
            <BracesIcon aria-hidden="true" />
            <h2>树形节点</h2>
          </div>
          <div className={styles.treeActions}>
            <Button
              aria-label="折叠全部节点"
              disabled={!hasContent}
              onClick={onCollapseTree}
              size="icon-xs"
              variant="ghost"
            >
              <ChevronLeftIcon />
            </Button>
            <Button
              aria-label="展开全部节点"
              disabled={!hasContent}
              onClick={onExpandTree}
              size="icon-xs"
              variant="ghost"
            >
              <ChevronRightIcon />
            </Button>
            <Badge variant={parseError ? 'outline' : 'secondary'}>
              {parseError ? '已锁定' : '可编辑'}
            </Badge>
          </div>
        </header>
        <div className={styles.editorViewport}>
          <JsonEditorPane
            ariaLabel="JSON 树形节点编辑器"
            content={treeContent}
            mode="tree"
            onChange={onTreeChange}
            onSelect={onTreeSelect}
            readOnly={Boolean(parseError)}
            ref={treeEditorRef}
            theme={themeType}
          />
          {parseError ? (
            <div className={styles.lockOverlay}>
              <FileJsonIcon aria-hidden="true" />
              <strong>树形视图保留上次有效结果</strong>
              <span>修正源码或确认修复后即可继续编辑。</span>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  )
}

interface ViewerStatusBarProps {
  busyOperation: OperationType | null
  documentBytes: number
  draftStatus: DraftStatus
  fileName: string
  statusMessage: string
  textLength: number
}

function ViewerStatusBar({
  busyOperation,
  documentBytes,
  draftStatus,
  fileName,
  statusMessage,
  textLength,
}: ViewerStatusBarProps) {
  return (
    <footer className={styles.statusBar}>
      <div className={styles.statusPrimary}>
        <span>{fileName}</span>
        <span>{formatBytes(documentBytes)}</span>
        <span>{textLength.toLocaleString('zh-CN')} 个字符</span>
      </div>
      <div className={styles.statusSecondary}>
        {busyOperation ? <span className={styles.busyDot} /> : null}
        <span>{statusMessage}</span>
        <span>·</span>
        <span>{getDraftStatusText(draftStatus)}</span>
      </div>
    </footer>
  )
}

interface RepairPreviewSheetProps {
  isMobile: boolean
  modified: string | null
  onApply: () => void
  onClose: () => void
  onOpenChange: (open: boolean) => void
  original: string
  themeType: 'dark' | 'light'
}

function RepairPreviewSheet({
  isMobile,
  modified,
  onApply,
  onClose,
  onOpenChange,
  original,
  themeType,
}: RepairPreviewSheetProps) {
  return (
    <Sheet onOpenChange={onOpenChange} open={modified !== null}>
      <SheetContent
        className={styles.repairSheet}
        showCloseButton
        side={isMobile ? 'bottom' : 'right'}
      >
        <SheetHeader className={styles.repairHeader}>
          <SheetTitle>确认 JSON 修复</SheetTitle>
          <SheetDescription>
            检查每一处变化。只有点击“采用修复”后，当前源码才会被替换。
          </SheetDescription>
        </SheetHeader>
        <div className={styles.repairDiff}>
          {modified === null ? null : (
            <RepairDiff
              modified={modified}
              original={original}
              themeType={themeType}
              viewMode={isMobile ? 'stacked' : 'split'}
            />
          )}
        </div>
        <SheetFooter className={styles.repairFooter}>
          <Button onClick={onClose} variant="outline">
            取消
          </Button>
          <Button onClick={onApply}>
            <WrenchIcon data-icon="inline-start" />
            采用修复
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

export function JsonViewer() {
  const [history, dispatchHistory] = useReducer(
    jsonHistoryReducer,
    '',
    createJsonHistory
  )
  const [hydrated, setHydrated] = useState(false)
  const [lastValidJson, setLastValidJson] = useState<unknown>({})
  const [parseError, setParseError] = useState<JsonOperationError | null>(null)
  const [fileName, setFileName] = useState('未命名.json')
  const [draftStatus, setDraftStatus] = useState<DraftStatus>('idle')
  const [busyOperation, setBusyOperation] = useState<OperationType | null>(null)
  const [repairPreview, setRepairPreview] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searchIndex, setSearchIndex] = useState(0)
  const [searchTruncated, setSearchTruncated] = useState(false)
  const [selectedPath, setSelectedPath] = useState<JsonPath | null>(null)
  const [statusMessage, setStatusMessage] = useState('编辑器正在准备。')
  const [copied, setCopied] = useState<'document' | 'path' | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const workbenchRef = useRef<HTMLDivElement>(null)
  const treeEditorRef = useRef<JsonEditorPaneHandle>(null)
  const workerRef = useRef<Worker | null>(null)
  const pendingRequestsRef = useRef(new Map<number, PendingWorkerRequest>())
  const requestIdRef = useRef(0)
  const copiedResetRef = useRef<number | null>(null)
  const textRef = useRef(history.text)
  const isMobile = useIsMobile()
  const { resolvedTheme } = useTheme()
  const themeType = resolvedTheme === 'dark' ? 'dark' : 'light'
  const documentBytes = useMemo(() => getUtf8Size(history.text), [history.text])
  const isLargeDocument = documentBytes > LARGE_DOCUMENT_BYTES
  const sourceContent = useMemo<Content>(
    () => ({ text: history.text }),
    [history.text]
  )
  const treeContent = useMemo<Content>(
    () => ({ json: lastValidJson }),
    [lastValidJson]
  )
  const searchResult = searchResults[searchIndex]
  const canUndo = history.past.length > 0
  const canRedo = history.future.length > 0
  const hasContent = history.text.length > 0

  textRef.current = history.text

  const commitText = useCallback(
    (text: string, origin: JsonChangeOrigin = 'action') => {
      dispatchHistory({ origin, text, timestamp: Date.now(), type: 'change' })
    },
    []
  )

  const runWorker = useCallback(
    (request: WorkerRequestWithoutId): Promise<JsonWorkerResponse> => {
      const worker = workerRef.current
      if (!worker) {
        return Promise.reject(new Error('后台处理器尚未准备好，请稍后重试。'))
      }

      requestIdRef.current += 1
      const id = requestIdRef.current
      return new Promise((resolve, reject) => {
        pendingRequestsRef.current.set(id, { reject, resolve })
        worker.postMessage({ ...request, id })
      })
    },
    []
  )

  useEffect(() => {
    const worker = new Worker(new URL('./json-worker.ts', import.meta.url))
    workerRef.current = worker
    worker.addEventListener(
      'message',
      (event: MessageEvent<JsonWorkerResponse>) => {
        const pending = pendingRequestsRef.current.get(event.data.id)
        if (!pending) {
          return
        }
        pendingRequestsRef.current.delete(event.data.id)
        pending.resolve(event.data)
      }
    )
    worker.addEventListener('error', () => {
      for (const pending of pendingRequestsRef.current.values()) {
        pending.reject(new Error('后台处理器意外停止，请刷新页面后重试。'))
      }
      pendingRequestsRef.current.clear()
    })

    return () => {
      worker.terminate()
      workerRef.current = null
      for (const pending of pendingRequestsRef.current.values()) {
        pending.reject(new Error('页面已关闭。'))
      }
      pendingRequestsRef.current.clear()
    }
  }, [])

  useEffect(() => {
    const draft = readJsonDraft(sessionStorage, SESSION_KEY)
    const restoredText = draft.text

    if (draft.status === 'unavailable') {
      setDraftStatus('unavailable')
    }

    if (restoredText) {
      dispatchHistory({ text: restoredText, type: 'hydrate' })
      setDraftStatus('restored')
      setStatusMessage('已恢复本标签页中的上次内容。')
    }
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) {
      return
    }

    setSearchResults([])
    setSearchIndex(0)
    setSearchTruncated(false)
    setSelectedPath(null)

    const parsed = parseJsonText(history.text)
    if (parsed.ok) {
      setLastValidJson(parsed.json)
      setParseError(null)
    } else if (history.text) {
      setParseError(parsed.error)
    } else {
      setLastValidJson({})
      setParseError(null)
    }
  }, [history.text, hydrated])

  useEffect(() => {
    if (!hydrated) {
      return
    }

    const timeout = window.setTimeout(() => {
      const result = persistJsonDraft(
        sessionStorage,
        SESSION_KEY,
        history.text,
        documentBytes,
        SESSION_BYTE_LIMIT
      )
      setDraftStatus(result === 'cleared' ? 'idle' : result)
    }, SESSION_DEBOUNCE_MS)

    return () => window.clearTimeout(timeout)
  }, [documentBytes, history.text, hydrated])

  useEffect(
    () => () => {
      if (copiedResetRef.current !== null) {
        window.clearTimeout(copiedResetRef.current)
      }
    },
    []
  )

  const handleSourceChange = useCallback(
    (content: Content) => {
      commitText(contentToText(content), 'source')
      setStatusMessage('源码已更新。')
    },
    [commitText]
  )

  const handleTreeChange = useCallback(
    (content: Content, status: OnChangeStatus) => {
      if (status.contentErrors || parseError || !('json' in content)) {
        return
      }
      const nextText = formatJsonValue(content.json)
      commitText(nextText, 'tree')
      setStatusMessage('树形节点已同步到源码。')
    },
    [commitText, parseError]
  )

  const handleTreeSelect = useCallback(
    (selection: JSONEditorSelection | undefined) => {
      setSelectedPath(getSelectionPath(selection))
    },
    []
  )

  const applyWorkerTextOperation = useCallback(
    async (type: 'beautify' | 'minify') => {
      if (!hasContent) {
        return
      }
      setBusyOperation(type)
      setStatusMessage(
        type === 'beautify' ? '正在美化 JSON…' : '正在压缩 JSON…'
      )
      try {
        const response = await runWorker({ text: textRef.current, type })
        if (!response.ok) {
          throw createWorkerError(response.error)
        }
        if (response.type !== type) {
          throw new Error('后台处理返回了不匹配的结果。')
        }
        commitText(response.text)
        setStatusMessage(
          type === 'beautify' ? 'JSON 已美化。' : 'JSON 已压缩。'
        )
      } catch (error) {
        setStatusMessage(
          error instanceof Error ? error.message : 'JSON 处理失败。'
        )
      } finally {
        setBusyOperation(null)
      }
    },
    [commitText, hasContent, runWorker]
  )

  const openRepairPreview = useCallback(async () => {
    if (!hasContent) {
      return
    }
    if (!parseError) {
      setStatusMessage('当前 JSON 语法有效，不需要修复。')
      return
    }
    setBusyOperation('repair')
    setStatusMessage('正在生成修复建议…')
    try {
      const response = await runWorker({
        text: textRef.current,
        type: 'repair',
      })
      if (!response.ok) {
        throw createWorkerError(response.error)
      }
      if (response.type !== 'repair') {
        throw new Error('后台处理返回了不匹配的结果。')
      }
      if (response.text === textRef.current) {
        setStatusMessage('当前 JSON 不需要修复。')
        return
      }
      setRepairPreview(response.text)
      setStatusMessage('修复建议已准备，确认后才会替换原文。')
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : '无法修复当前内容。'
      )
    } finally {
      setBusyOperation(null)
    }
  }, [hasContent, parseError, runWorker])

  const applyRepair = useCallback(() => {
    if (repairPreview === null) {
      return
    }
    commitText(repairPreview)
    setRepairPreview(null)
    setStatusMessage('已采用修复结果，可使用撤销恢复原文。')
  }, [commitText, repairPreview])

  const runSearch = useCallback(async () => {
    const query = searchQuery.trim()
    if (!(query && hasContent && !parseError)) {
      setSearchResults([])
      setSearchIndex(0)
      return
    }
    setBusyOperation('search')
    setStatusMessage('正在搜索键和值…')
    try {
      const response = await runWorker({
        query,
        text: textRef.current,
        type: 'search',
      })
      if (!response.ok) {
        throw createWorkerError(response.error)
      }
      if (response.type !== 'search') {
        throw new Error('后台处理返回了不匹配的结果。')
      }
      setSearchResults(response.results)
      setSearchIndex(0)
      setSearchTruncated(response.truncated)
      setStatusMessage(
        response.results.length > 0
          ? `找到 ${response.results.length}${response.truncated ? '+' : ''} 个匹配项。`
          : '没有找到匹配项。'
      )
      const [firstResult] = response.results
      if (firstResult) {
        await treeEditorRef.current?.focusPath(
          firstResult.path,
          firstResult.field
        )
      }
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : '搜索失败。')
    } finally {
      setBusyOperation(null)
    }
  }, [hasContent, parseError, runWorker, searchQuery])

  const moveSearchResult = useCallback(
    async (direction: -1 | 1) => {
      if (searchResults.length === 0) {
        return
      }
      const nextIndex =
        (searchIndex + direction + searchResults.length) % searchResults.length
      setSearchIndex(nextIndex)
      const nextResult = searchResults[nextIndex]
      await treeEditorRef.current?.focusPath(nextResult.path, nextResult.field)
      setStatusMessage(`已定位第 ${nextIndex + 1} 个匹配项。`)
    },
    [searchIndex, searchResults]
  )

  const clearDocument = useCallback(() => {
    commitText('')
    setFileName('未命名.json')
    setSearchQuery('')
    setSearchResults([])
    setSelectedPath(null)
    if (clearJsonDraft(sessionStorage, SESSION_KEY) === 'unavailable') {
      setDraftStatus('unavailable')
    }
    setStatusMessage('内容与本标签页草稿已清空。')
  }, [commitText])

  const fillSample = useCallback(() => {
    commitText(SAMPLE_TEXT)
    setFileName('api-response.json')
    setStatusMessage('已载入包含长整数的 API 响应示例。')
  }, [commitText])

  const importFile = useCallback(
    async (file: File) => {
      if (!isAcceptedFile(file)) {
        setStatusMessage('请选择 .json、.jsonl 或 .txt 文件。')
        return
      }
      try {
        const text = await file.text()
        commitText(text)
        setFileName(file.name)
        setStatusMessage(
          `已在本地读取 ${file.name}（${formatBytes(file.size)}）。`
        )
      } catch {
        setStatusMessage('文件读取失败，请重新选择。')
      }
    },
    [commitText]
  )

  const handleFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const [file] = event.target.files ?? []
      if (file) {
        importFile(file).catch(() => undefined)
      }
      event.target.value = ''
    },
    [importFile]
  )

  const downloadDocument = useCallback(() => {
    const blob = new Blob([history.text], {
      type: 'application/json;charset=utf-8',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.download = fileName.toLocaleLowerCase().endsWith('.json')
      ? fileName
      : `${fileName.replace(FILE_EXTENSION_PATTERN, '') || 'data'}.json`
    link.href = url
    link.click()
    URL.revokeObjectURL(url)
    setStatusMessage('JSON 文件已下载。')
  }, [fileName, history.text])

  const copyText = useCallback(
    async (value: string, target: 'document' | 'path') => {
      try {
        await copyToClipboard(value)
        setCopied(target)
        setStatusMessage(
          target === 'document' ? '已复制完整 JSON。' : '已复制 JSON Path。'
        )
        if (copiedResetRef.current !== null) {
          window.clearTimeout(copiedResetRef.current)
        }
        copiedResetRef.current = window.setTimeout(() => {
          setCopied(null)
          copiedResetRef.current = null
        }, COPY_RESET_MS)
      } catch {
        setStatusMessage('复制失败，请检查浏览器剪贴板权限。')
      }
    },
    []
  )

  const handleWorkspaceKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const modifier = event.metaKey || event.ctrlKey
      if (!modifier) {
        return
      }

      const key = event.key.toLocaleLowerCase()
      if (key === 'z' && !event.shiftKey && canUndo) {
        event.preventDefault()
        event.stopPropagation()
        dispatchHistory({ type: 'undo' })
        setStatusMessage('已撤销上一次修改。')
        return
      }

      if ((key === 'z' && event.shiftKey) || key === 'y') {
        if (!canRedo) {
          return
        }
        event.preventDefault()
        event.stopPropagation()
        dispatchHistory({ type: 'redo' })
        setStatusMessage('已重做修改。')
      }
    },
    [canRedo, canUndo]
  )

  const undo = useCallback(() => {
    dispatchHistory({ type: 'undo' })
    setStatusMessage('已撤销上一次修改。')
  }, [])
  const redo = useCallback(() => {
    dispatchHistory({ type: 'redo' })
    setStatusMessage('已重做修改。')
  }, [])

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click()
  }, [])
  const beautifyDocument = useCallback(() => {
    applyWorkerTextOperation('beautify').catch(() => undefined)
  }, [applyWorkerTextOperation])
  const minifyDocument = useCallback(() => {
    applyWorkerTextOperation('minify').catch(() => undefined)
  }, [applyWorkerTextOperation])
  const copyDocument = useCallback(() => {
    copyText(history.text, 'document').catch(() => undefined)
  }, [copyText, history.text])
  const handleSearchQueryChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setSearchQuery(event.target.value)
    },
    []
  )
  const handleSearchKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
        event.preventDefault()
        runSearch().catch(() => undefined)
      }
    },
    [runSearch]
  )
  const showPreviousSearchResult = useCallback(() => {
    moveSearchResult(-1).catch(() => undefined)
  }, [moveSearchResult])
  const showNextSearchResult = useCallback(() => {
    moveSearchResult(1).catch(() => undefined)
  }, [moveSearchResult])
  const currentPath = searchResult?.path ?? selectedPath
  const currentPathLabel = currentPath ? stringifyJsonPath(currentPath) : '$'
  const copyCurrentPath = useCallback(() => {
    if (currentPath) {
      copyText(stringifyJsonPath(currentPath), 'path').catch(() => undefined)
    }
  }, [copyText, currentPath])
  const collapseTree = useCallback(() => {
    treeEditorRef.current?.collapseAll()
  }, [])
  const expandTree = useCallback(() => {
    treeEditorRef.current?.expandAll()
  }, [])
  const closeRepairPreview = useCallback(() => {
    setRepairPreview(null)
  }, [])
  const handleRepairSheetChange = useCallback((open: boolean) => {
    if (!open) {
      setRepairPreview(null)
    }
  }, [])
  const validityLabel = getValidityLabel(parseError, hasContent)

  useEffect(() => {
    const workbench = workbenchRef.current
    if (!workbench) {
      return
    }

    const handleNativeDragEnter = () => setDragActive(true)
    const handleNativeDragLeave = (event: globalThis.DragEvent) => {
      if (!workbench.contains(event.relatedTarget as Node)) {
        setDragActive(false)
      }
    }
    const handleNativeDragOver = (event: globalThis.DragEvent) => {
      event.preventDefault()
    }
    const handleNativeDrop = (event: globalThis.DragEvent) => {
      event.preventDefault()
      setDragActive(false)
      const [file] = event.dataTransfer?.files ?? []
      if (file) {
        importFile(file).catch(() => undefined)
      }
    }

    workbench.addEventListener('dragenter', handleNativeDragEnter)
    workbench.addEventListener('dragleave', handleNativeDragLeave)
    workbench.addEventListener('dragover', handleNativeDragOver)
    workbench.addEventListener('drop', handleNativeDrop)
    workbench.addEventListener('keydown', handleWorkspaceKeyDown, true)

    return () => {
      workbench.removeEventListener('dragenter', handleNativeDragEnter)
      workbench.removeEventListener('dragleave', handleNativeDragLeave)
      workbench.removeEventListener('dragover', handleNativeDragOver)
      workbench.removeEventListener('drop', handleNativeDrop)
      workbench.removeEventListener('keydown', handleWorkspaceKeyDown, true)
    }
  }, [handleWorkspaceKeyDown, importFile])

  return (
    <TooltipProvider>
      <section className={styles.tool}>
        <div className={styles.workspace}>
          <div
            className={styles.workbench}
            data-drag-active={dragActive}
            ref={workbenchRef}
          >
            <ViewerToolbar
              busyOperation={busyOperation}
              canRedo={canRedo}
              canUndo={canUndo}
              fileInputRef={fileInputRef}
              hasContent={hasContent}
              onBeautify={beautifyDocument}
              onClear={clearDocument}
              onCopy={copyDocument}
              onDownload={downloadDocument}
              onFileChange={handleFileChange}
              onFillSample={fillSample}
              onImport={openFilePicker}
              onMinify={minifyDocument}
              onRedo={redo}
              onRepair={openRepairPreview}
              onUndo={undo}
              parseError={parseError}
            />

            <SearchControls
              currentPathLabel={currentPathLabel}
              hasContent={hasContent}
              hasSelectedPath={Boolean(searchResult || selectedPath)}
              onCopyPath={copyCurrentPath}
              onNext={showNextSearchResult}
              onPrevious={showPreviousSearchResult}
              onQueryChange={handleSearchQueryChange}
              onQueryKeyDown={handleSearchKeyDown}
              parseError={parseError}
              query={searchQuery}
              resultCount={searchResults.length}
              resultIndex={searchIndex}
              truncated={searchTruncated}
            />

            <DocumentNotices
              busyOperation={busyOperation}
              documentBytes={documentBytes}
              isLargeDocument={isLargeDocument}
              onRepair={openRepairPreview}
              parseError={parseError}
            />

            <EditorGrid
              hasContent={hasContent}
              onCollapseTree={collapseTree}
              onExpandTree={expandTree}
              onSourceChange={handleSourceChange}
              onTreeChange={handleTreeChange}
              onTreeSelect={handleTreeSelect}
              parseError={parseError}
              sourceContent={sourceContent}
              themeType={themeType}
              treeContent={treeContent}
              treeEditorRef={treeEditorRef}
              validityLabel={validityLabel}
            />

            <ViewerStatusBar
              busyOperation={busyOperation}
              documentBytes={documentBytes}
              draftStatus={draftStatus}
              fileName={fileName}
              statusMessage={statusMessage}
              textLength={history.text.length}
            />

            {dragActive ? (
              <div className={styles.dropOverlay}>
                <FolderOpenIcon aria-hidden="true" />
                <strong>松开即可在本地打开</strong>
                <span>支持 .json、.jsonl 和 .txt</span>
              </div>
            ) : null}
          </div>
        </div>

        <span aria-atomic="true" aria-live="polite" className="sr-only">
          {statusMessage}
          {copied ? ` ${copied === 'document' ? '文档' : '路径'}已复制。` : ''}
        </span>

        <RepairPreviewSheet
          isMobile={isMobile}
          modified={repairPreview}
          onApply={applyRepair}
          onClose={closeRepairPreview}
          onOpenChange={handleRepairSheetChange}
          original={history.text}
          themeType={themeType}
        />
      </section>
    </TooltipProvider>
  )
}
