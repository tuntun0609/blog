import { notFound } from 'next/navigation'
import { useMDXComponent } from 'next-contentlayer2/hooks'

import MDXComponents from '@/components/mdx'
import { allPages } from 'contentlayer/generated'

const Home = () => {
  const home = allPages.find(page => page.key === 'home')

  if (!home) {
    notFound()
  }
  const MDXContent = useMDXComponent(home.body.code)

  return (
    <div className="mx-auto w-full max-w-xl px-8 py-8 md:px-0">
      <MDXContent components={MDXComponents} />
    </div>
  )
}

export default Home
