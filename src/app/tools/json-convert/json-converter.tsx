'use client'

import {
  ArrowLeftRight,
  Check,
  Clipboard,
  Eraser,
  RotateCcw,
} from 'lucide-react'
import {
  type ChangeEvent,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import styles from './json-converter.module.css'

const SAMPLE_NORMAL = '你好，世界！\n这是一个 JSON 字符串转换示例。'
const SAMPLE_JSON = JSON.stringify(SAMPLE_NORMAL)
const INVALID_JSON_ERROR = '这不是有效的 JSON 字符串，请检查引号和转义符。'
const INVALID_JSON_TYPE_ERROR =
  '请输入 JSON 字符串（例如："你好，世界！"），不能是数字、对象或数组。'
const COPY_ERROR = '复制失败，请检查浏览器权限。'
const COPY_FALLBACK_STATUS = '输出内容已选中，请按 Ctrl/Cmd+C 手动复制。'

interface ConversionResult {
  error: string
  isValid: boolean
  output: string
}

const EMPTY_CONVERSION: ConversionResult = {
  error: '',
  isValid: false,
  output: '',
}

const countCharacters = (value: string): number => Array.from(value).length

export function JsonConverter() {
  const [input, setInput] = useState('')
  const [hasInput, setHasInput] = useState(false)
  const [mode, setMode] = useState<'decode' | 'encode'>('decode')
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState('')
  const [copyStatus, setCopyStatus] = useState('')
  const [outputStatus, setOutputStatus] = useState('')
  const outputRef = useRef<HTMLTextAreaElement>(null)
  const copyResetTimeoutRef = useRef<number | null>(null)
  const converterId = useId()
  const inputErrorId = `${converterId}-input-error`
  const copyErrorId = `${converterId}-copy-error`
  const conversion = useMemo<ConversionResult>(() => {
    if (!hasInput) {
      return EMPTY_CONVERSION
    }

    if (mode === 'encode') {
      return {
        error: '',
        isValid: true,
        output: JSON.stringify(input),
      }
    }

    try {
      const parsed: unknown = JSON.parse(input)
      if (typeof parsed !== 'string') {
        return {
          error: INVALID_JSON_TYPE_ERROR,
          isValid: false,
          output: '',
        }
      }

      return { error: '', isValid: true, output: parsed }
    } catch {
      return { error: INVALID_JSON_ERROR, isValid: false, output: '' }
    }
  }, [hasInput, input, mode])
  const { error, isValid, output } = conversion

  useEffect(() => {
    if (!isValid) {
      setOutputStatus('')
      return
    }

    const statusTimeout = window.setTimeout(() => {
      setOutputStatus(`已生成 ${countCharacters(output)} 个字符的转换结果。`)
    }, 280)
    return () => window.clearTimeout(statusTimeout)
  }, [isValid, output])

  useEffect(
    () => () => {
      if (copyResetTimeoutRef.current !== null) {
        window.clearTimeout(copyResetTimeoutRef.current)
      }
    },
    []
  )

  const handleInput = useCallback((value: string) => {
    setInput(value)
    setHasInput(value.length > 0)
    setCopied(false)
    setCopyError('')
    setCopyStatus('')
  }, [])

  const toggleMode = useCallback(() => {
    const nextInput = isValid ? output : input
    setMode((current) => (current === 'decode' ? 'encode' : 'decode'))
    setInput(nextInput)
    setHasInput(isValid || nextInput.length > 0)
    setCopied(false)
    setCopyError('')
    setCopyStatus('')
  }, [input, isValid, output])

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      handleInput(event.target.value)
    },
    [handleInput]
  )
  const fillSample = useCallback(() => {
    handleInput(mode === 'decode' ? SAMPLE_JSON : SAMPLE_NORMAL)
  }, [handleInput, mode])
  const clearInput = useCallback(() => {
    setInput('')
    setHasInput(false)
    setCopied(false)
    setCopyError('')
    setCopyStatus('')
  }, [])

  const selectOutput = useCallback(() => {
    const outputElement = outputRef.current
    if (!outputElement) {
      return
    }

    outputElement.focus()
    outputElement.select()
  }, [])

  const copyOutput = useCallback(async () => {
    if (!(isValid && output)) {
      return
    }

    setCopied(false)
    setCopyError('')
    setCopyStatus('')
    if (copyResetTimeoutRef.current !== null) {
      window.clearTimeout(copyResetTimeoutRef.current)
      copyResetTimeoutRef.current = null
    }

    if (!navigator.clipboard?.writeText) {
      selectOutput()
      setCopyError(COPY_ERROR)
      setCopyStatus(COPY_FALLBACK_STATUS)
      return
    }

    try {
      await navigator.clipboard.writeText(output)
      setCopied(true)
      setCopyStatus(`已复制 ${countCharacters(output)} 个字符。`)
      copyResetTimeoutRef.current = window.setTimeout(() => {
        setCopied(false)
        copyResetTimeoutRef.current = null
      }, 1600)
    } catch {
      selectOutput()
      setCopyError(COPY_ERROR)
      setCopyStatus(COPY_FALLBACK_STATUS)
    }
  }, [isValid, output, selectOutput])

  return (
    <section className={styles.converter}>
      <div className={styles.workspace}>
        <header className={styles.hero}>
          <h1>JSON 字符串转换</h1>
          <p>让转义符消失，或把普通文本安全地转成 JSON 字符串。</p>
        </header>
        <div className={styles.toolbar}>
          <div className={styles.modeLabel}>
            {mode === 'decode' ? 'JSON → 普通文本' : '普通文本 → JSON'}
          </div>
          <div className={styles.actions}>
            <Button
              className={styles.actionButton}
              onClick={fillSample}
              size="sm"
              variant="ghost"
            >
              <RotateCcw aria-hidden="true" /> 示例
            </Button>
            <Button
              className={styles.actionButton}
              onClick={clearInput}
              size="sm"
              variant="ghost"
            >
              <Eraser aria-hidden="true" /> 清空
            </Button>
          </div>
        </div>
        <div className={styles.editorGrid}>
          <div className={styles.editorPanel}>
            <div className={styles.panelHeader}>
              <span>输入</span>
              <span className={styles.hint}>
                {mode === 'decode' ? '粘贴带转义符的内容' : '输入普通字符串'}
              </span>
            </div>
            <Textarea
              aria-describedby={error ? inputErrorId : undefined}
              aria-invalid={error ? true : undefined}
              aria-label="输入字符串"
              className={styles.textarea}
              onChange={handleChange}
              placeholder={
                mode === 'decode'
                  ? '例如："你好，世界！\\n"'
                  : '例如：你好，世界！'
              }
              value={input}
            />
            {Boolean(error) && (
              <p className={styles.error} id={inputErrorId} role="alert">
                {error}
              </p>
            )}
            <span className={styles.counter}>
              {countCharacters(input)} 个字符
            </span>
          </div>
          <Button
            aria-label="切换转换方向"
            className={styles.swapButton}
            onClick={toggleMode}
            size="icon"
            variant="outline"
          >
            <ArrowLeftRight aria-hidden="true" />
          </Button>
          <div className={`${styles.editorPanel} ${styles.outputPanel}`}>
            <div className={styles.panelHeader}>
              <span>输出</span>
              <Button
                aria-describedby={copyError ? copyErrorId : undefined}
                aria-label="复制输出结果"
                className={styles.actionButton}
                disabled={!(isValid && output)}
                onClick={copyOutput}
                size="sm"
                variant="ghost"
              >
                {copied ? (
                  <Check aria-hidden="true" />
                ) : (
                  <Clipboard aria-hidden="true" />
                )}{' '}
                {copied ? '已复制' : '复制'}
              </Button>
            </div>
            <Textarea
              aria-label="输出字符串"
              className={styles.textarea}
              placeholder={isValid ? '（空字符串）' : '转换结果会显示在这里'}
              readOnly
              ref={outputRef}
              value={output}
            />
            {Boolean(copyError) && (
              <p className={styles.error} id={copyErrorId} role="alert">
                {copyError}
              </p>
            )}
            <span className={styles.counter}>
              {countCharacters(output)} 个字符
            </span>
          </div>
        </div>
        <footer className={styles.footer}>
          <span>所有处理均在浏览器本地完成</span>
          <span>不会上传你的内容</span>
        </footer>
        <span aria-atomic="true" aria-live="polite" className="sr-only">
          {outputStatus}
        </span>
        <span
          aria-atomic="true"
          aria-live="polite"
          className="sr-only"
          role="status"
        >
          {copyStatus}
        </span>
      </div>
    </section>
  )
}
