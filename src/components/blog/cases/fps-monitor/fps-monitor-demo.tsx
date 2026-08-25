'use client'

import { ActivityIcon, ZapIcon } from 'lucide-react'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import styles from './fps-monitor-demo.module.css'

const SAMPLE_DURATION = 500
const HISTORY_LENGTH = 24
const LONG_TASK_DURATION = 250
const LONG_TASK_PAINT_DELAY = 80
const CHART_WIDTH = 600
const CHART_HEIGHT = 160
const CHART_TOP_PADDING = 18
const DEFAULT_CHART_CEILING = 60
const CHART_CEILING_STEP = 30
const DROP_THRESHOLD = 0.72
interface FpsMetrics {
  fps: number | null
  frameTime: number | null
  history: number[]
}

interface StressTestResult {
  duration: number
  spinCount: number
}

interface ChartData {
  areaPoints: string
  ceiling: number
  linePoints: string
  referenceLineY: number
}

interface SampleState {
  label: string
  value: 'drop' | 'measuring' | 'stable'
}

const getSampleState = (
  fps: number | null,
  hasRecentDrop: boolean
): SampleState => {
  if (fps === null) {
    return { label: '正在建立采样窗口', value: 'measuring' }
  }

  if (hasRecentDrop) {
    return { label: '检测到明显波动', value: 'drop' }
  }

  return { label: '绘制节奏稳定', value: 'stable' }
}

const getChartData = (history: number[]): ChartData => {
  const highestSample = history.length > 0 ? Math.max(...history) : 0
  const ceiling = Math.max(
    DEFAULT_CHART_CEILING,
    Math.ceil(highestSample / CHART_CEILING_STEP) * CHART_CEILING_STEP
  )
  const horizontalStep = CHART_WIDTH / (HISTORY_LENGTH - 1)
  const historyOffset = HISTORY_LENGTH - history.length
  const points = history.map((sample, index) => {
    const x = (historyOffset + index) * horizontalStep
    const plotHeight = CHART_HEIGHT - CHART_TOP_PADDING
    const y = CHART_HEIGHT - (Math.min(sample, ceiling) / ceiling) * plotHeight

    return { x, y }
  })
  const linePoints = points.map(({ x, y }) => `${x},${y}`).join(' ')
  const [firstPoint] = points
  const lastPoint = points.at(-1)
  const areaPoints =
    firstPoint && lastPoint
      ? `${firstPoint.x},${CHART_HEIGHT} ${linePoints} ${lastPoint.x},${CHART_HEIGHT}`
      : ''

  return {
    areaPoints,
    ceiling,
    linePoints,
    referenceLineY:
      CHART_HEIGHT -
      (Math.min(DEFAULT_CHART_CEILING, ceiling) / ceiling) *
        (CHART_HEIGHT - CHART_TOP_PADDING),
  }
}

