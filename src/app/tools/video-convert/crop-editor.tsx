import {
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react'
import type {
  CropRectangle,
  CropResizeTarget,
  FrameDimensions,
} from './editor-model'
import { moveCropRectangle, resizeCropRectangle } from './editor-model'
import styles from './video-converter.module.css'

type CropInteractionTarget = CropResizeTarget | 'move'

interface CropEditorProps {
  dimensions: FrameDimensions
  onChange: (rectangle: CropRectangle) => void
  rectangle: CropRectangle
}

interface DragSession {
  pointerId: number
  startClientX: number
  startClientY: number
  startRectangle: CropRectangle
  target: CropInteractionTarget
}

const RESIZE_TARGETS: CropResizeTarget[] = [
  'top',
  'right',
  'bottom',
  'left',
  'top-left',
  'top-right',
  'bottom-left',
  'bottom-right',
]

const TARGET_LABELS: Record<CropInteractionTarget, string> = {
  bottom: '调整裁切框下边缘',
  'bottom-left': '调整裁切框左下角',
  'bottom-right': '调整裁切框右下角',
  left: '调整裁切框左边缘',
  move: '移动裁切框',
  right: '调整裁切框右边缘',
  top: '调整裁切框上边缘',
  'top-left': '调整裁切框左上角',
  'top-right': '调整裁切框右上角',
}

const getTargetPoint = (
  rectangle: CropRectangle,
  target: CropResizeTarget
): { x: number; y: number } => {
  const centerX = rectangle.left + rectangle.width / 2
  const centerY = rectangle.top + rectangle.height / 2
  const right = rectangle.left + rectangle.width
  const bottom = rectangle.top + rectangle.height

  if (target === 'top') {
    return { x: centerX, y: rectangle.top }
  }
  if (target === 'right') {
    return { x: right, y: centerY }
  }
  if (target === 'bottom') {
    return { x: centerX, y: bottom }
  }
  if (target === 'left') {
    return { x: rectangle.left, y: centerY }
  }
  if (target === 'top-left') {
    return { x: rectangle.left, y: rectangle.top }
  }
  if (target === 'top-right') {
    return { x: right, y: rectangle.top }
  }
  if (target === 'bottom-left') {
    return { x: rectangle.left, y: bottom }
  }
  return { x: right, y: bottom }
}

const getKeyboardDelta = (
  event: KeyboardEvent<HTMLButtonElement>
): { x: number; y: number } | null => {
  const step = event.shiftKey ? 10 : 1

  if (event.key === 'ArrowLeft') {
    return { x: -step, y: 0 }
  }
  if (event.key === 'ArrowRight') {
    return { x: step, y: 0 }
  }
  if (event.key === 'ArrowUp') {
    return { x: 0, y: -step }
  }
  if (event.key === 'ArrowDown') {
    return { x: 0, y: step }
  }
  return null
}

const getHandleStyle = (
  target: CropResizeTarget,
  percentages: {
    bottom: number
    height: number
    left: number
    right: number
    top: number
    width: number
  }
): CSSProperties => {
  if (target === 'top') {
    return {
      left: `${percentages.left}%`,
      top: `${percentages.top}%`,
      width: `${percentages.width}%`,
    }
  }
  if (target === 'right') {
    return {
      height: `${percentages.height}%`,
      left: `${percentages.right}%`,
      top: `${percentages.top}%`,
    }
  }
  if (target === 'bottom') {
    return {
      left: `${percentages.left}%`,
      top: `${percentages.bottom}%`,
      width: `${percentages.width}%`,
    }
  }
  if (target === 'left') {
    return {
      height: `${percentages.height}%`,
      left: `${percentages.left}%`,
      top: `${percentages.top}%`,
    }
  }

  const left = target.includes('left') ? percentages.left : percentages.right
  const top = target.includes('top') ? percentages.top : percentages.bottom
  return { left: `${left}%`, top: `${top}%` }
}

function CropResizeHandle({
  finishDrag,
  handleKeyDown,
  handlePointerDown,
  handlePointerMove,
  percentages,
  target,
}: {
  finishDrag: (event: ReactPointerEvent<HTMLButtonElement>) => void
  handleKeyDown: (
    event: KeyboardEvent<HTMLButtonElement>,
    target: CropInteractionTarget
  ) => void
  handlePointerDown: (
    event: ReactPointerEvent<HTMLButtonElement>,
    target: CropInteractionTarget
  ) => void
  handlePointerMove: (event: ReactPointerEvent<HTMLButtonElement>) => void
  percentages: {
    bottom: number
    height: number
    left: number
    right: number
    top: number
    width: number
  }
  target: CropResizeTarget
}) {
  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>) => handleKeyDown(event, target),
    [handleKeyDown, target]
  )
  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) =>
      handlePointerDown(event, target),
    [handlePointerDown, target]
  )

  return (
    <button
      aria-label={TARGET_LABELS[target]}
      className={styles.cropHandle}
      data-target={target}
      onKeyDown={onKeyDown}
      onPointerCancel={finishDrag}
      onPointerDown={onPointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishDrag}
      style={getHandleStyle(target, percentages)}
      title={`${TARGET_LABELS[target]}；方向键微调，Shift 加速`}
      type="button"
    />
  )
}

