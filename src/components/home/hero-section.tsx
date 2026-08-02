import type { ReactNode } from 'react'
import { HeroBackground } from './hero-background'
import styles from '@/app/home.module.css'

interface HeroSectionProps {
  readonly children: ReactNode
}

export function HeroSection({ children }: HeroSectionProps) {
  return (
    <section aria-labelledby="hero-title" className={styles.hero}>
      <HeroBackground />
      <div className={styles.heroContent}>{children}</div>
    </section>
  )
}
