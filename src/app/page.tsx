import { notFound } from 'next/navigation'

import { MDXContent } from '@/components/mdx'
import { allPages } from 'contentlayer/generated'

const Home = () => {
  const home = allPages.find(page => page.key === 'home')

  if (!home) {
    notFound()
  }

  return (
    <div className="mx-auto w-full max-w-xl px-8 py-8 md:px-0">
      <MDXContent code={home.body.code} />
    </div>
  )
}

export default Home
