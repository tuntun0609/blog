import { SearchIcon, XIcon } from 'lucide-react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group'
import type { BlogCategory } from '@/lib/blog-taxonomy'
import type { BlogCategoryFacet } from '@/lib/blog-types'
import { getBlogListHref } from '@/lib/blog-url'
import styles from './blog.module.css'

interface CategoryFilterProps {
  activeCategory?: BlogCategory
  categories: readonly BlogCategoryFacet[]
  query?: string
  resultCount: number
  totalPosts: number
}

const getResultDescription = ({
  activeCategory,
  query,
  resultCount,
  totalPosts,
}: Omit<CategoryFilterProps, 'categories'>): string => {
  if (activeCategory && query) {
    return `在 ${activeCategory} 中找到 ${resultCount} 篇与“${query}”相关的文章`
  }

  if (query) {
    return `找到 ${resultCount} 篇与“${query}”相关的文章`
  }

  if (activeCategory) {
    return `${activeCategory} · ${resultCount} 篇文章`
  }

  return `浏览全部 ${totalPosts} 篇文章`
}

export function CategoryFilter({
  activeCategory,
  categories,
  query,
  resultCount,
  totalPosts,
}: CategoryFilterProps) {
  const resultDescription = getResultDescription({
    activeCategory,
    query,
    resultCount,
    totalPosts,
  })

  return (
    <section aria-labelledby="blog-filter-title" className={styles.blogFilter}>
      <div className={styles.blogFilterHeader}>
        <div>
          <h2 id="blog-filter-title">查找文章</h2>
          <p aria-live="polite">{resultDescription}</p>
        </div>

        <search className={styles.articleSearch}>
          <form action="/blog" method="get">
            {activeCategory ? (
              <input name="category" type="hidden" value={activeCategory} />
            ) : null}
            <InputGroup>
              <InputGroupAddon align="inline-start">
                <SearchIcon aria-hidden="true" />
              </InputGroupAddon>
              <InputGroupInput
                aria-label="搜索文章"
                autoComplete="off"
                defaultValue={query}
                name="q"
                placeholder="搜索标题、主题或技术"
                type="search"
              />
              <InputGroupAddon align="inline-end">
                {query ? (
                  <Link
                    aria-label="清除搜索"
                    className={buttonVariants({
                      size: 'icon-xs',
                      variant: 'ghost',
                    })}
                    href={getBlogListHref({ category: activeCategory })}
                  >
                    <XIcon aria-hidden="true" />
                  </Link>
                ) : null}
                <InputGroupButton type="submit">搜索</InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
          </form>
        </search>
      </div>

      <nav aria-label="文章分类" className={styles.categoryFilterOptions}>
        <Badge
          render={
            <Link
              aria-current={activeCategory ? undefined : 'page'}
              aria-label={`显示全部文章，共 ${totalPosts} 篇`}
              href={getBlogListHref({ query })}
            />
          }
          variant={activeCategory ? 'outline' : 'default'}
        >
          全部 · {totalPosts}
        </Badge>
        {categories.map((category) => {
          const isActive = category.name === activeCategory

          return (
            <Badge
              key={category.name}
              render={
                <Link
                  aria-current={isActive ? 'page' : undefined}
                  aria-label={`显示${category.name}分类，共 ${category.count} 篇`}
                  href={getBlogListHref({
                    category: category.name,
                    query,
                  })}
                />
              }
              variant={isActive ? 'default' : 'outline'}
            >
              {category.name} · {category.count}
            </Badge>
          )
        })}
      </nav>
    </section>
  )
}
