import {
  siBun,
  siCss,
  siGooglechrome,
  siHtml5,
  siJavascript,
  siNextdotjs,
  siNodedotjs,
  siPnpm,
  siPostgresql,
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

const toBrandColor = (hex: string): `#${string}` => `#${hex}`

// 技能数量
export const TECHNOLOGIES_PER_PAGE = 24

export const technologySkills: readonly TechnologySkill[] = [
  {
    description: '语义结构、可访问性与页面骨架',
    iconColor: '#FFFFFF',
    iconPath: siHtml5.path,
    id: 'html',
    keyColor: '#8A2C15',
    name: 'HTML',
  },
  {
    description: '布局、视觉样式与响应式界面',
    iconColor: '#FFFFFF',
    iconPath: siCss.path,
    id: 'css',
    keyColor: '#3F205F',
    name: 'CSS',
  },
  {
    description: '浏览器交互与应用逻辑',
    iconColor: toBrandColor(siJavascript.hex),
    iconPath: siJavascript.path,
    id: 'javascript',
    keyColor: '#4A400A',
    name: 'JavaScript',
  },
  {
    description: '类型系统与日常应用开发',
    iconColor: '#FFFFFF',
    iconPath: siTypescript.path,
    id: 'typescript',
    keyColor: '#1D4970',
    name: 'TypeScript',
  },
  {
    description: '组件、状态与交互界面',
    iconColor: toBrandColor(siReact.hex),
    iconPath: siReact.path,
    id: 'react',
    keyColor: '#242938',
    name: 'React',
  },
  {
    description: '全栈 Web 应用与内容站点',
    iconColor: '#FFFFFF',
    iconPath: siNextdotjs.path,
    id: 'nextjs',
    keyColor: toBrandColor(siNextdotjs.hex),
    name: 'Next.js',
  },
  {
    description: '设计系统与响应式样式',
    iconColor: toBrandColor(siTailwindcss.hex),
    iconPath: siTailwindcss.path,
    id: 'tailwindcss',
    keyColor: '#124A59',
    name: 'Tailwind CSS',
  },
  {
    description: '服务端工具与工程脚本',
    iconColor: '#FFFFFF',
    iconPath: siNodedotjs.path,
    id: 'nodejs',
    keyColor: '#234A2A',
    name: 'Node.js',
  },
  {
    description: '快速 JavaScript 运行时与一体化工具链',
    iconColor: '#FBF0DF',
    iconPath: siBun.path,
    id: 'bun',
    keyColor: '#302824',
    name: 'Bun',
  },
  {
    description: '高效、节省磁盘空间的包管理',
    iconColor: toBrandColor(siPnpm.hex),
    iconPath: siPnpm.path,
    id: 'pnpm',
    keyColor: '#6B3308',
    name: 'pnpm',
  },
  {
    description: '关系型数据建模与可靠查询',
    iconColor: '#FFFFFF',
    iconPath: siPostgresql.path,
    id: 'postgresql',
    keyColor: '#1E3A5F',
    name: 'PostgreSQL',
  },
  {
    description: '浏览器能力与扩展开发',
    iconColor: '#FFFFFF',
    iconPath: siGooglechrome.path,
    id: 'browser-extensions',
    keyColor: '#243B73',
    name: 'Browser Extensions',
  },
] as const
