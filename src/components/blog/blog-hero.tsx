import styles from './blog.module.css'

interface BlogHeroProps {
  compact: boolean
}

export function BlogHero({ compact }: BlogHeroProps) {
  return (
    <header className={compact ? styles.listIntroCompact : styles.listIntro}>
      <div className={styles.listIdentity}>
        <h1 className={styles.listTitle}>Tuntun</h1>
        <p className={styles.listRole}>Full-stack Developer</p>
        <p className={styles.listLead}>
          分享前端、后端、AI 与工程实践中真实遇到的问题。
        </p>
      </div>
    </header>
  )
}
