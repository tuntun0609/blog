import {
  AdtsOutputFormat,
  ALL_FORMATS,
  type AudioCodec,
  BlobSource,
  BufferTarget,
  CanvasSink,
  Conversion,
  type ConversionAudioOptions,
  ConversionCanceledError,
  type ConversionVideoOptions,
  getEncodableAudioCodecs,
  getEncodableVideoCodecs,
  Input,
  MkvOutputFormat,
  MovOutputFormat,
  Mp3OutputFormat,
  Mp4OutputFormat,
  Output,
  type OutputFormat,
  StreamTarget,
  type StreamTargetChunk,
  type VideoCodec,
  WavOutputFormat,
  WebMOutputFormat,
} from 'mediabunny'
import type { CropRectangle } from './editor-model'
import { getRotatedDimensions, mapVisualCropToConversion } from './editor-model'

export type OutputContainer =
  | 'aac'
  | 'mkv'
  | 'mov'
  | 'mp3'
  | 'mp4'
  | 'wav'
  | 'webm'

export type VideoCodecChoice = 'auto' | 'copy' | 'drop' | VideoCodec
export type AudioCodecChoice = 'auto' | 'copy' | 'drop' | AudioCodec

export interface MediaMetadata {
  audioCodec: AudioCodec | null
  audioTrackCount: number
  channels: number | null
  duration: number
  format: string
  frameRate: number | null
  height: number | null
  mimeType: string
  rotation: number | null
  sampleRate: number | null
  size: number
  videoCodec: VideoCodec | null
  videoTrackCount: number
  width: number | null
}

export interface PreparedMedia {
  file: File
  input: Input
  metadata: MediaMetadata
}

export interface OutputOptions {
  audioCodecs: AudioCodec[]
  canCopyAudio: boolean
  canCopyVideo: boolean
  videoCodecs: VideoCodec[]
}

export interface VideoTransformOptions {
  crop: CropRectangle & {
    active: boolean
  }
  mirrorHorizontal: boolean
  mirrorVertical: boolean
  resize: {
    active: boolean
    height: number | null
    width: number | null
  }
  rotation: 0 | 90 | 180 | 270
}

export interface ConvertOptions {
  audioCodec: AudioCodecChoice
  container: OutputContainer
  resampleRate: number | null
  trim: {
    active: boolean
    end: number | null
    start: number
  }
  videoCodec: VideoCodecChoice
  videoTransform: VideoTransformOptions
}

export interface ConversionProgress {
  bytesWritten: number
  processedTime: number
  ratio: number
}

export interface ConversionResult {
  blob: Blob
  cleanup: () => Promise<void>
  fileName: string
}

interface OutputSink {
  cleanup: () => Promise<void>
  getBlob: () => Promise<Blob>
  getBytesWritten: () => number
  target: BufferTarget | StreamTarget
}

const AUDIO_EXTENSION_BY_CODEC: Partial<Record<AudioCodec, string>> = {
  aac: 'aac',
  flac: 'flac',
  mp3: 'mp3',
}

let audioEncodersPromise: Promise<void> | null = null

const ensureAudioEncoders = (): Promise<void> => {
  if (audioEncodersPromise) {
    return audioEncodersPromise
  }

  audioEncodersPromise = Promise.all([
    import('@mediabunny/aac-encoder'),
    import('@mediabunny/flac-encoder'),
    import('@mediabunny/mp3-encoder'),
  ]).then(([aacEncoder, flacEncoder, mp3Encoder]) => {
    aacEncoder.registerAacEncoder()
    flacEncoder.registerFlacEncoder()
    mp3Encoder.registerMp3Encoder()
  })

  return audioEncodersPromise
}

const getOutputFormat = (container: OutputContainer): OutputFormat => {
  if (container === 'mp4') {
    return new Mp4OutputFormat()
  }
  if (container === 'webm') {
    return new WebMOutputFormat()
  }
  if (container === 'mov') {
    return new MovOutputFormat()
  }
  if (container === 'mkv') {
    return new MkvOutputFormat()
  }
  if (container === 'wav') {
    return new WavOutputFormat()
  }
  if (container === 'mp3') {
    return new Mp3OutputFormat()
  }
  if (container === 'aac') {
    return new AdtsOutputFormat()
  }

  throw new Error(`不支持的输出格式：${container satisfies never}`)
}

const getFrameRate = async (
  videoTrack: Awaited<ReturnType<Input['getPrimaryVideoTrack']>>
): Promise<number | null> => {
  if (!videoTrack) {
    return null
  }

  try {
    const statistics = await videoTrack.computePacketStats(80)
    return Number.isFinite(statistics.averagePacketRate)
      ? statistics.averagePacketRate
      : null
  } catch {
    return null
  }
}

