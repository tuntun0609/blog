import type { Metadata } from 'next'
import { SiteHeader } from '@/components/site-header'
import { Toaster } from '@/components/ui/sonner'
import { DocumentCalibrationTool } from './document-calibration-tool'

export const metadata: Metadata = {
  description:
    '无需上传，在浏览器本地拖动四个角点，将斜拍的合同、票据、笔记或书页校正为水平文档并下载。',
  title: '文档校准',
}

export default function DocumentCalibrationPage() {
  return (
    <div>
      <SiteHeader activeSection="tools" />
      <main>
        <DocumentCalibrationTool />
      </main>
      <Toaster richColors />
    </div>
  )
}
