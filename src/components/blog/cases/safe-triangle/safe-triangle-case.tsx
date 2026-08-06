'use client'

import { ArrowRightIcon, CheckIcon, EyeIcon, EyeOffIcon } from 'lucide-react'
import {
  type PointerEvent as ReactPointerEvent,
  type SyntheticEvent,
  useCallback,
  useRef,
  useState,
} from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import styles from './safe-triangle-case.module.css'

const SAFE_OVERLAP = 2
const POINTER_INTENT_SAMPLE_DISTANCE = 6
const MAX_VERTICAL_SLOPE = 2
const SUBMENU_ID = 'safe-triangle-case-submenu'

const MENU_GROUPS = [
  {
    description: '从构思到上线所需的基础能力。',
    id: 'products',
    items: ['设计工具', '开发平台', '数据服务'],
    label: '产品',
  },
  {
    description: '按照团队当前的工作方式开始使用。',
    id: 'solutions',
    items: ['初创团队', '企业协作', '开发者体验'],
    label: '解决方案',
  },
  {
    description: '进一步了解产品和交互设计。',
    id: 'resources',
    items: ['使用指南', '案例研究', '更新日志'],
    label: '资源',
  },
  {
    description: '认识团队以及我们正在做的事情。',
    id: 'company',
    items: ['关于我们', '加入团队', '联系我们'],
    label: '公司',
  },
] as const

type MenuGroupId = (typeof MENU_GROUPS)[number]['id']

interface SafeAreaGeometry {
  height: number
  left: number
  top: number
  vertexY: number
  width: number
}

interface PointerPosition {
  x: number
  y: number
}

