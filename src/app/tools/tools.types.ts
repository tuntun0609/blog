export interface ToolItem {
  cover: string
  description: string
  external?: boolean
  href?: string
  loading?: 'eager' | 'lazy'
  name: string
}

export interface ToolSection {
  badgeLabel: string
  id: string
  label: string
  tools: ToolItem[]
}
