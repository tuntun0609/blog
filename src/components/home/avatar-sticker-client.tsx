'use client'

import dynamic from 'next/dynamic'
import styles from './avatar-sticker.module.css'

const ClientAvatarSticker = dynamic(
  () => import('./avatar-sticker').then(({ AvatarSticker }) => AvatarSticker),
  {
    loading: () => <div aria-hidden="true" className={styles.avatarSticker} />,
    ssr: false,
  }
)

export function AvatarStickerClient() {
  return <ClientAvatarSticker />
}
