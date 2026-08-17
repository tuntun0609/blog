import { parse, stringify } from 'lossless-json'
import type { JSONParser } from 'vanilla-jsoneditor'
import type { JsonOperationError, JsonParseResult } from './json-viewer-types'

export const JSON_INDENTATION = 2

const POSITION_PATTERNS = [
  /(?:position|at)\s+(\d+)/iu,
  /char(?:acter)?\s+(\d+)/iu,
] as const

const normalizePosition = (value: number, text: string): number =>
  Math.min(Math.max(value, 0), text.length)

const getErrorPosition = (
  message: string,
  text: string
): number | undefined => {
  for (const pattern of POSITION_PATTERNS) {
    const match = pattern.exec(message)
    if (match?.[1]) {
      return normalizePosition(Number(match[1]), text)
    }
  }
}

export const getLineAndColumn = (
  text: string,
  position: number
): { column: number; line: number } => {
  const safePosition = normalizePosition(position, text)
  const beforeError = text.slice(0, safePosition)
  const lines = beforeError.split('\n')

  return {
    column: (lines.at(-1)?.length ?? 0) + 1,
    line: lines.length,
  }
}

export const normalizeJsonError = (
  error: unknown,
  text: string
): JsonOperationError => {
  const message = error instanceof Error ? error.message : 'JSON 处理失败。'
  const positionFromError =
    typeof error === 'object' &&
    error !== null &&
    'position' in error &&
    typeof error.position === 'number'
      ? error.position
      : undefined
  const position = positionFromError ?? getErrorPosition(message, text)

  if (position === undefined) {
    return { message }
  }

  return {
    ...getLineAndColumn(text, position),
    message,
    position,
  }
}

export const losslessJsonParser: JSONParser = {
  parse: (text: string): unknown => parse(text),
  stringify: (
    value: unknown,
    _replacer?:
      | ((this: unknown, key: string, value: unknown) => unknown)
      | Array<number | string>
      | null,
    space?: number | string
  ): string => stringify(value, null, space) ?? '',
}

export const parseJsonText = (text: string): JsonParseResult => {
  try {
    return { json: parse(text), ok: true }
  } catch (error) {
    return { error: normalizeJsonError(error, text), ok: false }
  }
}

export const formatJsonText = (
  text: string,
  indentation: number | string = JSON_INDENTATION
): string => {
  const json = parse(text)
  return stringify(json, null, indentation) ?? ''
}

export const formatJsonValue = (
  value: unknown,
  indentation: number | string = JSON_INDENTATION
): string => stringify(value, null, indentation) ?? ''
