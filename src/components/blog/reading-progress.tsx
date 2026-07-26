'use client'

import { useEffect, useRef } from 'react'
import styles from './blog.module.css'

export function ReadingProgress() {
  const progressBarRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const progressBar = progressBarRef.current

    if (!progressBar) {
      return
    }

    let frame = 0

    const updateProgress = () => {
      frame = 0

      const scrollRange =
        document.documentElement.scrollHeight - window.innerHeight
      const progress = scrollRange > 0 ? window.scrollY / scrollRange : 0

      progressBar.style.setProperty('--reading-progress', String(progress))
    }

    const queueUpdate = () => {
      if (frame === 0) {
        frame = window.requestAnimationFrame(updateProgress)
      }
    }

    updateProgress()
    window.addEventListener('scroll', queueUpdate, { passive: true })
    window.addEventListener('resize', queueUpdate)

    return () => {
      window.removeEventListener('scroll', queueUpdate)
      window.removeEventListener('resize', queueUpdate)

      if (frame !== 0) {
        window.cancelAnimationFrame(frame)
      }
    }
  }, [])

  return (
    <div
      aria-hidden="true"
      className={styles.readingProgress}
      ref={progressBarRef}
    />
  )
}