export function CropEditor({
  dimensions,
  onChange,
  rectangle,
}: CropEditorProps) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const dragSessionRef = useRef<DragSession | null>(null)
  const [dragging, setDragging] = useState(false)

  const percentages = useMemo(
    () => ({
      bottom: ((rectangle.top + rectangle.height) / dimensions.height) * 100,
      height: (rectangle.height / dimensions.height) * 100,
      left: (rectangle.left / dimensions.width) * 100,
      right: ((rectangle.left + rectangle.width) / dimensions.width) * 100,
      top: (rectangle.top / dimensions.height) * 100,
      width: (rectangle.width / dimensions.width) * 100,
    }),
    [dimensions, rectangle]
  )

  const finishDrag = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      const session = dragSessionRef.current
      if (!session || session.pointerId !== event.pointerId) {
        return
      }

      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }
      dragSessionRef.current = null
      setDragging(false)
    },
    []
  )

  const handlePointerDown = useCallback(
    (
      event: ReactPointerEvent<HTMLButtonElement>,
      target: CropInteractionTarget
    ) => {
      if (event.button !== 0) {
        return
      }

      event.preventDefault()
      event.stopPropagation()
      event.currentTarget.setPointerCapture(event.pointerId)
      dragSessionRef.current = {
        pointerId: event.pointerId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startRectangle: rectangle,
        target,
      }
      setDragging(true)
    },
    [rectangle]
  )

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      const session = dragSessionRef.current
      const bounds = overlayRef.current?.getBoundingClientRect()
      if (
        !session ||
        session.pointerId !== event.pointerId ||
        !bounds ||
        bounds.width <= 0 ||
        bounds.height <= 0
      ) {
        return
      }

      event.preventDefault()
      const scaleX = dimensions.width / bounds.width
      const scaleY = dimensions.height / bounds.height

      if (session.target === 'move') {
        onChange(
          moveCropRectangle({
            deltaX: (event.clientX - session.startClientX) * scaleX,
            deltaY: (event.clientY - session.startClientY) * scaleY,
            dimensions,
            rectangle: session.startRectangle,
          })
        )
        return
      }

      onChange(
        resizeCropRectangle({
          dimensions,
          rectangle: session.startRectangle,
          target: session.target,
          x: (event.clientX - bounds.left) * scaleX,
          y: (event.clientY - bounds.top) * scaleY,
        })
      )
    },
    [dimensions, onChange]
  )

  const handleKeyDown = useCallback(
    (
      event: KeyboardEvent<HTMLButtonElement>,
      target: CropInteractionTarget
    ) => {
      const delta = getKeyboardDelta(event)
      if (!delta) {
        return
      }

      event.preventDefault()
      if (target === 'move') {
        onChange(
          moveCropRectangle({
            deltaX: delta.x,
            deltaY: delta.y,
            dimensions,
            rectangle,
          })
        )
        return
      }

      const point = getTargetPoint(rectangle, target)
      onChange(
        resizeCropRectangle({
          dimensions,
          rectangle,
          target,
          x: point.x + delta.x,
          y: point.y + delta.y,
        })
      )
    },
    [dimensions, onChange, rectangle]
  )
  const handleMoveKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>) => handleKeyDown(event, 'move'),
    [handleKeyDown]
  )
  const handleMovePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) =>
      handlePointerDown(event, 'move'),
    [handlePointerDown]
  )

  return (
    <div
      className={styles.cropOverlay}
      data-dragging={dragging}
      ref={overlayRef}
    >
      <svg
        aria-hidden="true"
        className={styles.cropBackdrop}
        preserveAspectRatio="none"
        viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
      >
        <path
          d={`M0 0H${dimensions.width}V${dimensions.height}H0Z M${rectangle.left} ${rectangle.top}H${rectangle.left + rectangle.width}V${rectangle.top + rectangle.height}H${rectangle.left}Z`}
          fillRule="evenodd"
        />
      </svg>

      <div
        aria-hidden="true"
        className={styles.cropSelection}
        style={{
          height: `${percentages.height}%`,
          left: `${percentages.left}%`,
          top: `${percentages.top}%`,
          width: `${percentages.width}%`,
        }}
      >
        <span className={styles.cropSizeLabel}>
          {rectangle.width}×{rectangle.height}
        </span>
      </div>

      <div aria-hidden="true" className={styles.cropIndicators}>
        <span
          className={styles.cropHorizontalIndicator}
          style={{ left: `${percentages.left}%` }}
        >
          {rectangle.left}
        </span>
        <span
          className={styles.cropHorizontalIndicator}
          style={{ left: `${percentages.right}%` }}
        >
          {rectangle.left + rectangle.width}
        </span>
        <span
          className={styles.cropVerticalIndicator}
          style={{ top: `${percentages.top}%` }}
        >
          {rectangle.top}
        </span>
        <span
          className={styles.cropVerticalIndicator}
          style={{ top: `${percentages.bottom}%` }}
        >
          {rectangle.top + rectangle.height}
        </span>
      </div>

      <button
        aria-label={TARGET_LABELS.move}
        className={styles.cropMoveArea}
        onKeyDown={handleMoveKeyDown}
        onPointerCancel={finishDrag}
        onPointerDown={handleMovePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishDrag}
        style={{
          height: `${percentages.height}%`,
          left: `${percentages.left}%`,
          top: `${percentages.top}%`,
          width: `${percentages.width}%`,
        }}
        title="拖动移动裁切框；方向键微调，Shift 加速"
        type="button"
      />

      {RESIZE_TARGETS.map((target) => (
        <CropResizeHandle
          finishDrag={finishDrag}
          handleKeyDown={handleKeyDown}
          handlePointerDown={handlePointerDown}
          handlePointerMove={handlePointerMove}
          key={target}
          percentages={percentages}
          target={target}
        />
      ))}
    </div>
  )
}
