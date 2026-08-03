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
  loading?: 'eager' | 'lazy'
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
    description: '压缩、转码和提取封面，让常见的视频处理更直接。',
    id: 'video-tools',
    label: '视频工具',
    tools: [
      {
        cover: '/tools/video-compress.svg',
        description: '在清晰度与文件体积之间取得平衡。',
        loading: 'eager',
        name: '视频压缩',
      },
      {
        cover: '/tools/video-convert.svg',
        description: '直接在浏览器中转换常见视频格式。',
        href: '/tools/video-convert',
        name: '视频转码',
      },
      {
        cover: '/tools/video-cover.svg',
        description: '从视频中快速截取清晰的封面画面。',
        name: '封面提取',
      },
    ],
  },
  {
    description: '缩小体积、转换格式、调整尺寸，也可以验证图片来源。',
    id: 'image-tools',
    label: '图片工具',
    tools: [
      {
        cover: '/tools/image-compress.svg',
        description: '减小图片体积，便于分享与发布。',
        name: '图片压缩',
      },
      {
        cover: '/tools/image-convert.svg',
        description: '在常用图片格式之间轻松转换。',
        name: '格式转换',
      },
      {
        cover: '/tools/image-resize.svg',
        description: '按像素或比例调整图片尺寸。',
        name: '尺寸调整',
      },
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
    description: '在 JSON 字符串与普通文本之间快速来回转换。',
    id: 'text-tools',
    label: '文本工具',
    tools: [
      {
        cover: '/tools/json-convert.svg',
        description: '转义或还原 JSON 字符串，支持实时预览。',
        href: '/tools/json-convert',
        name: 'JSON 字符串转换',
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
