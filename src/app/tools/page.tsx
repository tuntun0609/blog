import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import type { CSSProperties } from 'react'
import { SiteHeader } from '@/components/site-header'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { ToolsSidebarNav } from './tools-sidebar-nav'
import styles from './tools.module.css'

export const metadata: Metadata = {
  description: '收录自制与第三方的视频、图片处理工具。',
  title: '工具箱',
}

interface ToolItem {
  cover: string
  description: string
  isExternal?: boolean
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
    description: '围绕常见的视频文件处理场景，逐步补充轻量、直接的实用工具。',
    id: 'video-tools',
    label: '视频工具',
    tools: [
      {
        cover: '/tools/video-compress.svg',
        description: '在尽量保留画面质量的前提下，快速减小视频文件体积。',
        name: '视频压缩',
      },
      {
        cover: '/tools/video-convert.svg',
        description: '在常见视频格式之间转换，适配不同平台与播放环境。',
        name: '格式转换',
      },
      {
        cover: '/tools/video-cover.svg',
        description: '从视频中选取指定画面，并导出为可继续使用的图片。',
        name: '封面提取',
      },
    ],
  },
  {
    description: '提供日常高频的图片优化与调整能力，减少重复的手动操作。',
    id: 'image-tools',
    label: '图片工具',
    tools: [
      {
        cover: '/tools/image-compress.svg',
        description: '针对网页与内容发布场景，压缩图片并平衡清晰度与体积。',
        name: '图片压缩',
      },
      {
        cover: '/tools/image-convert.svg',
        description: '转换 PNG、JPG、WebP 等常见格式，满足不同使用需求。',
        name: '格式转换',
      },
      {
        cover: '/tools/image-resize.svg',
        description: '按具体尺寸或常见比例调整图片，快速适配不同平台。',
        name: '尺寸调整',
      },
    ],
  },
]

const toolsSidebarStyle = {
  '--sidebar-width': '17rem',
} as CSSProperties

export default function ToolsPage() {
  return (
    <div className={styles.shell}>
      <a className={styles.skipLink} href="#main-content">
        跳至主要内容
      </a>

      <SiteHeader />

      <SidebarProvider className={styles.toolsLayout} style={toolsSidebarStyle}>
        <Sidebar
          className={styles.toolsSidebar}
          collapsible="offcanvas"
          variant="floating"
        >
          <SidebarContent className={styles.sidebarContent}>
            <SidebarGroup className={styles.sidebarGroup}>
              <SidebarGroupLabel>分类</SidebarGroupLabel>
              <ToolsSidebarNav
                sections={toolSections.map(({ id, label, tools }) => ({
                  count: tools.length,
                  id,
                  label,
                }))}
              />
            </SidebarGroup>
          </SidebarContent>
          <SidebarRail aria-label="切换工具目录" title="切换工具目录" />
        </Sidebar>

        <div className={styles.pageArea}>
          <main className={styles.page} id="main-content">
            <h1 className={styles.srOnly}>工具箱</h1>

            <div className={styles.mobileSidebarTrigger}>
              <SidebarTrigger aria-label="打开工具目录" />
              <span>目录</span>
            </div>

            <div className={styles.sections}>
              {toolSections.map((section, sectionIndex) => (
                <section
                  aria-labelledby={`${section.id}-title`}
                  className={styles.toolSection}
                  id={section.id}
                  key={section.id}
                >
                  <div className={styles.sectionHeader}>
                    <h2 id={`${section.id}-title`}>{section.label}</h2>
                    <p>{section.description}</p>
                  </div>

                  <div className={styles.cardGrid}>
                    {section.tools.map((tool) => (
                      <Card className={styles.toolCard} key={tool.name}>
                        <Image
                          alt=""
                          className={styles.cardCover}
                          height={360}
                          sizes="(max-width: 680px) calc(100vw - 2rem), (max-width: 860px) 50vw, 22rem"
                          src={tool.cover}
                          width={640}
                        />
                        <CardHeader>
                          <CardTitle className={styles.cardTitle}>
                            {tool.name}
                            {tool.isExternal ? (
                              <Badge variant="outline">外部</Badge>
                            ) : null}
                          </CardTitle>
                          <CardDescription>{tool.description}</CardDescription>
                        </CardHeader>
                      </Card>
                    ))}
                  </div>

                  {sectionIndex < toolSections.length - 1 ? (
                    <Separator className={styles.sectionSeparator} />
                  ) : null}
                </section>
              ))}
            </div>
          </main>

          <footer className={styles.footer}>
            <p>Tuntun · Web Front-End Developer</p>
            <div>
              <span>持续收集，也持续构建</span>
              <Link href="/">返回首页</Link>
            </div>
          </footer>
        </div>
      </SidebarProvider>
    </div>
  )
}
