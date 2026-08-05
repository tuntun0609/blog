import { blogSource, getPostMarkdown, getPublishedPosts } from '@/lib/blog'

export const revalidate = false

export function generateStaticParams() {
  return getPublishedPosts().map((post) => ({ slug: post.slugs }))
}

export async function GET(
  _request: Request,
  { params }: RouteContext<'/llms.mdx/blog/[...slug]'>
) {
  const { slug } = await params
  const post = blogSource.getPage(slug)

  if (!post?.data.published) {
    return new Response('文章不存在', { status: 404 })
  }

  return new Response(await getPostMarkdown(post), {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
    },
  })
}
