import {
  AdtsOutputFormat,
  ALL_FORMATS,
  type AudioCodec,
  BlobSource,
  CanvasSink,
  Conversion,
  type ConversionAudioOptions,
  ConversionCanceledError,
  type ConversionVideoOptions,
  getEncodableAudioCodecs,
  getEncodableVideoCodecs,
  Input,
  type InputAudioTrack,
  type InputVideoTrack,
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
  close: () => Promise<void>
  getBlob: () => Promise<Blob>
  getBytesWritten: () => number
  target: StreamTarget
}

const audioEncoderPromises = new Map<AudioCodec, Promise<void>>()

const registerAudioEncoder = async (codec: AudioCodec): Promise<void> => {
  if (codec === 'aac') {
    const { registerAacEncoder } = await import('@mediabunny/aac-encoder')
    registerAacEncoder()
    return
  }
  if (codec === 'flac') {
    const { registerFlacEncoder } = await import('@mediabunny/flac-encoder')
    registerFlacEncoder()
    return
  }
  if (codec === 'mp3') {
    const { registerMp3Encoder } = await import('@mediabunny/mp3-encoder')
    registerMp3Encoder()
    return
  }
  if (codec === 'ac3' || codec === 'eac3') {
    const { registerAc3Encoder } = await import('@mediabunny/ac3')
    registerAc3Encoder()
  }
}

const ensureAudioEncoderForCodec = (codec: AudioCodec): Promise<void> => {
  const existing = audioEncoderPromises.get(codec)
  if (existing) {
    return existing
  }

  const registration = registerAudioEncoder(codec)
  audioEncoderPromises.set(codec, registration)
  return registration
}

const ensureDefaultAudioEncoders = async (): Promise<void> => {
  await Promise.all(
    (['aac', 'flac', 'mp3'] satisfies AudioCodec[]).map((codec) =>
      ensureAudioEncoderForCodec(codec)
    )
  )
}

let proresDecoderPromise: Promise<void> | null = null

