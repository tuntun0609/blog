import { DocsBody } from 'fumadocs-ui/layouts/docs/page'
import {
  ArrowUpRightIcon,
  CalendarDaysIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Clock3Icon,
} from 'lucide-react'
import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import readingTime from 'reading-time'
import { ArticlePageActions } from '@/components/blog/page-actions'
import { ReadingProgress } from '@/components/blog/reading-progress'
import { getMdxComponents } from '@/components/mdx'
import { Badge } from '@/components/ui/badge'
import { blogSource, getPostGitHubUrl, getPublishedPosts } from '@/lib/blog'
import { formatPostDate } from '@/lib/blog-date'
import styles from '@/components/blog/blog.module.css'

interface PostPageProps {
  params: Promise<{ slug: string[] }>
}

export function generateStaticParams() {
  return blogSource.generateParams()
}

export async function generateMetadata({
  params,
}: PostPageProps): Promise<Metadata> {
  const { slug } = await params
  const post = blogSource.getPage(slug)

  if (!post?.data.published) {
    return {}
  }

  return {
    description: post.data.description,
    openGraph: {
      images: [{ alt: post.data.title, url: post.data.cover }],
      publishedTime: post.data.date,
      type: 'article',
    },
    title: post.data.title,
  }
}

export default async function PostPage({ params }: PostPageProps) {
  const { slug } = await params
  const post = blogSource.getPage(slug)

  if (!post?.data.published) {
    notFound()
  }

  const MdxContent = post.data.body
  const posts = getPublishedPosts()
  const currentPostIndex = posts.findIndex((item) => item.url === post.url)
  const previousPost = posts[currentPostIndex - 1]
  const nextPost = posts[currentPostIndex + 1]
  const readTime = readingTime(await post.data.getText('processed'))
  const readTimeInMinutes = Math.ceil(readTime.minutes)

  return (
    <div className={styles.postPage}>
      <ReadingProgress />

      <Link className={styles.backLink} href="/blog">
        <ArrowUpRightIcon aria-hidden="true" className={styles.backArrow} />
        返回博客
      </Link>

      <article>
        <header className={styles.articleHeader}>
          <div>
            <ul aria-label="文章分类与标签" className={styles.articleTaxonomy}>
              <li>
                <Badge>{post.data.category}</Badge>
              </li>
              {post.data.tags.map((tag) => (
                <li key={tag}>
                  <Badge variant="secondary">{tag}</Badge>
                </li>
              ))}
            </ul>
            <h1 className={styles.articleTitle}>{post.data.title}</h1>
            <p className={styles.articleDescription}>{post.data.description}</p>
          </div>
          <div className={styles.articleSidebar}>
            <dl className={styles.articleMeta}>
              <div>
                <dt>发布日期</dt>
                <dd>
                  <CalendarDaysIcon aria-hidden="true" />
                  <time dateTime={post.data.date}>
                    {formatPostDate(post.data.date)}
                  </time>
                </dd>
              </div>
              <div>
                <dt>阅读时间</dt>
                <dd>
                  <Clock3Icon aria-hidden="true" />
                  {readTimeInMinutes} 分钟
                </dd>
              </div>
            </dl>
            <div className={styles.articleActions}>
              <ArticlePageActions
                githubUrl={getPostGitHubUrl(post)}
                markdownUrl={`${post.url}.md`}
              />
            </div>
          </div>
        </header>

        <div className={styles.articleCover}>
          <Image
            alt={post.data.title}
            fill
            preload
            sizes="(max-width: 1128px) 100vw, 1088px"
            src={post.data.cover}
          />
        </div>

        <div className={styles.articleLayout}>
          <DocsBody className={styles.articleBody}>
            <MdxContent components={getMdxComponents()} />
          </DocsBody>
          {post.data.toc.length > 0 ? (
            <aside className={styles.toc}>
              <nav aria-label="文章目录">
                <p className={styles.tocTitle}>本页内容</p>
                <div className={styles.tocLinks}>
                  {post.data.toc.map((item) => (
                    <a
                      className={styles.tocLink}
                      href={item.url}
                      key={item.url}
                      style={{
                        paddingInlineStart: `${Math.max(item.depth - 2, 0) * 0.75}rem`,
                      }}
                    >
                      {item.title}
                    </a>
                  ))}
                </div>
              </nav>
            </aside>
          ) : null}
        </div>

        <div className={styles.continueReading}>
          {previousPost ? (
            <Link href={previousPost.url}>
              <span>
                <ChevronLeftIcon aria-hidden="true" />
                上一篇
              </span>
              <strong>{previousPost.data.title}</strong>
              <p>{previousPost.data.description}</p>
            </Link>
          ) : null}
          {nextPost ? (
            <Link href={nextPost.url}>
              <span>
                下一篇
                <ChevronRightIcon aria-hidden="true" />
              </span>
              <strong>{nextPost.data.title}</strong>
              <p>{nextPost.data.description}</p>
            </Link>
          ) : null}
        </div>
      </article>
    </div>
  )
}
