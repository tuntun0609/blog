import type { Metadata } from 'next'
import { SiteHeader } from '@/components/site-header'
import { VideoConverter } from './video-converter'

export const metadata: Metadata = {
  description:
    '无需上传，在浏览器本地完成 MP4、WebM、MOV、MKV、WAV、MP3 与 AAC 视频音频转码。',
  title: '视频转码',
}

export default function VideoConvertPage() {
  return (
    <div>
      <SiteHeader activeSection="tools" />
      <main>
        <VideoConverter />
      </main>
    </div>
  )
}
