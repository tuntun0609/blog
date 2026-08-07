'use client'

import {
  DIFFS_TAG_NAME,
  type FileContents,
  FileDiff,
  type FileDiffOptions,
  parseDiffFromFile,
  preloadHighlighter,
} from '@pierre/diffs'
import { CircleAlertIcon, RotateCcwIcon } from 'lucide-react'
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import styles from './text-diff-tool.module.css'

export type DiffViewMode = 'split' | 'stacked'
export type DiffRenderState = 'error' | 'loading' | 'ready'

interface DiffResultProps {
  modified: string
  onRenderStateChange: (state: DiffRenderState) => void
  original: string
  themeType: 'dark' | 'light'
  viewMode: DiffViewMode
}

const ORIGINAL_FILE_NAME = 'original.txt'
const MODIFIED_FILE_NAME = 'modified.txt'
const DIFF_CONTEXT_LINES = 4
const EXPANSION_LINE_COUNT = 80
const DIFF_CUSTOM_CSS = `
  :host {
    --diffs-font-family: var(--font-geist-mono), monospace;
    --diffs-font-size: 13px;
    --diffs-header-font-family: var(--font-sans), sans-serif;
    --diffs-line-height: 21px;
  }

  [data-diff][data-overflow="wrap"] {
    padding-top: 0;
  }

  [data-diffs-header="default"] {
    border-bottom: 1px solid color-mix(in lab, var(--diffs-bg) 88%, var(--diffs-fg));
  }
`

function DiffLoadingState() {
  return (
    <div className={styles.skeleton}>
      <Skeleton className={styles.skeletonHeading} />
      <Skeleton className={styles.skeletonLine} />
      <Skeleton className={styles.skeletonLine} />
      <Skeleton className={styles.skeletonShortLine} />
    </div>
  )
}

export function DiffResult({
  modified,
  onRenderStateChange,
  original,
  themeType,
  viewMode,
}: DiffResultProps) {
  const [renderAttempt, setRenderAttempt] = useState(0)
  const [renderState, setRenderState] = useState<DiffRenderState>('loading')
  const oldFile = useMemo<FileContents>(
    () => ({ contents: original, lang: 'text', name: ORIGINAL_FILE_NAME }),
    [original]
  )
  const newFile = useMemo<FileContents>(
    () => ({ contents: modified, lang: 'text', name: MODIFIED_FILE_NAME }),
    [modified]
  )
  const options = useMemo<FileDiffOptions<undefined>>(
    () => ({
      collapsedContextThreshold: 2,
      diffIndicators: 'classic',
      diffStyle: viewMode === 'stacked' ? 'unified' : 'split',
      disableFileHeader: false,
      disableLineNumbers: false,
      expansionLineCount: EXPANSION_LINE_COUNT,
      hunkSeparators: 'line-info-basic',
      lineDiffType: 'char',
      maxLineDiffLength: Number.MAX_SAFE_INTEGER,
      overflow: 'wrap',
      parseDiffOptions: { context: DIFF_CONTEXT_LINES },
      theme: { dark: 'pierre-dark', light: 'pierre-light' },
      themeType,
      unsafeCSS: DIFF_CUSTOM_CSS,
    }),
    [themeType, viewMode]
  )
  const fileDiff = useMemo(
    () => parseDiffFromFile(oldFile, newFile, options.parseDiffOptions),
    [newFile, oldFile, options.parseDiffOptions]
  )
  const containerRef = useRef<HTMLDivElement>(null)
  const updateRenderState = useCallback(
    (state: DiffRenderState) => {
      setRenderState(state)
      onRenderStateChange(state)
    },
    [onRenderStateChange]
  )
  const retryRender = useCallback(() => {
    setRenderAttempt((attempt) => attempt + 1)
  }, [])

  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    let diff: FileDiff | undefined
    let isCancelled = false

    const renderDiff = async () => {
      try {
        updateRenderState('loading')
        await preloadHighlighter({
          langs: ['text'],
          themes: ['pierre-dark', 'pierre-light'],
        })
        if (isCancelled) {
          return
        }

        const diffContainer = document.createElement(DIFFS_TAG_NAME)
        diffContainer.className = styles.diffHost
        container.replaceChildren(diffContainer)

        diff = new FileDiff(options, undefined, true)
        diff.hydrate({ fileContainer: diffContainer, fileDiff })
        updateRenderState('ready')
      } catch {
        if (isCancelled) {
          return
        }
        container.replaceChildren()
        updateRenderState('error')
      }
    }

    renderDiff()
    return () => {
      isCancelled = true
      diff?.cleanUp()
      container.replaceChildren()
    }
  }, [fileDiff, options, renderAttempt, updateRenderState])

  return (
    <div
      aria-busy={renderState === 'loading'}
      className={styles.diffRendererShell}
      data-render-state={renderState}
    >
      <div className={styles.diffRenderer} ref={containerRef} />
      {renderState === 'loading' ? <DiffLoadingState /> : null}
      {renderState === 'error' ? (
        <Empty className={styles.emptyState} role="alert">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CircleAlertIcon aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>比较结果加载失败</EmptyTitle>
            <EmptyDescription>
              文字仍保留在输入框中，可以重新载入结果。
            </EmptyDescription>
          </EmptyHeader>
          <Button onClick={retryRender} size="sm" variant="outline">
            <RotateCcwIcon aria-hidden="true" data-icon="inline-start" />
            重试
          </Button>
        </Empty>
      ) : null}
    </div>
  )
}
