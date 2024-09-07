'use client'

import { useEffect, useState, MouseEvent } from 'react'
import { Moon, Sun, SunMoon } from 'lucide-react'
import { useTheme } from 'next-themes'

import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn, getSystemTheme } from '@/lib/utils'

const themeConfig = [
  {
    label: 'Light',
    icon: <Sun className="h-4 w-4" />,
    value: 'light',
  },
  {
    label: 'Dark',
    icon: <Moon className="h-4 w-4" />,
    value: 'dark',
  },
  {
    label: 'System',
    icon: <SunMoon className="h-4 w-4" />,
    value: 'system',
  },
]

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme, resolvedTheme } = useTheme()

  const onChangeTheme = (value: string, e: MouseEvent) => {
    const x = e.clientX
    const y = e.clientY
    const endRadius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))

    const systemTheme = getSystemTheme()

    // 如果选择的主题与当前主题相同，直接返回
    if (value === theme) {
      return
    }

    // 切换为系统，但当前主题与系统主题相同时，直接切换
    if (value === 'system' && theme === systemTheme) {
      setTheme('system')
      return
    }

    // 从系统主题切换到固定主题时，如果固定主题与系统主题相同，直接切换
    if (theme === 'system' && value === systemTheme) {
      setTheme(value)
      return
    }

    const transition = document.startViewTransition(async () => {
      setTheme(value)
    })

    transition.ready.then(() => {
      const clipPath = [`circle(0px at ${x}px ${y}px)`, `circle(${endRadius}px at ${x}px ${y}px)`]
      document.documentElement.animate(
        {
          clipPath: resolvedTheme === 'dark' ? [...clipPath].reverse() : clipPath,
        },
        {
          duration: 400,
          easing: 'ease-out',
          pseudoElement:
            resolvedTheme === 'dark'
              ? '::view-transition-old(root)'
              : '::view-transition-new(root)',
        }
      )
    })
  }

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return null
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-10 w-10 p-0">
          <Sun className="rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="flex w-[150px] flex-col gap-1 p-2" align="end">
        {themeConfig.map(config => (
          <Button
            key={config.value}
            variant="ghost"
            className={cn(
              'w-full justify-start gap-2 p-2 pl-4',
              theme === config.value && 'bg-gray-100 dark:bg-gray-800'
            )}
            onClick={e => onChangeTheme(config.value, e)}
          >
            {config.icon}
            {config.label}
          </Button>
        ))}
      </PopoverContent>
    </Popover>
  )
}