export const prepareMedia = async (file: File): Promise<PreparedMedia> => {
  const input = new Input({
    formats: ALL_FORMATS,
    source: new BlobSource(file),
  })

  try {
    if (!(await input.canRead())) {
      throw new Error('无法识别这个媒体文件，请确认文件没有损坏。')
    }

    const [format, mimeType, tracks, videoTrack, audioTrack] =
      await Promise.all([
        input.getFormat(),
        input.getMimeType(),
        input.getTracks(),
        input.getPrimaryVideoTrack(),
        input.getPrimaryAudioTrack(),
      ])

    const durationFromMetadata = await input.getDurationFromMetadata(tracks)
    const duration =
      durationFromMetadata === null
        ? await input.computeDuration(tracks)
        : durationFromMetadata

    const [
      width,
      height,
      rotation,
      videoCodec,
      frameRate,
      audioCodec,
      channels,
      sampleRate,
    ] = await Promise.all([
      videoTrack?.getDisplayWidth() ?? null,
      videoTrack?.getDisplayHeight() ?? null,
      videoTrack?.getRotation() ?? null,
      videoTrack?.getCodec() ?? null,
      getFrameRate(videoTrack),
      audioTrack?.getCodec() ?? null,
      audioTrack?.getNumberOfChannels() ?? null,
      audioTrack?.getSampleRate() ?? null,
    ])

    return {
      file,
      input,
      metadata: {
        audioCodec,
        audioTrackCount: tracks.filter((track) => track.isAudioTrack()).length,
        channels,
        duration,
        format: format.name,
        frameRate,
        height,
        mimeType,
        rotation,
        sampleRate,
        size: file.size,
        videoCodec,
        videoTrackCount: tracks.filter((track) => track.isVideoTrack()).length,
        width,
      },
    }
  } catch (error) {
    input.dispose()
    throw error
  }
}

export const disposePreparedMedia = (prepared: PreparedMedia | null): void => {
  if (prepared && !prepared.input.disposed) {
    prepared.input.dispose()
  }
}

export const getDefaultOutputContainer = (
  prepared: PreparedMedia
): OutputContainer => {
  const format = prepared.metadata.format.toLowerCase()

  if (format.includes('mp4') || format.includes('quicktime')) {
    return 'webm'
  }
  if (format.includes('webm') || format.includes('matroska')) {
    return 'mp4'
  }
  if (format.includes('wave')) {
    return 'mp3'
  }
  if (
    format.includes('mp3') ||
    format.includes('aac') ||
    format.includes('flac') ||
    format.includes('ogg')
  ) {
    return 'wav'
  }

  return prepared.metadata.videoTrackCount > 0 ? 'mp4' : 'wav'
}

export const getOutputOptions = async (
  prepared: PreparedMedia,
  container: OutputContainer
): Promise<OutputOptions> => {
  await ensureAudioEncoders()

  const outputFormat = getOutputFormat(container)
  const supportedVideoCodecs = outputFormat.getSupportedVideoCodecs()
  const supportedAudioCodecs = outputFormat.getSupportedAudioCodecs()
  const { metadata } = prepared

  const [videoCodecs, audioCodecs] = await Promise.all([
    getEncodableVideoCodecs(supportedVideoCodecs, {
      height: metadata.height ?? undefined,
      width: metadata.width ?? undefined,
    }),
    getEncodableAudioCodecs(supportedAudioCodecs, {
      numberOfChannels: metadata.channels ?? undefined,
      sampleRate: metadata.sampleRate ?? undefined,
    }),
  ])

  return {
    audioCodecs,
    canCopyAudio:
      metadata.audioCodec !== null &&
      supportedAudioCodecs.includes(metadata.audioCodec),
    canCopyVideo:
      metadata.videoCodec !== null &&
      supportedVideoCodecs.includes(metadata.videoCodec),
    videoCodecs,
  }
}

