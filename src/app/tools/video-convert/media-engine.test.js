import { describe, expect, test } from 'bun:test'
import { Mp4OutputFormat } from 'mediabunny'
import {
  createMemorySink,
  getAudioConversionOptions,
  getVideoConversionOptions,
} from './media-engine.ts'

const createVideoTrack = ({ codec = 'avc', rotation = 0 } = {}) => ({
  canDecode: async () => true,
  displayHeight: 1080,
  displayWidth: 1920,
  getCodec: async () => codec,
  getDisplayHeight: async () => 1080,
  getDisplayWidth: async () => 1920,
  getRotation: async () => rotation,
})

const createAudioTrack = () => ({
  canDecode: async () => true,
  getCodec: async () => 'opus',
  getSampleRate: async () => 48_000,
})

const baseOptions = {
  audioCodec: 'auto',
  container: 'mp4',
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

describe('Remotion-compatible output sink', () => {
  test('preserves random-access MP4 metadata rewrites', async () => {
    const sink = createMemorySink('converted.mp4')
    const { target } = sink

    target._start()
    target._write(new Uint8Array([5, 6]), 4)
    await target._flush()
    target._write(new Uint8Array([1, 2, 3, 4]), 0)
    await target._flush()
    await target._finalize()

    const file = await sink.getBlob()

    expect(file).toBeInstanceOf(File)
    expect(file.name).toBe('converted.mp4')
    expect(new Uint8Array(await file.arrayBuffer())).toEqual(
      new Uint8Array([1, 2, 3, 4, 5, 6])
    )
  })

  test('uses an empty configuration for a compatible copy operation', async () => {
    const options = await getVideoConversionOptions(
      baseOptions,
      createVideoTrack(),
      new Mp4OutputFormat()
    )

    expect(options).toEqual({})
  })

  test('matches Remotion video transcode parameters', async () => {
    const options = await getVideoConversionOptions(
      {
        ...baseOptions,
        videoCodec: 'avc',
        videoTransform: {
          ...baseOptions.videoTransform,
          crop: { active: true, height: 99, left: 7, top: 9, width: 101 },
          resize: { active: true, height: 360, width: 640 },
          rotation: 90,
        },
      },
      createVideoTrack(),
      new Mp4OutputFormat()
    )

    expect(options.codec).toBe('avc')
    expect(options.crop).toEqual({
      height: 98,
      left: 6,
      top: 8,
      width: 100,
    })
    expect(options.forceTranscode).toBe(true)
    expect(options.height).toBe(360)
    expect(options.width).toBeUndefined()
    expect(options.rotate).toBe(90)
    expect(options.allowRotationMetadata).toBeUndefined()
    expect(options.process).toBeFunction()
  })

  test('matches Remotion audio transcode parameters', async () => {
    const options = await getAudioConversionOptions(
      { ...baseOptions, audioCodec: 'aac', resampleRate: 16_000 },
      createAudioTrack(),
      new Mp4OutputFormat()
    )

    expect(options).toMatchObject({
      codec: 'aac',
      forceTranscode: true,
      sampleRate: 16_000,
    })
    expect(options.process).toBeFunction()
  })
})
