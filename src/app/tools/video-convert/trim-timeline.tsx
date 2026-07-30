import {
  Maximize2Icon,
  Minimize2Icon,
  MinusIcon,
  PauseIcon,
  PlayIcon,
  PlusIcon,
  Volume2Icon,
  VolumeXIcon,
} from 'lucide-react'
import {
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Button } from '@/components/ui/button'
import { Field, FieldLabel } from '@/components/ui/field'
import { Slider } from '@/components/ui/slider'
import type { TrimBoundary, TrimFrameRange } from './editor-model'
import {
  clamp,
  formatPreciseTimestamp,
  moveTrimBoundary,
  normalizeTrimRange,
  trimRangeToSeconds,
} from './editor-model'
import type { PreparedMedia } from './media-engine'
import styles from './video-converter.module.css'

interface TrimTimelineProps {
  currentTime: number
  duration: number
  durationInFrames: number
  fps: number
  isFullscreen: boolean
  isMuted: boolean
  isPlaying: boolean
  onChange: (range: TrimFrameRange) => void
  onSeek: (frame: number) => void
  onToggleFullscreen: () => void
  onToggleMute: () => void
  onTogglePlayback: () => void
  onVolumeChange: (volume: number) => void
  prepared: PreparedMedia
  range: TrimFrameRange
  trimActive: boolean
  volume: number
}

type TimelineDragTarget = TrimBoundary | 'playhead'

interface TrimDragSession {
  captureTarget: HTMLButtonElement
  grabOffsetX: number
  pointerId: number
  target: TimelineDragTarget
}

const FILMSTRIP_HEIGHT = 48
const DESKTOP_HANDLE_WIDTH = 14
const MOBILE_HANDLE_WIDTH = 20
const INITIAL_REPEAT_DELAY = 350
const REPEAT_INTERVAL = 80

function FrameStepButton({
  ariaLabel,
  disabled,
  icon,
  onStep,
}: {
  ariaLabel: string
  disabled: boolean
  icon: 'minus' | 'plus'
  onStep: () => void
}) {
  const repeatTimeoutRef = useRef<number | null>(null)
  const repeatIntervalRef = useRef<number | null>(null)
  const suppressClickRef = useRef(false)
  const disabledRef = useRef(disabled)
  const onStepRef = useRef(onStep)
  const Icon = icon === 'minus' ? MinusIcon : PlusIcon

  disabledRef.current = disabled
  onStepRef.current = onStep

  const stopRepeating = useCallback(() => {
    if (repeatTimeoutRef.current !== null) {
      window.clearTimeout(repeatTimeoutRef.current)
      repeatTimeoutRef.current = null
    }
    if (repeatIntervalRef.current !== null) {
      window.clearInterval(repeatIntervalRef.current)
      repeatIntervalRef.current = null
    }
  }, [])

  useEffect(() => stopRepeating, [stopRepeating])

  const step = useCallback(() => {
    if (disabledRef.current) {
      stopRepeating()
      return
    }
    onStepRef.current()
  }, [stopRepeating])

  const finishPress = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }
      stopRepeating()
      window.setTimeout(() => {
        suppressClickRef.current = false
      }, 0)
    },
    [stopRepeating]
  )
  const handleClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      if (suppressClickRef.current) {
        suppressClickRef.current = false
        event.preventDefault()
        return
      }
      step()
    },
    [step]
  )
  const handleContextMenu = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => event.preventDefault(),
    []
  )
  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (event.button !== 0 || disabled) {
        return
      }
      event.preventDefault()
      event.currentTarget.setPointerCapture(event.pointerId)
      suppressClickRef.current = true
      step()
      repeatTimeoutRef.current = window.setTimeout(() => {
        step()
        repeatIntervalRef.current = window.setInterval(step, REPEAT_INTERVAL)
      }, INITIAL_REPEAT_DELAY)
    },
    [disabled, step]
  )

  return (
    <Button
      aria-label={ariaLabel}
      className={styles.frameStepButton}
      disabled={disabled}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      onPointerCancel={finishPress}
      onPointerDown={handlePointerDown}
      onPointerUp={finishPress}
      size="icon-sm"
      type="button"
      variant="outline"
    >
      <Icon aria-hidden="true" />
    </Button>
  )
}

