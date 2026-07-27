'use client'

import { DiaTextReveal } from '@/components/ui/dia-text-reveal'
import { markHeroTitleRevealed } from './hero-animation-sequence'

export function HeroTitleReveal() {
  return (
    <DiaTextReveal
      onRevealComplete={markHeroTitleRevealed}
      text="FullStack Developer"
    />
  )
}
