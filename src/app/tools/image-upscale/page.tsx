import type { Metadata } from 'next'
import { SiteHeader } from '@/components/site-header'
import { ImageUpscaleTool } from './image-upscale-tool'

export const metadata: Metadata = {
  description:
    '无需上传，在浏览器本地用 AI 超分重建图片细节，或通过平滑、最近邻插值放大像素。',
  title: '图片放大',
}

/**
 * THESIS: 导入优先的单图工作台，拒绝营销页与通用仪表盘布局。
 * OWN-WORLD: 纸白、墨黑、冷灰工作面、细边界和唯一构建紫；扁平编辑台控件。
 * STORY: 访客导入本地图，选择 AI 或像素放大，核对尺寸，对比后下载结果。
 * FIRST VIEWPORT: 空态聚焦导入；载图后左侧大预览、右侧窄参数栏，主操作位于栏底。
 * FORM: Operate 首选方向；progressive side rail；seed 7c2f5e89。
 * FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md
 */
export default function ImageUpscalePage() {
  return (
    <div data-design-seed="7c2f5e89">
      <SiteHeader activeSection="tools" />
      <ImageUpscaleTool />
    </div>
  )
}
