import { describe, expect, test } from 'bun:test'
import {
  clampComparisonPosition,
  classifyWorkerError,
  createBackgroundRemovalFileName,
  fitInferenceDimensions,
  getComparisonPositionForKey,
  isCurrentWorkerResponse,
  normalizeModelProgress,
  selectProcessingBackend,
} from './background-removal-model'

describe('background removal model', () => {
  test('creates stable PNG output names', () => {
    expect(createBackgroundRemovalFileName('portrait.final.webp')).toBe(
      'portrait.final-no-bg.png'
    )
    expect(createBackgroundRemovalFileName('')).toBe('image-no-bg.png')
  })

  test('fits large inference inputs without changing their ratio', () => {
    expect(fitInferenceDimensions({ height: 3000, width: 6000 })).toEqual({
      height: 768,
      width: 1536,
    })
    expect(fitInferenceDimensions({ height: 800, width: 600 })).toEqual({
      height: 800,
      width: 600,
    })
  })

  test('normalizes progress callbacks and comparison positions', () => {
    expect(normalizeModelProgress({ progress: 37.4 })).toBe(37)
    expect(normalizeModelProgress({ loaded: 25, total: 100 })).toBe(25)
    expect(normalizeModelProgress({ loaded: 10, total: 0 })).toBeNull()
    expect(clampComparisonPosition(120)).toBe(100)
  })

  test('supports normal and accelerated comparison keyboard steps', () => {
    expect(
      getComparisonPositionForKey({
        key: 'ArrowRight',
        position: 50,
        shiftKey: false,
      })
    ).toBe(51)
    expect(
      getComparisonPositionForKey({
        key: 'ArrowLeft',
        position: 50,
        shiftKey: true,
      })
    ).toBe(40)
    expect(
      getComparisonPositionForKey({
        key: 'End',
        position: 50,
        shiftKey: false,
      })
    ).toBe(100)
  })

  test('classifies recoverable backend and network errors', () => {
    expect(
      classifyWorkerError(new Error('WebGPU requestAdapter failed'), 'webgpu')
        .code
    ).toBe('webgpu-unavailable')
    expect(
      classifyWorkerError(new Error('Failed to fetch model'), 'wasm').code
    ).toBe('model-download-failed')
    expect(classifyWorkerError(new Error('out of memory'), 'wasm').code).toBe(
      'out-of-memory'
    )
  })

  test('ignores stale worker replies', () => {
    expect(isCurrentWorkerResponse(3, { requestId: 3 })).toBe(true)
    expect(isCurrentWorkerResponse(3, { requestId: 2 })).toBe(false)
  })

  test('selects WebGPU when available and WASM otherwise', () => {
    expect(selectProcessingBackend(true)).toBe('webgpu')
    expect(selectProcessingBackend(false)).toBe('wasm')
  })
})
