'use client'

import {
  ArrowLeftIcon,
  CheckCircle2Icon,
  DownloadIcon,
  FileVideoIcon,
  RefreshCcwIcon,
  RotateCcwIcon,
  UploadIcon,
  XIcon,
  ZapIcon,
} from 'lucide-react'
import {
  type ChangeEvent,
  type CSSProperties,
  type DragEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { CropEditor } from './crop-editor'
import type {
  CropField,
  CropRectangle,
  FrameDimensions,
  TrimBoundary,
  TrimFrameRange,
} from './editor-model'
import {
  createFullCropRectangle,
  createFullTrimRange,
  getCropMinimums,
  getDurationInFrames,
  getPlayerFps,
  getRotatedDimensions,
  moveTrimBoundary,
  secondsToTrimFrame,
  trimRangeToSeconds,
  updateCropField,
} from './editor-model'
import type {
  AudioCodecChoice,
  ConversionProgress,
  ConversionResult,
  MediaMetadata,
  OutputContainer,
  OutputOptions,
  PreparedMedia,
  VideoCodecChoice,
} from './media-engine'
import { TrimTimeline } from './trim-timeline'
import styles from './video-converter.module.css'

type Phase = 'analyzing' | 'converting' | 'done' | 'error' | 'idle' | 'ready'

interface NumericFieldProps {
  label: string
  max?: number
  min?: number
  onChange: (value: number) => void
  step?: number
  value: number
}

interface SwitchSectionProps {
  active: boolean
  children?: ReactNode
  description: string
  disabled?: boolean
  label: string
  onChange: (active: boolean) => void
}

const OUTPUT_CONTAINERS: { label: string; value: OutputContainer }[] = [
  { label: 'MP4', value: 'mp4' },
  { label: 'WebM', value: 'webm' },
  { label: 'MOV', value: 'mov' },
  { label: 'MKV', value: 'mkv' },
  { label: 'WAV', value: 'wav' },
  { label: 'MP3', value: 'mp3' },
  { label: 'AAC', value: 'aac' },
]

const VIDEO_CODEC_LABELS: Record<string, string> = {
  av1: 'AV1',
  avc: 'H.264 / AVC',
  hevc: 'H.265 / HEVC',
  prores: 'Apple ProRes',
  vp8: 'VP8',
  vp9: 'VP9',
}

const AUDIO_CODEC_LABELS: Record<string, string> = {
  aac: 'AAC',
  ac3: 'AC-3',
  eac3: 'E-AC-3',
  flac: 'FLAC',
  mp3: 'MP3',
  opus: 'Opus',
  'pcm-f32': 'PCM 32-bit Float',
  'pcm-s16': 'PCM 16-bit',
  'pcm-s24': 'PCM 24-bit',
  'pcm-s32': 'PCM 32-bit',
  vorbis: 'Vorbis',
}

const EMPTY_PROGRESS: ConversionProgress = {
  bytesWritten: 0,
  processedTime: 0,
  ratio: 0,
}

const ACCEPTED_MEDIA_TYPES =
  'video/*,audio/*,.aac,.flac,.m3u8,.m4v,.mkv,.mov,.mp3,.mp4,.ogg,.wav,.webm'

const formatBytes = (bytes: number): string => {
  if (bytes === 0) {
    return '0 B'
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const unitIndex = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1
  )
  const value = bytes / 1024 ** unitIndex
  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
}

const formatDuration = (seconds: number): string => {
  if (!Number.isFinite(seconds)) {
    return '未知'
  }

  const totalSeconds = Math.max(0, Math.round(seconds))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const remainingSeconds = totalSeconds % 60
  const base = `${minutes.toString().padStart(2, '0')}:${remainingSeconds
    .toString()
    .padStart(2, '0')}`
  return hours > 0 ? `${hours.toString().padStart(2, '0')}:${base}` : base
}

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message) {
    return error.message
  }
  return '处理媒体时发生未知错误，请更换文件或转换设置后重试。'
}

const isVideoTranscodeCodec = (
  codec: VideoCodecChoice
): codec is Exclude<VideoCodecChoice, 'auto' | 'copy' | 'drop'> =>
  codec !== 'auto' && codec !== 'copy' && codec !== 'drop'

const isAudioTranscodeCodec = (
  codec: AudioCodecChoice
): codec is Exclude<AudioCodecChoice, 'auto' | 'copy' | 'drop'> =>
  codec !== 'auto' && codec !== 'copy' && codec !== 'drop'

function NumericField({
  label,
  max,
  min = 0,
  onChange,
  step = 1,
  value,
}: NumericFieldProps) {
  const inputId = useId()
  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      onChange(Number(event.currentTarget.value))
    },
    [onChange]
  )

  return (
    <label className={styles.numericField} htmlFor={inputId}>
      <span>{label}</span>
      <Input
        id={inputId}
        max={max}
        min={min}
        onChange={handleChange}
        step={step}
        type="number"
        value={value}
      />
    </label>
  )
}

