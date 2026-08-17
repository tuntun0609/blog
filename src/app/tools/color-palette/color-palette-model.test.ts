import { describe, expect, test } from 'bun:test'
import {
  clampColorCount,
  formatBytes,
  formatCssVariables,
  getSliderNumber,
  type PaletteColor,
} from './color-palette-model'

const colors: PaletteColor[] = [
  {
    hex: '#6D28D9',
    hsl: 'hsl(262, 70%, 50%)',
    oklch: 'oklch(0.504 0.247 293.1)',
    population: 80,
    proportion: 0.8,
    rgb: 'rgb(109, 40, 217)',
    textColor: '#FFFFFF',
  },
  {
    hex: '#FDE68A',
    hsl: 'hsl(48, 96%, 77%)',
    oklch: 'oklch(0.906 0.123 95.7)',
    population: 20,
    proportion: 0.2,
    rgb: 'rgb(253, 230, 138)',
    textColor: '#000000',
  },
]

describe('color palette model', () => {
  test('clamps configured palette sizes', () => {
    expect(clampColorCount(2)).toBe(3)
    expect(clampColorCount(7.6)).toBe(8)
    expect(clampColorCount(12)).toBe(10)
    expect(getSliderNumber([5])).toBe(5)
    expect(getSliderNumber([])).toBe(6)
  })

  test('formats palette colors as reusable CSS variables', () => {
    expect(formatCssVariables(colors)).toBe(
      ':root {\n  --palette-1: #6D28D9;\n  --palette-2: #FDE68A;\n}'
    )
  })

  test('formats common file sizes', () => {
    expect(formatBytes(900)).toBe('900 B')
    expect(formatBytes(2048)).toBe('2.0 KB')
    expect(formatBytes(2 * 1024 * 1024)).toBe('2.0 MB')
  })
})
