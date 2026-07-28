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

// 技能数量
export const TECHNOLOGIES_PER_PAGE = 24

export const technologySkills: readonly TechnologySkill[] = [
  {
    description: '语义结构、可访问性与页面骨架',
    iconColor: '#FFFFFF',
    iconPath: siHtml5.path,
    id: 'html',
    keyColor: '#E34C26',
    name: 'HTML',
  },
  {
    description: '布局、视觉样式与响应式界面',
    iconColor: '#FFFFFF',
    iconPath: siCss.path,
    id: 'css',
    keyColor: '#563D7C',
    name: 'CSS',
  },
  {
    description: '浏览器交互与应用逻辑',
    iconColor: '#241407',
    iconPath: siJavascript.path,
    id: 'javascript',
    keyColor: '#EC903A',
    name: 'JavaScript',
  },
  {
    description: '类型系统与日常应用开发',
    iconColor: '#FFFFFF',
    iconPath: siTypescript.path,
    id: 'typescript',
    keyColor: '#007ACC',
    name: 'TypeScript',
  },
  {
    description: '组件、状态与交互界面',
    iconColor: '#13333D',
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
    keyColor: '#000000',
    name: 'Next.js',
  },
  {
    description: '设计系统与响应式样式',
    iconColor: '#083344',
    iconPath: siTailwindcss.path,
    id: 'tailwindcss',
    keyColor: '#06B6D4',
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
    description: '快速 JavaScript 运行时与一体化工具链',
    iconColor: '#000000',
    iconPath: siBun.path,
    id: 'bun',
    keyColor: '#FBF0DF',
    name: 'Bun',
  },
  {
    description: '高效、节省磁盘空间的包管理',
    iconColor: '#301801',
    iconPath: siPnpm.path,
    id: 'pnpm',
    keyColor: '#F69220',
    name: 'pnpm',
  },
  {
    description: '关系型数据建模与可靠查询',
    iconColor: '#FFFFFF',
    iconPath: siPostgresql.path,
    id: 'postgresql',
    keyColor: '#336791',
    name: 'PostgreSQL',
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
