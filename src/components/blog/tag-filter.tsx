import { TagFilterControls } from '@/components/blog/tag-filter-controls'
import type { BlogTagFacet } from '@/lib/blog-types'
import styles from './blog.module.css'

interface TagFilterProps {
  activeTag?: string
  resultCount: number
  tags: readonly BlogTagFacet[]
  totalPosts: number
}

export function TagFilter({
  activeTag,
  resultCount,
  tags,
  totalPosts,
}: TagFilterProps) {
  const resultDescription = activeTag
    ? `“${activeTag}”下有 ${resultCount} 篇文章`
    : `浏览全部 ${totalPosts} 篇文章`

  return (
    <section aria-labelledby="tag-filter-title" className={styles.tagFilter}>
      <TagFilterControls
        activeTag={activeTag}
        resultDescription={resultDescription}
        tags={tags}
        totalPosts={totalPosts}
      />
    </section>
  )
}
