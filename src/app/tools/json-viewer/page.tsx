import type { Metadata } from 'next'
import { SiteHeader } from '@/components/site-header'
import { JsonViewer } from './json-viewer'

export const metadata: Metadata = {
  description:
    '在浏览器本地查看、编辑、美化、压缩和修复 JSON，支持源码与树形节点同步。',
  title: 'JSON Viewer',
}

export default function JsonViewerPage() {
  return (
    <>
      <SiteHeader activeSection="tools" />
      <main>
        <JsonViewer />
      </main>
    </>
  )
}
