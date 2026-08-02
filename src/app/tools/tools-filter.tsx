'use client'

import { ArrowRightIcon } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import type { MouseEvent } from 'react'
import { useCallback, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import styles from './tools.module.css'

interface ToolItem {
  cover: string
  description: string
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

type CategoryId = 'all' | ToolSection['id']

const ToolCard = ({ tool }: { tool: ToolItem }) => {
  const isAvailable = Boolean(tool.href)
  const card = (
    <Card
      className={styles.toolCard}
      data-available={isAvailable ? 'true' : 'false'}
      size="sm"
    >
      <CardHeader className={styles.cardHeader}>
        <div className={styles.cardTopline}>
          <div className={styles.cardMedia}>
            <Image
              alt=""
              className={styles.cardCover}
              height={108}
              loading={tool.loading ?? 'lazy'}
              sizes="(max-width: 680px) calc(100vw - 2rem), (max-width: 960px) calc(50vw - 2.125rem), 29rem"
              src={tool.cover}
              width={192}
            />
          </div>
          <Badge variant={isAvailable ? 'default' : 'secondary'}>
            {isAvailable ? '可用' : '开发中'}
          </Badge>
        </div>
        <div className={styles.cardCopy}>
          <CardTitle>{tool.name}</CardTitle>
          <CardDescription>{tool.description}</CardDescription>
        </div>
      </CardHeader>
      <CardFooter className={styles.cardFooter}>
        <span>{isAvailable ? '打开工具' : '即将推出'}</span>
        {isAvailable ? <ArrowRightIcon aria-hidden="true" /> : null}
      </CardFooter>
    </Card>
  )

  if (!tool.href) {
    return <div className={styles.toolCardItem}>{card}</div>
  }

  return (
    <Link
      aria-label={`打开${tool.name}`}
      className={styles.toolCardLink}
      href={tool.href}
    >
      {card}
    </Link>
  )
}

export function ToolsFilter({ sections }: { sections: ToolSection[] }) {
  const [activeCategory, setActiveCategory] = useState<CategoryId>('all')
  const handleCategoryChange = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      setActiveCategory(event.currentTarget.value as CategoryId)
    },
    []
  )
  const visibleSections =
    activeCategory === 'all'
      ? sections
      : sections.filter((section) => section.id === activeCategory)

  return (
    <>
      <nav aria-label="工具分类" className={styles.categoryNav}>
        <button
          aria-pressed={activeCategory === 'all'}
          className={
            activeCategory === 'all'
              ? styles.categoryLinkActive
              : styles.categoryLink
          }
          onClick={handleCategoryChange}
          type="button"
          value="all"
        >
          全部工具
        </button>
        {sections.map((section) => {
          const isActive = activeCategory === section.id
          return (
            <button
              aria-pressed={isActive}
              className={
                isActive ? styles.categoryLinkActive : styles.categoryLink
              }
              key={section.id}
              onClick={handleCategoryChange}
              type="button"
              value={section.id}
            >
              {section.label}
            </button>
          )
        })}
      </nav>

      <div className={styles.sections}>
        {visibleSections.map((section) => (
          <section
            aria-labelledby={`${section.id}-title`}
            className={styles.toolSection}
            key={section.id}
          >
            <div className={styles.sectionHeader}>
              <div>
                <h2 id={`${section.id}-title`}>{section.label}</h2>
                <p>{section.description}</p>
              </div>
              <span>{section.tools.length} 个工具</span>
            </div>
            <div className={styles.cardGrid}>
              {section.tools.map((tool) => (
                <ToolCard key={tool.name} tool={tool} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  )
}
