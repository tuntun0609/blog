import { notFound } from 'next/navigation'

import { MDXContent } from '@/components/mdx'
import { allPages } from 'contentlayer/generated'

export const metadata = {
  title: 'Projects',
}

const Projects = () => {
  const projects = allPages.find(page => page.key === 'projects')

  if (!projects) {
    notFound()
  }

  return (
    <div className="mx-auto w-full max-w-xl px-8 py-8 md:px-0">
      <MDXContent code={projects.body.code} />
    </div>
  )
}

export default Projects
