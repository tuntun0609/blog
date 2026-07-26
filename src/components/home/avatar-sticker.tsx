'use client'

import Image from 'next/image'
import Script from 'next/script'
import { useCallback, useEffect, useRef, useState } from 'react'
import styles from './avatar-sticker.module.css'

const AVATAR_SOURCE_SIZE = 460
const AVATAR_CORNER_RADIUS = 44
const DISPLAY_SIZE_RATIO = 0.84
const STICKER_RUNTIME_SRC = '/vendor/sticker-forge/sticker-forge.iife.js'

type LoadStatus = 'error' | 'loading' | 'ready'

interface StickerPoint {
  readonly x: number
  readonly y: number
}

interface StickerInstance {
  destroy: () => void
  reset: () => void
  resize: () => void
  setOptions: (options: StickerOptions) => void
}

interface StickerOptions {
  back?: {
    color?: string
    gloss?: number
    roughness?: number
  }
  display?: {
    height?: number
    width?: number
  }
  edge?: {
    strength?: number
    width?: number
  }
  lighting?: {
    ambient?: number
    direction?: StickerPoint & { z: number }
    intensity?: number
    softness?: number
  }
  material?: {
    intensity?: number
    scale?: number
    type?: 'glitter' | 'holographic' | 'original' | 'reflective'
  }
  outline?: {
    color?: string
    width?: number
  }
  peel?: {
    detachThreshold?: number
    grabWidth?: number
    maxAngle?: number
    radius?: number
    release?: 'reset' | 'snap' | 'stay'
    residue?: boolean
    stiffness?: number
    surfaceShadow?: boolean
  }
  quality?: 'high' | 'low' | 'medium'
  shadow?: {
    angle?: number
    blur?: number
    color?: string
    distance?: number
    opacity?: number
  }
  sound?: {
    enabled?: boolean
    volume?: number
  }
  source?: {
    name?: string
    src: string
    type: 'image'
  }
  tilt?: number
  wind?: number
}

interface StickerForgeApi {
  createSticker: (
    target: HTMLElement,
    options?: StickerOptions
  ) => Promise<StickerInstance>
}

declare global {
  interface Window {
    StickerForge?: StickerForgeApi
  }
}

let roundedAvatarSourcePromise: Promise<string> | null = null

const createRoundedAvatarSource = async (): Promise<string> => {
  const avatarImage = new window.Image()
  avatarImage.decoding = 'async'
  avatarImage.src = '/avatar-tuntun.jpg'
  await avatarImage.decode()

  const canvas = document.createElement('canvas')
  canvas.width = AVATAR_SOURCE_SIZE
  canvas.height = AVATAR_SOURCE_SIZE
  const context = canvas.getContext('2d')

  if (!context) {
    throw new Error('无法创建头像贴纸画布。')
  }

  context.beginPath()
  context.roundRect(
    0,
    0,
    AVATAR_SOURCE_SIZE,
    AVATAR_SOURCE_SIZE,
    AVATAR_CORNER_RADIUS
  )
  context.clip()
  context.drawImage(avatarImage, 0, 0, AVATAR_SOURCE_SIZE, AVATAR_SOURCE_SIZE)

  return canvas.toDataURL('image/png')
}

const getRoundedAvatarSource = (): Promise<string> => {
  roundedAvatarSourcePromise ??= createRoundedAvatarSource()
  return roundedAvatarSourcePromise
}

const getDisplaySize = (element: HTMLElement): number =>
  Math.max(1, element.getBoundingClientRect().width * DISPLAY_SIZE_RATIO)

