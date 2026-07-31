export interface CropRectangle {
  height: number
  left: number
  top: number
  width: number
}

export interface FrameDimensions {
  height: number
  width: number
}

export interface TrimFrameRange {
  inFrame: number
  outFrame: number
}

export type CropField = keyof CropRectangle
export type CropResizeTarget =
  | 'bottom'
  | 'bottom-left'
  | 'bottom-right'
  | 'left'
  | 'right'
  | 'top'
  | 'top-left'
  | 'top-right'

export type TrimBoundary = 'in' | 'out'

const DEFAULT_PLAYER_FPS = 30
const REMOTION_MINIMUM_CROP_SIZE = 120

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max)

const roundFinite = (value: number, fallback: number): number =>
  Number.isFinite(value) ? Math.round(value) : fallback

export const getCropMinimums = (
  dimensions: FrameDimensions
): FrameDimensions => ({
  height: Math.min(REMOTION_MINIMUM_CROP_SIZE, dimensions.height),
  width: Math.min(REMOTION_MINIMUM_CROP_SIZE, dimensions.width),
})

export const createFullCropRectangle = (
  dimensions: FrameDimensions
): CropRectangle => ({
  height: dimensions.height,
  left: 0,
  top: 0,
  width: dimensions.width,
})

export const normalizeCropRectangle = (
  rectangle: CropRectangle,
  dimensions: FrameDimensions
): CropRectangle => {
  const minimums = getCropMinimums(dimensions)
  const width = clamp(
    roundFinite(rectangle.width, dimensions.width),
    minimums.width,
    dimensions.width
  )
  const height = clamp(
    roundFinite(rectangle.height, dimensions.height),
    minimums.height,
    dimensions.height
  )

  return {
    height,
    left: clamp(roundFinite(rectangle.left, 0), 0, dimensions.width - width),
    top: clamp(roundFinite(rectangle.top, 0), 0, dimensions.height - height),
    width,
  }
}

export const updateCropField = ({
  dimensions,
  field,
  rectangle,
  value,
}: {
  dimensions: FrameDimensions
  field: CropField
  rectangle: CropRectangle
  value: number
}): CropRectangle => {
  const minimums = getCropMinimums(dimensions)
  const nextValue = roundFinite(value, rectangle[field])

  if (field === 'left') {
    const left = clamp(nextValue, 0, dimensions.width - minimums.width)
    return {
      ...rectangle,
      left,
      width: clamp(rectangle.width, minimums.width, dimensions.width - left),
    }
  }
  if (field === 'top') {
    const top = clamp(nextValue, 0, dimensions.height - minimums.height)
    return {
      ...rectangle,
      height: clamp(rectangle.height, minimums.height, dimensions.height - top),
      top,
    }
  }
  if (field === 'width') {
    return {
      ...rectangle,
      width: clamp(
        nextValue,
        minimums.width,
        dimensions.width - rectangle.left
      ),
    }
  }

  return {
    ...rectangle,
    height: clamp(
      nextValue,
      minimums.height,
      dimensions.height - rectangle.top
    ),
  }
}

export const moveCropRectangle = ({
  deltaX,
  deltaY,
  dimensions,
  rectangle,
}: {
  deltaX: number
  deltaY: number
  dimensions: FrameDimensions
  rectangle: CropRectangle
}): CropRectangle => ({
  ...rectangle,
  left: clamp(
    Math.round(rectangle.left + deltaX),
    0,
    dimensions.width - rectangle.width
  ),
  top: clamp(
    Math.round(rectangle.top + deltaY),
    0,
    dimensions.height - rectangle.height
  ),
})

const resizeHorizontal = ({
  dimensions,
  rectangle,
  target,
  x,
}: {
  dimensions: FrameDimensions
  rectangle: CropRectangle
  target: CropResizeTarget
  x: number
}): Pick<CropRectangle, 'left' | 'width'> => {
  const minimumWidth = getCropMinimums(dimensions).width
  const right = rectangle.left + rectangle.width

  if (target.includes('left')) {
    const left = clamp(Math.round(x), 0, right - minimumWidth)
    return { left, width: right - left }
  }
  if (target.includes('right')) {
    return {
      left: rectangle.left,
      width: clamp(
        Math.round(x) - rectangle.left,
        minimumWidth,
        dimensions.width - rectangle.left
      ),
    }
  }

  return { left: rectangle.left, width: rectangle.width }
}

const resizeVertical = ({
  dimensions,
  rectangle,
  target,
  y,
}: {
  dimensions: FrameDimensions
  rectangle: CropRectangle
  target: CropResizeTarget
  y: number
}): Pick<CropRectangle, 'height' | 'top'> => {
  const minimumHeight = getCropMinimums(dimensions).height
  const bottom = rectangle.top + rectangle.height

  if (target.includes('top')) {
    const top = clamp(Math.round(y), 0, bottom - minimumHeight)
    return { height: bottom - top, top }
  }
  if (target.includes('bottom')) {
    return {
      height: clamp(
        Math.round(y) - rectangle.top,
        minimumHeight,
        dimensions.height - rectangle.top
      ),
      top: rectangle.top,
    }
  }

  return { height: rectangle.height, top: rectangle.top }
}

