'use client'

import { DiaTextReveal } from '@/components/ui/dia-text-reveal'
import { markHeroTitleRevealed } from './hero-animation-sequence'

interface HeroTitleRevealProps {
  readonly text: string
}

export function HeroTitleReveal({ text }: HeroTitleRevealProps) {
  return <DiaTextReveal onRevealComplete={markHeroTitleRevealed} text={text} />
}
