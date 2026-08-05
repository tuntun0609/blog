'use client'

import { useEffect } from 'react'

interface HomeMotionProps {
  rootId: string
}

export function HomeMotion({ rootId }: HomeMotionProps) {
  useEffect(() => {
    const root = document.getElementById(rootId)

    if (!root) {
      return
    }

    const motionPreference = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    )
    const revealElements = Array.from(
      root.querySelectorAll<HTMLElement>('[data-reveal]')
    )

    for (const element of revealElements) {
      const rect = element.getBoundingClientRect()
      if (rect.top < window.innerHeight * 0.94) {
        element.dataset.visible = 'true'
      }
    }

    const updateMotionPreference = (): void => {
      root.dataset.motion = motionPreference.matches ? 'reduced' : 'ready'
    }

    updateMotionPreference()
    const supportsMediaQueryEventListener =
      typeof motionPreference.addEventListener === 'function'

    if (supportsMediaQueryEventListener) {
      motionPreference.addEventListener('change', updateMotionPreference)
    } else {
      motionPreference.addListener(updateMotionPreference)
    }

    if (typeof IntersectionObserver !== 'function') {
      for (const element of revealElements) {
        element.dataset.visible = 'true'
      }

      return () => {
        if (supportsMediaQueryEventListener) {
          motionPreference.removeEventListener('change', updateMotionPreference)
        } else {
          motionPreference.removeListener(updateMotionPreference)
        }
        delete root.dataset.motion
      }
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            ;(entry.target as HTMLElement).dataset.visible = 'true'
            observer.unobserve(entry.target)
          }
        }
      },
      { rootMargin: '0px 0px -10%', threshold: 0.12 }
    )

    for (const element of revealElements) {
      if (element.dataset.visible !== 'true') {
        observer.observe(element)
      }
    }

    return () => {
      observer.disconnect()
      if (supportsMediaQueryEventListener) {
        motionPreference.removeEventListener('change', updateMotionPreference)
      } else {
        motionPreference.removeListener(updateMotionPreference)
      }
      delete root.dataset.motion
    }
  }, [rootId])

  return null
}
