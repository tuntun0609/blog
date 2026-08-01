import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import type { CSSProperties } from 'react'
import { SiteHeader } from '@/components/site-header'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
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
  href?: string
  isExternal?: boolean
  name: string
}

interface ToolSection {
  id: string
  label: string
  tools: ToolItem[]
}

const toolSections: ToolSection[] = [
  {
    id: 'video-tools',
    label: '视频工具',
    tools: [
      {
        cover: '/tools/video-compress.svg',
        name: '视频压缩',
      },
      {
        cover: '/tools/video-convert.svg',
        href: '/tools/video-convert',
        name: '视频转码',
      },
      {
        cover: '/tools/video-cover.svg',
        name: '封面提取',
      },
    ],
  },
  {
    id: 'image-tools',
    label: '图片工具',
    tools: [
      {
        cover: '/tools/image-compress.svg',
        name: '图片压缩',
      },
      {
        cover: '/tools/image-convert.svg',
        name: '格式转换',
      },
      {
        cover: '/tools/image-resize.svg',
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
              {toolSections.map((section) => (
                <section
                  aria-labelledby={`${section.id}-title`}
                  className={styles.toolSection}
                  id={section.id}
                  key={section.id}
                >
                  <div className={styles.sectionHeader}>
                    <h2 id={`${section.id}-title`}>{section.label}</h2>
                  </div>

                  <div className={styles.cardGrid}>
                    {section.tools.map((tool) => {
                      const card = (
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
                          </CardHeader>
                        </Card>
                      )

                      return tool.href ? (
                        <Link
                          aria-label={`打开${tool.name}`}
                          className={styles.toolCardLink}
                          href={tool.href}
                          key={tool.name}
                        >
                          {card}
                        </Link>
                      ) : (
                        <div className={styles.toolCardLink} key={tool.name}>
                          {card}
                        </div>
                      )
                    })}
                  </div>
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