export const resizeCropRectangle = ({
  dimensions,
  rectangle,
  target,
  x,
  y,
}: {
  dimensions: FrameDimensions
  rectangle: CropRectangle
  target: CropResizeTarget
  x: number
  y: number
}): CropRectangle => ({
  ...resizeHorizontal({ dimensions, rectangle, target, x }),
  ...resizeVertical({ dimensions, rectangle, target, y }),
})

export const getRotatedDimensions = (
  dimensions: FrameDimensions,
  rotation: 0 | 90 | 180 | 270
): FrameDimensions =>
  rotation === 90 || rotation === 270
    ? { height: dimensions.width, width: dimensions.height }
    : dimensions

export const mapVisualCropToConversion = ({
  dimensions,
  mirrorHorizontal,
  mirrorVertical,
  rectangle,
}: {
  dimensions: FrameDimensions
  mirrorHorizontal: boolean
  mirrorVertical: boolean
  rectangle: CropRectangle
}): CropRectangle =>
  normalizeCropRectangle(
    {
      ...rectangle,
      left: mirrorHorizontal
        ? dimensions.width - rectangle.left - rectangle.width
        : rectangle.left,
      top: mirrorVertical
        ? dimensions.height - rectangle.top - rectangle.height
        : rectangle.top,
    },
    dimensions
  )

export const getPlayerFps = (frameRate: number | null | undefined): number =>
  typeof frameRate === 'number' && Number.isFinite(frameRate) && frameRate > 0
    ? frameRate
    : DEFAULT_PLAYER_FPS

export const getDurationInFrames = (duration: number, fps: number): number =>
  Number.isFinite(duration) && duration > 0
    ? Math.max(1, Math.ceil(duration * fps))
    : 1

export const createFullTrimRange = (
  durationInFrames: number
): TrimFrameRange => ({
  inFrame: 0,
  outFrame: Math.max(0, durationInFrames - 1),
})

export const normalizeTrimRange = (
  range: TrimFrameRange,
  durationInFrames: number
): TrimFrameRange => {
  const lastFrame = Math.max(0, durationInFrames - 1)
  const inFrame = clamp(roundFinite(range.inFrame, 0), 0, lastFrame)
  const outFrame = clamp(
    roundFinite(range.outFrame, lastFrame),
    inFrame,
    lastFrame
  )
  return { inFrame, outFrame }
}

export const moveTrimBoundary = ({
  boundary,
  durationInFrames,
  frame,
  range,
}: {
  boundary: TrimBoundary
  durationInFrames: number
  frame: number
  range: TrimFrameRange
}): TrimFrameRange => {
  const normalized = normalizeTrimRange(range, durationInFrames)
  const lastFrame = Math.max(0, durationInFrames - 1)

  return boundary === 'in'
    ? {
        ...normalized,
        inFrame: clamp(Math.round(frame), 0, normalized.outFrame),
      }
    : {
        ...normalized,
        outFrame: clamp(Math.round(frame), normalized.inFrame, lastFrame),
      }
}

export const getTimelineFrameX = ({
  durationInFrames,
  frame,
  inset,
  width,
}: {
  durationInFrames: number
  frame: number
  inset: number
  width: number
}): number => {
  const lastFrame = Math.max(0, durationInFrames - 1)
  const safeWidth = Math.max(0, width)
  const safeInset = clamp(inset, 0, safeWidth / 2)
  const railWidth = safeWidth - safeInset * 2
  const progress = lastFrame === 0 ? 0 : clamp(frame, 0, lastFrame) / lastFrame

  return safeInset + progress * railWidth
}

export const getTimelineFrameAtX = ({
  durationInFrames,
  inset,
  width,
  x,
}: {
  durationInFrames: number
  inset: number
  width: number
  x: number
}): number => {
  const lastFrame = Math.max(0, durationInFrames - 1)
  const safeWidth = Math.max(0, width)
  const safeInset = clamp(inset, 0, safeWidth / 2)
  const railWidth = safeWidth - safeInset * 2
  const progress =
    railWidth === 0 ? 0 : clamp((x - safeInset) / railWidth, 0, 1)

  return Math.round(progress * lastFrame)
}

export const trimRangeToSeconds = ({
  duration,
  fps,
  range,
}: {
  duration: number
  fps: number
  range: TrimFrameRange
}): { end: number; start: number } => ({
  end: Math.min(duration, (range.outFrame + 1) / fps),
  start: Math.min(duration, range.inFrame / fps),
})

export const secondsToTrimFrame = ({
  boundary,
  durationInFrames,
  fps,
  seconds,
}: {
  boundary: TrimBoundary
  durationInFrames: number
  fps: number
  seconds: number
}): number => {
  const lastFrame = Math.max(0, durationInFrames - 1)
  const exactFrame = Math.round(Math.max(0, seconds) * fps)
  return clamp(boundary === 'out' ? exactFrame - 1 : exactFrame, 0, lastFrame)
}

export const formatPreciseTimestamp = (seconds: number): string => {
  const clamped = Math.max(0, seconds)
  const hours = Math.floor(clamped / 3600)
  const minutes = Math.floor((clamped % 3600) / 60)
  const remainingSeconds = (clamped % 60).toFixed(3).padStart(6, '0')

  return hours > 0
    ? `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds}`
    : `${minutes}:${remainingSeconds}`
}
