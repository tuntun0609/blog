export type ComparisonState = 'different' | 'empty' | 'identical'

export interface TextPair {
  modified: string
  original: string
}

export const EMPTY_TEXT_PAIR: TextPair = {
  modified: '',
  original: '',
}

export const countCharacters = (value: string): number =>
  Array.from(value).length

export const getComparisonState = (
  original: string,
  modified: string
): ComparisonState => {
  if (!(original || modified)) {
    return 'empty'
  }

  return original === modified ? 'identical' : 'different'
}
