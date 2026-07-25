import { ArrowLeftIcon, Clock3Icon } from 'lucide-react'
import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getMdxComponents } from '@/components/mdx'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

import { blogSource, formatPostDate } from '@/lib/blog'

type PostPageProps = {
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

  if (!(post && post.data.published)) {
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

  if (!(post && post.data.published)) {
    notFound()
  }

  const MdxContent = post.data.body

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <Button
        nativeButton={false}
        render={<Link href="/blog" />}
        variant="ghost"
      >
        <ArrowLeftIcon data-icon="inline-start" />
        返回博客
      </Button>

      <article className="mt-8">
        <header className="mx-auto max-w-3xl text-center">
          <div className="flex flex-wrap items-center justify-center gap-3 text-muted-foreground text-sm">
            <Badge variant="secondary">{post.data.category}</Badge>
            <time dateTime={post.data.date}>
              {formatPostDate(post.data.date)}
            </time>
            <span className="inline-flex items-center gap-1.5">
              <Clock3Icon aria-hidden="true" className="size-4" />
              {post.data.readingTime}
            </span>
          </div>
          <h1 className="mt-5 font-bold text-3xl leading-tight sm:text-5xl">
            {post.data.title}
          </h1>
          <p className="mt-5 text-lg text-muted-foreground leading-8">
            {post.data.description}
          </p>
        </header>

        <div className="relative mx-auto mt-10 aspect-video max-w-5xl overflow-hidden rounded-lg">
          <Image
            alt={post.data.title}
            className="object-cover"
            fill
            preload
            sizes="(max-width: 1024px) 100vw, 1024px"
            src={post.data.cover}
          />
        </div>

        <div className="mx-auto mt-12 grid max-w-5xl gap-12 lg:grid-cols-[minmax(0,1fr)_14rem]">
          <div className="min-w-0">
            <div className="pt-2">
              <MdxContent components={getMdxComponents()} />
            </div>
          </div>
          {post.data.toc.length > 0 ? (
            <aside className="hidden lg:block">
              <nav
                aria-label="文章目录"
                className="sticky top-24 flex flex-col gap-3 text-sm"
              >
                <p className="font-semibold">本页内容</p>
                {post.data.toc.map((item) => (
                  <a
                    className="text-muted-foreground transition-colors hover:text-foreground"
                    href={item.url}
                    key={item.url}
                  >
                    {item.title}
                  </a>
                ))}
              </nav>
            </aside>
          ) : null}
        </div>
      </article>
    </div>
  )
}
