'use client'

import { ImageIcon, VideoIcon, WrenchIcon } from 'lucide-react'
import { type MouseEvent, useCallback, useEffect, useState } from 'react'
import {
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
import styles from './tools.module.css'

const sectionIcons = {
  'image-tools': ImageIcon,
  'video-tools': VideoIcon,
} as const

interface ToolsSidebarNavProps {
  sections: {
    id: string
    label: string
  }[]
}

export function ToolsSidebarNav({ sections }: ToolsSidebarNavProps) {
  const { setOpenMobile } = useSidebar()
  const [activeSectionId, setActiveSectionId] = useState(
    sections.at(0)?.id ?? ''
  )

  useEffect(() => {
    const hashSectionId = window.location.hash.slice(1)
    const hasMatchingSection = sections.some(
      (section) => section.id === hashSectionId
    )

    if (hasMatchingSection) {
      setActiveSectionId(hashSectionId)
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntry = entries.find((entry) => entry.isIntersecting)

        if (visibleEntry) {
          setActiveSectionId(visibleEntry.target.id)
        }
      },
      {
        rootMargin: '-24% 0px -66% 0px',
      }
    )

    for (const section of sections) {
      const sectionElement = document.getElementById(section.id)
      if (sectionElement) {
        observer.observe(sectionElement)
      }
    }

    return () => observer.disconnect()
  }, [sections])

  const handleNavigate = useCallback(
    (event: MouseEvent<HTMLAnchorElement>) => {
      setActiveSectionId(event.currentTarget.hash.slice(1))
      setOpenMobile(false)
    },
    [setOpenMobile]
  )

  return (
    <SidebarGroupContent>
      <nav aria-label="工具分类">
        <SidebarMenu className={styles.sidebarMenu}>
          {sections.map((section) => {
            const Icon =
              sectionIcons[section.id as keyof typeof sectionIcons] ??
              WrenchIcon

            return (
              <SidebarMenuItem key={section.id}>
                <SidebarMenuButton
                  className={styles.sidebarNavButton}
                  isActive={activeSectionId === section.id}
                  render={
                    <a
                      aria-current={
                        activeSectionId === section.id ? 'location' : undefined
                      }
                      href={`#${section.id}`}
                      onClick={handleNavigate}
                    />
                  }
                  size="lg"
                >
                  <Icon aria-hidden="true" className={styles.sidebarNavIcon} />
                  <span>{section.label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </nav>
    </SidebarGroupContent>
  )
}