const ensureProresDecoder = (): Promise<void> => {
  if (proresDecoderPromise) {
    return proresDecoderPromise
  }

  proresDecoderPromise = import('@mediabunny/prores').then((prores) => {
    prores.registerProresDecoder()
  })

  return proresDecoderPromise
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

const normalizeRotation = (rotation: number): number =>
  ((rotation % 360) + 360) % 360

const getRotatedDimensions = (
  width: number,
  height: number,
  rotation: number
): { height: number; width: number } =>
  normalizeRotation(rotation) % 180 === 90
    ? { height: width, width: height }
    : { height, width }

const getVideoEncodeDimensions = ({
  height,
  needsToBeMultipleOfTwo,
  rotation,
  resize,
  width,
}: {
  height: number
  needsToBeMultipleOfTwo: boolean
  resize: VideoTransformOptions['resize']
  rotation: number
  width: number
}): { height: number; width: number } => {
  const rotated = getRotatedDimensions(width, height, rotation)
  let nextWidth = rotated.width
  let nextHeight = rotated.height

  if (resize.active) {
    if (resize.height !== null) {
      nextHeight = resize.height
      nextWidth = Math.round((resize.height / rotated.height) * rotated.width)
    } else if (resize.width !== null) {
      nextWidth = resize.width
      nextHeight = Math.round((resize.width / rotated.width) * rotated.height)
    }
  }

  if (needsToBeMultipleOfTwo) {
    nextWidth = Math.floor(nextWidth / 2) * 2
    nextHeight = Math.floor(nextHeight / 2) * 2
  }

  return { height: nextHeight, width: nextWidth }
}

const canCopyVideoTrack = async ({
  inputTrack,
  options,
  outputFormat,
}: {
  inputTrack: InputVideoTrack
  options: ConvertOptions
  outputFormat: OutputFormat
}): Promise<boolean> => {
  const inputCodec = await inputTrack.getCodec()
  if (!inputCodec) {
    return false
  }

  const inputRotation = await inputTrack.getRotation()
  if (
    normalizeRotation(inputRotation) !==
    normalizeRotation(options.videoTransform.rotation)
  ) {
    return false
  }

  const dimensions = getVideoEncodeDimensions({
    height: await inputTrack.getDisplayHeight(),
    needsToBeMultipleOfTwo: inputCodec === 'avc' || inputCodec === 'hevc',
    resize: options.videoTransform.resize,
    rotation: options.videoTransform.rotation,
    width: await inputTrack.getDisplayWidth(),
  })
  if (
    dimensions.height !== inputTrack.displayHeight ||
    dimensions.width !== inputTrack.displayWidth
  ) {
    return false
  }

  return outputFormat.getSupportedCodecs().includes(inputCodec)
}

const getVideoTranscodingCodecs = async ({
  inputTrack,
  options,
  outputFormat,
}: {
  inputTrack: InputVideoTrack
  options: ConvertOptions
  outputFormat: OutputFormat
}): Promise<VideoCodec[]> => {
  const inputCodec = await inputTrack.getCodec()
  if (!(inputCodec && (await inputTrack.canDecode()))) {
    return []
  }

  const dimensions = getVideoEncodeDimensions({
    height: await inputTrack.getDisplayHeight(),
    needsToBeMultipleOfTwo: inputCodec === 'avc',
    resize: options.videoTransform.resize,
    rotation: options.videoTransform.rotation,
    width: await inputTrack.getDisplayWidth(),
  })
  const codecResults = await Promise.all(
    outputFormat.getSupportedVideoCodecs().map(async (codec) => {
      const encodable = await getEncodableVideoCodecs([codec], dimensions)
      return encodable.includes(codec) ? codec : null
    })
  )
  return codecResults.filter((codec) => codec !== null)
}

const getAudioTranscodingCodecs = async ({
  inputTrack,
  outputFormat,
  sampleRate,
}: {
  inputTrack: InputAudioTrack
  outputFormat: OutputFormat
  sampleRate: number | null
}): Promise<AudioCodec[]> => {
  const inputCodec = await inputTrack.getCodec()
  if (!(inputCodec && (await inputTrack.canDecode()))) {
    return []
  }

  const inputSampleRate = await inputTrack.getSampleRate()
  const targetSampleRate = sampleRate ?? inputSampleRate
  const codecResults = await Promise.all(
    outputFormat.getSupportedAudioCodecs().map(async (codec) => {
      await ensureAudioEncoderForCodec(codec)
      const encodable = await getEncodableAudioCodecs([codec], {
        sampleRate: targetSampleRate,
      })
      if (encodable.includes(codec)) {
        return codec
      }
      if (sampleRate !== null) {
        return null
      }
      const encodableWithDefaults = await getEncodableAudioCodecs([codec])
      return encodableWithDefaults.includes(codec) ? codec : null
    })
  )
  return codecResults.filter((codec) => codec !== null)
}

const canCopyAudioTrack = async ({
  inputTrack,
  outputFormat,
  sampleRate,
}: {
  inputTrack: InputAudioTrack
  outputFormat: OutputFormat
  sampleRate: number | null
}): Promise<boolean> => {
  const inputCodec = await inputTrack.getCodec()
  if (!inputCodec) {
    return false
  }

  if (
    sampleRate !== null &&
    (await inputTrack.getSampleRate()) !== sampleRate
  ) {
    return false
  }

  return outputFormat.getSupportedCodecs().includes(inputCodec)
}

const getFrameRate = async (
  videoTrack: Awaited<ReturnType<Input['getPrimaryVideoTrack']>>
): Promise<number | null> => {
  if (!videoTrack) {
    return null
  }

  try {
    const statistics = await videoTrack.computePacketStats(50)
    return Number.isFinite(statistics.averagePacketRate)
      ? statistics.averagePacketRate
      : null
  } catch {
    return null
  }
}

export const prepareMedia = async (file: File): Promise<PreparedMedia> => {
  await Promise.all([ensureDefaultAudioEncoders(), ensureProresDecoder()])

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

    const durationFromMetadata = await input.getDurationFromMetadata(
      undefined,
      {
        skipLiveWait: true,
      }
    )
    const duration =
      durationFromMetadata === null
        ? await input.computeDuration(undefined, { skipLiveWait: true })
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
  if (format.includes('hls')) {
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
  await ensureDefaultAudioEncoders()

  const outputFormat = getOutputFormat(container)
  const [videoTrack, audioTrack] = await Promise.all([
    prepared.input.getPrimaryVideoTrack(),
    prepared.input.getPrimaryAudioTrack(),
  ])
  const defaultOptions: ConvertOptions = {
    audioCodec: 'auto',
    container,
    resampleRate: null,
    trim: { active: false, end: null, start: 0 },
    videoCodec: 'auto',
    videoTransform: {
      crop: { active: false, height: 1, left: 0, top: 0, width: 1 },
      mirrorHorizontal: false,
      mirrorVertical: false,
      resize: { active: false, height: null, width: null },
      rotation: 0,
    },
  }
  const [videoCodecs, audioCodecs, canCopyVideo, canCopyAudio] =
    await Promise.all([
      videoTrack
        ? getVideoTranscodingCodecs({
            inputTrack: videoTrack,
            options: defaultOptions,
            outputFormat,
          })
        : Promise.resolve([]),
      audioTrack
        ? getAudioTranscodingCodecs({
            inputTrack: audioTrack,
            outputFormat,
            sampleRate: null,
          })
        : Promise.resolve([]),
      videoTrack
        ? canCopyVideoTrack({
            inputTrack: videoTrack,
            options: defaultOptions,
            outputFormat,
          })
        : Promise.resolve(false),
      audioTrack
        ? canCopyAudioTrack({
            inputTrack: audioTrack,
            outputFormat,
            sampleRate: null,
          })
        : Promise.resolve(false),
    ])

  return {
    audioCodecs,
    canCopyAudio,
    canCopyVideo,
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
  const parts = fileName.split('.')
  parts.pop()
  return parts.join('.')
}

const INITIAL_MEMORY_SINK_SIZE = 2 ** 20

export const createMemorySink = (fileName: string): OutputSink => {
  let bytes = new Uint8Array(INITIAL_MEMORY_SINK_SIZE)
  let bytesWritten = 0
  let fileSize = 0

  const ensureCapacity = (requiredSize: number): void => {
    if (requiredSize <= bytes.byteLength) {
      return
    }

    let nextSize = bytes.byteLength
    while (nextSize < requiredSize) {
      nextSize *= 2
    }

    const nextBytes = new Uint8Array(nextSize)
    nextBytes.set(bytes)
    bytes = nextBytes
  }

  const stream = new WritableStream<StreamTargetChunk>({
    write(chunk) {
      const end = chunk.position + chunk.data.byteLength
      ensureCapacity(end)
      bytes.set(chunk.data, chunk.position)
      fileSize = Math.max(fileSize, end)
      bytesWritten += chunk.data.byteLength
    },
  })

  const target = new StreamTarget(stream)

  return {
    cleanup: () => Promise.resolve(),
    close: () => Promise.resolve(),
    getBlob: () =>
      Promise.resolve(
        new File([bytes.slice(0, fileSize)], fileName, {
          lastModified: Date.now(),
        })
      ),
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
    let isClosed = false

    const close = async (): Promise<void> => {
      if (isClosed) {
        return
      }
      isClosed = true
      await writable.close()
    }

    const stream = new WritableStream<StreamTargetChunk>({
      async write(chunk) {
        await writable.seek(chunk.position)
        await writable.write(chunk)
        bytesWritten += chunk.data.byteLength
      },
    })

    return {
      cleanup: async () => {
        try {
          await close()
        } catch {
          // Closing a canceled stream may fail after the browser aborted it.
        }
        try {
          await directory.removeEntry(storageName)
        } catch {
          // The temporary file may already have been removed by the browser.
        }
      },
      close,
      getBlob: () => fileHandle.getFile(),
      getBytesWritten: () => bytesWritten,
      target: new StreamTarget(stream),
    }
  } catch {
    return null
  }
}

const createOutputSink = async (fileName: string): Promise<OutputSink> =>
  (await createOpfsSink(fileName)) ?? createMemorySink(fileName)

const makeVideoProcessor =
  ({
    horizontal,
    vertical,
  }: {
    horizontal: boolean
    vertical: boolean
  }): NonNullable<ConversionVideoOptions['process']> =>
  (sample) => {
    const frame = sample.toVideoFrame()
    if (!(horizontal || vertical)) {
      return frame
    }

    const canvas = new OffscreenCanvas(frame.displayWidth, frame.displayHeight)
    const context = canvas.getContext('2d')
    if (!context) {
      throw new Error('Could not get 2d context')
    }

    canvas.width = frame.displayWidth
    canvas.height = frame.displayHeight
    context.translate(
      horizontal ? frame.displayWidth : 0,
      vertical ? frame.displayHeight : 0
    )
    context.scale(horizontal ? -1 : 1, vertical ? -1 : 1)
    context.drawImage(frame, 0, 0)
    return new VideoFrame(canvas, {
      displayHeight: frame.displayHeight,
      displayWidth: frame.displayWidth,
      duration: frame.duration ?? undefined,
      timestamp: frame.timestamp,
    })
  }

const makeCrop = (crop: CropRectangle, codec: VideoCodec): CropRectangle => {
  if (codec !== 'avc' && codec !== 'hevc') {
    return crop
  }

  return {
    height: Math.floor(crop.height / 2) * 2,
    left: Math.floor(crop.left / 2) * 2,
    top: Math.floor(crop.top / 2) * 2,
    width: Math.floor(crop.width / 2) * 2,
  }
}

const hasVideoTransform = (options: ConvertOptions): boolean => {
  const { crop, resize, rotation, mirrorHorizontal, mirrorVertical } =
    options.videoTransform
  return (
    crop.active ||
    resize.active ||
    rotation !== 0 ||
    mirrorHorizontal ||
    mirrorVertical
  )
}

export const getVideoConversionOptions = async (
  options: ConvertOptions,
  inputTrack: InputVideoTrack,
  outputFormat: OutputFormat
): Promise<ConversionVideoOptions> => {
  if (options.videoCodec === 'drop') {
    return { discard: true }
  }

  const transformationsActive = hasVideoTransform(options)
  const copyAllowed =
    !(transformationsActive || options.trim.active) &&
    (await canCopyVideoTrack({ inputTrack, options, outputFormat }))
  if (options.videoCodec === 'copy' && copyAllowed) {
    return {}
  }
  if (options.videoCodec === 'auto' && copyAllowed) {
    return {}
  }

  const codec =
    options.videoCodec === 'auto' || options.videoCodec === 'copy'
      ? (
          await getVideoTranscodingCodecs({
            inputTrack,
            options,
            outputFormat,
          })
        )[0]
      : options.videoCodec
  if (!codec) {
    return { discard: true }
  }

  const { crop, resize, rotation, mirrorHorizontal, mirrorVertical } =
    options.videoTransform
  const conversionOptions: ConversionVideoOptions = {
    codec,
    crop: crop.active ? makeCrop(crop, codec) : undefined,
    forceTranscode: true,
    process: makeVideoProcessor({
      horizontal: mirrorHorizontal,
      vertical: mirrorVertical,
    }),
    rotate: rotation,
  }
  if (resize.active) {
    conversionOptions.height = resize.height ?? undefined
    if (resize.height === null) {
      conversionOptions.width = resize.width ?? undefined
    }
  }

  return conversionOptions
}

export const getAudioConversionOptions = async (
  options: ConvertOptions,
  inputTrack: InputAudioTrack,
  outputFormat: OutputFormat
): Promise<ConversionAudioOptions> => {
  if (options.audioCodec === 'drop') {
    return { discard: true }
  }

  const copyAllowed = await canCopyAudioTrack({
    inputTrack,
    outputFormat,
    sampleRate: options.resampleRate,
  })
  if (options.audioCodec === 'copy' && copyAllowed) {
    return {}
  }
  if (options.audioCodec === 'auto' && copyAllowed) {
    return {}
  }

  const codec =
    options.audioCodec === 'auto' || options.audioCodec === 'copy'
      ? (
          await getAudioTranscodingCodecs({
            inputTrack,
            outputFormat,
            sampleRate: options.resampleRate,
          })
        )[0]
      : options.audioCodec
  if (!codec) {
    return { discard: true }
  }

  await ensureAudioEncoderForCodec(codec)
  return {
    codec,
    forceTranscode: true,
    process: (sample) => sample,
    sampleRate: options.resampleRate ?? undefined,
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
  const outputFormat = getOutputFormat(options.container)
  const fileName = `${getBaseName(prepared.file.name)}${outputFormat.fileExtension}`
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
    audio: (inputTrack) =>
      getAudioConversionOptions(options, inputTrack, outputFormat),
    input: prepared.input,
    output,
    trim: options.trim.active
      ? {
          end: options.trim.end ?? undefined,
          start: options.trim.start,
        }
      : undefined,
    video: (inputTrack) =>
      getVideoConversionOptions(options, inputTrack, outputFormat),
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
    await sink.close()
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
