import { describe, expect, test } from 'bun:test'
import {
  createInitialCorners,
  createOutputFileName,
  getOutputDimensions,
  getSafeOutputDimensions,
  getSliderNumber,
  scaleCorners,
  validateCorners,
} from './document-calibration-model'

describe('document calibration model', () => {
  test('creates an inset quadrilateral in natural image coordinates', () => {
    expect(createInitialCorners({ height: 1000, width: 2000 })).toEqual({
      bottomLeft: { x: 100, y: 900 },
      bottomRight: { x: 1900, y: 900 },
      topLeft: { x: 100, y: 100 },
      topRight: { x: 1900, y: 100 },
    })
  })

  test('derives output size from the longest opposing edges', () => {
    const dimensions = getOutputDimensions({
      bottomLeft: { x: 100, y: 900 },
      bottomRight: { x: 1700, y: 850 },
      topLeft: { x: 300, y: 100 },
      topRight: { x: 1600, y: 160 },
    })
    expect(dimensions).toEqual({ height: 825, width: 1601 })
  })

  test('scales oversized results proportionally', () => {
    const safe = getSafeOutputDimensions(
      { height: 8000, width: 8000 },
      16_384,
      40_000_000
    )
    expect(safe.limited).toBe(true)
    expect(safe.width).toBe(6324)
    expect(safe.height).toBe(6324)
    expect(safe.width * safe.height).toBeLessThanOrEqual(40_000_000)
  })

  test('rejects crossed and degenerate point selections', () => {
    expect(
      validateCorners({
        bottomLeft: { x: 10, y: 90 },
        bottomRight: { x: 90, y: 10 },
        topLeft: { x: 10, y: 10 },
        topRight: { x: 90, y: 90 },
      })
    ).toContain('不能交叉')
    expect(
      validateCorners({
        bottomLeft: { x: 10, y: 12 },
        bottomRight: { x: 12, y: 12 },
        topLeft: { x: 10, y: 10 },
        topRight: { x: 12, y: 10 },
      })
    ).toContain('距离太近')
  })

  test('scales corners and creates stable export values', () => {
    expect(
      scaleCorners(
        {
          bottomLeft: { x: 10, y: 90 },
          bottomRight: { x: 90, y: 90 },
          topLeft: { x: 10, y: 10 },
          topRight: { x: 90, y: 10 },
        },
        0.5
      )
    ).toEqual({
      bottomLeft: { x: 5, y: 45 },
      bottomRight: { x: 45, y: 45 },
      topLeft: { x: 5, y: 5 },
      topRight: { x: 45, y: 5 },
    })
    expect(
      createOutputFileName({
        fileName: 'contract.photo.png',
        format: 'jpeg',
        height: 1200,
        width: 800,
      })
    ).toBe('contract.photo-calibrated-800x1200.jpg')
    expect(getSliderNumber([92.4])).toBe(92)
  })
})
