import dayjs from 'dayjs'
import { useMDXComponent } from 'next-contentlayer2/hooks'

import { GiscusComment } from '@/components/comment'
import MDXComponents from '@/components/mdx'
import ScrollTopButton from '@/components/scroll-to-top'
import TOC from '@/components/toc'
import { cn } from '@/lib/utils'
import { allBlogs } from 'contentlayer/generated'

dayjs.locale('zh-cn')

export const generateStaticParams = async () =>
  allBlogs.map(post => ({ slug: post.slug.split('/') }))

export const generateMetadata = ({ params }: { params: { slug: string[] } }) => {
  const slug = decodeURI(params.slug.join('/'))
  const post = allBlogs.find(post => post.slug === slug)
  if (!post) {
    throw new Error(`Post not found for slug: ${params.slug}`)
  }
  return { title: post.title }
}

const BlogLayout = ({ params }: { params: { slug: string[] } }) => {
  const slug = decodeURI(params.slug.join('/'))
  const blog = allBlogs.find(blog => blog.slug === slug)

  if (!blog) {
    throw new Error(`Post not found for slug: ${params.slug}`)
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
