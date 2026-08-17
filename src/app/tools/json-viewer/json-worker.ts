/// <reference lib="webworker" />

import { formatJsonText, normalizeJsonError } from './json-operations'
import type { JsonWorkerRequest, JsonWorkerResponse } from './json-viewer-types'

const handleRequest = (request: JsonWorkerRequest): JsonWorkerResponse => {
  try {
    if (request.type === 'beautify') {
      return {
        id: request.id,
        ok: true,
        text: formatJsonText(request.text),
        type: request.type,
      }
    }

    if (request.type === 'minify') {
      return {
        id: request.id,
        ok: true,
        text: formatJsonText(request.text, 0),
        type: request.type,
      }
    }

    return {
      error: { message: '无法识别 JSON 操作。' },
      id: request.id,
      ok: false,
      type: request.type,
    }
  } catch (error) {
    return {
      error: normalizeJsonError(error, request.text),
      id: request.id,
      ok: false,
      type: request.type,
    }
  }
}

self.addEventListener('message', (event: MessageEvent<JsonWorkerRequest>) => {
  self.postMessage(handleRequest(event.data))
})
