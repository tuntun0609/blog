import {
  siGooglechrome,
  siNextdotjs,
  siNodedotjs,
  siReact,
  siTailwindcss,
  siTypescript,
} from 'simple-icons'

export interface TechnologySkill {
  readonly description: string
  readonly iconColor: `#${string}`
  readonly iconPath: string
  readonly id: string
  readonly keyColor: `#${string}`
  readonly name: string
}

// 技能数量
export const TECHNOLOGIES_PER_PAGE = 24

export const technologySkills: readonly TechnologySkill[] = [
  {
    description: '类型系统与日常应用开发',
    iconColor: '#FFFFFF',
    iconPath: siTypescript.path,
    id: 'typescript',
    keyColor: '#3178C6',
    name: 'TypeScript',
  },
  {
    description: '组件、状态与交互界面',
    iconColor: '#082F38',
    iconPath: siReact.path,
    id: 'react',
    keyColor: '#61DAFB',
    name: 'React',
  },
  {
    description: '全栈 Web 应用与内容站点',
    iconColor: '#FFFFFF',
    iconPath: siNextdotjs.path,
    id: 'nextjs',
    keyColor: '#111111',
    name: 'Next.js',
  },
  {
    description: '设计系统与响应式样式',
    iconColor: '#083344',
    iconPath: siTailwindcss.path,
    id: 'tailwindcss',
    keyColor: '#22D3EE',
    name: 'Tailwind CSS',
  },
  {
    description: '服务端工具与工程脚本',
    iconColor: '#FFFFFF',
    iconPath: siNodedotjs.path,
    id: 'nodejs',
    keyColor: '#3C873A',
    name: 'Node.js',
  },
  {
    description: '浏览器能力与扩展开发',
    iconColor: '#FFFFFF',
    iconPath: siGooglechrome.path,
    id: 'browser-extensions',
    keyColor: '#4285F4',
    name: 'Browser Extensions',
  },
] as const
