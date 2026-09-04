import type { Metadata } from 'next'
import Image from 'next/image'
import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'
import type { ToolSection } from './tools.types'
import { ToolsFilter } from './tools-filter'
import { ToolsHeroField } from './tools-hero-field'
import styles from './tools.module.css'

export const metadata: Metadata = {
  description: '收录自制与第三方的视频、图片、文本和其他实用工具。',
  title: '工具箱',
}

const toolSections: ToolSection[] = [
  {
    badgeLabel: '视频',
    id: 'video-tools',
    label: '视频工具',
    tools: [
      {
        cover: '/tools/video-convert-illustration.png',
        description: '直接在浏览器中转换常见视频格式。',
        href: '/tools/video-convert',
        loading: 'eager',
        name: '视频转码',
      },
    ],
  },
  {
    badgeLabel: '图片',
    id: 'image-tools',
    label: '图片工具',
    tools: [
      {
        cover: '/tools/image-resize.svg',
        description: '用本地 AI 重建细节，或按指定插值直接放大像素。',
        href: '/tools/image-upscale',
        name: '图片放大',
      },
      {
        cover: '/tools/background-removal-illustration.png',
        description: '在浏览器本地识别主体并导出透明 PNG。',
        href: '/tools/background-removal',
        name: '图片背景去除',
      },
      {
        cover: '/tools/image-crop-illustration.png',
        description: '在浏览器本地裁剪、旋转并导出图片。',
        href: '/tools/image-crop',
        name: '图片裁剪',
      },
      {
        cover: '/tools/document-calibration-illustration.png',
        description: '拖动四个角点，将斜拍文档校正为水平图片。',
        href: '/tools/document-calibration',
        name: '文档校准',
      },
      {
        cover: '/tools/color-palette-illustration.png',
        description: '从本地图片提取主题色，并复制 HEX 或 CSS 变量。',
        href: '/tools/color-palette',
        name: '图片主题色提取',
      },
      {
        cover: '/tools/openai-verify-illustration.png',
        description: '前往 OpenAI 的 Verify 页面。',
        external: true,
        href: 'https://openai.com/zh-Hans-CN/research/verify/',
        name: 'OpenAI Verify',
      },
    ],
  },
  {
    badgeLabel: '文本',
    id: 'text-tools',
    label: '文本工具',
    tools: [
      {
        cover: '/tools/json-viewer-illustration.png',
        description: '双栏查看与编辑 JSON，支持美化、压缩和修复。',
        href: '/tools/json-viewer',
        name: 'JSON Viewer',
      },
      {
        cover: '/tools/json-convert-illustration.png',
        description: '转义或还原 JSON 字符串，支持实时预览。',
        href: '/tools/json-convert',
        name: 'JSON 字符串转换',
      },
      {
        cover: '/tools/text-diff-illustration.png',
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
        <section className={styles.hero}>
          <div className={styles.heroInner}>
            <header className={styles.heroCopy}>
              <h1 className={styles.pageTitle}>
                <span>一些顺手的</span>
                <span>工具</span>
              </h1>
              <p className={styles.pageIntroDescription}>
                收集好用的工具，也把自己的想法做成工具。
              </p>
            </header>

            <div aria-hidden="true" className={styles.heroArtwork}>
              <ToolsHeroField />
              <div className={styles.heroVeil} />
              <div className={styles.heroCollage}>
                <div className={`${styles.heroSheet} ${styles.heroSheetVideo}`}>
                  <Image
                    alt=""
                    height={941}
                    loading="eager"
                    sizes="(max-width: 760px) 15rem, 24rem"
                    src="/tools/video-convert-illustration.png"
                    width={1672}
                  />
                </div>
                <div className={`${styles.heroSheet} ${styles.heroSheetImage}`}>
                  <Image
                    alt=""
                    height={941}
                    loading="eager"
                    sizes="(max-width: 760px) 12rem, 19rem"
                    src="/tools/color-palette-illustration.png"
                    width={1672}
                  />
                </div>
                <div className={`${styles.heroSheet} ${styles.heroSheetText}`}>
                  <Image
                    alt=""
                    height={941}
                    loading="eager"
                    sizes="(max-width: 760px) 9rem, 14rem"
                    src="/tools/json-viewer-illustration.png"
                    width={1672}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          aria-labelledby="tools-directory-title"
          className={styles.toolsContent}
        >
          <ToolsFilter sections={toolSections} />
        </section>
      </main>

      <SiteFooter
        linkHref="/"
        linkLabel="返回首页"
        message="持续收集，也持续构建"
      />
    </div>
  )
}
