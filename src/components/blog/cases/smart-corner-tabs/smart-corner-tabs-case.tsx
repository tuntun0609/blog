'use client'

import { BugIcon, RotateCcwIcon, SparklesIcon, XIcon } from 'lucide-react'
import {
  animate,
  type MotionStyle,
  type MotionValue,
  motion,
  useMotionTemplate,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useTransform,
} from 'motion/react'
import {
  type KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import styles from './smart-corner-tabs-case.module.css'

const MORPH_DISTANCE = 20
const MAX_CANVAS_RADIUS = 10
const MAX_CUTOUT_RADIUS = 8
const MAX_DRAG_DISTANCE = 120
const MIN_TAB_GAP = 12
const KEYBOARD_STEP = 8

interface DebugValues {
  canvasRadius: number
  cutoutRadius: number
  morphDistance: number
  offset: number
  progress: number
}

type CustomMotionStyle = MotionStyle &
  Record<'--canvas-radius' | '--tab-cutout-radius', MotionValue<string>>

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max)

const roundToOneDecimal = (value: number): number => Math.round(value * 10) / 10

const getDebugValues = (rawOffset: number): DebugValues => {
  const offset = Math.max(rawOffset, 0)
  const morphDistance = clamp(offset, 0, MORPH_DISTANCE)
  const progress = morphDistance / MORPH_DISTANCE

  return {
    canvasRadius: roundToOneDecimal(progress * MAX_CANVAS_RADIUS),
    cutoutRadius: roundToOneDecimal(progress * MAX_CUTOUT_RADIUS),
    morphDistance: roundToOneDecimal(morphDistance),
    offset: roundToOneDecimal(offset),
    progress: Math.round(progress * 100),
  }
}

