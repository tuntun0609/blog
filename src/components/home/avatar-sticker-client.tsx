'use client'

import { useEffect, useState } from 'react'
import { AvatarSticker } from './avatar-sticker'
import { subscribeToHeroTitleReveal } from './hero-animation-sequence'

export function AvatarStickerClient() {
  const [isRuntimeEnabled, setIsRuntimeEnabled] = useState(false)

  useEffect(
    () =>
      subscribeToHeroTitleReveal(() => {
        setIsRuntimeEnabled(true)
      }),
    []
  )

  return <AvatarSticker isRuntimeEnabled={isRuntimeEnabled} />
}