export function AvatarSticker() {
  const [isRuntimeReady, setIsRuntimeReady] = useState(false)
  const [status, setStatus] = useState<LoadStatus>('loading')
  const frameRef = useRef<HTMLDivElement | null>(null)
  const hostRef = useRef<HTMLDivElement | null>(null)

  const handleRuntimeReady = useCallback((): void => {
    setIsRuntimeReady(true)
  }, [])

  const handleRuntimeError = useCallback((): void => {
    setStatus('error')
  }, [])

  useEffect(() => {
    const frame = frameRef.current
    const host = hostRef.current
    const stickerForge = window.StickerForge
    if (!(isRuntimeReady && frame && host && stickerForge)) {
      return
    }

    let isCancelled = false
    let didStartPeel = false
    let hintCancellationFrame = 0
    let stickerInstance: StickerInstance | null = null
    let resizeObserver: ResizeObserver | null = null

    const handlePeelChange = (event: Event): void => {
      const { progress } = (event as CustomEvent<{ progress: number }>).detail
      host.dataset.peelProgress = progress.toFixed(3)
    }
    const handlePeelStart = (): void => {
      didStartPeel = true
      host.dataset.focusOrigin = 'pointer'
      host.dataset.peeling = 'true'
    }
    const handlePeelEnd = (): void => {
      host.dataset.peeling = 'false'
    }
    const handleDetachComplete = (): void => {
      host.dataset.detached = 'true'
    }
    const handleCycleComplete = (): void => {
      host.dataset.detached = 'false'
      host.dataset.peelProgress = '0.000'
      host.dataset.peeling = 'false'
    }
    const handleKeyboardInput = (): void => {
      delete host.dataset.focusOrigin
    }
    const handleFocusLeave = (): void => {
      delete host.dataset.focusOrigin
    }
    const handlePointerDown = (): void => {
      didStartPeel = false
      cancelAnimationFrame(hintCancellationFrame)
      hintCancellationFrame = requestAnimationFrame(() => {
        hintCancellationFrame = 0
        if (!didStartPeel) {
          stickerInstance?.reset()
        }
      })
    }
    const handleRendererError = (): void => {
      if (!isCancelled) {
        setStatus('error')
      }
    }

    host.addEventListener('cyclecomplete', handleCycleComplete)
    host.addEventListener('detachcomplete', handleDetachComplete)
    host.addEventListener('error', handleRendererError)
    host.addEventListener('peelchange', handlePeelChange)
    host.addEventListener('peelend', handlePeelEnd)
    host.addEventListener('peelstart', handlePeelStart)
    host.addEventListener('blur', handleFocusLeave, true)
    host.addEventListener('keydown', handleKeyboardInput, true)
    host.addEventListener('pointerdown', handlePointerDown, true)

    const mountSticker = async (): Promise<void> => {
      try {
        const avatarSource = await getRoundedAvatarSource()
        if (isCancelled) {
          return
        }

        const displaySize = getDisplaySize(frame)
        const instance = await stickerForge.createSticker(host, {
          back: { color: '#f7f5f2', gloss: 0.7, roughness: 0.3 },
          display: { height: displaySize, width: displaySize },
          edge: { strength: 0.7, width: 2.4 },
          lighting: {
            ambient: 0.35,
            direction: { x: -0.38, y: 0.52, z: 0.76 },
            intensity: 0.8,
            softness: 0.6,
          },
          material: { intensity: 0.86, scale: 1, type: 'original' },
          outline: { color: '#ffffff', width: 18 },
          peel: {
            detachThreshold: 0.74,
            grabWidth: 22,
            maxAngle: 3.55,
            radius: 0.12,
            release: 'snap',
            residue: true,
            stiffness: 0.72,
            surfaceShadow: true,
          },
          quality: 'high',
          shadow: {
            angle: 42,
            blur: 16,
            color: '#191823',
            distance: 9,
            opacity: 0.18,
          },
          sound: { enabled: true, volume: 0.35 },
          source: {
            name: 'Tuntun avatar',
            src: avatarSource,
            type: 'image',
          },
          tilt: -1.5,
          wind: 0.16,
        })

        if (isCancelled) {
          instance.destroy()
          return
        }

        stickerInstance = instance
        const stickerCanvas = host.querySelector('canvas')
        stickerCanvas?.setAttribute(
          'aria-label',
          '可从任意边缘拖动撕起的头像贴纸'
        )
        stickerCanvas?.setAttribute('title', '从头像贴纸的任意边缘向内拖动')
        host.dataset.detached = 'false'
        host.dataset.peelProgress = '0.000'
        host.dataset.peeling = 'false'
        setStatus('ready')

        resizeObserver = new ResizeObserver(() => {
          const nextDisplaySize = getDisplaySize(frame)
          instance.setOptions({
            display: { height: nextDisplaySize, width: nextDisplaySize },
          })
          instance.resize()
        })
        resizeObserver.observe(frame)
      } catch {
        if (!isCancelled) {
          setStatus('error')
        }
      }
    }

    mountSticker().catch(handleRendererError)

    return () => {
      isCancelled = true
      cancelAnimationFrame(hintCancellationFrame)
      resizeObserver?.disconnect()
      host.removeEventListener('cyclecomplete', handleCycleComplete)
      host.removeEventListener('detachcomplete', handleDetachComplete)
      host.removeEventListener('error', handleRendererError)
      host.removeEventListener('peelchange', handlePeelChange)
      host.removeEventListener('peelend', handlePeelEnd)
      host.removeEventListener('peelstart', handlePeelStart)
      host.removeEventListener('blur', handleFocusLeave, true)
      host.removeEventListener('keydown', handleKeyboardInput, true)
      host.removeEventListener('pointerdown', handlePointerDown, true)
      stickerInstance?.destroy()
    }
  }, [isRuntimeReady])

  return (
    <div
      aria-busy={status === 'loading'}
      className={styles.avatarSticker}
      data-status={status}
      ref={frameRef}
    >
      <div aria-hidden={status === 'ready'} className={styles.fallback}>
        <Image
          alt="Tuntun 的 GitHub 头像"
          className={styles.fallbackImage}
          draggable={false}
          fetchPriority="high"
          height={460}
          loading="eager"
          priority
          sizes="(max-width: 720px) 148px, 188px"
          src="/avatar-tuntun.jpg"
          width={460}
        />
      </div>
      <div className={styles.engineHost} ref={hostRef} />
      <Script
        id="sticker-forge-runtime"
        onError={handleRuntimeError}
        onReady={handleRuntimeReady}
        src={STICKER_RUNTIME_SRC}
        strategy="afterInteractive"
      />
    </div>
  )
}
