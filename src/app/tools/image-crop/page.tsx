import type { Metadata } from 'next'
import { SiteHeader } from '@/components/site-header'
import { ImageCropper } from './image-cropper'

export const metadata: Metadata = {
  description:
    '无需上传，在浏览器本地完成图片裁剪、旋转、翻转、精确尺寸调整，并导出 JPEG、PNG 或 WebP。',
  title: '图片裁剪',
}

export default function ImageCropPage() {
  return (
    <div>
      <SiteHeader activeSection="tools" />
      <main>
        <ImageCropper />
      </main>
    </div>
  )
}