const useFpsMetrics = (isActive: boolean): FpsMetrics => {
  const [metrics, setMetrics] = useState<FpsMetrics>({
    fps: null,
    frameTime: null,
    history: [],
  })

  useEffect(() => {
    if (!isActive) {
      return
    }

    let frameId = 0
    let frameCount = 0
    let sampleStart = 0
    let isRunning = false
    const measure = (now: number): void => {
      if (!isRunning) {
        return
      }

      frameCount += 1

      const elapsed = now - sampleStart

      if (elapsed >= SAMPLE_DURATION) {
        const fps = Math.round((frameCount * 1000) / elapsed)
        const frameTime = elapsed / frameCount

        setMetrics((previousMetrics) => ({
          fps,
          frameTime,
          history: [...previousMetrics.history, fps].slice(-HISTORY_LENGTH),
        }))
        frameCount = 0
        sampleStart = now
      }

      frameId = requestAnimationFrame(measure)
    }

    const stop = (): void => {
      isRunning = false
      cancelAnimationFrame(frameId)
    }

    const start = (): void => {
      stop()
      frameCount = 0
      sampleStart = performance.now()
      isRunning = true
      frameId = requestAnimationFrame(measure)
    }

    const handleVisibilityChange = (): void => {
      if (document.hidden) {
        stop()
        return
      }

      start()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    if (!document.hidden) {
      start()
    }

    return () => {
      stop()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [isActive])

  return metrics
}

export function FpsMonitorDemo() {
  const demoRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const descriptionId = useId()
  const stressTimerRef = useRef<number | null>(null)
  const [isStressTestRunning, setIsStressTestRunning] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const [stressTestResult, setStressTestResult] =
    useState<StressTestResult | null>(null)
  const metrics = useFpsMetrics(isVisible)
  const chartData = getChartData(metrics.history)
  const lowestFps =
    metrics.history.length > 0 ? Math.min(...metrics.history) : null
  const rollingPeak =
    metrics.history.length > 0 ? Math.max(...metrics.history) : null
  const hasRecentDrop =
    metrics.fps !== null &&
    rollingPeak !== null &&
    metrics.fps < rollingPeak * DROP_THRESHOLD
  const sampleState = getSampleState(metrics.fps, hasRecentDrop)

  useEffect(
    () => () => {
      if (stressTimerRef.current !== null) {
        window.clearTimeout(stressTimerRef.current)
      }
    },
    []
  )

  useEffect(() => {
    const demo = demoRef.current
    if (!demo) {
      return
    }

    if (typeof IntersectionObserver !== 'function') {
      setIsVisible(true)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(Boolean(entry?.isIntersecting)),
      { rootMargin: '160px 0px', threshold: 0.01 }
    )

    observer.observe(demo)
    return () => observer.disconnect()
  }, [])

  const runStressTest = useCallback((): void => {
    if (isStressTestRunning) {
      return
    }

    setIsStressTestRunning(true)
    setStressTestResult(null)

    stressTimerRef.current = window.setTimeout(() => {
      const startedAt = performance.now()
      let spinCount = 0

      while (performance.now() - startedAt < LONG_TASK_DURATION) {
        spinCount += 1
      }

      setStressTestResult({
        duration: Math.round(performance.now() - startedAt),
        spinCount,
      })
      setIsStressTestRunning(false)
      stressTimerRef.current = null
    }, LONG_TASK_PAINT_DELAY)
  }, [isStressTestRunning])

  const chartDescription =
    metrics.fps === null
      ? '帧率历史曲线，正在等待首次采样'
      : `帧率历史曲线，当前 ${metrics.fps} FPS，最低 ${lowestFps ?? metrics.fps} FPS`

  return (
    <Card className="my-8" ref={demoRef}>
      <CardHeader className={styles.cardHeader}>
        <CardTitle>
          <h3 className={styles.demoTitle} id={titleId}>
            亲自制造一次掉帧
          </h3>
        </CardTitle>
        <CardDescription id={descriptionId}>
          按钮会让主线程阻塞 {LONG_TASK_DURATION}ms，观察运动和帧率曲线的变化。
        </CardDescription>
        <CardAction>
          <Button
            aria-describedby={descriptionId}
            className={styles.stressButton}
            disabled={isStressTestRunning}
            onClick={runStressTest}
            size="lg"
            type="button"
            variant="outline"
          >
            <ZapIcon data-icon="inline-start" />
            {isStressTestRunning
              ? '阻塞中…'
              : `制造 ${LONG_TASK_DURATION}ms 卡顿`}
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent>
        <section aria-labelledby={titleId} className={styles.monitor}>
          <div className={styles.monitorToolbar}>
            <div className={styles.liveStatus} data-state={sampleState.value}>
              <span>{sampleState.label}</span>
            </div>
            <div aria-live="polite" className={styles.stressResult}>
              {stressTestResult ? (
                <>
                  上次实际阻塞 {stressTestResult.duration}ms
                  <span className={styles.screenReaderOnly}>
                    ，执行 {stressTestResult.spinCount.toLocaleString()}{' '}
                    次空循环
                  </span>
                </>
              ) : (
                `每 ${SAMPLE_DURATION}ms 更新一次`
              )}
            </div>
          </div>

          <div className={styles.motionLane}>
            <div>
              <div className={styles.motionTitle}>浏览器绘制循环</div>
              <p>阻塞主线程时，运动与采样会同时停顿。</p>
            </div>
          </div>

          <div className={styles.dashboard}>
            <div className={styles.chartPanel}>
              <div className={styles.chartHeader}>
                <span>最近 {HISTORY_LENGTH * (SAMPLE_DURATION / 1000)} 秒</span>
                <span>量程 {chartData.ceiling} FPS</span>
              </div>
              <div className={styles.chartCanvas}>
                <svg
                  aria-label={chartDescription}
                  className={styles.chart}
                  preserveAspectRatio="none"
                  role="img"
                  viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
                >
                  <line
                    className={styles.referenceLine}
                    x1="0"
                    x2={CHART_WIDTH}
                    y1={chartData.referenceLineY}
                    y2={chartData.referenceLineY}
                  />
                  {chartData.areaPoints ? (
                    <polygon
                      className={styles.chartArea}
                      points={chartData.areaPoints}
                    />
                  ) : null}
                  {chartData.linePoints ? (
                    <polyline
                      className={styles.chartLine}
                      points={chartData.linePoints}
                    />
                  ) : null}
                </svg>
                {metrics.history.length === 0 ? (
                  <div className={styles.emptyChart}>等待首次采样…</div>
                ) : null}
              </div>
              <div className={styles.chartLegend}>
                <span aria-hidden="true" />
                {DEFAULT_CHART_CEILING} FPS 参考线
              </div>
            </div>

            <dl className={styles.metrics}>
              <div className={styles.primaryMetric}>
                <dt>当前帧率</dt>
                <dd>
                  {metrics.fps ?? '--'} <span>FPS</span>
                </dd>
              </div>
              <div>
                <dt>平均帧间隔</dt>
                <dd>
                  {metrics.frameTime?.toFixed(1) ?? '--'} <span>ms</span>
                </dd>
              </div>
              <div>
                <dt>采样最低值</dt>
                <dd>
                  {lowestFps ?? '--'} <span>FPS</span>
                </dd>
              </div>
            </dl>
          </div>

          <div className={styles.monitorFooter}>
            <ActivityIcon aria-hidden="true" />
            高刷新率屏幕可能显示超过 60 FPS，这是正常的。
          </div>
        </section>
      </CardContent>
    </Card>
  )
}
