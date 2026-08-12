'use client'

import type {
  CropperCanvas,
  CropperGrid,
  CropperImage,
  CropperSelection,
} from 'cropperjs'
import {
  ArrowLeftIcon,
  CheckCircle2Icon,
  ClipboardIcon,
  CropIcon,
  DownloadIcon,
  FlipHorizontal2Icon,
  FlipVertical2Icon,
  Grid3X3Icon,
  ImageIcon,
  Link2OffIcon,
  LinkIcon,
  LoaderCircleIcon,
  Redo2Icon,
  RefreshCcwIcon,
  RotateCcwIcon,
  RotateCwIcon,
  Undo2Icon,
  UploadIcon,
} from 'lucide-react'
import type {
  ChangeEvent,
  FocusEvent,
  KeyboardEvent as ReactKeyboardEvent,
  UIEvent,
} from 'react'
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  ACCEPTED_IMAGE_TYPES,
  exportCropSelection,
  prepareImageFile,
} from './image-crop-engine'
import type {
  AspectPreset,
  CropField,
  CropRectangle,
  CropShape,
  Dimensions,
  EditorSnapshot,
  HistoryState,
  NaturalCropMapping,
  OutputFormat,
  ProcessingPhase,
  TransformMatrix,
} from './image-crop-model'
import {
  ASPECT_PRESET_LABELS,
  clamp,
  coerceOutputFormat,
  createHistory,
  createOutputFileName,
  fitAspectCrop,
  formatBytes,
  getAspectRatio,
  getDefaultOutputDimensions,
  getMatrixScale,
  mapNaturalCropToSelection,
  mapSelectionToNaturalCrop,
  normalizeRotation,
  pushHistory,
  redoHistory,
  roundDimension,
  undoHistory,
  updateLockedDimensions,
  updateNaturalCropField,
  validateOutputDimensions,
} from './image-crop-model'
import styles from './image-cropper.module.css'

interface CropperRuntime {
  canvas: CropperCanvas
  cropper: import('cropperjs').default
  grid: CropperGrid | null
  image: CropperImage
  initialScale: number
  selection: CropperSelection
}

interface ExportResult {
  blob: Blob
  fileName: string
  height: number
  mimeType: string
  url: string
  width: number
}

interface NumericFieldProps {
  label: string
  max?: number
  min?: number
  onBlur?: (event: FocusEvent<HTMLInputElement>) => void
  onChange: (value: number) => void
  step?: number
  value: number
}

interface LatestEditorState {
  aspectPreset: AspectPreset
  customAspect: Dimensions
  flipHorizontal: boolean
  flipVertical: boolean
  rotation: number
  shape: CropShape
}

const ASPECT_PRESETS = Object.entries(ASPECT_PRESET_LABELS).map(
  ([value, label]) => ({ label, value: value as AspectPreset })
)

const OUTPUT_FORMATS: { label: string; value: OutputFormat }[] = [
  { label: 'JPEG', value: 'jpeg' },
  { label: 'PNG', value: 'png' },
  { label: 'WebP', value: 'webp' },
]

const DEFAULT_CUSTOM_ASPECT: Dimensions = { height: 1, width: 1 }
const EMPTY_CROP: CropRectangle = { height: 1, width: 1, x: 0, y: 0 }
const DEFAULT_QUALITY = 92
const MIN_ZOOM = 10
const MAX_ZOOM = 500
const ZOOM_STEP = 1
const CANVAS_MOVEMENT_BY_KEY: Partial<
  Record<string, readonly [number, number]>
> = {
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
}

const CROPPER_TEMPLATE = `
  <cropper-canvas background scale-step="0.05">
    <cropper-image rotatable scalable translatable></cropper-image>
    <cropper-shade hidden></cropper-shade>
    <cropper-handle action="select" plain></cropper-handle>
    <cropper-selection initial-coverage="0.8" movable precise resizable>
      <cropper-grid role="grid" bordered covered></cropper-grid>
      <cropper-crosshair centered></cropper-crosshair>
      <cropper-handle action="move" theme-color="rgba(255, 255, 255, 0.35)"></cropper-handle>
      <cropper-handle action="n-resize"></cropper-handle>
      <cropper-handle action="e-resize"></cropper-handle>
      <cropper-handle action="s-resize"></cropper-handle>
      <cropper-handle action="w-resize"></cropper-handle>
      <cropper-handle action="ne-resize"></cropper-handle>
      <cropper-handle action="nw-resize"></cropper-handle>
      <cropper-handle action="se-resize"></cropper-handle>
      <cropper-handle action="sw-resize"></cropper-handle>
    </cropper-selection>
  </cropper-canvas>
`

const createLatestEditorState = (): LatestEditorState => ({
  aspectPreset: 'free',
  customAspect: DEFAULT_CUSTOM_ASPECT,
  flipHorizontal: false,
  flipVertical: false,
  rotation: 0,
  shape: 'rectangle',
})

const toTransformMatrix = (values: number[]): TransformMatrix => {
  const [a = 1, b = 0, c = 0, d = 1, e = 0, f = 0] = values
  return [a, b, c, d, e, f]
}

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message) {
    return error.message
  }
  return '处理图片时发生未知错误，请更换文件后重试。'
}

const NumericField = ({
  label,
  max,
  min = 0,
  onBlur,
  onChange,
  step = 1,
  value,
}: NumericFieldProps) => {
  const id = useId()
  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      onChange(Number(event.currentTarget.value))
    },
    [onChange]
  )

  return (
    <Field className={styles.numericField}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        max={max}
        min={min}
        onBlur={onBlur}
        onChange={handleChange}
        step={step}
        type="number"
        value={Number.isFinite(value) ? value : 0}
      />
    </Field>
  )
}

