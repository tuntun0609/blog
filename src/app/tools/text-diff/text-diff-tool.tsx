'use client'

import {
  ArrowLeftRightIcon,
  CheckCircle2Icon,
  Columns2Icon,
  EraserIcon,
  FileDiffIcon,
  Rows3Icon,
} from 'lucide-react'
import dynamic from 'next/dynamic'
import { useTheme } from 'next-themes'
import {
  type ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useIsMobile } from '@/hooks/use-mobile'
import type { DiffRenderState, DiffViewMode } from './diff-result'
import {
  countCharacters,
  EMPTY_TEXT_PAIR,
  getComparisonState,
  type TextPair,
} from './text-diff-model'
import styles from './text-diff-tool.module.css'

const DEBOUNCE_DELAY_MS = 200
const DiffResult = dynamic(
  () => import('./diff-result').then((module) => module.DiffResult),
  {
    loading: () => <DiffResultSkeleton />,
    ssr: false,
  }
)

const isDiffViewMode = (value: string | undefined): value is DiffViewMode =>
  value === 'split' || value === 'stacked'

const getResultDescription = (
  diffRenderState: DiffRenderState,
  isUpdating: boolean,
  comparisonState: ReturnType<typeof getComparisonState>
): string => {
  if (isUpdating) {
    return '正在更新字符级比较结果…'
  }
  if (comparisonState === 'different') {
    if (diffRenderState === 'loading') {
      return '正在准备字符级比较结果…'
    }
    if (diffRenderState === 'error') {
      return '比较结果加载失败，请重试。'
    }
    return '红色表示删除，绿色表示新增；未变化的上下文可按需展开。'
  }
  if (comparisonState === 'identical') {
    return '两段文字完全一致。'
  }
  return '粘贴两个版本后会自动开始比较。'
}

function DiffResultSkeleton() {
  return (
    <div className={styles.skeleton}>
      <Skeleton className={styles.skeletonHeading} />
      <Skeleton className={styles.skeletonLine} />
      <Skeleton className={styles.skeletonLine} />
      <Skeleton className={styles.skeletonShortLine} />
    </div>
  )
}