export function SafeTriangleCase() {
  const [activeMenuId, setActiveMenuId] = useState<MenuGroupId>('products')
  const [safeAreaGeometry, setSafeAreaGeometry] =
    useState<SafeAreaGeometry | null>(null)
  const [showSafeArea, setShowSafeArea] = useState(true)
  const submenuRef = useRef<HTMLDivElement>(null)
  const previousPointerRef = useRef<PointerPosition | null>(null)
  const activeMenu =
    MENU_GROUPS.find((menuGroup) => menuGroup.id === activeMenuId) ??
    MENU_GROUPS[0]

  const activateMenuFromEvent = useCallback(
    (event: SyntheticEvent<HTMLElement>): void => {
      const { menuId } = event.currentTarget.dataset
      const menuGroup = MENU_GROUPS.find((item) => item.id === menuId)

      if (!menuGroup || menuGroup.id === activeMenuId) {
        return
      }

      setActiveMenuId(menuGroup.id)
      setSafeAreaGeometry(null)
      previousPointerRef.current = null
    },
    [activeMenuId]
  )

  const clearSafeArea = useCallback((): void => {
    setSafeAreaGeometry(null)
    previousPointerRef.current = null
  }, [])

  const toggleSafeArea = useCallback((): void => {
    setShowSafeArea((isVisible) => !isVisible)
  }, [])

  const updateSafeArea = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>): void => {
      if (event.pointerType !== 'mouse') {
        return
      }

      const currentPointer = { x: event.clientX, y: event.clientY }
      const previousPointer = previousPointerRef.current

      if (!previousPointer) {
        previousPointerRef.current = currentPointer
        return
      }

      const horizontalMovement = currentPointer.x - previousPointer.x
      const verticalMovement = currentPointer.y - previousPointer.y
      const movementDistance = Math.hypot(horizontalMovement, verticalMovement)

      if (movementDistance < POINTER_INTENT_SAMPLE_DISTANCE) {
        return
      }

      previousPointerRef.current = currentPointer

      const isMovingTowardSubmenu =
        horizontalMovement > 0 &&
        Math.abs(verticalMovement) <= horizontalMovement * MAX_VERTICAL_SLOPE

      if (!isMovingTowardSubmenu) {
        setSafeAreaGeometry(null)
        return
      }

      const submenu = submenuRef.current

      if (!submenu) {
        return
      }

      const submenuRect = submenu.getBoundingClientRect()
      const safeLeft = Math.min(event.clientX - SAFE_OVERLAP, submenuRect.left)
      const safeWidth = Math.max(submenuRect.left - safeLeft, 0)

      if (safeWidth === 0) {
        setSafeAreaGeometry(null)
        return
      }

      const vertexY = Math.min(
        Math.max(event.clientY - submenuRect.top, 0),
        submenuRect.height
      )

      setSafeAreaGeometry({
        height: submenuRect.height,
        left: safeLeft,
        top: submenuRect.top,
        vertexY,
        width: safeWidth,
      })
    },
    []
  )

  return (
    <Card className="my-8">
      <CardHeader>
        <CardTitle>试着斜着移动鼠标</CardTitle>
        <CardDescription>
          斜向右侧移动会保留当前子菜单；垂直向下移动则会立即切换父菜单项。
        </CardDescription>
        <CardAction>
          <Button
            aria-pressed={showSafeArea}
            onClick={toggleSafeArea}
            size="sm"
            variant="outline"
          >
            {showSafeArea ? (
              <EyeOffIcon data-icon="inline-start" />
            ) : (
              <EyeIcon data-icon="inline-start" />
            )}
            {showSafeArea ? '隐藏安全区域' : '显示安全区域'}
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent>
        <div
          className={styles.stage}
          onPointerLeave={clearSafeArea}
          onPointerMove={updateSafeArea}
        >
          <nav aria-label="安全三角形案例主菜单" className={styles.menuColumn}>
            <ul className={styles.menuList}>
              {MENU_GROUPS.map((menuGroup) => {
                const isActive = menuGroup.id === activeMenuId

                return (
                  <li
                    data-menu-id={menuGroup.id}
                    key={menuGroup.id}
                    onPointerEnter={activateMenuFromEvent}
                  >
                    <Button
                      aria-controls={SUBMENU_ID}
                      aria-expanded={isActive}
                      aria-haspopup="menu"
                      className={styles.menuTrigger}
                      data-menu-id={menuGroup.id}
                      onClick={activateMenuFromEvent}
                      onFocus={activateMenuFromEvent}
                      type="button"
                      variant={isActive ? 'secondary' : 'ghost'}
                    >
                      {menuGroup.label}
                      <ArrowRightIcon data-icon="inline-end" />
                    </Button>
                  </li>
                )
              })}
            </ul>
          </nav>

          {safeAreaGeometry ? (
            <div
              aria-hidden="true"
              className={styles.safeArea}
              data-visible={showSafeArea}
              style={{
                clipPath: `polygon(0 ${safeAreaGeometry.vertexY}px, 100% 0, 100% 100%)`,
                height: safeAreaGeometry.height,
                left: safeAreaGeometry.left,
                top: safeAreaGeometry.top,
                width: safeAreaGeometry.width,
              }}
            />
          ) : null}

          <div
            aria-label={`${activeMenu.label}子菜单`}
            className={styles.submenuPanel}
            id={SUBMENU_ID}
            ref={submenuRef}
            role="menu"
          >
            <div className={styles.submenuHeader}>
              <div className={styles.submenuTitle}>{activeMenu.label}</div>
              <div className={styles.submenuDescription}>
                {activeMenu.description}
              </div>
            </div>
            <Separator className="my-3" />
            <ul className={styles.submenuList}>
              {activeMenu.items.map((item) => (
                <li key={item}>
                  <Button
                    className={styles.submenuButton}
                    role="menuitem"
                    type="button"
                    variant="ghost"
                  >
                    {item}
                    <ArrowRightIcon data-icon="inline-end" />
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </CardContent>

      <CardFooter className="flex flex-wrap gap-2">
        <Badge variant={showSafeArea ? 'default' : 'secondary'}>
          <CheckIcon data-icon="inline-start" />
          {showSafeArea ? '安全区域可见' : '安全区域已隐藏'}
        </Badge>
        <span className="text-muted-foreground text-xs">
          按钮只控制辅助区域的显示，命中逻辑始终启用。
        </span>
      </CardFooter>
    </Card>
  )
}