export function ImageCropper() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const resultTitleRef = useRef<HTMLDivElement>(null)
  const sourceImageRef = useRef<HTMLImageElement>(null)
  const cropperContainerRef = useRef<HTMLDivElement>(null)
  const cropperRuntimeRef = useRef<CropperRuntime | null>(null)
  const sourceUrlRef = useRef<string | null>(null)
  const resultUrlRef = useRef<string | null>(null)
  const loadRequestRef = useRef(0)
  const initialSnapshotRef = useRef<EditorSnapshot | null>(null)
  const latestStateRef = useRef<LatestEditorState>(createLatestEditorState())
  const rectanglePresetRef = useRef<AspectPreset>('free')
  const selectionHistoryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  )
  const settingsScrolledRef = useRef(false)
  const customOutputSizeRef = useRef(false)

  const [phase, setPhase] = useState<ProcessingPhase>('idle')
  const [fileName, setFileName] = useState('')
  const [sourceUrl, setSourceUrl] = useState<string | null>(null)
  const [sourceDimensions, setSourceDimensions] = useState<Dimensions | null>(
    null
  )
  const [sourceSize, setSourceSize] = useState(0)
  const [frozenAnimation, setFrozenAnimation] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [crop, setCrop] = useState<CropRectangle>(EMPTY_CROP)
  const [frameDimensions, setFrameDimensions] = useState<Dimensions>({
    height: 1,
    width: 1,
  })
  const [shape, setShape] = useState<CropShape>('rectangle')
  const [aspectPreset, setAspectPreset] = useState<AspectPreset>('free')
  const [customAspect, setCustomAspect] = useState<Dimensions>(
    DEFAULT_CUSTOM_ASPECT
  )
  const [showGrid, setShowGrid] = useState(true)
  const [zoom, setZoom] = useState(100)
  const [rotation, setRotation] = useState(0)
  const [flipHorizontal, setFlipHorizontal] = useState(false)
  const [flipVertical, setFlipVertical] = useState(false)
  const [history, setHistory] = useState<HistoryState | null>(null)
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('jpeg')
  const [quality, setQuality] = useState(DEFAULT_QUALITY)
  const [customOutputSize, setCustomOutputSize] = useState(false)
  const [lockOutputRatio, setLockOutputRatio] = useState(true)
  const [outputDimensions, setOutputDimensions] = useState<Dimensions>({
    height: 1,
    width: 1,
  })
  const [result, setResult] = useState<ExportResult | null>(null)
  const [settingsScrolled, setSettingsScrolled] = useState(false)

  const aspectId = useId()
  const formatId = useId()
  const customAspectWidthId = useId()
  const customAspectHeightId = useId()
  const zoomId = useId()
  const rotationId = useId()
  const outputWidthId = useId()
  const outputHeightId = useId()
  const qualityId = useId()
  const canvasHelpId = useId()

  const replaceSourceUrl = useCallback((blob: Blob | null): string | null => {
    if (sourceUrlRef.current) {
      URL.revokeObjectURL(sourceUrlRef.current)
    }
    const nextUrl = blob ? URL.createObjectURL(blob) : null
    sourceUrlRef.current = nextUrl
    setSourceUrl(nextUrl)
    return nextUrl
  }, [])

  const clearResult = useCallback(() => {
    if (resultUrlRef.current) {
      URL.revokeObjectURL(resultUrlRef.current)
      resultUrlRef.current = null
    }
    setResult(null)
  }, [])

  const syncLatestState = useCallback((next: Partial<LatestEditorState>) => {
    latestStateRef.current = { ...latestStateRef.current, ...next }
  }, [])

  const getNaturalMapping = useCallback((): NaturalCropMapping | null => {
    const runtime = cropperRuntimeRef.current
    if (!(runtime && sourceDimensions)) {
      return null
    }

    const canvasBounds = runtime.canvas.getBoundingClientRect()
    const imageBounds = runtime.image.getBoundingClientRect()
    return mapSelectionToNaturalCrop({
      canvasBounds,
      imageBounds,
      matrix: toTransformMatrix(runtime.image.$getTransform()),
      naturalDimensions: sourceDimensions,
      selection: {
        height: runtime.selection.height,
        width: runtime.selection.width,
        x: runtime.selection.x,
        y: runtime.selection.y,
      },
    })
  }, [sourceDimensions])

  const syncEditorMeasurements = useCallback(() => {
    const runtime = cropperRuntimeRef.current
    const mapping = getNaturalMapping()
    if (!(runtime && mapping)) {
      return
    }

    const nextCrop = mapping.crop
      ? {
          height: roundDimension(mapping.crop.height),
          width: roundDimension(mapping.crop.width),
          x: Math.round(mapping.crop.x),
          y: Math.round(mapping.crop.y),
        }
      : { height: 0, width: 0, x: 0, y: 0 }
    const matrix = toTransformMatrix(runtime.image.$getTransform())
    const nextZoom = clamp(
      Math.round((getMatrixScale(matrix) / runtime.initialScale) * 100),
      MIN_ZOOM,
      MAX_ZOOM
    )
    setCrop(nextCrop)
    setFrameDimensions({
      height: roundDimension(mapping.frame.height),
      width: roundDimension(mapping.frame.width),
    })
    setZoom(nextZoom)

    if (!customOutputSizeRef.current) {
      setOutputDimensions(getDefaultOutputDimensions(nextCrop))
    }
  }, [getNaturalMapping])

  const captureSnapshot = useCallback((): EditorSnapshot | null => {
    const runtime = cropperRuntimeRef.current
    if (!runtime) {
      return null
    }
    const latest = latestStateRef.current
    return {
      aspectPreset: latest.aspectPreset,
      customAspect: latest.customAspect,
      flipHorizontal: latest.flipHorizontal,
      flipVertical: latest.flipVertical,
      matrix: toTransformMatrix(runtime.image.$getTransform()),
      rotation: latest.rotation,
      selection: {
        height: runtime.selection.height,
        width: runtime.selection.width,
        x: runtime.selection.x,
        y: runtime.selection.y,
      },
      shape: latest.shape,
    }
  }, [])

  const commitSnapshot = useCallback(() => {
    const snapshot = captureSnapshot()
    if (!snapshot) {
      return
    }
    setHistory((current) =>
      current ? pushHistory(current, snapshot) : createHistory(snapshot)
    )
  }, [captureSnapshot])

  const applySnapshot = useCallback(
    (snapshot: EditorSnapshot) => {
      const runtime = cropperRuntimeRef.current
      if (!runtime) {
        return
      }
      runtime.image.$setTransform([...snapshot.matrix])
      runtime.selection.aspectRatio =
        getAspectRatio({
          customAspect: snapshot.customAspect,
          naturalDimensions: sourceDimensions ?? { height: 1, width: 1 },
          preset: snapshot.aspectPreset,
        }) ?? Number.NaN
      runtime.selection.$change(
        snapshot.selection.x,
        snapshot.selection.y,
        snapshot.selection.width,
        snapshot.selection.height,
        runtime.selection.aspectRatio,
        true
      )
      setShape(snapshot.shape)
      setAspectPreset(snapshot.aspectPreset)
      setCustomAspect(snapshot.customAspect)
      setFlipHorizontal(snapshot.flipHorizontal)
      setFlipVertical(snapshot.flipVertical)
      setRotation(snapshot.rotation)
      syncLatestState({
        aspectPreset: snapshot.aspectPreset,
        customAspect: snapshot.customAspect,
        flipHorizontal: snapshot.flipHorizontal,
        flipVertical: snapshot.flipVertical,
        rotation: snapshot.rotation,
        shape: snapshot.shape,
      })
      if (snapshot.shape === 'rectangle') {
        rectanglePresetRef.current = snapshot.aspectPreset
      }
      requestAnimationFrame(syncEditorMeasurements)
    },
    [sourceDimensions, syncEditorMeasurements, syncLatestState]
  )

  const handleUndo = useCallback(() => {
    setHistory((current) => {
      if (!current) {
        return current
      }
      const undone = undoHistory(current)
      if (undone.snapshot) {
        applySnapshot(undone.snapshot)
      }
      return undone.history
    })
  }, [applySnapshot])

  const handleRedo = useCallback(() => {
    setHistory((current) => {
      if (!current) {
        return current
      }
      const redone = redoHistory(current)
      if (redone.snapshot) {
        applySnapshot(redone.snapshot)
      }
      return redone.history
    })
  }, [applySnapshot])

  const resetEditorState = useCallback(() => {
    const initial = initialSnapshotRef.current
    if (!initial) {
      return
    }
    applySnapshot(initial)
    requestAnimationFrame(commitSnapshot)
  }, [applySnapshot, commitSnapshot])

  const resetSession = useCallback(() => {
    loadRequestRef.current += 1
    cropperRuntimeRef.current?.cropper.destroy()
    cropperRuntimeRef.current = null
    initialSnapshotRef.current = null
    if (selectionHistoryTimerRef.current) {
      clearTimeout(selectionHistoryTimerRef.current)
      selectionHistoryTimerRef.current = null
    }
    replaceSourceUrl(null)
    clearResult()
    latestStateRef.current = createLatestEditorState()
    rectanglePresetRef.current = 'free'
    setPhase('idle')
    setFileName('')
    setSourceDimensions(null)
    setSourceSize(0)
    setFrozenAnimation(false)
    setErrorMessage(null)
    setCrop(EMPTY_CROP)
    setShape('rectangle')
    setAspectPreset('free')
    setCustomAspect(DEFAULT_CUSTOM_ASPECT)
    setShowGrid(true)
    setZoom(100)
    setRotation(0)
    setFlipHorizontal(false)
    setFlipVertical(false)
    setHistory(null)
    setOutputFormat('jpeg')
    setQuality(DEFAULT_QUALITY)
    setCustomOutputSize(false)
    customOutputSizeRef.current = false
    setLockOutputRatio(true)
    setOutputDimensions({ height: 1, width: 1 })
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [clearResult, replaceSourceUrl])

  const loadFile = useCallback(
    async (file: File) => {
      const requestId = loadRequestRef.current + 1
      loadRequestRef.current = requestId
      setPhase('decoding')
      setFileName(file.name || 'pasted-image.png')
      setErrorMessage(null)
      clearResult()

      try {
        const prepared = await prepareImageFile(file)
        if (loadRequestRef.current !== requestId) {
          return
        }
        cropperRuntimeRef.current?.cropper.destroy()
        cropperRuntimeRef.current = null
        setSourceDimensions(prepared.dimensions)
        setSourceSize(file.size)
        setFrozenAnimation(prepared.frozenAnimation)
        replaceSourceUrl(prepared.sourceBlob)
        setPhase('editing')
      } catch (error) {
        if (loadRequestRef.current !== requestId) {
          return
        }
        replaceSourceUrl(null)
        setErrorMessage(getErrorMessage(error))
        setPhase('error')
      }
    },
    [clearResult, replaceSourceUrl]
  )

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.currentTarget.files?.[0]
      if (file) {
        await loadFile(file)
      }
    },
    [loadFile]
  )

  useEffect(() => {
    let dragDepth = 0
    const handleDragEnter = (event: globalThis.DragEvent) => {
      event.preventDefault()
      dragDepth += 1
      setIsDragging(true)
    }
    const handleDragOver = (event: globalThis.DragEvent) => {
      event.preventDefault()
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'copy'
      }
    }
    const handleDragLeave = (event: globalThis.DragEvent) => {
      event.preventDefault()
      dragDepth = Math.max(0, dragDepth - 1)
      if (dragDepth === 0) {
        setIsDragging(false)
      }
    }
    const handleDrop = async (event: globalThis.DragEvent) => {
      event.preventDefault()
      dragDepth = 0
      setIsDragging(false)
      const file = Array.from(event.dataTransfer?.files ?? []).find((item) =>
        item.type.startsWith('image/')
      )
      if (!file) {
        setErrorMessage('拖入的内容中没有可读取的图片。')
        return
      }
      await loadFile(file)
    }

    window.addEventListener('dragenter', handleDragEnter)
    window.addEventListener('dragover', handleDragOver)
    window.addEventListener('dragleave', handleDragLeave)
    window.addEventListener('drop', handleDrop)
    return () => {
      window.removeEventListener('dragenter', handleDragEnter)
      window.removeEventListener('dragover', handleDragOver)
      window.removeEventListener('dragleave', handleDragLeave)
      window.removeEventListener('drop', handleDrop)
    }
  }, [loadFile])

  useEffect(() => {
    const handlePaste = async (event: ClipboardEvent) => {
      const file = Array.from(event.clipboardData?.files ?? []).find((item) =>
        item.type.startsWith('image/')
      )
      if (!file) {
        return
      }
      const pastedFile = new File(
        [file],
        file.name || `pasted-image.${file.type.split('/')[1] ?? 'png'}`,
        { type: file.type }
      )
      event.preventDefault()
      await loadFile(pastedFile)
    }
    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [loadFile])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const { target } = event
      const isEditable =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      if (isEditable || !(event.metaKey || event.ctrlKey)) {
        return
      }
      if (event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) {
          handleRedo()
        } else {
          handleUndo()
        }
      } else if (event.key.toLowerCase() === 'y') {
        event.preventDefault()
        handleRedo()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleRedo, handleUndo])

  useEffect(
    () => () => {
      loadRequestRef.current += 1
      cropperRuntimeRef.current?.cropper.destroy()
      if (selectionHistoryTimerRef.current) {
        clearTimeout(selectionHistoryTimerRef.current)
      }
      if (sourceUrlRef.current) {
        URL.revokeObjectURL(sourceUrlRef.current)
      }
      if (resultUrlRef.current) {
        URL.revokeObjectURL(resultUrlRef.current)
      }
    },
    []
  )

  useEffect(() => {
    if (!(sourceUrl && sourceDimensions)) {
      return
    }
    let cancelled = false
    let runtime: CropperRuntime | null = null

    const initializeCropper = async () => {
      const sourceImage = sourceImageRef.current
      const container = cropperContainerRef.current
      if (!(sourceImage && container)) {
        return
      }
      try {
        await sourceImage.decode()
        const { default: CropperConstructor } = await import('cropperjs')
        if (cancelled) {
          return
        }
        const cropper = new CropperConstructor(sourceImage, {
          container,
          template: CROPPER_TEMPLATE,
        })
        const canvas = cropper.getCropperCanvas()
        const image = cropper.getCropperImage()
        const selection = cropper.getCropperSelection()
        if (!(canvas && image && selection)) {
          cropper.destroy()
          throw new Error('图片裁剪器初始化失败。')
        }
        await image.$ready()
        if (cancelled) {
          cropper.destroy()
          return
        }

        const grid = container.querySelector<CropperGrid>('cropper-grid')
        image.rotatable = true
        image.scalable = true
        image.translatable = true
        selection.keyboard = false
        selection.precise = true
        selection.movable = true
        selection.resizable = true
        selection.aspectRatio = Number.NaN
        const initialScale = getMatrixScale(
          toTransformMatrix(image.$getTransform())
        )
        runtime = { canvas, cropper, grid, image, initialScale, selection }
        cropperRuntimeRef.current = runtime

        const canvasBounds = canvas.getBoundingClientRect()
        const imageBounds = image.getBoundingClientRect()
        const imageArea = {
          height: imageBounds.height,
          width: imageBounds.width,
        }
        const initialSelection = fitAspectCrop({
          aspectRatio: imageArea.width / imageArea.height,
          bounds: imageArea,
          coverage: 0.82,
        })
        selection.$change(
          initialSelection.x + imageBounds.left - canvasBounds.left,
          initialSelection.y + imageBounds.top - canvasBounds.top,
          initialSelection.width,
          initialSelection.height,
          Number.NaN,
          true
        )

        const handleChange = () => {
          requestAnimationFrame(syncEditorMeasurements)
          if (selectionHistoryTimerRef.current) {
            clearTimeout(selectionHistoryTimerRef.current)
          }
          selectionHistoryTimerRef.current = setTimeout(() => {
            selectionHistoryTimerRef.current = null
            commitSnapshot()
          }, 220)
        }
        const handleAction = (event: Event) => {
          const { detail } = event as CustomEvent<{
            action?: string
            rotate?: number
          }>
          if (detail?.action === 'rotate' && detail.rotate) {
            const nextRotation = normalizeRotation(
              latestStateRef.current.rotation + (detail.rotate * 180) / Math.PI
            )
            setRotation(nextRotation)
            syncLatestState({ rotation: nextRotation })
          }
          requestAnimationFrame(syncEditorMeasurements)
        }
        const handleActionEnd = () => {
          if (selectionHistoryTimerRef.current) {
            clearTimeout(selectionHistoryTimerRef.current)
            selectionHistoryTimerRef.current = null
          }
          requestAnimationFrame(() => {
            syncEditorMeasurements()
            const snapshot = captureSnapshot()
            if (snapshot) {
              setHistory((current) =>
                current
                  ? pushHistory(current, snapshot)
                  : createHistory(snapshot)
              )
            }
          })
        }

        selection.addEventListener('change', handleChange)
        canvas.addEventListener('action', handleAction)
        canvas.addEventListener('actionend', handleActionEnd)

        requestAnimationFrame(() => {
          syncEditorMeasurements()
          const snapshot = captureSnapshot()
          if (snapshot) {
            initialSnapshotRef.current = snapshot
            setHistory(createHistory(snapshot))
          }
        })

        return () => {
          if (selectionHistoryTimerRef.current) {
            clearTimeout(selectionHistoryTimerRef.current)
            selectionHistoryTimerRef.current = null
          }
          selection.removeEventListener('change', handleChange)
          canvas.removeEventListener('action', handleAction)
          canvas.removeEventListener('actionend', handleActionEnd)
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(getErrorMessage(error))
          setPhase('error')
        }
      }
    }

    let removeListeners: (() => void) | undefined
    initializeCropper().then((cleanup) => {
      removeListeners = cleanup
    })
    return () => {
      cancelled = true
      removeListeners?.()
      if (runtime) {
        runtime.cropper.destroy()
        if (cropperRuntimeRef.current === runtime) {
          cropperRuntimeRef.current = null
        }
      }
    }
  }, [
    captureSnapshot,
    sourceDimensions,
    sourceUrl,
    syncEditorMeasurements,
    syncLatestState,
  ])

  useEffect(() => {
    const runtime = cropperRuntimeRef.current
    if (runtime?.grid) {
      runtime.grid.hidden = !showGrid
    }
  }, [showGrid])

  const applyAspectPreset = useCallback(
    (preset: AspectPreset, shouldCommit = true) => {
      const runtime = cropperRuntimeRef.current
      if (!(runtime && sourceDimensions)) {
        return
      }
      const ratio = getAspectRatio({
        customAspect,
        naturalDimensions: sourceDimensions,
        preset,
      })
      runtime.selection.aspectRatio = ratio ?? Number.NaN
      setAspectPreset(preset)
      syncLatestState({ aspectPreset: preset, customAspect })
      if (latestStateRef.current.shape === 'rectangle') {
        rectanglePresetRef.current = preset
      }

      if (ratio) {
        const { selection } = runtime
        const {
          height: selectionHeight,
          width: selectionWidth,
          x,
          y,
        } = selection
        const centerX = x + selectionWidth / 2
        const centerY = y + selectionHeight / 2
        let width = selectionWidth
        let height = width / ratio
        if (height > selectionHeight) {
          height = selectionHeight
          width = height * ratio
        }
        selection.$change(
          centerX - width / 2,
          centerY - height / 2,
          width,
          height,
          ratio,
          true
        )
      }
      requestAnimationFrame(() => {
        syncEditorMeasurements()
        if (shouldCommit) {
          commitSnapshot()
        }
      })
    },
    [
      commitSnapshot,
      customAspect,
      sourceDimensions,
      syncEditorMeasurements,
      syncLatestState,
    ]
  )

  const handleAspectChange = useCallback(
    (value: string | null) => {
      if (value) {
        applyAspectPreset(value as AspectPreset)
      }
    },
    [applyAspectPreset]
  )

  const handleShapeChange = useCallback(
    (value: string[]) => {
      const nextShape = value.at(-1) as CropShape | undefined
      if (!nextShape || nextShape === shape) {
        return
      }
      setShape(nextShape)
      syncLatestState({ shape: nextShape })
      if (nextShape === 'circle') {
        rectanglePresetRef.current = aspectPreset
        setOutputFormat((current) => coerceOutputFormat('circle', current))
        applyAspectPreset('square', false)
      } else {
        applyAspectPreset(rectanglePresetRef.current, false)
      }
      requestAnimationFrame(() => {
        syncEditorMeasurements()
        commitSnapshot()
      })
    },
    [
      applyAspectPreset,
      aspectPreset,
      commitSnapshot,
      shape,
      syncEditorMeasurements,
      syncLatestState,
    ]
  )

  const updateCustomAspect = useCallback(
    (field: 'height' | 'width', value: number) => {
      const next = {
        ...customAspect,
        [field]: Math.max(1, roundDimension(value)),
      }
      setCustomAspect(next)
      syncLatestState({ customAspect: next })
      if (aspectPreset === 'custom') {
        const runtime = cropperRuntimeRef.current
        if (runtime) {
          runtime.selection.aspectRatio = next.width / next.height
        }
      }
    },
    [aspectPreset, customAspect, syncLatestState]
  )

  const commitCustomAspect = useCallback(() => {
    if (aspectPreset === 'custom') {
      applyAspectPreset('custom')
    }
  }, [applyAspectPreset, aspectPreset])

  const handleCustomAspectWidthChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      updateCustomAspect('width', Number(event.currentTarget.value))
    },
    [updateCustomAspect]
  )

  const handleCustomAspectHeightChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      updateCustomAspect('height', Number(event.currentTarget.value))
    },
    [updateCustomAspect]
  )

  const updateCropField = useCallback(
    (field: CropField, value: number) => {
      const runtime = cropperRuntimeRef.current
      const mapping = getNaturalMapping()
      if (!(runtime && mapping?.crop)) {
        return
      }
      const nextCrop = updateNaturalCropField({
        field,
        frame: mapping.frame,
        rectangle: mapping.crop,
        value,
      })
      const canvasBounds = runtime.canvas.getBoundingClientRect()
      const imageBounds = runtime.image.getBoundingClientRect()
      const nextSelection = mapNaturalCropToSelection({
        canvasBounds,
        crop: nextCrop,
        imageBounds,
        scale: mapping.scale,
      })
      runtime.selection.$change(
        nextSelection.x,
        nextSelection.y,
        nextSelection.width,
        nextSelection.height,
        runtime.selection.aspectRatio,
        true
      )
      syncEditorMeasurements()
    },
    [getNaturalMapping, syncEditorMeasurements]
  )

  const commitCropField = useCallback(() => commitSnapshot(), [commitSnapshot])

  const handleCropXChange = useCallback(
    (value: number) => updateCropField('x', value),
    [updateCropField]
  )

  const handleCropYChange = useCallback(
    (value: number) => updateCropField('y', value),
    [updateCropField]
  )

  const handleCropWidthChange = useCallback(
    (value: number) => updateCropField('width', value),
    [updateCropField]
  )

  const handleCropHeightChange = useCallback(
    (value: number) => updateCropField('height', value),
    [updateCropField]
  )

  const setAbsoluteZoom = useCallback(
    (nextZoom: number, shouldCommit = false) => {
      const runtime = cropperRuntimeRef.current
      if (!runtime) {
        return
      }
      const safeZoom = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM)
      const matrix = toTransformMatrix(runtime.image.$getTransform())
      const currentScale = getMatrixScale(matrix)
      const targetScale = runtime.initialScale * (safeZoom / 100)
      runtime.image.$scale(targetScale / currentScale)
      setZoom(safeZoom)
      requestAnimationFrame(() => {
        syncEditorMeasurements()
        if (shouldCommit) {
          commitSnapshot()
        }
      })
    },
    [commitSnapshot, syncEditorMeasurements]
  )

  const handleZoomChange = useCallback(
    (value: number | readonly number[]) => {
      const next = Array.isArray(value) ? value[0] : value
      if (typeof next === 'number') {
        setAbsoluteZoom(next)
      }
    },
    [setAbsoluteZoom]
  )

  const handleZoomCommit = useCallback(
    (value: number | readonly number[]) => {
      const next = Array.isArray(value) ? value[0] : value
      if (typeof next === 'number') {
        setAbsoluteZoom(next, true)
      }
    },
    [setAbsoluteZoom]
  )

  const handleZoomInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setAbsoluteZoom(Number(event.currentTarget.value))
    },
    [setAbsoluteZoom]
  )

  const handleZoomInputBlur = useCallback(
    (event: FocusEvent<HTMLInputElement>) => {
      setAbsoluteZoom(Number(event.currentTarget.value), true)
    },
    [setAbsoluteZoom]
  )

  const setAbsoluteRotation = useCallback(
    (nextRotation: number, shouldCommit = false) => {
      const runtime = cropperRuntimeRef.current
      if (!runtime) {
        return
      }
      const safeRotation = normalizeRotation(nextRotation)
      const delta = safeRotation - latestStateRef.current.rotation
      runtime.image.$rotate(`${delta}deg`)
      setRotation(safeRotation)
      syncLatestState({ rotation: safeRotation })
      requestAnimationFrame(() => {
        syncEditorMeasurements()
        if (shouldCommit) {
          commitSnapshot()
        }
      })
    },
    [commitSnapshot, syncEditorMeasurements, syncLatestState]
  )

  const handleRotationChange = useCallback(
    (value: number | readonly number[]) => {
      const next = Array.isArray(value) ? value[0] : value
      if (typeof next === 'number') {
        setAbsoluteRotation(next)
      }
    },
    [setAbsoluteRotation]
  )

  const handleRotationCommit = useCallback(
    (value: number | readonly number[]) => {
      const next = Array.isArray(value) ? value[0] : value
      if (typeof next === 'number') {
        setAbsoluteRotation(next, true)
      }
    },
    [setAbsoluteRotation]
  )

  const handleRotationInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setAbsoluteRotation(Number(event.currentTarget.value))
    },
    [setAbsoluteRotation]
  )

  const handleRotationInputBlur = useCallback(
    (event: FocusEvent<HTMLInputElement>) => {
      setAbsoluteRotation(Number(event.currentTarget.value), true)
    },
    [setAbsoluteRotation]
  )

  const rotateBy = useCallback(
    (degrees: number) => {
      setAbsoluteRotation(latestStateRef.current.rotation + degrees, true)
    },
    [setAbsoluteRotation]
  )

  const rotateCounterclockwise = useCallback(() => rotateBy(-90), [rotateBy])
  const rotateClockwise = useCallback(() => rotateBy(90), [rotateBy])

  const handleCanvasKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLButtonElement>) => {
      if (event.target !== event.currentTarget) {
        return
      }
      const runtime = cropperRuntimeRef.current
      if (!runtime) {
        return
      }

      const movement = CANVAS_MOVEMENT_BY_KEY[event.key]
      if (movement) {
        event.preventDefault()
        runtime.selection.$move(...movement)
        return
      }

      if (event.key === '+' || event.key === '=') {
        event.preventDefault()
        setAbsoluteZoom(zoom + ZOOM_STEP, true)
      } else if (event.key === '-') {
        event.preventDefault()
        setAbsoluteZoom(zoom - ZOOM_STEP, true)
      }
    },
    [setAbsoluteZoom, zoom]
  )

  const toggleFlip = useCallback(
    (axis: 'horizontal' | 'vertical') => {
      const runtime = cropperRuntimeRef.current
      if (!runtime) {
        return
      }
      const isHorizontal = axis === 'horizontal'
      runtime.image.$scale(isHorizontal ? -1 : 1, isHorizontal ? 1 : -1)
      const nextValue = isHorizontal
        ? !latestStateRef.current.flipHorizontal
        : !latestStateRef.current.flipVertical
      if (isHorizontal) {
        setFlipHorizontal(nextValue)
        syncLatestState({ flipHorizontal: nextValue })
      } else {
        setFlipVertical(nextValue)
        syncLatestState({ flipVertical: nextValue })
      }
      requestAnimationFrame(() => {
        syncEditorMeasurements()
        commitSnapshot()
      })
    },
    [commitSnapshot, syncEditorMeasurements, syncLatestState]
  )

  const toggleHorizontalFlip = useCallback(
    () => toggleFlip('horizontal'),
    [toggleFlip]
  )

  const toggleVerticalFlip = useCallback(
    () => toggleFlip('vertical'),
    [toggleFlip]
  )

  const handleCustomOutputToggle = useCallback(
    (checked: boolean) => {
      setCustomOutputSize(checked)
      customOutputSizeRef.current = checked
      if (!checked) {
        setOutputDimensions(getDefaultOutputDimensions(crop))
      }
    },
    [crop]
  )

  const updateOutputDimension = useCallback(
    (field: 'height' | 'width', value: number) => {
      const safeValue = roundDimension(value)
      const aspectRatio = crop.width / crop.height
      setOutputDimensions((current) =>
        lockOutputRatio
          ? updateLockedDimensions({ aspectRatio, field, value: safeValue })
          : { ...current, [field]: safeValue }
      )
    },
    [crop.height, crop.width, lockOutputRatio]
  )

  const handleOutputWidthChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      updateOutputDimension('width', Number(event.currentTarget.value))
    },
    [updateOutputDimension]
  )

  const handleOutputHeightChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      updateOutputDimension('height', Number(event.currentTarget.value))
    },
    [updateOutputDimension]
  )

  const toggleOutputRatioLock = useCallback(() => {
    setLockOutputRatio((current) => !current)
  }, [])

  const handleFormatChange = useCallback(
    (value: string | null) => {
      if (value) {
        setOutputFormat(coerceOutputFormat(shape, value as OutputFormat))
      }
    },
    [shape]
  )

  const handleQualityChange = useCallback(
    (value: number | readonly number[]) => {
      const next = Array.isArray(value) ? value[0] : value
      if (typeof next === 'number') {
        setQuality(next)
      }
    },
    []
  )

  const generateResult = useCallback(async () => {
    const runtime = cropperRuntimeRef.current
    if (!runtime) {
      return
    }
    const mapping = getNaturalMapping()
    if (!mapping?.crop) {
      setErrorMessage('裁剪区域没有与图片重合，请移动或缩放裁剪框后重试。')
      return
    }
    const dimensionsError = validateOutputDimensions(outputDimensions)
    if (dimensionsError) {
      setErrorMessage(dimensionsError)
      return
    }

    setPhase('exporting')
    setErrorMessage(null)
    clearResult()
    try {
      const exported = await exportCropSelection({
        crop: mapping.crop,
        options: {
          format: outputFormat,
          height: outputDimensions.height,
          quality,
          shape,
          width: outputDimensions.width,
        },
        selection: runtime.selection,
        selectionCrop: mapping.selectionCrop,
      })
      const url = URL.createObjectURL(exported.blob)
      resultUrlRef.current = url
      const resultFileName = createOutputFileName({
        fileName,
        format: outputFormat,
        height: exported.dimensions.height,
        width: exported.dimensions.width,
      })
      setResult({
        blob: exported.blob,
        fileName: resultFileName,
        height: exported.dimensions.height,
        mimeType: exported.blob.type,
        url,
        width: exported.dimensions.width,
      })
      setPhase('result')
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
      setPhase('editing')
    }
  }, [
    clearResult,
    fileName,
    getNaturalMapping,
    outputDimensions,
    outputFormat,
    quality,
    shape,
  ])

  useEffect(() => {
    if (!(phase === 'result' && result)) {
      return
    }
    const frame = requestAnimationFrame(() => {
      resultTitleRef.current?.scrollIntoView({ block: 'start' })
      resultTitleRef.current?.focus({ preventScroll: true })
    })
    return () => cancelAnimationFrame(frame)
  }, [phase, result])

  const downloadResult = useCallback(() => {
    if (!result) {
      return
    }
    const anchor = document.createElement('a')
    anchor.download = result.fileName
    anchor.href = result.url
    anchor.click()
  }, [result])

  const continueEditing = useCallback(() => {
    clearResult()
    setPhase('editing')
  }, [clearResult])

  const handleSettingsScroll = useCallback((event: UIEvent<HTMLDivElement>) => {
    const nextScrolled = event.currentTarget.scrollTop > 0
    if (settingsScrolledRef.current !== nextScrolled) {
      settingsScrolledRef.current = nextScrolled
      setSettingsScrolled(nextScrolled)
    }
  }, [])

  const canUndo = Boolean(history && history.index > 0)
  const canRedo = Boolean(history && history.index < history.entries.length - 1)
  const isBusy = phase === 'decoding' || phase === 'exporting'
  const outputError = validateOutputDimensions(outputDimensions)
  const outputFormatItems =
    shape === 'circle'
      ? OUTPUT_FORMATS.filter((item) => item.value !== 'jpeg')
      : OUTPUT_FORMATS
  const shapeValue = useMemo(() => [shape], [shape])
  const outputFormatLabel =
    OUTPUT_FORMATS.find((item) => item.value === outputFormat)?.label ?? 'PNG'
  const resultStatus =
    phase === 'result' && result
      ? `图片已生成：${result.fileName}，尺寸 ${result.width} 乘 ${result.height} 像素。`
      : ''
  const statusMessage =
    phase === 'exporting' ? '正在浏览器本地生成裁剪结果。' : resultStatus

  return (
    <div className={styles.cropper} data-dragging={isDragging || undefined}>
      <Input
        accept={ACCEPTED_IMAGE_TYPES}
        aria-label="选择要裁剪的图片"
        className={styles.fileInput}
        onChange={handleFileChange}
        ref={fileInputRef}
        type="file"
      />

      {isDragging ? (
        <div className={styles.dragOverlay}>
          <UploadIcon aria-hidden="true" />
          <strong>松开即可载入图片</strong>
        </div>
      ) : null}

      {sourceUrl && sourceDimensions ? (
        <div className={styles.workspace}>
          <div className={styles.workspaceTopbar}>
            <Button onClick={resetSession} variant="ghost">
              <ArrowLeftIcon data-icon="inline-start" />
              返回选择图片
            </Button>
            <div className={styles.topbarActions}>
              <Button
                aria-label="撤销（Command 或 Control 加 Z）"
                disabled={!canUndo || isBusy}
                onClick={handleUndo}
                size="icon"
                title="撤销"
                variant="outline"
              >
                <Undo2Icon />
              </Button>
              <Button
                aria-label="重做（Command 或 Control 加 Shift 加 Z）"
                disabled={!canRedo || isBusy}
                onClick={handleRedo}
                size="icon"
                title="重做"
                variant="outline"
              >
                <Redo2Icon />
              </Button>
              <Button
                disabled={isBusy}
                onClick={resetEditorState}
                variant="outline"
              >
                <RefreshCcwIcon data-icon="inline-start" />
                重置
              </Button>
              <Button
                disabled={isBusy}
                onClick={openFilePicker}
                variant="outline"
              >
                <ImageIcon data-icon="inline-start" />
                更换图片
              </Button>
            </div>
          </div>

          <div className={styles.workspaceGrid}>
            <section aria-label="图片裁剪预览" className={styles.previewColumn}>
              <div className={styles.stage}>
                <Button
                  aria-describedby={canvasHelpId}
                  className={styles.canvasKeyboardButton}
                  onKeyDown={handleCanvasKeyDown}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  键盘微调
                </Button>
                <div
                  className={styles.cropperContainer}
                  ref={cropperContainerRef}
                >
                  {/* Cropper.js requires a real HTMLImageElement as its source. */}
                  <img
                    alt="待裁剪图片"
                    className={styles.sourceImage}
                    height={sourceDimensions.height}
                    ref={sourceImageRef}
                    src={sourceUrl}
                    width={sourceDimensions.width}
                  />
                  {shape === 'circle' && cropperRuntimeRef.current ? (
                    <div
                      aria-hidden="true"
                      className={styles.circleGuide}
                      style={{
                        height: cropperRuntimeRef.current.selection.height,
                        left: cropperRuntimeRef.current.selection.x,
                        top: cropperRuntimeRef.current.selection.y,
                        width: cropperRuntimeRef.current.selection.width,
                      }}
                    />
                  ) : null}
                </div>
              </div>
              <p className={styles.keyboardHint} id={canvasHelpId}>
                聚焦“键盘微调”后可用方向键移动裁剪框，按加减键缩放；Command 或
                Control 加 Z 可撤销。
              </p>

              <Card size="sm">
                <CardHeader>
                  <CardTitle>{fileName}</CardTitle>
                  <CardDescription>
                    图片只在当前浏览器中处理，不会上传到服务器。
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <dl className={styles.imageStats}>
                    <div>
                      <dt>原图</dt>
                      <dd>
                        {sourceDimensions.width.toLocaleString('zh-CN')} ×{' '}
                        {sourceDimensions.height.toLocaleString('zh-CN')}
                      </dd>
                    </div>
                    <div>
                      <dt>文件大小</dt>
                      <dd>{formatBytes(sourceSize)}</dd>
                    </div>
                    <div>
                      <dt>当前裁剪</dt>
                      <dd>
                        {crop.width.toLocaleString('zh-CN')} ×{' '}
                        {crop.height.toLocaleString('zh-CN')}
                      </dd>
                    </div>
                    <div>
                      <dt>缩放</dt>
                      <dd>{zoom}%</dd>
                    </div>
                  </dl>
                  {frozenAnimation ? (
                    <p className={styles.animationNote}>
                      动画图片已按首帧载入，导出结果为静态图片。
                    </p>
                  ) : null}
                </CardContent>
              </Card>
            </section>

            <aside aria-label="裁剪设置" className={styles.settingsColumn}>
              {phase === 'result' && result ? (
                <Card>
                  <CardHeader>
                    <div className={styles.doneIcon}>
                      <CheckCircle2Icon aria-hidden="true" />
                    </div>
                    <CardTitle
                      className={styles.resultTitle}
                      ref={resultTitleRef}
                      tabIndex={-1}
                    >
                      图片已生成
                    </CardTitle>
                    <CardDescription>{result.fileName}</CardDescription>
                  </CardHeader>
                  <CardContent className={styles.resultContent}>
                    <div className={styles.resultPreview}>
                      {/* Blob URLs are local generated files and bypass Next image optimization. */}
                      <img
                        alt="裁剪结果预览"
                        height={result.height}
                        src={result.url}
                        width={result.width}
                      />
                    </div>
                    <dl className={styles.resultStats}>
                      <div>
                        <dt>尺寸</dt>
                        <dd>
                          {result.width} × {result.height}
                        </dd>
                      </div>
                      <div>
                        <dt>格式</dt>
                        <dd>{outputFormatLabel}</dd>
                      </div>
                      <div>
                        <dt>大小</dt>
                        <dd>{formatBytes(result.blob.size)}</dd>
                      </div>
                    </dl>
                  </CardContent>
                  <CardFooter className={styles.resultActions}>
                    <Button
                      className={styles.fullWidthButton}
                      onClick={downloadResult}
                    >
                      <DownloadIcon data-icon="inline-start" />
                      下载图片
                    </Button>
                    <Button
                      className={styles.fullWidthButton}
                      onClick={continueEditing}
                      variant="outline"
                    >
                      继续编辑
                    </Button>
                  </CardFooter>
                </Card>
              ) : (
                <Card>
                  <CardHeader
                    className={styles.settingsHeader}
                    data-content-scrolled={settingsScrolled || undefined}
                  >
                    <CardTitle>裁剪设置</CardTitle>
                    <CardDescription>
                      拖动裁剪框，也可以输入精确像素。
                    </CardDescription>
                  </CardHeader>
                  <CardContent onScroll={handleSettingsScroll}>
                    <FieldGroup className={styles.controls}>
                      <FieldSet>
                        <FieldLegend>裁剪区域</FieldLegend>
                        <FieldDescription>
                          圆形裁剪会生成透明 PNG 或 WebP。
                        </FieldDescription>
                        <FieldGroup>
                          <Field>
                            <FieldLabel>形状</FieldLabel>
                            <ToggleGroup
                              aria-label="裁剪形状"
                              className={styles.shapeToggle}
                              onValueChange={handleShapeChange}
                              spacing={0}
                              value={shapeValue}
                              variant="outline"
                            >
                              <ToggleGroupItem value="rectangle">
                                矩形
                              </ToggleGroupItem>
                              <ToggleGroupItem value="circle">
                                圆形
                              </ToggleGroupItem>
                            </ToggleGroup>
                          </Field>
                          <Field>
                            <FieldLabel htmlFor={aspectId}>裁剪比例</FieldLabel>
                            <Select
                              items={ASPECT_PRESETS}
                              onValueChange={handleAspectChange}
                              value={aspectPreset}
                            >
                              <SelectTrigger id={aspectId}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectGroup>
                                  {ASPECT_PRESETS.map((item) => (
                                    <SelectItem
                                      key={item.value}
                                      value={item.value}
                                    >
                                      {item.label}
                                    </SelectItem>
                                  ))}
                                </SelectGroup>
                              </SelectContent>
                            </Select>
                          </Field>
                          {aspectPreset === 'custom' ? (
                            <div className={styles.twoColumnFields}>
                              <Field>
                                <FieldLabel htmlFor={customAspectWidthId}>
                                  比例宽
                                </FieldLabel>
                                <Input
                                  id={customAspectWidthId}
                                  min={1}
                                  onBlur={commitCustomAspect}
                                  onChange={handleCustomAspectWidthChange}
                                  type="number"
                                  value={customAspect.width}
                                />
                              </Field>
                              <Field>
                                <FieldLabel htmlFor={customAspectHeightId}>
                                  比例高
                                </FieldLabel>
                                <Input
                                  id={customAspectHeightId}
                                  min={1}
                                  onBlur={commitCustomAspect}
                                  onChange={handleCustomAspectHeightChange}
                                  type="number"
                                  value={customAspect.height}
                                />
                              </Field>
                            </div>
                          ) : null}
                          <FieldSet>
                            <FieldLegend variant="label">精确像素</FieldLegend>
                            <div className={styles.fourColumnFields}>
                              <NumericField
                                label="X"
                                max={frameDimensions.width - crop.width}
                                onBlur={commitCropField}
                                onChange={handleCropXChange}
                                value={crop.x}
                              />
                              <NumericField
                                label="Y"
                                max={frameDimensions.height - crop.height}
                                onBlur={commitCropField}
                                onChange={handleCropYChange}
                                value={crop.y}
                              />
                              <NumericField
                                label="宽"
                                max={frameDimensions.width}
                                min={1}
                                onBlur={commitCropField}
                                onChange={handleCropWidthChange}
                                value={crop.width}
                              />
                              <NumericField
                                label="高"
                                max={frameDimensions.height}
                                min={1}
                                onBlur={commitCropField}
                                onChange={handleCropHeightChange}
                                value={crop.height}
                              />
                            </div>
                          </FieldSet>
                          <Field orientation="horizontal">
                            <FieldLabel>
                              <Grid3X3Icon aria-hidden="true" />
                              <FieldContent>
                                <FieldTitle>三分网格</FieldTitle>
                                <FieldDescription>
                                  帮助对齐主体与视觉重心。
                                </FieldDescription>
                              </FieldContent>
                              <Switch
                                checked={showGrid}
                                onCheckedChange={setShowGrid}
                              />
                            </FieldLabel>
                          </Field>
                        </FieldGroup>
                      </FieldSet>

                      <FieldSet>
                        <FieldLegend>变换</FieldLegend>
                        <FieldGroup>
                          <Field>
                            <div className={styles.fieldHeading}>
                              <FieldLabel htmlFor={zoomId}>缩放</FieldLabel>
                              <span>{zoom}%</span>
                            </div>
                            <div className={styles.sliderRow}>
                              <Slider
                                aria-label="图片缩放"
                                id={zoomId}
                                max={MAX_ZOOM}
                                min={MIN_ZOOM}
                                onValueChange={handleZoomChange}
                                onValueCommitted={handleZoomCommit}
                                step={ZOOM_STEP}
                                value={zoom}
                              />
                              <Input
                                aria-label="缩放百分比"
                                max={MAX_ZOOM}
                                min={MIN_ZOOM}
                                onBlur={handleZoomInputBlur}
                                onChange={handleZoomInputChange}
                                type="number"
                                value={zoom}
                              />
                            </div>
                          </Field>
                          <Field>
                            <div className={styles.fieldHeading}>
                              <FieldLabel htmlFor={rotationId}>旋转</FieldLabel>
                              <span>{Math.round(rotation)}°</span>
                            </div>
                            <div className={styles.sliderRow}>
                              <Slider
                                aria-label="任意角度旋转"
                                id={rotationId}
                                max={180}
                                min={-180}
                                onValueChange={handleRotationChange}
                                onValueCommitted={handleRotationCommit}
                                step={1}
                                value={rotation}
                              />
                              <Input
                                aria-label="旋转角度"
                                max={180}
                                min={-180}
                                onBlur={handleRotationInputBlur}
                                onChange={handleRotationInputChange}
                                type="number"
                                value={Math.round(rotation)}
                              />
                            </div>
                          </Field>
                          <div className={styles.transformButtons}>
                            <Button
                              aria-label="逆时针旋转 90 度"
                              onClick={rotateCounterclockwise}
                              size="icon"
                              title="逆时针旋转 90°"
                              variant="outline"
                            >
                              <RotateCcwIcon />
                            </Button>
                            <Button
                              aria-label="顺时针旋转 90 度"
                              onClick={rotateClockwise}
                              size="icon"
                              title="顺时针旋转 90°"
                              variant="outline"
                            >
                              <RotateCwIcon />
                            </Button>
                            <Button
                              aria-pressed={flipHorizontal}
                              onClick={toggleHorizontalFlip}
                              variant="outline"
                            >
                              <FlipHorizontal2Icon data-icon="inline-start" />
                              水平翻转
                            </Button>
                            <Button
                              aria-pressed={flipVertical}
                              onClick={toggleVerticalFlip}
                              variant="outline"
                            >
                              <FlipVertical2Icon data-icon="inline-start" />
                              垂直翻转
                            </Button>
                          </div>
                        </FieldGroup>
                      </FieldSet>

                      <FieldSet>
                        <FieldLegend>输出</FieldLegend>
                        <FieldGroup>
                          <Field>
                            <FieldLabel htmlFor={formatId}>格式</FieldLabel>
                            <Select
                              items={outputFormatItems}
                              onValueChange={handleFormatChange}
                              value={outputFormat}
                            >
                              <SelectTrigger id={formatId}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectGroup>
                                  {outputFormatItems.map((item) => (
                                    <SelectItem
                                      key={item.value}
                                      value={item.value}
                                    >
                                      {item.label}
                                    </SelectItem>
                                  ))}
                                </SelectGroup>
                              </SelectContent>
                            </Select>
                          </Field>
                          {outputFormat === 'png' ? null : (
                            <Field>
                              <div className={styles.fieldHeading}>
                                <FieldLabel htmlFor={qualityId}>
                                  质量
                                </FieldLabel>
                                <span>{quality}</span>
                              </div>
                              <Slider
                                aria-label="输出质量"
                                id={qualityId}
                                max={100}
                                min={10}
                                onValueChange={handleQualityChange}
                                step={1}
                                value={quality}
                              />
                            </Field>
                          )}
                          <Field orientation="horizontal">
                            <FieldLabel>
                              <FieldContent>
                                <FieldTitle>自定义输出尺寸</FieldTitle>
                                <FieldDescription>
                                  默认使用原图上的裁剪像素。
                                </FieldDescription>
                              </FieldContent>
                              <Switch
                                checked={customOutputSize}
                                onCheckedChange={handleCustomOutputToggle}
                              />
                            </FieldLabel>
                          </Field>
                          {customOutputSize ? (
                            <div className={styles.outputSizeRow}>
                              <Field
                                data-invalid={Boolean(outputError) || undefined}
                              >
                                <FieldLabel htmlFor={outputWidthId}>
                                  输出宽
                                </FieldLabel>
                                <Input
                                  aria-invalid={
                                    Boolean(outputError) || undefined
                                  }
                                  id={outputWidthId}
                                  min={1}
                                  onChange={handleOutputWidthChange}
                                  type="number"
                                  value={outputDimensions.width}
                                />
                              </Field>
                              <Button
                                aria-label={
                                  lockOutputRatio
                                    ? '解除尺寸比例'
                                    : '锁定尺寸比例'
                                }
                                aria-pressed={lockOutputRatio}
                                className={styles.ratioLockButton}
                                onClick={toggleOutputRatioLock}
                                size="icon"
                                title={
                                  lockOutputRatio ? '比例已锁定' : '比例未锁定'
                                }
                                variant="ghost"
                              >
                                {lockOutputRatio ? (
                                  <LinkIcon />
                                ) : (
                                  <Link2OffIcon />
                                )}
                              </Button>
                              <Field
                                data-invalid={Boolean(outputError) || undefined}
                              >
                                <FieldLabel htmlFor={outputHeightId}>
                                  输出高
                                </FieldLabel>
                                <Input
                                  aria-invalid={
                                    Boolean(outputError) || undefined
                                  }
                                  id={outputHeightId}
                                  min={1}
                                  onChange={handleOutputHeightChange}
                                  type="number"
                                  value={outputDimensions.height}
                                />
                              </Field>
                            </div>
                          ) : null}
                          {outputError ? (
                            <p className={styles.inlineError} role="alert">
                              {outputError}
                            </p>
                          ) : null}
                          {errorMessage ? (
                            <p className={styles.inlineError} role="alert">
                              {errorMessage}
                            </p>
                          ) : null}
                        </FieldGroup>
                      </FieldSet>
                    </FieldGroup>
                  </CardContent>
                  <CardFooter>
                    <Button
                      className={styles.fullWidthButton}
                      disabled={Boolean(outputError) || phase === 'exporting'}
                      onClick={generateResult}
                      size="lg"
                    >
                      {phase === 'exporting' ? (
                        <LoaderCircleIcon
                          className={styles.loadingIcon}
                          data-icon="inline-start"
                        />
                      ) : (
                        <CropIcon data-icon="inline-start" />
                      )}
                      {phase === 'exporting'
                        ? '正在生成图片'
                        : `生成 ${outputFormatLabel}`}
                    </Button>
                  </CardFooter>
                </Card>
              )}
            </aside>
          </div>
          <p aria-live="polite" className={styles.srStatus}>
            {statusMessage}
          </p>
        </div>
      ) : (
        <section className={styles.hero}>
          <div className={styles.heroIntro}>
            <h1>图片裁剪</h1>
            <p>自由调整比例、旋转和输出尺寸。文件只在浏览器本地处理。</p>
          </div>
          <Button
            aria-label="选择、拖入或粘贴图片"
            className={styles.dropZoneButton}
            disabled={phase === 'decoding'}
            onClick={openFilePicker}
            type="button"
            variant="ghost"
          >
            <Empty className={styles.dropZone}>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  {phase === 'decoding' ? (
                    <LoaderCircleIcon className={styles.loadingIcon} />
                  ) : (
                    <ImageIcon />
                  )}
                </EmptyMedia>
                <EmptyTitle>
                  {phase === 'decoding' ? '正在读取图片' : '选择一张图片'}
                </EmptyTitle>
                <EmptyDescription>
                  {phase === 'decoding'
                    ? `${fileName} · 正在检查格式与画面尺寸`
                    : '支持 JPEG、PNG、WebP、AVIF、GIF 和 BMP'}
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <span className={styles.pickFileButton}>
                  <UploadIcon aria-hidden="true" />
                  选择图片
                </span>
                <span className={styles.pasteHint}>
                  <ClipboardIcon aria-hidden="true" />
                  也可以拖放文件，或直接粘贴剪贴板图片
                </span>
              </EmptyContent>
            </Empty>
          </Button>
          {errorMessage ? (
            <div className={styles.heroError} role="alert">
              <strong>无法打开图片</strong>
              <span>{errorMessage}</span>
              <Button onClick={openFilePicker} variant="outline">
                选择其他图片
              </Button>
            </div>
          ) : null}
        </section>
      )}
    </div>
  )
}