function SwitchSection({
  active,
  children,
  description,
  disabled = false,
  label,
  onChange,
}: SwitchSectionProps) {
  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      onChange(event.currentTarget.checked)
    },
    [onChange]
  )

  return (
    <div className={styles.switchSection} data-active={active}>
      <label className={styles.switchLabel}>
        <span>
          <strong>{label}</strong>
          <small>{description}</small>
        </span>
        <input
          checked={active}
          disabled={disabled}
          onChange={handleChange}
          type="checkbox"
        />
      </label>
      {active && children ? (
        <div className={styles.switchContent}>{children}</div>
      ) : null}
    </div>
  )
}

function MetadataCard({ metadata }: { metadata: MediaMetadata }) {
  const items = [
    ['容器', metadata.format],
    ['时长', formatDuration(metadata.duration)],
    ['文件大小', formatBytes(metadata.size)],
    [
      '画面',
      metadata.width && metadata.height
        ? `${metadata.width} × ${metadata.height}`
        : '无视频轨道',
    ],
    [
      '视频编码',
      metadata.videoCodec
        ? (VIDEO_CODEC_LABELS[metadata.videoCodec] ?? metadata.videoCodec)
        : '—',
    ],
    ['帧率', metadata.frameRate ? `${metadata.frameRate.toFixed(2)} FPS` : '—'],
    [
      '音频编码',
      metadata.audioCodec
        ? (AUDIO_CODEC_LABELS[metadata.audioCodec] ?? metadata.audioCodec)
        : '—',
    ],
    [
      '音频',
      metadata.sampleRate
        ? `${metadata.sampleRate.toLocaleString()} Hz · ${metadata.channels ?? 0} 声道`
        : '无音频轨道',
    ],
  ]

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>媒体信息</CardTitle>
        <CardDescription>
          {metadata.videoTrackCount} 条视频轨道 · {metadata.audioTrackCount}{' '}
          条音频轨道
        </CardDescription>
      </CardHeader>
      <CardContent>
        <dl className={styles.metadataGrid}>
          {items.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  )
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: This client boundary coordinates the converter's mutually exclusive workflow states and browser resource cleanup.
export function VideoConverter() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const previewSectionRef = useRef<HTMLElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const preparedRef = useRef<PreparedMedia | null>(null)
  const previewUrlRef = useRef<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const resultCleanupRef = useRef<(() => Promise<void>) | null>(null)
  const selectionSequenceRef = useRef(0)

  const [phase, setPhase] = useState<Phase>('idle')
  const [metadata, setMetadata] = useState<MediaMetadata | null>(null)
  const [fileName, setFileName] = useState('')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [preparedMedia, setPreparedMedia] = useState<PreparedMedia | null>(null)
  const [preparedVersion, setPreparedVersion] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [isVideoPlaying, setIsVideoPlaying] = useState(false)
  const [volume, setVolume] = useState(1)
  const [isDragging, setIsDragging] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [container, setContainer] = useState<OutputContainer>('mp4')
  const [outputOptions, setOutputOptions] = useState<OutputOptions | null>(null)
  const [optionsLoading, setOptionsLoading] = useState(false)
  const [videoCodec, setVideoCodec] = useState<VideoCodecChoice>('auto')
  const [audioCodec, setAudioCodec] = useState<AudioCodecChoice>('auto')
  const [cropActive, setCropActive] = useState(false)
  const [cropRectangle, setCropRectangle] = useState<CropRectangle>({
    height: 1,
    left: 0,
    top: 0,
    width: 1,
  })
  const [resizeActive, setResizeActive] = useState(false)
  const [resizeWidth, setResizeWidth] = useState(0)
  const [resizeHeight, setResizeHeight] = useState(0)
  const [rotation, setRotation] = useState<0 | 90 | 180 | 270>(0)
  const [mirrorHorizontal, setMirrorHorizontal] = useState(false)
  const [mirrorVertical, setMirrorVertical] = useState(false)
  const [trimActive, setTrimActive] = useState(false)
  const [trimRange, setTrimRange] = useState<TrimFrameRange>({
    inFrame: 0,
    outFrame: 0,
  })
  const [resampleActive, setResampleActive] = useState(false)
  const [resampleRate, setResampleRate] = useState(16_000)
  const [progress, setProgress] = useState<ConversionProgress>(EMPTY_PROGRESS)
  const [result, setResult] = useState<ConversionResult | null>(null)

  const replacePreviewUrl = useCallback((file: File | null) => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
    }

    const nextUrl = file ? URL.createObjectURL(file) : null
    previewUrlRef.current = nextUrl
    setPreviewUrl(nextUrl)
  }, [])

  const cleanupResult = useCallback(async () => {
    if (resultCleanupRef.current) {
      await resultCleanupRef.current()
      resultCleanupRef.current = null
    }
    setResult(null)
  }, [])

  const resetTransformSettings = useCallback((nextMetadata: MediaMetadata) => {
    const width = nextMetadata.width ?? 0
    const height = nextMetadata.height ?? 0
    const dimensions = {
      height: Math.max(1, height),
      width: Math.max(1, width),
    }
    const fps = getPlayerFps(nextMetadata.frameRate)
    setCurrentTime(0)
    setIsVideoPlaying(false)
    setCropActive(false)
    setCropRectangle(createFullCropRectangle(dimensions))
    setResizeActive(false)
    setResizeWidth(width)
    setResizeHeight(height)
    setRotation(0)
    setMirrorHorizontal(false)
    setMirrorVertical(false)
    setTrimActive(false)
    setTrimRange(
      createFullTrimRange(getDurationInFrames(nextMetadata.duration, fps))
    )
    setResampleActive(false)
    setResampleRate(nextMetadata.sampleRate ?? 16_000)
  }, [])

  const openFile = useCallback(
    async (file: File) => {
      const selectionSequence = selectionSequenceRef.current + 1
      selectionSequenceRef.current = selectionSequence
      abortControllerRef.current?.abort()
      setErrorMessage(null)
      setPhase('analyzing')
      setFileName(file.name)
      setOutputOptions(null)
      setProgress(EMPTY_PROGRESS)
      await cleanupResult()

      try {
        const engine = await import('./media-engine')
        const prepared = await engine.prepareMedia(file)

        if (selectionSequence !== selectionSequenceRef.current) {
          engine.disposePreparedMedia(prepared)
          return
        }

        engine.disposePreparedMedia(preparedRef.current)
        preparedRef.current = prepared
        setPreparedMedia(prepared)
        replacePreviewUrl(file)
        setMetadata(prepared.metadata)
        resetTransformSettings(prepared.metadata)
        setVideoCodec('auto')
        setAudioCodec('auto')
        setContainer(engine.getDefaultOutputContainer(prepared))
        setPreparedVersion((version) => version + 1)
        setPhase('ready')
      } catch (error) {
        if (selectionSequence !== selectionSequenceRef.current) {
          return
        }
        setMetadata(null)
        setPreparedMedia(null)
        replacePreviewUrl(null)
        setErrorMessage(getErrorMessage(error))
        setPhase('error')
      }
    },
    [cleanupResult, replacePreviewUrl, resetTransformSettings]
  )

  useEffect(() => {
    const prepared = preparedRef.current
    if (!prepared || preparedVersion === 0) {
      return
    }

    let isCurrent = true
    setOptionsLoading(true)
    setOutputOptions(null)

    import('./media-engine')
      .then((engine) => engine.getOutputOptions(prepared, container))
      .then((options) => {
        if (!isCurrent) {
          return
        }
        setOutputOptions(options)
        setVideoCodec((current) => {
          const isAvailable =
            current === 'auto' ||
            current === 'drop' ||
            (current === 'copy' && options.canCopyVideo) ||
            (isVideoTranscodeCodec(current) &&
              options.videoCodecs.includes(current))
          return isAvailable ? current : 'auto'
        })
        setAudioCodec((current) => {
          const isAvailable =
            current === 'auto' ||
            current === 'drop' ||
            (current === 'copy' && options.canCopyAudio) ||
            (isAudioTranscodeCodec(current) &&
              options.audioCodecs.includes(current))
          return isAvailable ? current : 'auto'
        })
      })
      .catch((error: unknown) => {
        if (isCurrent) {
          setErrorMessage(getErrorMessage(error))
        }
      })
      .finally(() => {
        if (isCurrent) {
          setOptionsLoading(false)
        }
      })

    return () => {
      isCurrent = false
    }
  }, [container, preparedVersion])

  useEffect(
    () => () => {
      selectionSequenceRef.current += 1
      abortControllerRef.current?.abort()
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current)
      }
      if (preparedRef.current && !preparedRef.current.input.disposed) {
        preparedRef.current.input.dispose()
      }
      if (resultCleanupRef.current) {
        resultCleanupRef.current().catch(() => undefined)
      }
    },
    []
  )

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === previewSectionRef.current)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () =>
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  useEffect(() => {
    const video = videoRef.current
    if (!video) {
      return
    }
    video.muted = isMuted
    video.volume = volume
  }, [isMuted, previewUrl, volume])

  const handleFileInputChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.currentTarget.files?.[0]
      event.currentTarget.value = ''
      if (file) {
        await openFile(file)
      }
    },
    [openFile]
  )

  const handleDrop = useCallback(
    async (event: DragEvent<HTMLButtonElement>) => {
      event.preventDefault()
      setIsDragging(false)
      const [file] = event.dataTransfer.files
      if (file) {
        await openFile(file)
      }
    },
    [openFile]
  )

  const startConversion = useCallback(async () => {
    const prepared = preparedRef.current
    if (!prepared) {
      return
    }

    const fps = getPlayerFps(prepared.metadata.frameRate)
    const trimSeconds = trimRangeToSeconds({
      duration: prepared.metadata.duration,
      fps,
      range: trimRange,
    })

    await cleanupResult()
    const abortController = new AbortController()
    abortControllerRef.current = abortController
    setErrorMessage(null)
    setProgress(EMPTY_PROGRESS)
    setPhase('converting')

    try {
      const engine = await import('./media-engine')
      const conversionResult = await engine.convertMedia({
        onProgress: setProgress,
        options: {
          audioCodec,
          container,
          resampleRate: resampleActive ? resampleRate : null,
          trim: {
            active: trimActive,
            end: trimActive ? trimSeconds.end : null,
            start: trimActive ? trimSeconds.start : 0,
          },
          videoCodec,
          videoTransform: {
            crop: {
              active: cropActive,
              ...cropRectangle,
            },
            mirrorHorizontal,
            mirrorVertical,
            resize: {
              active: resizeActive,
              height: resizeActive ? resizeHeight : null,
              width: resizeActive ? resizeWidth : null,
            },
            rotation,
          },
        },
        prepared,
        signal: abortController.signal,
      })

      resultCleanupRef.current = conversionResult.cleanup
      setResult(conversionResult)
      setPhase('done')
    } catch (error) {
      if (abortController.signal.aborted) {
        setPhase('ready')
        setProgress(EMPTY_PROGRESS)
      } else {
        setErrorMessage(getErrorMessage(error))
        setPhase('error')
      }
    } finally {
      if (abortControllerRef.current === abortController) {
        abortControllerRef.current = null
      }
    }
  }, [
    audioCodec,
    cleanupResult,
    container,
    cropActive,
    cropRectangle,
    mirrorHorizontal,
    mirrorVertical,
    resampleActive,
    resampleRate,
    resizeActive,
    resizeHeight,
    resizeWidth,
    rotation,
    trimActive,
    trimRange,
    videoCodec,
  ])

  const resetAll = useCallback(async () => {
    selectionSequenceRef.current += 1
    abortControllerRef.current?.abort()
    await cleanupResult()
    const engine = await import('./media-engine')
    engine.disposePreparedMedia(preparedRef.current)
    preparedRef.current = null
    setPreparedMedia(null)
    replacePreviewUrl(null)
    setMetadata(null)
    setFileName('')
    setCurrentTime(0)
    setIsVideoPlaying(false)
    setErrorMessage(null)
    setOutputOptions(null)
    setProgress(EMPTY_PROGRESS)
    setPhase('idle')
  }, [cleanupResult, replacePreviewUrl])

  const downloadResult = useCallback(() => {
    if (!result) {
      return
    }

    const url = URL.createObjectURL(result.blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = result.fileName
    anchor.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }, [result])

  const useResultAsInput = useCallback(async () => {
    if (!result) {
      return
    }

    const resultBuffer = await result.blob.arrayBuffer()
    const nextFile = new File([resultBuffer], result.fileName, {
      lastModified: Date.now(),
      type: result.blob.type,
    })
    await openFile(nextFile)
  }, [openFile, result])

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleDragEnter = useCallback((event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((event: DragEvent<HTMLButtonElement>) => {
    if (event.currentTarget === event.target) {
      setIsDragging(false)
    }
  }, [])

  const handleDragOver = useCallback((event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault()
  }, [])

  const cancelConversion = useCallback(() => {
    abortControllerRef.current?.abort()
  }, [])

  const seekVideoToFrame = useCallback(
    (frame: number) => {
      const video = videoRef.current
      if (!(video && metadata)) {
        return
      }
      const nextTime = Math.min(
        metadata.duration,
        Math.max(0, frame / getPlayerFps(metadata.frameRate))
      )
      video.pause()
      video.currentTime = nextTime
      setCurrentTime(nextTime)
      setIsVideoPlaying(false)
    },
    [metadata]
  )

  const toggleVideoPlayback = useCallback(() => {
    const video = videoRef.current
    if (!video) {
      return
    }
    if (!video.paused) {
      video.pause()
      return
    }
    if (video.ended || video.currentTime >= video.duration) {
      video.currentTime = 0
      setCurrentTime(0)
    }
    video.play().catch((error: unknown) => {
      setErrorMessage(getErrorMessage(error))
      setIsVideoPlaying(false)
    })
  }, [])

  const handleVolumeChange = useCallback((nextVolume: number) => {
    const clampedVolume = Math.min(Math.max(nextVolume, 0), 1)
    setVolume(clampedVolume)
    setIsMuted(clampedVolume === 0)
  }, [])

  const toggleMute = useCallback(() => {
    if (isMuted || volume === 0) {
      if (volume === 0) {
        setVolume(1)
      }
      setIsMuted(false)
      return
    }
    setIsMuted(true)
  }, [isMuted, volume])

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch((error: unknown) => {
        setErrorMessage(getErrorMessage(error))
      })
      return
    }
    const preview = previewSectionRef.current
    if (!preview) {
      return
    }
    preview.requestFullscreen().catch((error: unknown) => {
      setErrorMessage(getErrorMessage(error))
    })
  }, [])

  const handleCropActiveChange = useCallback((active: boolean) => {
    setCropActive(active)
    if (!(active && window.matchMedia('(max-width: 950px)').matches)) {
      return
    }

    window.requestAnimationFrame(() => {
      const reduceMotion = window.matchMedia(
        '(prefers-reduced-motion: reduce)'
      ).matches
      previewSectionRef.current?.scrollIntoView({
        behavior: reduceMotion ? 'auto' : 'smooth',
        block: 'start',
      })
    })
  }, [])

  const handleCropFieldChange = useCallback(
    (field: CropField, value: number, dimensions: FrameDimensions) => {
      setCropRectangle((rectangle) =>
        updateCropField({ dimensions, field, rectangle, value })
      )
    },
    []
  )

  const handleTrimSecondsChange = useCallback(
    (boundary: TrimBoundary, seconds: number) => {
      if (!metadata) {
        return
      }
      const fps = getPlayerFps(metadata.frameRate)
      const durationInFrames = getDurationInFrames(metadata.duration, fps)
      const frame = secondsToTrimFrame({
        boundary,
        durationInFrames,
        fps,
        seconds,
      })
      setTrimRange((range) =>
        moveTrimBoundary({ boundary, durationInFrames, frame, range })
      )
      seekVideoToFrame(frame)
    },
    [metadata, seekVideoToFrame]
  )

  const resetConversionSettings = useCallback(() => {
    setPhase('ready')
    setResult(null)
  }, [])

  const handleContainerChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      setContainer(event.currentTarget.value as OutputContainer)
      setVideoCodec('auto')
      setAudioCodec('auto')
    },
    []
  )

  const handleVideoCodecChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      setVideoCodec(event.currentTarget.value as VideoCodecChoice)
    },
    []
  )

  const handleAudioCodecChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      setAudioCodec(event.currentTarget.value as AudioCodecChoice)
    },
    []
  )

  const handleRotationChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      const nextRotation = Number(event.currentTarget.value) as
        | 0
        | 90
        | 180
        | 270
      setRotation(nextRotation)
      if (metadata?.width && metadata.height) {
        setCropRectangle(
          createFullCropRectangle(
            getRotatedDimensions(
              { height: metadata.height, width: metadata.width },
              nextRotation
            )
          )
        )
      }
    },
    [metadata]
  )

  const handleMirrorHorizontalChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setMirrorHorizontal(event.currentTarget.checked)
    },
    []
  )

  const handleMirrorVerticalChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setMirrorVertical(event.currentTarget.checked)
    },
    []
  )

  const handleResampleRateChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      setResampleRate(Number(event.currentTarget.value))
    },
    []
  )

  const sourceDimensions = useMemo<FrameDimensions | null>(
    () =>
      metadata?.width && metadata.height
        ? { height: metadata.height, width: metadata.width }
        : null,
    [metadata]
  )
  const displayDimensions = useMemo(
    () =>
      sourceDimensions
        ? getRotatedDimensions(sourceDimensions, rotation)
        : null,
    [rotation, sourceDimensions]
  )
  const playerFps = getPlayerFps(metadata?.frameRate)
  const durationInFrames = getDurationInFrames(
    metadata?.duration ?? 0,
    playerFps
  )
  const trimSeconds = metadata
    ? trimRangeToSeconds({
        duration: metadata.duration,
        fps: playerFps,
        range: trimRange,
      })
    : { end: 0, start: 0 }
  const cropMinimums = displayDimensions
    ? getCropMinimums(displayDimensions)
    : null
  const trimInputSeconds = {
    end: Number(trimSeconds.end.toFixed(3)),
    start: Number(trimSeconds.start.toFixed(3)),
  }
  const videoPreviewStyle = useMemo<CSSProperties>(() => {
    const quarterTurn = rotation === 90 || rotation === 270
    const sourceAspect = sourceDimensions
      ? sourceDimensions.width / sourceDimensions.height
      : 1

    return {
      height: quarterTurn ? `${(1 / sourceAspect) * 100}%` : '100%',
      transform: `translate(-50%, -50%) rotate(${rotation}deg) scaleX(${mirrorHorizontal ? -1 : 1}) scaleY(${mirrorVertical ? -1 : 1})`,
      width: quarterTurn ? `${sourceAspect * 100}%` : '100%',
    }
  }, [mirrorHorizontal, mirrorVertical, rotation, sourceDimensions])
  const videoStageStyle = useMemo<CSSProperties>(() => {
    const aspect = displayDimensions
      ? displayDimensions.width / displayDimensions.height
      : 16 / 9
    return {
      aspectRatio: `${displayDimensions?.width ?? 16} / ${displayDimensions?.height ?? 9}`,
      width: `min(100%, calc(67svh * ${aspect}))`,
    }
  }, [displayDimensions])

  const handleVideoPlay = useCallback(() => {
    const video = videoRef.current
    if (!video) {
      return
    }
    const isOutsideTrimRange =
      trimActive &&
      (video.currentTime < trimSeconds.start ||
        video.currentTime >= trimSeconds.end)
    if (isOutsideTrimRange) {
      video.currentTime = trimSeconds.start
    }
    setCurrentTime(video.currentTime)
    setIsVideoPlaying(true)
  }, [trimActive, trimSeconds.end, trimSeconds.start])

  const handleVideoPause = useCallback(() => {
    const video = videoRef.current
    setIsVideoPlaying(false)
    if (video) {
      setCurrentTime(video.currentTime)
    }
  }, [])

  const handleVideoTimeUpdate = useCallback(() => {
    const video = videoRef.current
    if (!video) {
      return
    }
    setCurrentTime(video.currentTime)
    if (!trimActive || video.currentTime < trimSeconds.end - 0.001) {
      return
    }
    const outTime = trimRange.outFrame / playerFps
    video.pause()
    video.currentTime = outTime
    setCurrentTime(outTime)
    setIsVideoPlaying(false)
  }, [playerFps, trimActive, trimRange.outFrame, trimSeconds.end])
  const syncCurrentVideoTime = useCallback(() => {
    const video = videoRef.current
    if (video) {
      setCurrentTime(video.currentTime)
    }
  }, [])
  const changeCropLeft = useCallback(
    (value: number) => {
      if (displayDimensions) {
        handleCropFieldChange('left', value, displayDimensions)
      }
    },
    [displayDimensions, handleCropFieldChange]
  )
  const changeCropTop = useCallback(
    (value: number) => {
      if (displayDimensions) {
        handleCropFieldChange('top', value, displayDimensions)
      }
    },
    [displayDimensions, handleCropFieldChange]
  )
  const changeCropWidth = useCallback(
    (value: number) => {
      if (displayDimensions) {
        handleCropFieldChange('width', value, displayDimensions)
      }
    },
    [displayDimensions, handleCropFieldChange]
  )
  const changeCropHeight = useCallback(
    (value: number) => {
      if (displayDimensions) {
        handleCropFieldChange('height', value, displayDimensions)
      }
    },
    [displayDimensions, handleCropFieldChange]
  )
  const changeTrimStart = useCallback(
    (value: number) => handleTrimSecondsChange('in', value),
    [handleTrimSecondsChange]
  )
  const changeTrimEnd = useCallback(
    (value: number) => handleTrimSecondsChange('out', value),
    [handleTrimSecondsChange]
  )

  const outputLabel =
    OUTPUT_CONTAINERS.find((item) => item.value === container)?.label ??
    container.toUpperCase()
  const isAudioOnly = Boolean(metadata && metadata.videoTrackCount === 0)
  const submitDisabled =
    optionsLoading ||
    !outputOptions ||
    phase === 'converting' ||
    (metadata?.videoTrackCount === 0 && metadata.audioTrackCount === 0) ||
    (videoCodec === 'drop' && audioCodec === 'drop')

  return (
    <div className={styles.converter} data-dragging={isDragging}>
      <input
        accept={ACCEPTED_MEDIA_TYPES}
        aria-label="选择要转换的媒体文件"
        className={styles.fileInput}
        id="video-convert-file-input"
        onChange={handleFileInputChange}
        ref={fileInputRef}
        type="file"
      />

      {isDragging ? (
        <div className={styles.dragOverlay}>
          <UploadIcon aria-hidden="true" />
          <strong>松开即可载入文件</strong>
        </div>
      ) : null}

      {metadata && previewUrl ? (
        <div className={styles.workspace}>
          <div className={styles.workspaceTopbar}>
            <Button onClick={resetAll} variant="ghost">
              <ArrowLeftIcon data-icon="inline-start" />
              返回选择文件
            </Button>
            <Button onClick={openFilePicker} variant="outline">
              <RefreshCcwIcon data-icon="inline-start" />
              更换文件
            </Button>
          </div>

          <div className={styles.workspaceGrid}>
            <section
              aria-label="媒体预览"
              className={styles.previewColumn}
              ref={previewSectionRef}
            >
              <div className={styles.playerShell} data-crop-active={cropActive}>
                {isAudioOnly ? (
                  <div className={styles.audioPreview}>
                    <FileVideoIcon aria-hidden="true" />
                    <strong>{fileName}</strong>
                    <audio controls src={previewUrl}>
                      <track kind="captions" />
                    </audio>
                  </div>
                ) : (
                  <div
                    className={styles.videoStage}
                    data-crop-active={cropActive}
                    style={videoStageStyle}
                  >
                    <video
                      className={styles.videoPreview}
                      onEnded={handleVideoPause}
                      onLoadedMetadata={syncCurrentVideoTime}
                      onPause={handleVideoPause}
                      onPlay={handleVideoPlay}
                      onSeeked={syncCurrentVideoTime}
                      onTimeUpdate={handleVideoTimeUpdate}
                      playsInline
                      ref={videoRef}
                      src={previewUrl}
                      style={videoPreviewStyle}
                    >
                      <track kind="captions" />
                    </video>
                    {cropActive &&
                    displayDimensions &&
                    phase !== 'converting' &&
                    phase !== 'done' ? (
                      <CropEditor
                        dimensions={displayDimensions}
                        onChange={setCropRectangle}
                        rectangle={cropRectangle}
                      />
                    ) : null}
                  </div>
                )}
              </div>
              {!isAudioOnly && preparedMedia ? (
                <TrimTimeline
                  currentTime={currentTime}
                  duration={metadata.duration}
                  durationInFrames={durationInFrames}
                  fps={playerFps}
                  isFullscreen={isFullscreen}
                  isMuted={isMuted}
                  isPlaying={isVideoPlaying}
                  onChange={setTrimRange}
                  onSeek={seekVideoToFrame}
                  onToggleFullscreen={toggleFullscreen}
                  onToggleMute={toggleMute}
                  onTogglePlayback={toggleVideoPlayback}
                  onVolumeChange={handleVolumeChange}
                  prepared={preparedMedia}
                  range={trimRange}
                  trimActive={trimActive}
                  volume={volume}
                />
              ) : null}
              <MetadataCard metadata={metadata} />
            </section>

            <aside aria-label="转换设置" className={styles.settingsColumn}>
              {phase === 'converting' ? (
                <Card>
                  <CardHeader>
                    <CardTitle>正在转换为 {outputLabel}</CardTitle>
                    <CardDescription>
                      文件只在当前浏览器中处理，请保持页面打开。
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div
                      aria-label={`转换进度 ${Math.round(progress.ratio * 100)}%`}
                      aria-valuemax={100}
                      aria-valuemin={0}
                      aria-valuenow={Math.round(progress.ratio * 100)}
                      className={styles.progressTrack}
                      role="progressbar"
                    >
                      <span style={{ width: `${progress.ratio * 100}%` }} />
                    </div>
                    <div className={styles.progressMeta}>
                      <strong>{Math.round(progress.ratio * 100)}%</strong>
                      <span>
                        {formatDuration(progress.processedTime)} ·{' '}
                        {formatBytes(progress.bytesWritten)}
                      </span>
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button
                      className={styles.fullWidthButton}
                      onClick={cancelConversion}
                      variant="outline"
                    >
                      <XIcon data-icon="inline-start" />
                      取消转换
                    </Button>
                  </CardFooter>
                </Card>
              ) : null}
              {phase === 'done' && result ? (
                <Card>
                  <CardHeader>
                    <div className={styles.doneIcon}>
                      <CheckCircle2Icon aria-hidden="true" />
                    </div>
                    <CardTitle>转换完成</CardTitle>
                    <CardDescription>{result.fileName}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className={styles.resultStats}>
                      <span>{formatBytes(result.blob.size)}</span>
                      <span>{outputLabel}</span>
                    </div>
                  </CardContent>
                  <CardFooter className={styles.resultActions}>
                    <Button
                      className={styles.fullWidthButton}
                      onClick={downloadResult}
                    >
                      <DownloadIcon data-icon="inline-start" />
                      下载文件
                    </Button>
                    <div>
                      <Button onClick={useResultAsInput} variant="outline">
                        用作新输入
                      </Button>
                      <Button
                        onClick={resetConversionSettings}
                        variant="outline"
                      >
                        <RotateCcwIcon data-icon="inline-start" />
                        重新设置
                      </Button>
                    </div>
                  </CardFooter>
                </Card>
              ) : null}
              {phase !== 'converting' && phase !== 'done' ? (
                <Card>
                  <CardHeader>
                    <CardTitle>转换设置</CardTitle>
                    <CardDescription>
                      与 Remotion Convert 一样，使用 WebCodecs 在本地完成转换。
                    </CardDescription>
                  </CardHeader>
                  <CardContent className={styles.controls}>
                    <label className={styles.selectField}>
                      <span>输出容器</span>
                      <select
                        onChange={handleContainerChange}
                        value={container}
                      >
                        {OUTPUT_CONTAINERS.map((item) => (
                          <option key={item.value} value={item.value}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    {optionsLoading ? (
                      <div className={styles.codecSkeletons}>
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                      </div>
                    ) : null}

                    {!optionsLoading && metadata.videoTrackCount > 0 ? (
                      <label className={styles.selectField}>
                        <span>视频编码</span>
                        <select
                          onChange={handleVideoCodecChange}
                          value={videoCodec}
                        >
                          <option value="auto">自动（优先无损复制）</option>
                          {outputOptions?.canCopyVideo ? (
                            <option value="copy">
                              复制原始编码（{metadata.videoCodec?.toUpperCase()}
                              ）
                            </option>
                          ) : null}
                          {outputOptions?.videoCodecs.map((codec) => (
                            <option key={codec} value={codec}>
                              转码为 {VIDEO_CODEC_LABELS[codec] ?? codec}
                            </option>
                          ))}
                          <option value="drop">移除视频轨道</option>
                        </select>
                      </label>
                    ) : null}

                    {!optionsLoading && metadata.audioTrackCount > 0 ? (
                      <label className={styles.selectField}>
                        <span>音频编码</span>
                        <select
                          onChange={handleAudioCodecChange}
                          value={audioCodec}
                        >
                          <option value="auto">自动（优先无损复制）</option>
                          {outputOptions?.canCopyAudio ? (
                            <option value="copy">
                              复制原始编码（{metadata.audioCodec?.toUpperCase()}
                              ）
                            </option>
                          ) : null}
                          {outputOptions?.audioCodecs.map((codec) => (
                            <option key={codec} value={codec}>
                              转码为 {AUDIO_CODEC_LABELS[codec] ?? codec}
                            </option>
                          ))}
                          <option value="drop">移除音频轨道</option>
                        </select>
                      </label>
                    ) : null}

                    {metadata.videoTrackCount > 0 ? (
                      <>
                        <SwitchSection
                          active={cropActive}
                          description="拖动画面手柄，也可输入精确像素"
                          label="裁剪"
                          onChange={handleCropActiveChange}
                        >
                          {displayDimensions && cropMinimums ? (
                            <div className={styles.fourColumnFields}>
                              <NumericField
                                label="左"
                                max={
                                  displayDimensions.width - cropMinimums.width
                                }
                                onChange={changeCropLeft}
                                value={cropRectangle.left}
                              />
                              <NumericField
                                label="上"
                                max={
                                  displayDimensions.height - cropMinimums.height
                                }
                                onChange={changeCropTop}
                                value={cropRectangle.top}
                              />
                              <NumericField
                                label="宽"
                                max={displayDimensions.width}
                                min={cropMinimums.width}
                                onChange={changeCropWidth}
                                value={cropRectangle.width}
                              />
                              <NumericField
                                label="高"
                                max={displayDimensions.height}
                                min={cropMinimums.height}
                                onChange={changeCropHeight}
                                value={cropRectangle.height}
                              />
                            </div>
                          ) : null}
                        </SwitchSection>

                        <SwitchSection
                          active={resizeActive}
                          description="设置输出画面尺寸"
                          label="调整尺寸"
                          onChange={setResizeActive}
                        >
                          <div className={styles.twoColumnFields}>
                            <NumericField
                              label="宽度"
                              min={2}
                              onChange={setResizeWidth}
                              value={resizeWidth}
                            />
                            <NumericField
                              label="高度"
                              min={2}
                              onChange={setResizeHeight}
                              value={resizeHeight}
                            />
                          </div>
                        </SwitchSection>

                        <div className={styles.inlineOptions}>
                          <label className={styles.selectField}>
                            <span>旋转</span>
                            <select
                              onChange={handleRotationChange}
                              value={rotation}
                            >
                              <option value={0}>不旋转</option>
                              <option value={90}>顺时针 90°</option>
                              <option value={180}>旋转 180°</option>
                              <option value={270}>顺时针 270°</option>
                            </select>
                          </label>
                          <div className={styles.checkOptions}>
                            <label>
                              <input
                                checked={mirrorHorizontal}
                                onChange={handleMirrorHorizontalChange}
                                type="checkbox"
                              />
                              水平镜像
                            </label>
                            <label>
                              <input
                                checked={mirrorVertical}
                                onChange={handleMirrorVerticalChange}
                                type="checkbox"
                              />
                              垂直镜像
                            </label>
                          </div>
                        </div>

                        <SwitchSection
                          active={trimActive}
                          description="拖动播放器下方手柄，支持逐帧微调"
                          label="截取"
                          onChange={setTrimActive}
                        >
                          <div className={styles.twoColumnFields}>
                            <NumericField
                              label="开始（秒）"
                              max={metadata.duration}
                              onChange={changeTrimStart}
                              step={1 / playerFps}
                              value={trimInputSeconds.start}
                            />
                            <NumericField
                              label="结束（秒）"
                              max={metadata.duration}
                              onChange={changeTrimEnd}
                              step={1 / playerFps}
                              value={trimInputSeconds.end}
                            />
                          </div>
                        </SwitchSection>
                      </>
                    ) : null}

                    {metadata.audioTrackCount > 0 ? (
                      <SwitchSection
                        active={resampleActive}
                        description="更改音频采样率"
                        label="音频重采样"
                        onChange={setResampleActive}
                      >
                        <label className={styles.selectField}>
                          <span>采样率</span>
                          <select
                            onChange={handleResampleRateChange}
                            value={resampleRate}
                          >
                            <option value={8000}>8,000 Hz</option>
                            <option value={16_000}>16,000 Hz</option>
                            <option value={22_050}>22,050 Hz</option>
                            <option value={44_100}>44,100 Hz</option>
                            <option value={48_000}>48,000 Hz</option>
                          </select>
                        </label>
                      </SwitchSection>
                    ) : null}

                    {errorMessage ? (
                      <div className={styles.inlineError} role="alert">
                        {errorMessage}
                      </div>
                    ) : null}
                  </CardContent>
                  <CardFooter>
                    <Button
                      className={styles.fullWidthButton}
                      disabled={submitDisabled}
                      onClick={startConversion}
                      size="lg"
                    >
                      <ZapIcon data-icon="inline-start" />
                      转换为 {outputLabel}
                    </Button>
                  </CardFooter>
                </Card>
              ) : null}
            </aside>
          </div>
        </div>
      ) : (
        <section className={styles.hero}>
          <div className={styles.heroIntro}>
            <h1>视频转码</h1>
            <p className={styles.heroDescription}>
              在浏览器本地转换视频和音频。文件不会上传到服务器。
            </p>
          </div>

          <button
            aria-label="选择或拖入媒体文件"
            className={styles.dropZoneLabel}
            onClick={openFilePicker}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            type="button"
          >
            <div
              className={styles.dropZone}
              data-analyzing={phase === 'analyzing'}
            >
              <FileVideoIcon aria-hidden="true" />
              <div className={styles.dropZoneCopy}>
                <strong>
                  {phase === 'analyzing'
                    ? '正在读取媒体信息'
                    : '选择视频或音频文件'}
                </strong>
                <span>
                  {phase === 'analyzing'
                    ? `${fileName} · 正在检查轨道、编码与时长`
                    : '点击选择，或将文件拖放到这里'}
                </span>
              </div>
              {phase === 'analyzing' ? (
                <div aria-hidden="true" className={styles.analyzingBars}>
                  <Skeleton className="h-2 w-full" />
                  <Skeleton className="h-2 w-3/4" />
                </div>
              ) : (
                <span className={styles.pickFileButton}>
                  <UploadIcon aria-hidden="true" />
                  选择文件
                </span>
              )}
            </div>
          </button>

          {errorMessage ? (
            <div className={styles.heroError} role="alert">
              <strong>无法打开文件</strong>
              <span>{errorMessage}</span>
              <Button onClick={openFilePicker} variant="outline">
                选择其他文件
              </Button>
            </div>
          ) : null}
        </section>
      )}
    </div>
  )
}
