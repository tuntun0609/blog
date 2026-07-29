import Image from 'next/image'
import type { ProjectDefinition } from './projects-config'
import styles from './projects-showcase.module.css'

const ImagePreview = ({ project }: { project: ProjectDefinition }) => {
  if (project.preview.kind !== 'image') {
    return null
  }

  return (
    <Image
      alt={`${project.title} 项目预览`}
      className={styles.previewImage}
      fill
      sizes="(max-width: 639px) calc(100vw - 4rem), 32rem"
      src={project.preview.src}
      style={{ objectPosition: project.preview.position }}
    />
  )
}

const CodePreview = () => (
  <div aria-hidden="true" className={styles.codePreview}>
    <div className={styles.codeTopline}>
      <span>app.config.ts</span>
      <span className={styles.codeAccent}>● ● ●</span>
    </div>
    <pre>
      <code>
        <span className={styles.codeAccent}>export default</span> createSaaS(
        {'{'}
        {'\n  '}auth: betterAuth(),
        {'\n  '}database: drizzle(),
        {'\n  '}docs: fumadocs(),
        {'\n  '}i18n: nextIntl(),
        {'\n'}
        {'}'})
      </code>
    </pre>
  </div>
)

const BilibiliPreview = ({ project }: { project: ProjectDefinition }) => {
  if (project.preview.kind !== 'bilibili') {
    return null
  }

  return (
    <div aria-hidden="true" className={styles.bilibiliPreview}>
      <Image
        alt=""
        className={styles.bilibiliIcon}
        height={164}
        src={project.preview.src}
        width={164}
      />
      <div className={styles.bilibiliType}>
        <span className={styles.bilibiliLabel}>BROWSER EXTENSION</span>
        <strong>BILI / TOOL</strong>
      </div>
    </div>
  )
}

export const ProjectPreview = ({ project }: { project: ProjectDefinition }) => {
  if (project.preview.kind === 'image') {
    return <ImagePreview project={project} />
  }

  if (project.preview.kind === 'bilibili') {
    return <BilibiliPreview project={project} />
  }

  return <CodePreview />
}
