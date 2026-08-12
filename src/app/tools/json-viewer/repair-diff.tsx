'use client'

import {
  DIFFS_TAG_NAME,
  type FileContents,
  FileDiff,
  type FileDiffOptions,
  parseDiffFromFile,
  preloadHighlighter,
} from '@pierre/diffs'
import { useLayoutEffect, useMemo, useRef } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import styles from './json-viewer.module.css'

interface RepairDiffProps {
  modified: string
  original: string
  themeType: 'dark' | 'light'
  viewMode: 'split' | 'stacked'
}

const DIFF_CONTEXT_LINES = 3
const DIFF_CUSTOM_CSS = `
  :host {
    --diffs-font-family: var(--font-geist-mono), monospace;
    --diffs-font-size: 12px;
    --diffs-header-font-family: var(--font-sans), sans-serif;
    --diffs-line-height: 20px;
  }

  [data-diff][data-overflow="wrap"] {
    padding-top: 0;
  }
`

export function RepairDiff({
  modified,
  original,
  themeType,
  viewMode,
}: RepairDiffProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const oldFile = useMemo<FileContents>(
    () => ({ contents: original, lang: 'json', name: 'before.json' }),
    [original]
  )
  const newFile = useMemo<FileContents>(
    () => ({ contents: modified, lang: 'json', name: 'after.json' }),
    [modified]
  )
  const options = useMemo<FileDiffOptions<undefined>>(
    () => ({
      collapsedContextThreshold: 2,
      diffIndicators: 'classic',
      diffStyle: viewMode === 'stacked' ? 'unified' : 'split',
      disableFileHeader: false,
      disableLineNumbers: false,
      expansionLineCount: 80,
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

  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    let diff: FileDiff | undefined
    let cancelled = false

    const renderDiff = async () => {
      try {
        await preloadHighlighter({
          langs: ['json'],
          themes: ['pierre-dark', 'pierre-light'],
        })
        if (cancelled) {
          return
        }

        const diffContainer = document.createElement(DIFFS_TAG_NAME)
        diffContainer.className = styles.diffHost
        container.replaceChildren(diffContainer)
        diff = new FileDiff(options, undefined, true)
        diff.hydrate({ fileContainer: diffContainer, fileDiff })
      } catch {
        if (!cancelled) {
          container.textContent = '差异预览加载失败，原文不会被修改。'
        }
      }
    }

    renderDiff().catch(() => undefined)
    return () => {
      cancelled = true
      diff?.cleanUp()
      container.replaceChildren()
    }
  }, [fileDiff, options])

  return (
    <div className={styles.diffShell}>
      <div className={styles.diffRenderer} ref={containerRef} />
      <div className={styles.diffSkeleton}>
        <Skeleton className={styles.skeletonHeading} />
        <Skeleton className={styles.skeletonLine} />
        <Skeleton className={styles.skeletonLine} />
      </div>
    </div>
  )
}