export function TrimTimeline({
  currentTime,
  duration,
  durationInFrames,
  fps,
  isFullscreen,
  isMuted,
  isPlaying,
  onChange,
  onSeek,
  onToggleFullscreen,
  onToggleMute,
  onTogglePlayback,
  onVolumeChange,
  prepared,
  range,
  trimActive,
  volume,
}: TrimTimelineProps) {
  const volumeSliderId = useId()
  const wrapperRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dragSessionRef = useRef<TrimDragSession | null>(null)
  const [hasCoarsePointer, setHasCoarsePointer] = useState(false)
  const [timelineWidth, setTimelineWidth] = useState(0)
  const [thumbnailState, setThumbnailState] = useState<
    'error' | 'loading' | 'ready'
  >('loading')
  const normalizedRange = useMemo(
    () => normalizeTrimRange(range, durationInFrames),
    [durationInFrames, range]
  )
  const currentFrame = clamp(
    Math.round(currentTime * fps),
    0,
    Math.max(0, durationInFrames - 1)
  )
  const handleWidth = hasCoarsePointer
    ? MOBILE_HANDLE_WIDTH
    : DESKTOP_HANDLE_WIDTH

  useEffect(() => {
    const mediaQuery = window.matchMedia('(pointer: coarse)')
    const updatePointerType = () => setHasCoarsePointer(mediaQuery.matches)
    updatePointerType()
    mediaQuery.addEventListener('change', updatePointerType)
    return () => mediaQuery.removeEventListener('change', updatePointerType)
  }, [])

  useEffect(() => {
    const wrapper = wrapperRef.current
    if (!wrapper) {
      return
    }

    const updateWidth = () => {
      const nextWidth = Math.round(wrapper.getBoundingClientRect().width)
      setTimelineWidth((current) =>
        current === nextWidth ? current : nextWidth
      )
    }
    updateWidth()
    const observer = new ResizeObserver(updateWidth)
    observer.observe(wrapper)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || timelineWidth <= 0) {
      return
    }

    const abortController = new AbortController()
    let current = true
    setThumbnailState('loading')

    import('./media-engine')
      .then((engine) =>
        engine.drawFilmstrip({
          canvas,
          height: FILMSTRIP_HEIGHT,
          prepared,
          signal: abortController.signal,
          width: timelineWidth,
        })
      )
      .then(() => {
        if (current && !abortController.signal.aborted) {
          setThumbnailState('ready')
        }
      })
      .catch(() => {
        if (current && !abortController.signal.aborted) {
          setThumbnailState('error')
        }
      })

    return () => {
      current = false
      abortController.abort()
    }
  }, [prepared, timelineWidth])

  const frameToOriginX = useCallback(
    (frame: number): number => {
      const railWidth = Math.max(1, timelineWidth - handleWidth * 2)
      const progress = frame / Math.max(1, durationInFrames - 1)
      return handleWidth + progress * railWidth
    },
    [durationInFrames, handleWidth, timelineWidth]
  )

  const geometry = useMemo(() => {
    if (timelineWidth <= 0) {
      return null
    }
    const startOrigin = frameToOriginX(normalizedRange.inFrame)
    const endOrigin = frameToOriginX(normalizedRange.outFrame)
    return {
      activeLeft: startOrigin,
      activeWidth: Math.max(0, endOrigin - startOrigin),
      endHandleLeft: endOrigin,
      leftMaskWidth: startOrigin,
      rightMaskLeft: endOrigin,
      rightMaskWidth: Math.max(0, timelineWidth - endOrigin),
      startHandleLeft: startOrigin - handleWidth,
    }
  }, [frameToOriginX, handleWidth, normalizedRange, timelineWidth])
  const playheadLeft = timelineWidth > 0 ? frameToOriginX(currentFrame) : null

  const getFrameFromLocalX = useCallback(
    (localX: number, width: number): number => {
      const railWidth = Math.max(1, width - handleWidth * 2)
      const progress = clamp((localX - handleWidth) / railWidth, 0, 1)
      return Math.round(progress * Math.max(0, durationInFrames - 1))
    },
    [durationInFrames, handleWidth]
  )

  const updateBoundary = useCallback(
    (boundary: TrimBoundary, frame: number) => {
      const nextRange = moveTrimBoundary({
        boundary,
        durationInFrames,
        frame,
        range: normalizedRange,
      })
      onChange(nextRange)
      onSeek(boundary === 'in' ? nextRange.inFrame : nextRange.outFrame)
    },
    [durationInFrames, normalizedRange, onChange, onSeek]
  )

  const handlePointerDown = useCallback(
    (
      event: ReactPointerEvent<HTMLButtonElement>,
      target: TimelineDragTarget
    ) => {
      if (event.button !== 0) {
        return
      }
      const bounds = wrapperRef.current?.getBoundingClientRect()
      if (!bounds) {
        return
      }

      event.preventDefault()
      event.currentTarget.setPointerCapture(event.pointerId)
      let frame = currentFrame
      if (target === 'in') {
        frame = normalizedRange.inFrame
      } else if (target === 'out') {
        frame = normalizedRange.outFrame
      }
      dragSessionRef.current = {
        captureTarget: event.currentTarget,
        grabOffsetX: event.clientX - bounds.left - frameToOriginX(frame),
        pointerId: event.pointerId,
        target,
      }
      onSeek(frame)
    },
    [currentFrame, frameToOriginX, normalizedRange, onSeek]
  )

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const session = dragSessionRef.current
      const bounds = wrapperRef.current?.getBoundingClientRect()
      if (!(session && bounds) || session.pointerId !== event.pointerId) {
        return
      }
      event.preventDefault()
      const frame = getFrameFromLocalX(
        event.clientX - bounds.left - session.grabOffsetX,
        bounds.width
      )

      if (session.target === 'playhead') {
        onSeek(frame)
        return
      }
      updateBoundary(session.target, frame)
    },
    [getFrameFromLocalX, onSeek, updateBoundary]
  )

  const finishDrag = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const session = dragSessionRef.current
    if (!session || session.pointerId !== event.pointerId) {
      return
    }
    if (session.captureTarget.hasPointerCapture(event.pointerId)) {
      session.captureTarget.releasePointerCapture(event.pointerId)
    }
    dragSessionRef.current = null
  }, [])

  const handleHandleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>, boundary: TrimBoundary) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
        return
      }
      event.preventDefault()
      const boundaryFrame =
        boundary === 'in' ? normalizedRange.inFrame : normalizedRange.outFrame
      updateBoundary(
        boundary,
        boundaryFrame + (event.key === 'ArrowLeft' ? -1 : 1)
      )
    },
    [normalizedRange, updateBoundary]
  )
  const handleInKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>) =>
      handleHandleKeyDown(event, 'in'),
    [handleHandleKeyDown]
  )
  const handleOutKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>) =>
      handleHandleKeyDown(event, 'out'),
    [handleHandleKeyDown]
  )
  const handleInPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) =>
      handlePointerDown(event, 'in'),
    [handlePointerDown]
  )
  const handleOutPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) =>
      handlePointerDown(event, 'out'),
    [handlePointerDown]
  )
  const handlePlayheadKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
        return
      }
      event.preventDefault()
      onSeek(currentFrame + (event.key === 'ArrowLeft' ? -1 : 1))
    },
    [currentFrame, onSeek]
  )
  const handlePlayheadPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) =>
      handlePointerDown(event, 'playhead'),
    [handlePointerDown]
  )
  const handleVolumeChange = useCallback(
    (nextVolume: number | readonly number[]) => {
      onVolumeChange(
        typeof nextVolume === 'number' ? nextVolume : (nextVolume[0] ?? 0)
      )
    },
    [onVolumeChange]
  )
  const moveInBack = useCallback(
    () => updateBoundary('in', normalizedRange.inFrame - 1),
    [normalizedRange.inFrame, updateBoundary]
  )
  const moveInForward = useCallback(
    () => updateBoundary('in', normalizedRange.inFrame + 1),
    [normalizedRange.inFrame, updateBoundary]
  )
  const moveOutBack = useCallback(
    () => updateBoundary('out', normalizedRange.outFrame - 1),
    [normalizedRange.outFrame, updateBoundary]
  )
  const moveOutForward = useCallback(
    () => updateBoundary('out', normalizedRange.outFrame + 1),
    [normalizedRange.outFrame, updateBoundary]
  )

  const timestamps = trimRangeToSeconds({
    duration,
    fps,
    range: normalizedRange,
  })

  return (
    <div className={styles.trimTimeline}>
      <div
        className={styles.filmstrip}
        data-loading={thumbnailState === 'loading'}
        onPointerCancel={finishDrag}
        onPointerMove={handlePointerMove}
        onPointerUp={finishDrag}
        ref={wrapperRef}
      >
        <canvas className={styles.filmstripCanvas} ref={canvasRef} />
        {trimActive && geometry ? (
          <>
            <span
              aria-hidden="true"
              className={styles.trimMask}
              style={{ left: 0, width: geometry.leftMaskWidth }}
            />
            <span
              aria-hidden="true"
              className={styles.trimMask}
              style={{
                left: geometry.rightMaskLeft,
                width: geometry.rightMaskWidth,
              }}
            />
            <span
              aria-hidden="true"
              className={styles.trimSelection}
              style={{
                left: geometry.activeLeft,
                width: geometry.activeWidth,
              }}
            />
            <Button
              aria-label="剪辑开始帧"
              aria-valuemax={normalizedRange.outFrame}
              aria-valuemin={0}
              aria-valuenow={normalizedRange.inFrame}
              aria-valuetext={formatPreciseTimestamp(timestamps.start)}
              className={styles.trimHandle}
              data-boundary="in"
              onKeyDown={handleInKeyDown}
              onPointerDown={handleInPointerDown}
              role="slider"
              style={{ left: geometry.startHandleLeft, width: handleWidth }}
              type="button"
              variant="ghost"
            >
              <span aria-hidden="true" />
              <span aria-hidden="true" />
            </Button>
            <Button
              aria-label="剪辑结束帧"
              aria-valuemax={durationInFrames - 1}
              aria-valuemin={normalizedRange.inFrame}
              aria-valuenow={normalizedRange.outFrame}
              aria-valuetext={formatPreciseTimestamp(timestamps.end)}
              className={styles.trimHandle}
              data-boundary="out"
              onKeyDown={handleOutKeyDown}
              onPointerDown={handleOutPointerDown}
              role="slider"
              style={{ left: geometry.endHandleLeft, width: handleWidth }}
              type="button"
              variant="ghost"
            >
              <span aria-hidden="true" />
              <span aria-hidden="true" />
            </Button>
          </>
        ) : null}
        {playheadLeft === null ? null : (
          <Button
            aria-label="当前播放位置"
            aria-valuemax={Math.max(0, durationInFrames - 1)}
            aria-valuemin={0}
            aria-valuenow={currentFrame}
            aria-valuetext={formatPreciseTimestamp(
              Math.min(duration, Math.max(0, currentTime))
            )}
            className={styles.timelinePlayhead}
            onKeyDown={handlePlayheadKeyDown}
            onPointerDown={handlePlayheadPointerDown}
            role="slider"
            style={{ left: playheadLeft }}
            title="拖动控制播放进度；方向键逐帧移动"
            type="button"
            variant="ghost"
          >
            <span aria-hidden="true" />
          </Button>
        )}
      </div>

      <div className={styles.timelineTransport}>
        <div className={styles.timelineControlGroup}>
          <Button
            aria-label={isPlaying ? '暂停视频' : '播放视频'}
            className={styles.timelineControlButton}
            onClick={onTogglePlayback}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            {isPlaying ? (
              <PauseIcon aria-hidden="true" />
            ) : (
              <PlayIcon aria-hidden="true" />
            )}
          </Button>
          <Button
            aria-label={isMuted || volume === 0 ? '取消静音' : '静音'}
            className={styles.timelineControlButton}
            onClick={onToggleMute}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            {isMuted || volume === 0 ? (
              <VolumeXIcon aria-hidden="true" />
            ) : (
              <Volume2Icon aria-hidden="true" />
            )}
          </Button>
          <Field className={styles.volumeField}>
            <FieldLabel className="sr-only" htmlFor={volumeSliderId}>
              音量
            </FieldLabel>
            <Slider
              className={styles.volumeSlider}
              id={volumeSliderId}
              max={1}
              min={0}
              onValueChange={handleVolumeChange}
              step={0.01}
              value={[volume]}
            />
          </Field>
        </div>

        <time className={styles.playbackTime}>
          {formatPreciseTimestamp(Math.min(duration, Math.max(0, currentTime)))}{' '}
          / {formatPreciseTimestamp(duration)}
        </time>

        <Button
          aria-label={isFullscreen ? '退出全屏' : '进入全屏'}
          className={styles.timelineControlButton}
          onClick={onToggleFullscreen}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          {isFullscreen ? (
            <Minimize2Icon aria-hidden="true" />
          ) : (
            <Maximize2Icon aria-hidden="true" />
          )}
        </Button>
      </div>

      {thumbnailState === 'error' ? (
        <p className={styles.filmstripError} role="status">
          当前浏览器无法生成缩略图，不影响拖动进度和时间范围剪辑。
        </p>
      ) : null}

      {trimActive ? (
        <div className={styles.trimFineControls}>
          <div>
            <time>{formatPreciseTimestamp(timestamps.start)}</time>
            <span>
              <FrameStepButton
                ariaLabel="开始帧向前移动 1 帧"
                disabled={normalizedRange.inFrame === 0}
                icon="minus"
                onStep={moveInBack}
              />
              <FrameStepButton
                ariaLabel="开始帧向后移动 1 帧"
                disabled={normalizedRange.inFrame >= normalizedRange.outFrame}
                icon="plus"
                onStep={moveInForward}
              />
            </span>
          </div>
          <div>
            <time>{formatPreciseTimestamp(timestamps.end)}</time>
            <span>
              <FrameStepButton
                ariaLabel="结束帧向前移动 1 帧"
                disabled={normalizedRange.outFrame <= normalizedRange.inFrame}
                icon="minus"
                onStep={moveOutBack}
              />
              <FrameStepButton
                ariaLabel="结束帧向后移动 1 帧"
                disabled={normalizedRange.outFrame === durationInFrames - 1}
                icon="plus"
                onStep={moveOutForward}
              />
            </span>
          </div>
        </div>
      ) : null}
    </div>
  )
}
