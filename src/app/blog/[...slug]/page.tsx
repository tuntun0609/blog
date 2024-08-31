import dayjs from 'dayjs'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { useMDXComponent } from 'next-contentlayer2/hooks'

import { GiscusComment } from '@/components/comment'
import MDXComponents from '@/components/mdx'
import ScrollTopButton from '@/components/scroll-to-top'
import TOC from '@/components/toc'
import { siteMetadata } from '@/config/siteMeta'
import { cn, sortBlogs } from '@/lib/utils'
import { allBlogs } from 'contentlayer/generated'

const blogs = sortBlogs(allBlogs)

dayjs.locale('zh-cn')

export const generateStaticParams = async () =>
  allBlogs.map(blog => ({ slug: blog.slug.split('/') }))

export const generateMetadata = ({ params }: { params: { slug: string[] } }) => {
  const slug = decodeURI(params.slug.join('/'))

  const blog = blogs.find(blog => blog.slug === slug)
  if (!blog) {
    return {}
  }
  return {
    title: blog.title,
    description: blog.summary ?? siteMetadata.description,
    keywords: blog.tags ?? siteMetadata.keywords,
  }
}

const BlogLayout = ({ params }: { params: { slug: string[] } }) => {
  const slug = decodeURI(params.slug.join('/'))

  const blogIndex = blogs.findIndex(blog => blog.slug === slug)
  const prevBlog = blogs[blogIndex + 1]
  const nextBlog = blogs[blogIndex - 1]
  const blog = blogs.find(blog => blog.slug === slug)

  if (!blog) {
    notFound()
  }

  const MDXContent = useMDXComponent(blog.body.code)

  return (
    <div className="flex">
      <aside className="hidden flex-col pr-6 lg:flex lg:w-1/5" />
      <article className={cn('mx-auto w-full max-w-xl px-8 py-8 md:px-0 lg:w-3/5')}>
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-3xl font-bold">{blog.title}</h1>
          <div className="text-sm text-gray-600">
            <time dateTime={blog.date}>{dayjs(blog.date).format('YYYY-MM-DD HH:mm')}</time>
            <div>阅读时间: {blog.readingTime}</div>
          </div>
        </div>
        <div id="article">
          <MDXContent components={MDXComponents} />
        </div>

        <div className={cn('flex justify-between', (prevBlog || nextBlog) && 'my-8')}>
          {prevBlog && (
            <Link
              href={`/blog/${prevBlog.slug}`}
              className={cn('flex gap-1 text-blue-600', nextBlog && 'max-w-[48%]')}
            >
              <span>←</span>
              <span>{prevBlog.title}</span>
            </Link>
          )}
          {nextBlog && (
            <Link
              href={`/blog/${nextBlog.slug}`}
              className={cn('flex justify-end gap-1 text-blue-600', prevBlog && 'max-w-[48%]')}
            >
              <span>{nextBlog.title}</span> <span>→</span>
            </Link>
          )}
        </div>

        <GiscusComment />
        <ScrollTopButton />
      </article>

      <div className="hidden flex-col pr-6 lg:flex lg:w-1/5">
        <div className="sticky right-0 top-16 mt-8">
          <TOC />
        </div>
      </div>
    </div>
  )
}

export default BlogLayout
