import type { Metadata } from 'next'
import { SiteHeader } from '@/components/site-header'
import { TextDiffTool } from './text-diff-tool'

export const metadata: Metadata = {
  description:
    '在浏览器本地比较两段文字，以 Split 或 Stacked 编辑器视图精确查看字符级差异。',
  title: '文字内容 Diff',
}

export default function TextDiffPage() {
  return (
    <>
      <SiteHeader activeSection="tools" />
      <main>
        <TextDiffTool />
      </main>
    </>
  )
}
