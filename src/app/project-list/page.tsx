import { notFound } from 'next/navigation'
import { useMDXComponent } from 'next-contentlayer2/hooks'

import MDXComponents from '@/components/mdx'
import { allPages } from 'contentlayer/generated'

export const metadata = {
  title: 'Projects',
}

const Projects = () => {
  const projects = allPages.find(page => page.key === 'projects')

  if (!projects) {
    notFound()
  }
  const MDXContent = useMDXComponent(projects.body.code)

  return (
    <div className="mx-auto w-full max-w-xl px-8 py-8 md:px-0">
      <MDXContent components={MDXComponents} />
    </div>
  )
}

export default Projects