export const drawFilmstrip = async ({
  canvas,
  height,
  prepared,
  signal,
  width,
}: {
  canvas: HTMLCanvasElement
  height: number
  prepared: PreparedMedia
  signal: AbortSignal
  width: number
}): Promise<void> => {
  if (prepared.input.disposed || signal.aborted) {
    return
  }

  const videoTrack = await prepared.input.getPrimaryVideoTrack()
  if (!videoTrack) {
    throw new Error('当前媒体没有可用于生成时间轴的视频轨道。')
  }

  const displayWidth = await videoTrack.getDisplayWidth()
  const displayHeight = await videoTrack.getDisplayHeight()
  const { duration } = prepared.metadata
  if (displayWidth <= 0 || displayHeight <= 0 || duration <= 0) {
    throw new Error('无法读取时间轴缩略图所需的视频尺寸或时长。')
  }

  const devicePixelRatio = Math.min(window.devicePixelRatio || 1, 3)
  const logicalTileWidth = Math.max(1, height * (displayWidth / displayHeight))
  const tileCount = Math.max(1, Math.ceil(width / logicalTileWidth))
  const lastTimestamp = Math.max(0, duration - 0.001)
  const timestamps = Array.from({ length: tileCount }, (_, tileIndex) =>
    Math.min(lastTimestamp, duration * ((tileIndex + 0.5) / tileCount))
  )

  canvas.width = Math.max(1, Math.round(width * devicePixelRatio))
  canvas.height = Math.max(1, Math.round(height * devicePixelRatio))
  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('当前浏览器无法创建时间轴画布。')
  }

  context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0)
  context.fillStyle = '#111827'
  context.fillRect(0, 0, width, height)

  const sink = new CanvasSink(videoTrack, {
    height: Math.max(1, Math.round(height * devicePixelRatio)),
    poolSize: 2,
  })
  let drawnFrameIndex = 0
  for await (const frame of sink.canvasesAtTimestamps(timestamps)) {
    if (signal.aborted) {
      return
    }
    if (frame) {
      context.drawImage(
        frame.canvas,
        drawnFrameIndex * logicalTileWidth,
        0,
        logicalTileWidth + 1,
        height
      )
    }
    drawnFrameIndex += 1
  }
}

const getBaseName = (fileName: string): string => {
  const lastDot = fileName.lastIndexOf('.')
  return lastDot <= 0 ? fileName : fileName.slice(0, lastDot)
}

const createMemorySink = (): OutputSink => {
  const target = new BufferTarget()
  let bytesWritten = 0

  target.on('write', ({ end }) => {
    bytesWritten = Math.max(bytesWritten, end)
  })

  return {
    cleanup: () => Promise.resolve(),
    getBlob: () => {
      if (!target.buffer) {
        throw new Error('输出文件尚未完成。')
      }
      return Promise.resolve(new Blob([target.buffer]))
    },
    getBytesWritten: () => bytesWritten,
    target,
  }
}

const createOpfsSink = async (fileName: string): Promise<OutputSink | null> => {
  if (!navigator.storage?.getDirectory) {
    return null
  }

  try {
    const directory = await navigator.storage.getDirectory()
    const storageName = `video-convert-${crypto.randomUUID()}-${fileName}`
    const fileHandle = await directory.getFileHandle(storageName, {
      create: true,
    })
    const writable = await fileHandle.createWritable()
    let bytesWritten = 0

    const stream = new WritableStream<StreamTargetChunk>({
      abort: () => writable.abort(),
      close: () => writable.close(),
      async write(chunk) {
        await writable.seek(chunk.position)
        await writable.write(chunk.data)
        bytesWritten = Math.max(
          bytesWritten,
          chunk.position + chunk.data.byteLength
        )
      },
    })

    return {
      cleanup: async () => {
        try {
          await directory.removeEntry(storageName)
        } catch {
          // The temporary file may already have been removed by the browser.
        }
      },
      getBlob: () => fileHandle.getFile(),
      getBytesWritten: () => bytesWritten,
      target: new StreamTarget(stream, { chunked: true }),
    }
  } catch {
    return null
  }
}

const createOutputSink = async (fileName: string): Promise<OutputSink> =>
  (await createOpfsSink(fileName)) ?? createMemorySink()

const makeMirrorProcessor = ({
  horizontal,
  vertical,
}: {
  horizontal: boolean
  vertical: boolean
}): NonNullable<ConversionVideoOptions['process']> => {
  let canvas: HTMLCanvasElement | OffscreenCanvas | null = null

  return (sample) => {
    const frame = sample.toVideoFrame()
    const width = frame.displayWidth
    const height = frame.displayHeight

    if (!canvas || canvas.width !== width || canvas.height !== height) {
      canvas =
        typeof OffscreenCanvas === 'undefined'
          ? document.createElement('canvas')
          : new OffscreenCanvas(width, height)
      canvas.width = width
      canvas.height = height
    }

    const context = canvas.getContext('2d')
    if (!context) {
      frame.close()
      throw new Error('浏览器无法创建视频变换画布。')
    }

    context.save()
    context.clearRect(0, 0, width, height)
    context.translate(horizontal ? width : 0, vertical ? height : 0)
    context.scale(horizontal ? -1 : 1, vertical ? -1 : 1)
    context.drawImage(frame, 0, 0, width, height)
    context.restore()
    frame.close()

    return canvas
  }
}

