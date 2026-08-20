'use client'

import { ArrowRightIcon, ExternalLinkIcon } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useCallback, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type { ToolItem, ToolSection } from './tools.types'
import styles from './tools.module.css'

type CategoryId = 'all' | ToolSection['id']

interface ToolCardProps {
  categoryId: ToolSection['id']
  categoryLabel: string
  tool: ToolItem
}

const ToolCard = ({ categoryId, categoryLabel, tool }: ToolCardProps) => {
  const isAvailable = Boolean(tool.href)
  const isExternal = tool.external === true
  let footerLabel = '即将推出'

  if (isExternal) {
    footerLabel = '打开外部工具'
  } else if (isAvailable) {
    footerLabel = '打开工具'
  }

  const FooterIcon = isExternal ? ExternalLinkIcon : ArrowRightIcon
  const card = (
    <Card
      className={styles.toolCard}
      data-available={isAvailable ? 'true' : 'false'}
      size="sm"
    >
      <CardHeader className={styles.cardHeader}>
        <div className={styles.cardMediaFrame}>
          <div className={styles.cardMedia}>
            <Image
              alt=""
              className={styles.cardCover}
              height={941}
              loading={tool.loading ?? 'lazy'}
              sizes="(max-width: 680px) calc(100vw - 3.5rem), (max-width: 960px) calc(50vw - 3rem), 21rem"
              src={tool.cover}
              width={1672}
            />
          </div>
        </div>

        <div className={styles.cardCopy}>
          <div className={styles.cardBadges}>
            <Badge
              className={styles.categoryBadge}
              data-category={categoryId}
              variant="outline"
            >
              {categoryLabel}
            </Badge>
            {isExternal ? (
              <Badge variant="secondary">
                <ExternalLinkIcon aria-hidden="true" data-icon="inline-start" />
                外部工具
              </Badge>
            ) : null}
            {isAvailable ? null : <Badge variant="secondary">开发中</Badge>}
          </div>
          <CardTitle>{tool.name}</CardTitle>
          <CardDescription>{tool.description}</CardDescription>
        </div>
      </CardHeader>
      <CardFooter className={styles.cardFooter}>
        <span>{footerLabel}</span>
        {isAvailable ? <FooterIcon aria-hidden="true" /> : null}
      </CardFooter>
    </Card>
  )

  if (!tool.href) {
    return <div className={styles.toolCardItem}>{card}</div>
  }

  if (isExternal) {
    return (
      <a
        aria-label={`打开${tool.name}（外部工具）`}
        className={styles.toolCardLink}
        href={tool.href}
        rel="noopener"
        target="_blank"
      >
        {card}
      </a>
    )
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
    (values: string[]): void => {
      const [nextCategory] = values
      const isKnownCategory =
        nextCategory === 'all' ||
        sections.some((section) => section.id === nextCategory)

      if (nextCategory && isKnownCategory) {
        setActiveCategory(nextCategory)
      }
    },
    [sections]
  )
  const activeSection = sections.find(
    (section) => section.id === activeCategory
  )
  const visibleTools = sections.flatMap((section) => {
    if (activeCategory !== 'all' && activeCategory !== section.id) {
      return []
    }

    return section.tools.map((tool) => ({
      categoryId: section.id,
      categoryLabel: section.badgeLabel,
      tool,
    }))
  })
  const directoryTitle = activeSection?.label ?? '全部工具'

  return (
    <div className={styles.directory}>
      <div className={styles.directoryHeader}>
        <div className={styles.directoryCopy}>
          <h2 id="tools-directory-title">{directoryTitle}</h2>
          <p aria-live="polite">{visibleTools.length} 个工具</p>
        </div>

        <nav aria-label="工具分类" className={styles.categoryNav}>
          <ToggleGroup
            aria-label="选择工具分类"
            className={styles.categoryGroup}
            onValueChange={handleCategoryChange}
            value={[activeCategory]}
          >
            <ToggleGroupItem value="all">全部工具</ToggleGroupItem>
            {sections.map((section) => (
              <ToggleGroupItem key={section.id} value={section.id}>
                {section.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </nav>
      </div>

      <div className={styles.cardGrid} key={activeCategory}>
        {visibleTools.map(({ categoryId, categoryLabel, tool }) => (
          <ToolCard
            categoryId={categoryId}
            categoryLabel={categoryLabel}
            key={`${categoryId}-${tool.name}`}
            tool={tool}
          />
        ))}
      </div>
    </div>
  )
}
