import { describe, expect, test } from 'bun:test'
// Bun resolves the adjacent TypeScript module while keeping Next's tsc scope clean.
import {
  createFullTrimRange,
  getDurationInFrames,
  getPlayerFps,
  mapVisualCropToConversion,
  moveCropRectangle,
  moveTrimBoundary,
  resizeCropRectangle,
  secondsToTrimFrame,
  trimRangeToSeconds,
  updateCropField,
} from './editor-model'

const HD = { height: 1080, width: 1920 }

describe('crop model', () => {
  test('moves the crop rectangle without leaving the frame', () => {
    expect(
      moveCropRectangle({
        deltaX: 2000,
        deltaY: -500,
        dimensions: HD,
        rectangle: { height: 400, left: 100, top: 100, width: 600 },
      })
    ).toEqual({ height: 400, left: 1320, top: 0, width: 600 })
  })

  test('resizes corners with the Remotion minimum size', () => {
    expect(
      resizeCropRectangle({
        dimensions: HD,
        rectangle: { height: 400, left: 100, top: 100, width: 600 },
        target: 'bottom-right',
        x: 120,
        y: 130,
      })
    ).toEqual({ height: 120, left: 100, top: 100, width: 120 })
  })

  test('keeps number fields and dimensions inside the source frame', () => {
    expect(
      updateCropField({
        dimensions: HD,
        field: 'left',
        rectangle: { height: 400, left: 100, top: 100, width: 600 },
        value: 1800,
      })
    ).toEqual({ height: 400, left: 1800, top: 100, width: 120 })
  })

  test('maps crop coordinates back through preview mirrors', () => {
    expect(
      mapVisualCropToConversion({
        dimensions: HD,
        mirrorHorizontal: true,
        mirrorVertical: true,
        rectangle: { height: 300, left: 100, top: 50, width: 500 },
      })
    ).toEqual({ height: 300, left: 1320, top: 730, width: 500 })
  })
})

describe('trim model', () => {
  test('uses the source frame rate and falls back to 30 FPS', () => {
    expect(getPlayerFps(29.97)).toBe(29.97)
    expect(getPlayerFps(null)).toBe(30)
    expect(getDurationInFrames(2, 29.97)).toBe(60)
  })

  test('keeps inclusive trim handles from crossing', () => {
    const fullRange = createFullTrimRange(60)
    const movedStart = moveTrimBoundary({
      boundary: 'in',
      durationInFrames: 60,
      frame: 50,
      range: fullRange,
    })
    expect(
      moveTrimBoundary({
        boundary: 'out',
        durationInFrames: 60,
        frame: 10,
        range: movedStart,
      })
    ).toEqual({ inFrame: 50, outFrame: 50 })
  })

  test('converts the inclusive out frame to an exclusive end time', () => {
    expect(
      trimRangeToSeconds({
        duration: 2,
        fps: 30,
        range: { inFrame: 15, outFrame: 44 },
      })
    ).toEqual({ end: 1.5, start: 0.5 })
    expect(
      secondsToTrimFrame({
        boundary: 'out',
        durationInFrames: 60,
        fps: 30,
        seconds: 1.5,
      })
    ).toBe(44)
  })
})
