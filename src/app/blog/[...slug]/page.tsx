import dayjs from 'dayjs'
import { useMDXComponent } from 'next-contentlayer2/hooks'

import MDXComponents from '@/components/mdx'
import ScrollTopButton from '@/components/scroll-to-top'
import { cn } from '@/lib/utils'
import { allBlogs } from 'contentlayer/generated'

import '@/style/mdx.css'
import 'katex/dist/katex.css'

dayjs.locale('zh-cn')

export const generateStaticParams = async () =>
  allBlogs.map(post => ({ slug: post._raw.flattenedPath.split('/') }))

export const generateMetadata = ({ params }: { params: { slug: string[] } }) => {
  const slug = decodeURI(params.slug.join('/'))
  const post = allBlogs.find(post => post._raw.flattenedPath === slug)
  if (!post) {
    throw new Error(`Post not found for slug: ${params.slug}`)
  }
  return { title: post.title }
}

const PostLayout = ({ params }: { params: { slug: string[] } }) => {
  const slug = decodeURI(params.slug.join('/'))
  const blog = allBlogs.find(blog => blog._raw.flattenedPath === slug)

  if (!blog) {
    throw new Error(`Post not found for slug: ${params.slug}`)
  }

  const MDXContent = useMDXComponent(blog.body.code)

  return (
    <article className={cn('mx-auto max-w-xl px-8 py-8 md:px-0')}>
      <div className="mb-8 text-center">
        <h1 className="mb-2 text-3xl font-bold">{blog.title}</h1>
        <div className="text-sm text-gray-600">
          <time dateTime={blog.lastMod}>{dayjs(blog.lastMod).format('YYYY-MM-DD HH:mm')}</time>
          <div>阅读时间: {blog.readingTime}</div>
        </div>
      </div>
      <MDXContent components={MDXComponents} />

      <ScrollTopButton />
    </article>
  )
}

export default PostLayout
