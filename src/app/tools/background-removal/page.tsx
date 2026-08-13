import type { Metadata } from 'next'
import { SiteHeader } from '@/components/site-header'
import { BackgroundRemovalTool } from './background-removal-tool'

export const metadata: Metadata = {
  description:
    '无需上传，在浏览器本地识别图片主体、去除背景，并导出保持原尺寸的透明 PNG。',
  title: '图片背景去除',
}

export default function BackgroundRemovalPage() {
  return (
    <div>
      <SiteHeader activeSection="tools" />
      <BackgroundRemovalTool />
    </div>
  )
}
