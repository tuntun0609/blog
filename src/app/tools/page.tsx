import type { Metadata } from 'next'
import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'
import { ToolsFilter } from './tools-filter'
import { ToolsHeroField } from './tools-hero-field'
import styles from './tools.module.css'

export const metadata: Metadata = {
  description: '收录自制与第三方的视频、图片、文本和其他实用工具。',
  title: '工具箱',
}

interface ToolItem {
  cover: string
  description: string
  external?: boolean
  href?: string
  name: string
}

interface ToolSection {
  description: string
  id: string
  label: string
  tools: ToolItem[]
}

const toolSections: ToolSection[] = [
  {
    description: '在浏览器中完成常见的视频格式转换。',
    id: 'video-tools',
    label: '视频工具',
    tools: [
      {
        cover: '/tools/video-convert.svg',
        description: '直接在浏览器中转换常见视频格式。',
        href: '/tools/video-convert',
        name: '视频转码',
      },
    ],
  },
  {
    description: '验证图片来源，前往真实可用的第三方工具。',
    id: 'image-tools',
    label: '图片工具',
    tools: [
      {
        cover: '/tools/openai-verify.svg',
        description: '前往 OpenAI 的 Verify 页面。',
        external: true,
        href: 'https://openai.com/zh-Hans-CN/research/verify/',
        name: 'OpenAI Verify',
      },
    ],
  },
  {
    description: '转换字符串，也可以精确比较两个文字版本之间的变化。',
    id: 'text-tools',
    label: '文本工具',
    tools: [
      {
        cover: '/tools/json-convert.svg',
        description: '转义或还原 JSON 字符串，支持实时预览。',
        href: '/tools/json-convert',
        name: 'JSON 字符串转换',
      },
      {
        cover: '/tools/text-diff.svg',
        description: '比较两个文字版本，精确标记到字符。',
        href: '/tools/text-diff',
        name: '文字内容 Diff',
      },
    ],
  },
]

export default function ToolsPage() {
  return (
    <div className={styles.shell}>
      <a className={styles.skipLink} href="#main-content">
        跳至主要内容
      </a>

      <SiteHeader activeSection="tools" />

      <main className={styles.page} id="main-content">
        <div aria-hidden="true" className={styles.pageIntro}>
          <ToolsHeroField />
          <div className={styles.heroVeil} />
        </div>

        <div className={styles.toolsLayout}>
          <header className={styles.heroCopy}>
            <h1 className={styles.pageTitle}>人类的本质就是造轮子</h1>
            <p className={styles.pageIntroDescription}>
              收集全网工具，也收集自制工具。希望能帮助到你
            </p>
          </header>

          <div className={styles.toolsContent}>
            <ToolsFilter sections={toolSections} />
          </div>
        </div>
      </main>

      <SiteFooter
        linkHref="/"
        linkLabel="返回首页"
        message="持续收集，也持续构建"
      />
    </div>
  )
}
