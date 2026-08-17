import type { Metadata } from 'next'
import { SiteHeader } from '@/components/site-header'
import { ColorPaletteTool } from './color-palette-tool'
import styles from './color-palette-page.module.css'

export const metadata: Metadata = {
  description:
    '无需上传，在浏览器本地从图片中提取 3 至 10 个主题色，并复制 HEX 色值或整组 CSS 变量。',
  title: '图片主题色提取',
}

export default function ColorPalettePage() {
  return (
    <>
      <a className={styles.skipLink} href="#main-content">
        跳至主要内容
      </a>
      <SiteHeader activeSection="tools" />
      <main id="main-content" tabIndex={-1}>
        <ColorPaletteTool />
      </main>
    </>
  )
}
