import {
  siGooglechrome,
  siJavascript,
  siNextdotjs,
  siReact,
  siTailwindcss,
  siTypescript,
} from 'simple-icons'

export type ProjectPreview =
  | {
      kind: 'bilibili'
      src: string
    }
  | {
      kind: 'code'
    }
  | {
      kind: 'image'
      position?: string
      src: string
    }

interface ProjectTechnology {
  name: string
  path: string
}

export interface ProjectDefinition {
  description: string
  href: string
  preview: ProjectPreview
  technologies: readonly ProjectTechnology[]
  title: string
}

export const projects: readonly ProjectDefinition[] = [
  {
    description:
      '本地优先的手绘动画工具：在浏览器中绘制、预览笔画过程，并导出图片或视频。',
    href: 'https://github.com/tuntun0609/dranimo',
    preview: {
      kind: 'image',
      src: '/projects/dranimo-preview.png',
    },
    technologies: [
      { name: 'Next.js', path: siNextdotjs.path },
      { name: 'React', path: siReact.path },
      { name: 'TypeScript', path: siTypescript.path },
      { name: 'Tailwind CSS', path: siTailwindcss.path },
    ],
    title: 'dranimo',
  },
  {
    description:
      '这个持续记录前端开发、开源项目与学习笔记的个人网站，使用 MDX 构建内容。',
    href: 'https://github.com/tuntun0609/blog',
    preview: {
      kind: 'image',
      src: '/projects/blog-preview.png',
    },
    technologies: [
      { name: 'Next.js', path: siNextdotjs.path },
      { name: 'React', path: siReact.path },
      { name: 'TypeScript', path: siTypescript.path },
    ],
    title: 'blog',
  },
  {
    description: '用自然语言创建和编辑信息图、幻灯片，并将成果导出为 PPTX。',
    href: 'https://github.com/tuntun0609/infographic-ai',
    preview: {
      kind: 'image',
      position: 'center',
      src: 'https://raw.githubusercontent.com/tuntun0609/infographic-ai/master/public/editor-snapshot.png',
    },
    technologies: [
      { name: 'React', path: siReact.path },
      { name: 'TypeScript', path: siTypescript.path },
      { name: 'Tailwind CSS', path: siTailwindcss.path },
    ],
    title: 'infographic-ai',
  },
  {
    description:
      '把认证、数据库、文档、国际化和 AI 能力整理成可组合的 Next.js 起点。',
    href: 'https://github.com/tuntun0609/easy-saas-next',
    preview: { kind: 'code' },
    technologies: [
      { name: 'Next.js', path: siNextdotjs.path },
      { name: 'React', path: siReact.path },
      { name: 'TypeScript', path: siTypescript.path },
      { name: 'Tailwind CSS', path: siTailwindcss.path },
    ],
    title: 'easy-saas-next',
  },
  {
    description:
      '重新整理 Bilibili 首页、视频和直播页面，让高频观看操作更顺手。',
    href: 'https://github.com/tuntun0609/tun-bili-tool',
    preview: {
      kind: 'bilibili',
      src: 'https://raw.githubusercontent.com/tuntun0609/tun-bili-tool/master/assets/icon512.png',
    },
    technologies: [
      { name: 'Chrome Extension', path: siGooglechrome.path },
      { name: 'TypeScript', path: siTypescript.path },
      { name: 'React', path: siReact.path },
    ],
    title: 'tun-bili-tool',
  },
  {
    description:
      '为 Leafer 画布加入元素吸附、参考线和过滤能力，让对齐自然发生。',
    href: 'https://github.com/tuntun0609/leafer-x-snap',
    preview: {
      kind: 'image',
      position: 'center',
      src: 'https://raw.githubusercontent.com/tuntun0609/leafer-x-snap/66a9ee56cf34e5e84419c7f1b02c41ef3348dadb/images/demo.png',
    },
    technologies: [
      { name: 'TypeScript', path: siTypescript.path },
      { name: 'JavaScript', path: siJavascript.path },
    ],
    title: 'leafer-x-snap',
  },
] as const