const getVideoConversionOptions = (
  options: ConvertOptions,
  metadata: MediaMetadata
): ConversionVideoOptions => {
  if (options.videoCodec === 'drop') {
    return { discard: true }
  }

  const conversionOptions: ConversionVideoOptions = {}
  if (options.videoCodec !== 'auto' && options.videoCodec !== 'copy') {
    conversionOptions.codec = options.videoCodec
    conversionOptions.forceTranscode = true
  }

  const { crop, resize, rotation, mirrorHorizontal, mirrorVertical } =
    options.videoTransform
  const transformsPixels =
    crop.active ||
    resize.active ||
    rotation !== 0 ||
    mirrorHorizontal ||
    mirrorVertical

  if (crop.active) {
    const sourceDimensions =
      metadata.width && metadata.height
        ? getRotatedDimensions(
            { height: metadata.height, width: metadata.width },
            rotation
          )
        : null
    conversionOptions.crop = sourceDimensions
      ? mapVisualCropToConversion({
          dimensions: sourceDimensions,
          mirrorHorizontal,
          mirrorVertical,
          rectangle: crop,
        })
      : crop
  }
  if (resize.active) {
    if (resize.height !== null && resize.width !== null) {
      conversionOptions.fit = 'fill'
    }
    conversionOptions.height = resize.height ?? undefined
    conversionOptions.width = resize.width ?? undefined
  }
  if (rotation !== 0) {
    conversionOptions.allowRotationMetadata = false
    conversionOptions.rotate = rotation
  }
  if (mirrorHorizontal || mirrorVertical) {
    conversionOptions.process = makeMirrorProcessor({
      horizontal: mirrorHorizontal,
      vertical: mirrorVertical,
    })
  }
  if (transformsPixels) {
    conversionOptions.forceTranscode = true
  }

  return conversionOptions
}

const getAudioConversionOptions = (
  options: ConvertOptions
): ConversionAudioOptions => {
  if (options.audioCodec === 'drop') {
    return { discard: true }
  }

  const conversionOptions: ConversionAudioOptions = {}
  if (options.audioCodec !== 'auto' && options.audioCodec !== 'copy') {
    conversionOptions.codec = options.audioCodec
    conversionOptions.forceTranscode = true
  }
  if (options.resampleRate !== null) {
    conversionOptions.forceTranscode = true
    conversionOptions.sampleRate = options.resampleRate
  }

  return conversionOptions
}

const registerSelectedEncoder = async (
  codec: AudioCodecChoice
): Promise<void> => {
  if (codec in AUDIO_EXTENSION_BY_CODEC) {
    await ensureAudioEncoders()
  }
}

export const convertMedia = async ({
  onProgress,
  options,
  prepared,
  signal,
}: {
  onProgress: (progress: ConversionProgress) => void
  options: ConvertOptions
  prepared: PreparedMedia
  signal: AbortSignal
}): Promise<ConversionResult> => {
  await registerSelectedEncoder(options.audioCodec)

  const outputFormat = getOutputFormat(options.container)
  const fileName = `${getBaseName(prepared.file.name)}-converted${outputFormat.fileExtension}`
  const sink = await createOutputSink(fileName)
  const output = new Output({
    format: outputFormat,
    target: sink.target,
  })

  if (signal.aborted) {
    await sink.cleanup()
    throw new ConversionCanceledError()
  }

  const conversion = await Conversion.init({
    audio: getAudioConversionOptions(options),
    input: prepared.input,
    output,
    showWarnings: false,
    tracks: 'all',
    trim: options.trim.active
      ? {
          end: options.trim.end ?? undefined,
          start: options.trim.start,
        }
      : undefined,
    video: getVideoConversionOptions(options, prepared.metadata),
  })

  if (!conversion.isValid) {
    await sink.cleanup()
    const reasons = conversion.discardedTracks
      .map(({ reason }) => reason.replaceAll('_', ' '))
      .join('、')
    throw new Error(
      reasons
        ? `当前浏览器无法完成这组转换：${reasons}`
        : '当前浏览器无法完成这组转换设置。'
    )
  }

  conversion.onProgress = (ratio, processedTime) => {
    onProgress({
      bytesWritten: sink.getBytesWritten(),
      processedTime,
      ratio,
    })
  }

  const cancelConversion = () => {
    conversion.cancel().catch(() => undefined)
  }
  signal.addEventListener('abort', cancelConversion, { once: true })

  try {
    await conversion.execute()
    const blob = await sink.getBlob()
    onProgress({
      bytesWritten: blob.size,
      processedTime: prepared.metadata.duration,
      ratio: 1,
    })

    return {
      blob,
      cleanup: sink.cleanup,
      fileName,
    }
  } catch (error) {
    await sink.cleanup()
    throw error
  } finally {
    signal.removeEventListener('abort', cancelConversion)
  }
}
