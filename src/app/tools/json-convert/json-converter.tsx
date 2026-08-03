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
  useMemo,
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
const COPY_ERROR = '复制失败，请检查浏览器权限，或手动选择输出内容复制。'

export function JsonConverter() {
  const [input, setInput] = useState('')
  const [mode, setMode] = useState<'decode' | 'encode'>('decode')
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const [copyError, setCopyError] = useState('')
  const [outputStatus, setOutputStatus] = useState('')
  const output = useMemo(() => {
    if (!input) {
      return ''
    }
    try {
      if (mode === 'encode') {
        return JSON.stringify(input)
      }
      const parsed: unknown = JSON.parse(input)
      return typeof parsed === 'string' ? parsed : ''
    } catch {
      return ''
    }
  }, [input, mode])
  useEffect(() => {
    if (!output) {
      setOutputStatus('')
      return
    }
    const statusTimeout = window.setTimeout(() => {
      setOutputStatus(`已生成 ${output.length} 个字符的转换结果。`)
    }, 280)
    return () => window.clearTimeout(statusTimeout)
  }, [output])
  const handleInput = useCallback(
    (value: string) => {
      setInput(value)
      setCopied(false)
      setCopyError('')
      if (mode === 'decode' && value) {
        try {
          const parsed: unknown = JSON.parse(value)
          setError(typeof parsed === 'string' ? '' : INVALID_JSON_TYPE_ERROR)
        } catch {
          setError(INVALID_JSON_ERROR)
        }
      } else {
        setError('')
      }
    },
    [mode]
  )
  const toggleMode = useCallback(() => {
    setMode((current) => (current === 'decode' ? 'encode' : 'decode'))
    setInput(output || input)
    setCopied(false)
    setError('')
    setCopyError('')
  }, [input, output])
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
    setCopied(false)
    setError('')
    setCopyError('')
  }, [])
  const copyOutput = useCallback(async () => {
    if (!output) {
      return
    }
    setCopied(false)
    setCopyError('')
    try {
      await navigator.clipboard.writeText(output)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopyError(COPY_ERROR)
    }
  }, [output])

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
              <p className={styles.error} role="alert">
                {error}
              </p>
            )}
            <span className={styles.counter}>{input.length} 个字符</span>
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
                aria-label="复制输出结果"
                className={styles.actionButton}
                disabled={!output}
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
              placeholder="转换结果会显示在这里"
              readOnly
              value={output}
            />
            {Boolean(copyError) && (
              <p className={styles.error} role="alert">
                {copyError}
              </p>
            )}
            <span className={styles.counter}>{output.length} 个字符</span>
          </div>
        </div>
        <footer className={styles.footer}>
          <span>所有处理均在浏览器本地完成</span>
          <span>不会上传你的内容</span>
        </footer>
        <span aria-live="polite" className="sr-only">
          {outputStatus}
        </span>
      </div>
    </section>
  )
}
