import { notFound } from 'next/navigation'

import { BlogCard } from '@/components/post-card'
import { capitalize, sortBlogs } from '@/lib/utils'
import tagsList from '@/tags.json'
import { allBlogs } from 'contentlayer/generated'

export const generateStaticParams = async () => tagsList.map(tag => ({ slug: tag.tag }))

export const generateMetadata = ({ params }: { params: { slug: string } }) => ({
  title: decodeURI(params.slug),
})

export default function TagHome({ params }: { params: { slug: string } }) {
  if (!params.slug) {
    notFound()
  }
  let posts = allBlogs
  const tag = decodeURI(params.slug)

  if (tag) {
    posts = sortBlogs(posts.filter(post => post.tags?.includes(tag)))
  }

  return (
    <div className="mx-auto max-w-xl px-8 py-8 md:px-0">
      <h1 className="mb-8 text-center text-2xl font-black">
        Tag {tag ? ` | ${capitalize(tag)}` : ''}
      </h1>
      {posts.map((post, idx) => (
        <BlogCard key={idx} {...post} />
      ))}
    </div>
  )
}
