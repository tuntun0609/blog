export interface JsonOperationError {
  column?: number
  line?: number
  message: string
  position?: number
}

export interface JsonParseSuccess {
  json: unknown
  ok: true
}

export interface JsonParseFailure {
  error: JsonOperationError
  ok: false
}

export type JsonParseResult = JsonParseFailure | JsonParseSuccess

export interface JsonWorkerRequest {
  id: number
  text: string
  type: 'beautify' | 'minify'
}

export interface JsonWorkerSuccess {
  id: number
  ok: true
  text: string
  type: 'beautify' | 'minify'
}

export interface JsonWorkerFailure {
  error: JsonOperationError
  id: number
  ok: false
  type: JsonWorkerRequest['type']
}

export type JsonWorkerResponse = JsonWorkerFailure | JsonWorkerSuccess
