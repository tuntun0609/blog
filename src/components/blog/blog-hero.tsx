'use client'

import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from 'motion/react'
import { Shantell_Sans } from 'next/font/google'
import type { PointerEvent } from 'react'
import { useCallback } from 'react'
import styles from './blog.module.css'

interface BlogHeroProps {
  compact: boolean
}

const SPRING_OPTIONS = {
  damping: 26,
  mass: 0.7,
  stiffness: 140,
} as const

const REVEAL_EASE = [0.23, 1, 0.32, 1] as const

const shantellSans = Shantell_Sans({
  preload: false,
  subsets: ['latin'],
  variable: '--font-shantell-sans',
  weight: '500',
})

export function BlogHero({ compact }: BlogHeroProps) {
  const shouldReduceMotion = useReducedMotion()
  const pointerX = useMotionValue(0)
  const pointerY = useMotionValue(0)
  const smoothPointerX = useSpring(pointerX, SPRING_OPTIONS)
  const smoothPointerY = useSpring(pointerY, SPRING_OPTIONS)
  const backX = useTransform(smoothPointerX, [-0.5, 0.5], [-8, 8])
  const backY = useTransform(smoothPointerY, [-0.5, 0.5], [-5, 5])
  const frontX = useTransform(smoothPointerX, [-0.5, 0.5], [11, -11])
  const frontY = useTransform(smoothPointerY, [-0.5, 0.5], [7, -7])

  const handlePointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (shouldReduceMotion || event.pointerType === 'touch') {
        return
      }

      const bounds = event.currentTarget.getBoundingClientRect()
      pointerX.set((event.clientX - bounds.left) / bounds.width - 0.5)
      pointerY.set((event.clientY - bounds.top) / bounds.height - 0.5)
    },
    [pointerX, pointerY, shouldReduceMotion]
  )

  const handlePointerLeave = useCallback(() => {
    pointerX.set(0)
    pointerY.set(0)
  }, [pointerX, pointerY])

  const identityInitial = shouldReduceMotion ? false : { opacity: 0, y: 18 }
  const artworkInitial = shouldReduceMotion
    ? false
    : { opacity: 0, scale: 0.975, y: 24 }

  return (
    <header className={compact ? styles.listIntroCompact : styles.listIntro}>
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className={styles.listIdentity}
        initial={identityInitial}
        transition={{ duration: 0.7, ease: REVEAL_EASE }}
      >
        <h1 className={styles.listTitle}>Tuntun</h1>
        <p className={styles.listRole}>Full-stack Developer</p>
        <p className={styles.listLead}>
          分享前端、后端、AI 与工程实践中真实遇到的问题。
        </p>
      </motion.div>

      <motion.div
        animate={{ opacity: 1, scale: 1, y: 0 }}
        aria-hidden="true"
        className={styles.heroArtwork}
        initial={artworkInitial}
        onPointerLeave={handlePointerLeave}
        onPointerMove={handlePointerMove}
        transition={{ delay: 0.08, duration: 0.9, ease: REVEAL_EASE }}
      >
        <motion.span
          className={styles.heroTypeOutline}
          style={{ x: backX, y: backY }}
        >
          TUNTUN
        </motion.span>

        <motion.span
          className={styles.heroTypeStack}
          style={{ x: frontX, y: frontY }}
        >
          <span className={styles.heroTypeLine}>TUN</span>
          <span className={styles.heroTypeLineOutline}>
            <span className={styles.heroTypeAccent}>T</span>UN
          </span>
        </motion.span>

        <motion.span
          className={`${styles.heroSignature} ${shantellSans.variable}`}
          style={{ x: backX, y: frontY }}
        >
          tuntun
        </motion.span>
      </motion.div>
    </header>
  )
}
