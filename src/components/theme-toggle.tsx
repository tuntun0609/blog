'use client'

import { type LucideIcon, MonitorIcon, MoonIcon, SunIcon } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const themeOptions = [
  { icon: SunIcon, label: '浅色', value: 'light' },
  { icon: MoonIcon, label: '深色', value: 'dark' },
  { icon: MonitorIcon, label: '跟随系统', value: 'system' },
] as const satisfies ReadonlyArray<{
  value: string
  label: string
  icon: LucideIcon
}>

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false)
  const [open, setOpen] = useState(false)
  const { forcedTheme, setTheme, theme } = useTheme()

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleThemeChange = useCallback(
    (value: string) => {
      setTheme(value)
      setOpen(false)
    },
    [setTheme]
  )

  if (!mounted) {
    return (
      <Button
        aria-label="选择主题"
        disabled
        size="icon"
        type="button"
        variant="ghost"
      >
        <MonitorIcon />
      </Button>
    )
  }

  const selectedTheme =
    themeOptions.find((option) => option.value === theme) ?? themeOptions[2]
  const SelectedIcon = selectedTheme.icon

  return (
    <DropdownMenu onOpenChange={setOpen} open={open}>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label={`选择主题，当前为${selectedTheme.label}`}
            disabled={Boolean(forcedTheme)}
            size="icon"
            type="button"
            variant="ghost"
          />
        }
      >
        <SelectedIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8}>
        <DropdownMenuRadioGroup
          aria-label="主题"
          onValueChange={handleThemeChange}
          value={theme ?? 'system'}
        >
          {themeOptions.map(({ icon: Icon, label, value }) => (
            <DropdownMenuRadioItem key={value} value={value}>
              <Icon />
              {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
