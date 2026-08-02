import { AvatarStickerClient } from './avatar-sticker-client'
import styles from '@/app/home.module.css'

export function HeroBackground() {
  return (
    <div className={styles.heroBackground}>
      <div aria-hidden="true" className={styles.heroBackgroundOrb} />
      <div className={styles.heroAvatar}>
        <AvatarStickerClient />
      </div>
    </div>
  )
}
