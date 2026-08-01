import { ImageZoom } from 'fumadocs-ui/components/image-zoom'
import defaultMdxComponents from 'fumadocs-ui/mdx'
import type { MDXComponents } from 'mdx/types'

export function getMdxComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    img: ImageZoom as unknown as NonNullable<MDXComponents['img']>,
    ...components,
  } satisfies MDXComponents
}

export const useMDXComponents = getMdxComponents

declare global {
  type MDXProvidedComponents = ReturnType<typeof getMdxComponents>
}