export function SmartCornerTabsCase() {
  const instructionsId = useId()
  const [debugValues, setDebugValues] = useState<DebugValues>(() =>
    getDebugValues(0)
  )
  const [maxDragDistance, setMaxDragDistance] = useState(MAX_DRAG_DISTANCE)
  const [showDebugView, setShowDebugView] = useState(true)
  const activeTabRef = useRef<HTMLDivElement>(null)
  const inactiveTabRef = useRef<HTMLDivElement>(null)
  const tabTrackRef = useRef<HTMLDivElement>(null)
  const prefersReducedMotion = useReducedMotion()
  const dragPosition = useMotionValue(0)
  const morphProgress = useTransform(
    dragPosition,
    [0, MORPH_DISTANCE],
    [0, 1],
    { clamp: true }
  )
  const canvasRadius = useTransform(
    morphProgress,
    [0, 1],
    [0, MAX_CANVAS_RADIUS]
  )
  const tabCutoutRadius = useTransform(
    morphProgress,
    [0, 1],
    [0, MAX_CUTOUT_RADIUS]
  )
  const canvasRadiusCss = useMotionTemplate`${canvasRadius}px`
  const tabCutoutRadiusCss = useMotionTemplate`${tabCutoutRadius}px`

  useEffect(() => {
    const activeTab = activeTabRef.current
    const inactiveTab = inactiveTabRef.current
    const tabTrack = tabTrackRef.current

    if (!(activeTab && inactiveTab && tabTrack)) {
      return
    }

    const updateDragConstraint = (): void => {
      const availableDistance =
        inactiveTab.offsetLeft - activeTab.offsetWidth - MIN_TAB_GAP
      const nextMaxDistance = Math.max(
        MORPH_DISTANCE,
        Math.min(MAX_DRAG_DISTANCE, Math.floor(availableDistance))
      )

      setMaxDragDistance((currentDistance) =>
        currentDistance === nextMaxDistance ? currentDistance : nextMaxDistance
      )

      if (dragPosition.get() > nextMaxDistance) {
        dragPosition.set(nextMaxDistance)
      }
    }

    updateDragConstraint()

    const resizeObserver = new ResizeObserver(updateDragConstraint)
    resizeObserver.observe(tabTrack)
    resizeObserver.observe(activeTab)
    resizeObserver.observe(inactiveTab)

    return () => {
      resizeObserver.disconnect()
    }
  }, [dragPosition])

  useMotionValueEvent(dragPosition, 'change', (latestOffset) => {
    setDebugValues(getDebugValues(latestOffset))
  })

  const moveTabFromKeyboard = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>): void => {
      const largerStep = event.shiftKey ? MORPH_DISTANCE : KEYBOARD_STEP
      let nextOffset: number | null = null

      if (event.key === 'ArrowLeft') {
        nextOffset = dragPosition.get() - largerStep
      } else if (event.key === 'ArrowRight') {
        nextOffset = dragPosition.get() + largerStep
      } else if (event.key === 'Home') {
        nextOffset = 0
      } else if (event.key === 'End') {
        nextOffset = maxDragDistance
      }

      if (nextOffset === null) {
        return
      }

      event.preventDefault()
      dragPosition.set(clamp(nextOffset, 0, maxDragDistance))
    },
    [dragPosition, maxDragDistance]
  )

  const resetTab = useCallback((): void => {
    if (prefersReducedMotion) {
      dragPosition.set(0)
      return
    }

    animate(dragPosition, 0, {
      damping: 34,
      stiffness: 420,
      type: 'spring',
    })
  }, [dragPosition, prefersReducedMotion])

  const toggleDebugView = useCallback((): void => {
    setShowDebugView((isVisible) => !isVisible)
  }, [])

  const morphStyle = {
    '--canvas-radius': canvasRadiusCss,
    '--tab-cutout-radius': tabCutoutRadiusCss,
  } as CustomMotionStyle
  const isAtOrigin = debugValues.offset < 0.1

  return (
    <Card className="my-8">
      <CardHeader className={styles.cardHeader}>
        <CardTitle>拖动标签页，观察连接处</CardTitle>
        <CardDescription>
          圆角只在标签页离开画布边缘后的前 20 px 内发生变化。
        </CardDescription>
        <CardAction className={styles.headerActions}>
          <Button
            aria-pressed={showDebugView}
            onClick={toggleDebugView}
            size="sm"
            type="button"
            variant="outline"
          >
            <BugIcon data-icon="inline-start" />
            {showDebugView ? '关闭调试' : '打开调试'}
          </Button>
          <Button
            disabled={isAtOrigin}
            onClick={resetTab}
            size="sm"
            type="button"
            variant="outline"
          >
            <RotateCcwIcon data-icon="inline-start" />
            复位
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent>
        <div className={styles.browserFrame}>
          <aside aria-label="演示应用侧边栏" className={styles.sidebar}>
            <div aria-hidden="true" className={styles.brandMark}>
              D
            </div>
            <div aria-hidden="true" className={styles.sidebarTool}>
              <SparklesIcon />
            </div>
          </aside>

          <section aria-label="智能圆角形变演示" className={styles.workspace}>
            <div className={styles.tabTrack} ref={tabTrackRef}>
              {showDebugView ? (
                <span aria-hidden="true" className={styles.originGuide} />
              ) : null}

              <motion.div
                aria-describedby={instructionsId}
                aria-label="拖动 Draft 04 标签页"
                aria-orientation="horizontal"
                aria-valuemax={maxDragDistance}
                aria-valuemin={0}
                aria-valuenow={Math.round(debugValues.offset)}
                aria-valuetext={`偏移 ${debugValues.offset.toFixed(1)} 像素，参与形变 ${debugValues.morphDistance.toFixed(1)} 像素，完成 ${debugValues.progress}%`}
                className={styles.activeTab}
                drag="x"
                dragConstraints={{ left: 0, right: maxDragDistance }}
                dragElastic={0}
                dragMomentum={false}
                onKeyDown={moveTabFromKeyboard}
                ref={activeTabRef}
                role="slider"
                style={{ ...morphStyle, x: dragPosition }}
                tabIndex={0}
              >
                <span aria-hidden="true" className={styles.activeIcon} />
                <span className={styles.activeLabel}>Draft 04</span>
                <XIcon aria-hidden="true" className={styles.closeIcon} />
              </motion.div>

              <div
                aria-hidden="true"
                className={styles.inactiveTab}
                ref={inactiveTabRef}
              >
                <span className={styles.inactiveIcon} />
                <span className={styles.inactiveLabel}>Research</span>
              </div>
            </div>

            <motion.div className={styles.canvas} style={morphStyle}>
              {showDebugView ? (
                <>
                  <span aria-hidden="true" className={styles.morphZone} />
                  <motion.span
                    aria-hidden="true"
                    className={styles.distanceLine}
                    style={{ width: dragPosition }}
                  />
                </>
              ) : null}

              <div className={styles.canvasHeader}>
                <div>
                  <Badge variant="secondary">Workspace</Badge>
                  <h3>Designing a calmer editor</h3>
                </div>
                <span className={styles.syncStatus}>All changes saved</span>
              </div>

              <div className={styles.canvasGrid}>
                <div className={styles.documentPanel}>
                  <div className={styles.documentLine} data-size="long" />
                  <div className={styles.documentLine} data-size="medium" />
                  <div className={styles.documentLine} data-size="short" />
                  <div className={styles.documentNote}>
                    <span>Focus</span>
                    <p>
                      Keep the canvas quiet and let the active context lead.
                    </p>
                  </div>
                </div>
                <div aria-hidden="true" className={styles.orbitPanel}>
                  <span className={styles.orbitCenter} />
                  <span className={styles.orbit} data-orbit="one" />
                  <span className={styles.orbit} data-orbit="two" />
                  <span className={styles.orbitDot} />
                </div>
              </div>
            </motion.div>
          </section>
        </div>

        {showDebugView ? (
          <section aria-label="实时调试数据" className={styles.debugPanel}>
            <div className={styles.debugSummary}>
              <span>形变计算</span>
              <code>
                clamp({debugValues.offset.toFixed(1)}, 0, {MORPH_DISTANCE}) ={' '}
                {debugValues.morphDistance.toFixed(1)} px
              </code>
            </div>

            <div className={styles.progressRow}>
              <span>形变进度</span>
              <strong>{debugValues.progress}%</strong>
              <span aria-hidden="true" className={styles.progressTrack}>
                <motion.span
                  className={styles.progressFill}
                  style={{ scaleX: morphProgress }}
                />
              </span>
            </div>

            <dl className={styles.debugMetrics}>
              <div>
                <dt>实际位移 x</dt>
                <dd>{debugValues.offset.toFixed(1)} px</dd>
              </div>
              <div>
                <dt>形变距离</dt>
                <dd>{debugValues.morphDistance.toFixed(1)} px</dd>
              </div>
              <div>
                <dt>Canvas radius</dt>
                <dd>{debugValues.canvasRadius.toFixed(1)} px</dd>
              </div>
              <div>
                <dt>Tab cutout</dt>
                <dd>{debugValues.cutoutRadius.toFixed(1)} px</dd>
              </div>
            </dl>
          </section>
        ) : null}

        <p className={styles.keyboardHint} id={instructionsId}>
          拖动后会停在当前位置。键盘可用 ← → 移动，Shift 加速，Home / End
          跳到两端。
        </p>
      </CardContent>
    </Card>
  )
}
