import { ArrowUpRight } from 'lucide-react'
import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import type { CSSProperties } from 'react'
import { SiteHeader } from '@/components/site-header'
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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
        description: '在清晰度与文件体积之间取得平衡。',
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
    ],
  },
]

const toolsSidebarStyle = {
  '--sidebar-width': '15rem',
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
          variant="sidebar"
        >
          <SidebarContent className={styles.sidebarContent}>
            <SidebarGroup className={styles.sidebarGroup}>
              <SidebarGroupLabel>分类</SidebarGroupLabel>
              <ToolsSidebarNav
                sections={toolSections.map(({ id, label }) => ({
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
            <header className={styles.pageIntro}>
              <h1 className={styles.pageTitle}>工具箱</h1>
              <p className={styles.pageIntroDescription}>
                收录自制与第三方的视频、图片处理工具。
              </p>
            </header>

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
                      const isAvailable = Boolean(tool.href || tool.isExternal)
                      const card = (
                        <Card
                          className={`${styles.toolCard} ${isAvailable ? '' : styles.toolCardUnavailable}`}
                          key={tool.name}
                        >
                          <div className={styles.cardMedia}>
                            <Image
                              alt=""
                              className={styles.cardCover}
                              height={360}
                              sizes="(max-width: 680px) calc(100vw - 2rem), (max-width: 860px) 50vw, 22rem"
                              src={tool.cover}
                              width={640}
                            />
                          </div>
                          <CardHeader>
                            <CardTitle className={styles.cardTitle}>
                              <span>{tool.name}</span>
                              <span
                                className={
                                  isAvailable
                                    ? styles.availableStatus
                                    : styles.unavailableStatus
                                }
                              >
                                {isAvailable ? '可用' : '开发中'}
                              </span>
                              {isAvailable ? (
                                <ArrowUpRight
                                  aria-hidden="true"
                                  className={styles.cardArrow}
                                />
                              ) : null}
                            </CardTitle>
                            <CardDescription className={styles.cardDescription}>
                              {tool.description}
                            </CardDescription>
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
