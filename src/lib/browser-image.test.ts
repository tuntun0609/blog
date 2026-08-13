import { describe, expect, test } from 'bun:test'
import {
  isAcceptedImageFile,
  isAnimatedWebP,
  validateImageDimensions,
} from './browser-image'

describe('browser image validation', () => {
  test('accepts supported MIME types and known extensions', () => {
    expect(isAcceptedImageFile({ name: 'photo.bin', type: 'image/png' })).toBe(
      true
    )
    expect(isAcceptedImageFile({ name: 'photo.AVIF', type: '' })).toBe(true)
    expect(
      isAcceptedImageFile({ name: 'photo.svg', type: 'image/svg+xml' })
    ).toBe(false)
  })

  test('enforces edge and pixel limits', () => {
    expect(() =>
      validateImageDimensions({ height: 4000, width: 6000 })
    ).not.toThrow()
    expect(() =>
      validateImageDimensions({ height: 100, width: 20_000 })
    ).toThrow('单边')
    expect(() =>
      validateImageDimensions({ height: 8000, width: 8000 })
    ).toThrow('百万像素')
  })

  test('detects the animation bit in extended WebP headers', async () => {
    const bytes = new Uint8Array(21)
    bytes.set(new TextEncoder().encode('RIFF'), 0)
    bytes.set(new TextEncoder().encode('WEBP'), 8)
    bytes.set(new TextEncoder().encode('VP8X'), 12)
    bytes[20] = 0x02
    const animated = new File([bytes], 'animated.webp', { type: 'image/webp' })

    expect(await isAnimatedWebP(animated)).toBe(true)
    bytes[20] = 0
    const still = new File([bytes], 'still.webp', { type: 'image/webp' })
    expect(await isAnimatedWebP(still)).toBe(false)
  })
})
