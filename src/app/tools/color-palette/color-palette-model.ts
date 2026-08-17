export const DEFAULT_COLOR_COUNT = 6
export const MIN_COLOR_COUNT = 3
export const MAX_COLOR_COUNT = 10

export type PalettePhase =
  | 'decoding'
  | 'error'
  | 'extracting'
  | 'idle'
  | 'ready'

export interface PaletteColor {
  hex: string
  hsl: string
  oklch: string
  population: number
  proportion: number
  rgb: string
  textColor: string
}

export interface PaletteSource {
  dimensions: {
    height: number
    width: number
  }
  fileName: string
  fileSize: number
  frozenAnimation: boolean
  sourceBlob: Blob
  url: string
}

const percentFormatter = new Intl.NumberFormat('zh-CN', {
  maximumFractionDigits: 1,
  style: 'percent',
})

export const clampColorCount = (value: number): number =>
  Math.min(MAX_COLOR_COUNT, Math.max(MIN_COLOR_COUNT, Math.round(value)))

export const getSliderNumber = (value: number | readonly number[]): number => {
  if (typeof value === 'number') {
    return clampColorCount(value)
  }
  return clampColorCount(value[0] ?? DEFAULT_COLOR_COUNT)
}

export const formatPaletteShare = (proportion: number): string =>
  percentFormatter.format(Math.max(0, proportion))

export const formatBytes = (bytes: number): string => {
  if (bytes < 1024) {
    return `${bytes} B`
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export const formatCssVariables = (colors: readonly PaletteColor[]): string => {
  const declarations = colors.map(
    (color, index) => `  --palette-${index + 1}: ${color.hex};`
  )
  return [':root {', ...declarations, '}'].join('\n')
}
