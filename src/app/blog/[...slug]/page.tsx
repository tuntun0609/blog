import { DocsBody } from 'fumadocs-ui/layouts/docs/page'
import {
  ArrowLeftIcon,
  ArrowUpRightIcon,
  CalendarDaysIcon,
  Clock3Icon,
  Layers3Icon,
} from 'lucide-react'
import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import styles from '@/components/blog/blog.module.css'
import { ReadingProgress } from '@/components/blog/reading-progress'
import { getMdxComponents } from '@/components/mdx'
import { blogSource, formatPostDate, getPublishedPosts } from '@/lib/blog'

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
  const nextPost = posts[currentPostIndex + 1]

  return (
    <div className={styles.postPage}>
      <ReadingProgress />

      <Link className={styles.backLink} href="/blog">
        <ArrowLeftIcon aria-hidden="true" />
        返回博客
      </Link>

      <article>
        <header className={styles.articleHeader}>
          <div>
            <p className={styles.kicker}>ARTICLE / {post.data.category}</p>
            <h1 className={styles.articleTitle}>{post.data.title}</h1>
            <p className={styles.articleDescription}>{post.data.description}</p>
          </div>
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
                {post.data.readingTime}
              </dd>
            </div>
            <div>
              <dt>文章分类</dt>
              <dd>
                <Layers3Icon aria-hidden="true" />
                {post.data.category}
              </dd>
            </div>
          </dl>
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
                    >
                      {item.title}
                    </a>
                  ))}
                </div>
              </nav>
            </aside>
          ) : null}
        </div>

        {nextPost ? (
          <Link className={styles.continueReading} href={nextPost.url}>
            <span className={styles.continueLabel}>继续阅读</span>
            <div>
              <h2>{nextPost.data.title}</h2>
              <p>{nextPost.data.description}</p>
            </div>
            <ArrowUpRightIcon aria-hidden="true" />
          </Link>
        ) : null}
      </article>
    </div>
  )
}
