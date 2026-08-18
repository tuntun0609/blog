'use client'

import { useEffect, useRef } from 'react'
import type { CornerEditor } from 'scanic'
import { createCalibrationEditor } from './document-calibration-engine'
import type {
  CalibrationCorners,
  CalibrationSource,
} from './document-calibration-model'
import styles from './document-calibration-tool.module.css'

export interface CornerEditorControls {
  reset: () => void
  setCorners: (corners: CalibrationCorners) => boolean
}

interface DocumentCornerEditorProps {
  initialCorners: CalibrationCorners
  onChange: (corners: CalibrationCorners) => void
  onControlsChange: (controls: CornerEditorControls | null) => void
  onError: (message: string) => void
  onImageReady: (image: HTMLImageElement | null) => void
  source: CalibrationSource
}

const CORNER_LABELS: Record<keyof CalibrationCorners, string> = {
  bottomLeft: '左下角点位',
  bottomRight: '右下角点位',
  topLeft: '左上角点位',
  topRight: '右上角点位',
}

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message) {
    return error.message
  }
  return '无法启动四点编辑器，请更换图片后重试。'
}

const loadSourceImage = (
  source: CalibrationSource,
  signal: AbortSignal
): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new window.Image()

    const releaseListeners = (): void => {
      image.onload = null
      image.onerror = null
      signal.removeEventListener('abort', handleAbort)
    }
    const handleAbort = (): void => {
      releaseListeners()
      image.src = ''
      reject(new DOMException('图片读取已取消。', 'AbortError'))
    }

    image.decoding = 'async'
    image.onload = () => {
      releaseListeners()
      image.width = source.dimensions.width
      image.height = source.dimensions.height
      resolve(image)
    }
    image.onerror = () => {
      releaseListeners()
      reject(new Error('无法读取左侧编辑器所需的图片。'))
    }
    signal.addEventListener('abort', handleAbort, { once: true })
    image.src = source.url
  })

const localizeCornerHandles = (container: HTMLElement): void => {
  const handles = container.querySelectorAll<HTMLButtonElement>('[data-corner]')
  for (const handle of handles) {
    const corner = handle.dataset.corner as keyof CalibrationCorners | undefined
    if (corner && CORNER_LABELS[corner]) {
      handle.setAttribute('aria-label', CORNER_LABELS[corner])
      handle.title = `${CORNER_LABELS[corner]}：方向键微调，按住 Shift 可加速`
    }
  }
}

export function DocumentCornerEditor({
  initialCorners,
  onChange,
  onControlsChange,
  onError,
  onImageReady,
  source,
}: DocumentCornerEditorProps) {
  const containerRef = useRef<HTMLElement>(null)
  const initialCornersRef = useRef(initialCorners)

  useEffect(() => {
    initialCornersRef.current = initialCorners
  }, [initialCorners, source.url])

  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    const abortController = new AbortController()
    let cancelled = false
    let editor: CornerEditor | null = null
    let themeObserver: MutationObserver | null = null

    const mountEditor = async (): Promise<void> => {
      try {
        const image = await loadSourceImage(source, abortController.signal)
        if (cancelled) {
          return
        }
        const nextEditor = await createCalibrationEditor({
          classNames: {
            handle: styles.cornerHandle,
            root: styles.cornerEditorRoot,
          },
          container,
          corners: initialCornersRef.current,
          handleHitArea: 48,
          image,
          keyboard: true,
          magnifier: {
            borderColor: '#ffffff',
            crosshairColor: '#ffffff',
            enabled: true,
            size: 112,
            zoom: 3,
          },
          nudges: { enabled: false },
          onChange,
          toolbar: { enabled: false },
        })
        if (cancelled) {
          nextEditor.destroy()
          return
        }

        editor = nextEditor
        localizeCornerHandles(container)
        onImageReady(image)
        onControlsChange({
          reset: () => nextEditor.reset(),
          setCorners: (corners) => nextEditor.setCorners(corners),
        })
        themeObserver = new MutationObserver(() => nextEditor.refreshTheme())
        themeObserver.observe(document.documentElement, {
          attributeFilter: ['class'],
          attributes: true,
        })
      } catch (error) {
        if (!(cancelled || abortController.signal.aborted)) {
          onError(getErrorMessage(error))
        }
      }
    }

    mountEditor().catch((error: unknown) => {
      if (!(cancelled || abortController.signal.aborted)) {
        onError(getErrorMessage(error))
      }
    })
    return () => {
      cancelled = true
      abortController.abort()
      themeObserver?.disconnect()
      editor?.destroy()
      onControlsChange(null)
      onImageReady(null)
    }
  }, [onChange, onControlsChange, onError, onImageReady, source.url])

  return (
    <section
      aria-label={`文档角点编辑区：${source.fileName}`}
      className={styles.cornerEditor}
      ref={containerRef}
    />
  )
}
