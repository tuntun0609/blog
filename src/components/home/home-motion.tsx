'use client'

import { useEffect } from 'react'

type HomeMotionProps = {
  rootId: string
}

export function HomeMotion({ rootId }: HomeMotionProps) {
  useEffect(() => {
    const root = document.getElementById(rootId)

    if (!root) {
      return
    }

    const reduceMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches
    const revealElements = Array.from(
      root.querySelectorAll<HTMLElement>('[data-reveal]')
    )
    const parallaxElements = Array.from(
      root.querySelectorAll<HTMLElement>('[data-parallax]')
    )

    for (const element of revealElements) {
      const rect = element.getBoundingClientRect()
      if (rect.top < window.innerHeight * 0.94) {
        element.dataset.visible = 'true'
      }
    }

    root.dataset.motion = reduceMotion ? 'reduced' : 'ready'

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

    let frame = 0

    const updateMotion = () => {
      frame = 0
      const scrollRange =
        document.documentElement.scrollHeight - window.innerHeight
      const progress = scrollRange > 0 ? window.scrollY / scrollRange : 0
      root.style.setProperty('--scroll-progress', String(progress))

      if (reduceMotion) {
        return
      }

      for (const element of parallaxElements) {
        const rect = element.getBoundingClientRect()

        if (rect.bottom < -100 || rect.top > window.innerHeight + 100) {
          continue
        }

        const speed = Number(element.dataset.parallaxSpeed ?? 0.04)
        const distanceFromCenter =
          rect.top + rect.height / 2 - window.innerHeight / 2
        const offset = Math.max(-48, Math.min(48, -distanceFromCenter * speed))
        element.style.setProperty('--parallax-y', `${offset.toFixed(2)}px`)
      }
    }

    const queueUpdate = () => {
      if (frame === 0) {
        frame = window.requestAnimationFrame(updateMotion)
      }
    }

    updateMotion()
    window.addEventListener('scroll', queueUpdate, { passive: true })
    window.addEventListener('resize', queueUpdate)

    return () => {
      observer.disconnect()
      window.removeEventListener('scroll', queueUpdate)
      window.removeEventListener('resize', queueUpdate)
      if (frame !== 0) {
        window.cancelAnimationFrame(frame)
      }
      delete root.dataset.motion
    }
  }, [rootId])

  return <div aria-hidden="true" data-home-scroll-progress />
}