export function TextDiffTool() {
  const [texts, setTexts] = useState<TextPair>(EMPTY_TEXT_PAIR)
  const [comparisonTexts, setComparisonTexts] =
    useState<TextPair>(EMPTY_TEXT_PAIR)
  const [diffRenderState, setDiffRenderState] =
    useState<DiffRenderState>('loading')
  const [viewMode, setViewMode] = useState<DiffViewMode>('split')
  const [hasChosenView, setHasChosenView] = useState(false)
  const isMobile = useIsMobile()
  const { resolvedTheme } = useTheme()

  useEffect(() => {
    if (hasChosenView) {
      return
    }
    setViewMode(isMobile ? 'stacked' : 'split')
  }, [hasChosenView, isMobile])

  useEffect(() => {
    if (
      texts.original === comparisonTexts.original &&
      texts.modified === comparisonTexts.modified
    ) {
      return
    }

    const updateTimeout = window.setTimeout(() => {
      setComparisonTexts(texts)
    }, DEBOUNCE_DELAY_MS)
    return () => window.clearTimeout(updateTimeout)
  }, [comparisonTexts.modified, comparisonTexts.original, texts])

  const comparisonState = useMemo(
    () =>
      getComparisonState(comparisonTexts.original, comparisonTexts.modified),
    [comparisonTexts]
  )
  const isUpdating =
    texts.original !== comparisonTexts.original ||
    texts.modified !== comparisonTexts.modified
  const resultDescription = getResultDescription(
    diffRenderState,
    isUpdating,
    comparisonState
  )
  const themeType = resolvedTheme === 'dark' ? 'dark' : 'light'
  const hasInput = Boolean(texts.original || texts.modified)

  const handleOriginalChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      const original = event.target.value
      setTexts((current) => ({ ...current, original }))
    },
    []
  )
  const handleModifiedChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      const modified = event.target.value
      setTexts((current) => ({ ...current, modified }))
    },
    []
  )
  const clearTexts = useCallback(() => {
    setTexts(EMPTY_TEXT_PAIR)
    setComparisonTexts(EMPTY_TEXT_PAIR)
  }, [])
  const swapTexts = useCallback(() => {
    setTexts((current) => ({
      modified: current.original,
      original: current.modified,
    }))
  }, [])
  const handleViewChange = useCallback((values: string[]) => {
    const [nextView] = values
    if (!isDiffViewMode(nextView)) {
      return
    }
    setHasChosenView(true)
    setViewMode(nextView)
  }, [])

  return (
    <section className={styles.tool}>
      <div className={styles.workspace}>
        <p className={styles.usageNote}>粘贴两个版本，差异会自动显示。</p>

        <div className={styles.workspaceLayout}>
          <div className={styles.editorSurface}>
            <div className={styles.toolbar}>
              <p>输入版本</p>
              <div className={styles.actions}>
                <Button
                  disabled={!hasInput}
                  onClick={clearTexts}
                  size="sm"
                  variant="ghost"
                >
                  <EraserIcon aria-hidden="true" data-icon="inline-start" />
                  清空
                </Button>
              </div>
            </div>

            <FieldGroup className={styles.editorGrid}>
              <Field className={styles.editorPanel}>
                <div className={styles.panelHeader}>
                  <FieldLabel htmlFor="original-text">原始文本</FieldLabel>
                </div>
                <Textarea
                  aria-describedby="original-text-count"
                  className={styles.textarea}
                  id="original-text"
                  onChange={handleOriginalChange}
                  placeholder="在这里粘贴原始版本…"
                  spellCheck={false}
                  value={texts.original}
                />
                <FieldDescription
                  className={styles.counter}
                  id="original-text-count"
                >
                  {countCharacters(texts.original)} 个字符
                </FieldDescription>
              </Field>

              <Button
                aria-label="交换原始文本与修改后文本"
                className={styles.swapButton}
                disabled={!hasInput}
                onClick={swapTexts}
                size="icon"
                title="交换两段文字"
                variant="outline"
              >
                <ArrowLeftRightIcon aria-hidden="true" />
              </Button>

              <Field className={styles.editorPanel}>
                <div className={styles.panelHeader}>
                  <FieldLabel htmlFor="modified-text">修改后文本</FieldLabel>
                </div>
                <Textarea
                  aria-describedby="modified-text-count"
                  className={styles.textarea}
                  id="modified-text"
                  onChange={handleModifiedChange}
                  placeholder="在这里粘贴修改后的版本…"
                  spellCheck={false}
                  value={texts.modified}
                />
                <FieldDescription
                  className={styles.counter}
                  id="modified-text-count"
                >
                  {countCharacters(texts.modified)} 个字符
                </FieldDescription>
              </Field>
            </FieldGroup>
          </div>

          <section aria-label="比较结果" className={styles.result}>
            <header className={styles.resultHeader}>
              <div className={styles.resultHeading}>
                <h2>差异预览</h2>
                <p>{resultDescription}</p>
              </div>
              <ToggleGroup
                aria-label="比较结果视图"
                onValueChange={handleViewChange}
                size="sm"
                spacing={0}
                value={[viewMode]}
                variant="outline"
              >
                <ToggleGroupItem aria-label="Split 并排视图" value="split">
                  <Columns2Icon aria-hidden="true" />
                  Split
                </ToggleGroupItem>
                <ToggleGroupItem aria-label="Stacked 堆叠视图" value="stacked">
                  <Rows3Icon aria-hidden="true" />
                  Stacked
                </ToggleGroupItem>
              </ToggleGroup>
            </header>

            <div
              aria-busy={
                isUpdating ||
                (comparisonState === 'different' &&
                  diffRenderState === 'loading')
              }
              className={styles.resultFrame}
              data-state={comparisonState}
            >
              {isUpdating && comparisonState === 'empty' ? (
                <DiffResultSkeleton />
              ) : null}
              {!isUpdating && comparisonState === 'empty' ? (
                <Empty className={styles.emptyState}>
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <FileDiffIcon aria-hidden="true" />
                    </EmptyMedia>
                    <EmptyTitle>等待两段文字</EmptyTitle>
                    <EmptyDescription>
                      粘贴两个版本后，字符级差异会显示在这里。
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : null}
              {!isUpdating && comparisonState === 'identical' ? (
                <Empty className={styles.emptyState}>
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <CheckCircle2Icon aria-hidden="true" />
                    </EmptyMedia>
                    <EmptyTitle>没有发现差异</EmptyTitle>
                    <EmptyDescription>两段文字完全一致。</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : null}
              {comparisonState === 'different' ? (
                <DiffResult
                  modified={comparisonTexts.modified}
                  onRenderStateChange={setDiffRenderState}
                  original={comparisonTexts.original}
                  themeType={themeType}
                  viewMode={viewMode}
                />
              ) : null}
            </div>
          </section>
        </div>

        <footer className={styles.privacyNote}>
          <span>所有比较均在浏览器本地完成</span>
          <span>不会上传或保存你的文字</span>
        </footer>

        <span
          aria-atomic="true"
          aria-live="polite"
          className="sr-only"
          role="status"
        >
          {resultDescription}
        </span>
      </div>
    </section>
  )
}
