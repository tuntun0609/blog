'use client'

import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from 'motion/react'
import dynamic from 'next/dynamic'
import { useTheme } from 'next-themes'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { useCallback, useEffect, useState } from 'react'
import styles from './tools.module.css'

const MeshGradient = dynamic(
  () =>
    import('@paper-design/shaders-react').then((module) => module.MeshGradient),
  { ssr: false }
)

const DARK_COLORS = ['#09090B', '#25124F', '#6D28D9', '#1D4ED8']
const LIGHT_COLORS = ['#F8F7FF', '#D9D0FF', '#8B5CF6', '#60A5FA']
const MAX_PARALLAX_RATIO = 0.0125
const MAX_PIXEL_COUNT = 2_073_600
const PARALLAX_SPRING = {
  damping: 24,
  mass: 0.8,
  stiffness: 90,
} as const

interface NavigatorConnection {
  saveData?: boolean
}

interface NavigatorWithConnection extends Navigator {
  connection?: NavigatorConnection
}

export function ToolsHeroField() {
  const { resolvedTheme } = useTheme()
  const shouldReduceMotion = useReducedMotion()
  const [canAnimateField, setCanAnimateField] = useState(false)
  const [isPageVisible, setIsPageVisible] = useState(false)
  const [isParallaxActive, setIsParallaxActive] = useState(false)
  const [supportsWebGl, setSupportsWebGl] = useState(false)
  const pointerX = useMotionValue(0)
  const pointerY = useMotionValue(0)
  const smoothX = useSpring(pointerX, PARALLAX_SPRING)
  const smoothY = useSpring(pointerY, PARALLAX_SPRING)

  useEffect(() => {
    const pointerQuery = window.matchMedia('(hover: hover) and (pointer: fine)')
    const { connection } = navigator as NavigatorWithConnection
    const updateFieldCapability = (): void => {
      const shouldSaveData = connection?.saveData ?? false
      setCanAnimateField(pointerQuery.matches && !shouldSaveData)
    }
    const updatePageVisibility = (): void => {
      setIsPageVisible(document.visibilityState === 'visible')
    }

    updateFieldCapability()
    updatePageVisibility()
    pointerQuery.addEventListener('change', updateFieldCapability)
    document.addEventListener('visibilitychange', updatePageVisibility)

    const canvas = document.createElement('canvas')
    setSupportsWebGl(Boolean(canvas.getContext('webgl2')))

    return () => {
      pointerQuery.removeEventListener('change', updateFieldCapability)
      document.removeEventListener('visibilitychange', updatePageVisibility)
    }
  }, [])

  const activateParallax = useCallback((): void => {
    if (canAnimateField && !shouldReduceMotion) {
      setIsParallaxActive(true)
    }
  }, [canAnimateField, shouldReduceMotion])

  const resetParallax = useCallback((): void => {
    setIsParallaxActive(false)
    pointerX.set(0)
    pointerY.set(0)
  }, [pointerX, pointerY])

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>): void => {
      if (!canAnimateField || shouldReduceMotion) {
        return
      }

      const bounds = event.currentTarget.getBoundingClientRect()
      const normalizedX = (event.clientX - bounds.left) / bounds.width - 0.5
      const normalizedY = (event.clientY - bounds.top) / bounds.height - 0.5

      pointerX.set(normalizedX * 2 * bounds.width * MAX_PARALLAX_RATIO)
      pointerY.set(normalizedY * 2 * bounds.height * MAX_PARALLAX_RATIO)
    },
    [canAnimateField, pointerX, pointerY, shouldReduceMotion]
  )

  const colors = resolvedTheme === 'dark' ? DARK_COLORS : LIGHT_COLORS
  const canRenderShader =
    canAnimateField &&
    isPageVisible &&
    supportsWebGl &&
    Boolean(resolvedTheme) &&
    !shouldReduceMotion

  return (
    <div
      aria-hidden="true"
      className={styles.heroFieldLayer}
      onPointerEnter={activateParallax}
      onPointerLeave={resetParallax}
      onPointerMove={handlePointerMove}
    >
      {canRenderShader ? (
        <motion.div
          className={styles.heroFieldMotion}
          data-parallax-active={isParallaxActive ? 'true' : 'false'}
          style={{ x: smoothX, y: smoothY }}
        >
          <MeshGradient
            className={styles.heroField}
            colors={colors}
            distortion={0.9}
            fit="cover"
            grainMixer={0.06}
            grainOverlay={0.04}
            maxPixelCount={MAX_PIXEL_COUNT}
            minPixelRatio={1}
            speed={0.18}
            swirl={0.55}
          />
        </motion.div>
      ) : null}
    </div>
  )
}
