'use client'

import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import dynamic from 'next/dynamic'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  TECHNOLOGIES_PER_PAGE,
  type TechnologySkill,
  technologySkills,
} from './technologies-config'
import { unlockKeyboardAudio } from './technologies-keyboard-audio'
import type { TechnologySlot } from './technologies-keyboard-model'
import styles from './technologies-keyboard.module.css'

const TechnologiesKeyboardCanvas = dynamic(
  () =>
    import('./technologies-keyboard-canvas').then(
      (module) => module.TechnologiesKeyboardCanvas
    ),
  {
    loading: () => (
      <div
        aria-label="正在装配 3D 键盘"
        className={styles.canvasLoading}
        role="status"
      >
        <span aria-hidden="true" className={styles.loadingSpinner} />
      </div>
    ),
    ssr: false,
  }
)

const DESKTOP_LAYOUT_QUERY = '(min-width: 821px)'
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'
const HEADER_HEIGHT_REM = 4.35
const KEYBOARD_LOWER_OFFSET_RATIO = 0.18
const KEYBOARD_FINAL_SCALE = 1.25
const KEYBOARD_MOVE_START = 0.04
const KEYBOARD_MOVE_END = 0.3
const COPY_HIDE_END = 0.24
const MONITOR_REVEAL_START = 0.42
const MONITOR_REVEAL_END = 0.57
const USB_CABLE_START = 0.61
const USB_CABLE_END = 0.79
const SIGNAL_START = 0.84
const KEYBOARD_CABLE_INSET_PX = 10
const MINIMUM_CABLE_BEND_PX = 18
const MAXIMUM_CABLE_BEND_PX = 42
const DARK_MONITOR_FOREGROUND = '#F7F7F5'
const DARK_MONITOR_TECHNOLOGY_IDS = new Set([
  'bun',
  'chatgpt',
  'github',
  'nextjs',
  'vercel',
])

const clampProgress = (value: number): number => Math.min(1, Math.max(0, value))

const getSegmentProgress = (
  progress: number,
  start: number,
  end: number
): number => {
  const normalizedProgress = clampProgress((progress - start) / (end - start))
  return normalizedProgress * normalizedProgress * (3 - 2 * normalizedProgress)
}

type ScrollStage = 'connecting' | 'details' | 'keyboard' | 'monitor' | 'powered'

interface TechScreenContentProps {
  readonly ariaHidden?: true
  readonly className: string
  readonly skill: TechnologySkill
}

function TechScreenContent({
  ariaHidden,
  className,
  skill,
}: TechScreenContentProps) {
  return (
    <div
      aria-hidden={ariaHidden}
      className={`${styles.techContent} ${className}`}
    >
      <p className={styles.techMonitorLabel}>TECHNOLOGIES / 24-KEY MACRO PAD</p>
      <div className={styles.techProjection} key={skill.id}>
        <div className={styles.techReadout}>
          <svg
            aria-hidden="true"
            className={styles.techLogo}
            viewBox="0 0 24 24"
          >
            <path d={skill.iconPath} />
          </svg>
          <div className={styles.techText}>
            <p className={styles.techName}>{skill.name}</p>
            <p className={styles.techDescription}>{skill.description}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

const getScrollStage = (progress: number): ScrollStage => {
  if (progress < COPY_HIDE_END) {
    return 'details'
  }

  if (progress < MONITOR_REVEAL_START) {
    return 'keyboard'
  }

  if (progress < USB_CABLE_START) {
    return 'monitor'
  }

  if (progress < SIGNAL_START) {
    return 'connecting'
  }

  return 'powered'
}

export function TechnologiesKeyboard() {
  const sectionRef = useRef<HTMLElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<HTMLDivElement>(null)
  const cableSvgRef = useRef<SVGSVGElement>(null)
  const cableCoreRef = useRef<SVGPathElement>(null)
  const monitorRef = useRef<HTMLDivElement>(null)
  const keyboardConnectorRef = useRef<HTMLSpanElement>(null)
  const scheduleScrollUpdateRef = useRef<() => void>(() => undefined)
  const presentationProgressRef = useRef(0)
  const [activePage, setActivePage] = useState(0)
  const [activeSlot, setActiveSlot] = useState(0)
  const pageCount = Math.max(
    1,
    Math.ceil(technologySkills.length / TECHNOLOGIES_PER_PAGE)
  )
  const pageStart = activePage * TECHNOLOGIES_PER_PAGE
  const visibleSkills = useMemo(
    () => technologySkills.slice(pageStart, pageStart + TECHNOLOGIES_PER_PAGE),
    [pageStart]
  )
  const slots = useMemo<readonly TechnologySlot[]>(
    () =>
      Array.from({ length: TECHNOLOGIES_PER_PAGE }, (_, slotIndex) => ({
        skill: visibleSkills[slotIndex] ?? null,
        slotIndex,
      })),
    [visibleSkills]
  )
  const activeSkill = slots[activeSlot]?.skill ?? visibleSkills[0]
  const displayAccent =
    activeSkill && DARK_MONITOR_TECHNOLOGY_IDS.has(activeSkill.id)
      ? DARK_MONITOR_FOREGROUND
      : (activeSkill?.keyColor ?? '#8BA8FF')
  const handleConnectorPositionChange = useCallback((): void => {
    scheduleScrollUpdateRef.current()
  }, [])

  useEffect(() => {
    const activateAudio = (): void => {
      unlockKeyboardAudio()
    }

    window.addEventListener('pointerdown', activateAudio, {
      capture: true,
      once: true,
    })
    window.addEventListener('keydown', activateAudio, {
      capture: true,
      once: true,
    })

    return () => {
      window.removeEventListener('pointerdown', activateAudio, {
        capture: true,
      })
      window.removeEventListener('keydown', activateAudio, {
        capture: true,
      })
    }
  }, [])

  useEffect(() => {
    const section = sectionRef.current
    const inner = innerRef.current
    const scene = sceneRef.current
    const cableSvg = cableSvgRef.current
    const cableCore = cableCoreRef.current
    const monitor = monitorRef.current
    const keyboardConnector = keyboardConnectorRef.current
    if (
      !(
        section &&
        inner &&
        scene &&
        cableSvg &&
        cableCore &&
        monitor &&
        keyboardConnector
      )
    ) {
      return
    }

    const desktopLayout = window.matchMedia(DESKTOP_LAYOUT_QUERY)
    const reducedMotion = window.matchMedia(REDUCED_MOTION_QUERY)
    let animationFrame = 0

    const resetScrollStyles = (): void => {
      presentationProgressRef.current = 0
      section.style.removeProperty('--keyboard-copy-opacity')
      section.style.removeProperty('--keyboard-copy-translate-y')
      section.style.removeProperty('--keyboard-translate-x')
      section.style.removeProperty('--keyboard-translate-y')
      section.style.removeProperty('--keyboard-scale')
      section.style.removeProperty('--monitor-opacity')
      section.style.removeProperty('--monitor-translate-y')
      section.style.removeProperty('--usb-cable-progress')
      delete section.dataset.scrollStage
      delete section.dataset.monitorVisible
      delete section.dataset.signalStage
    }

    const updateCableGeometry = (innerBounds: DOMRect): void => {
      const monitorBounds = monitor.getBoundingClientRect()
      const connectorBounds = keyboardConnector.getBoundingClientRect()
      const startX =
        monitorBounds.left + monitorBounds.width / 2 - innerBounds.left
      const startY = monitorBounds.bottom - innerBounds.top
      const endX =
        connectorBounds.left + connectorBounds.width / 2 - innerBounds.left
      const endY =
        connectorBounds.top +
        connectorBounds.height / 2 -
        innerBounds.top +
        KEYBOARD_CABLE_INSET_PX
      const verticalDistance = Math.max(1, endY - startY)
      const cableBend = Math.min(
        MAXIMUM_CABLE_BEND_PX,
        Math.max(MINIMUM_CABLE_BEND_PX, verticalDistance * 0.24)
      )
      const cablePath = `M ${endX} ${endY} C ${endX} ${endY - verticalDistance * 0.28}, ${startX - cableBend} ${startY + verticalDistance * 0.38}, ${startX} ${startY}`

      cableSvg.setAttribute(
        'viewBox',
        `0 0 ${innerBounds.width} ${innerBounds.height}`
      )
      cableCore.setAttribute('d', cablePath)
    }

    const updateScrollStyles = (): void => {
      animationFrame = 0

      if (!(desktopLayout.matches && !reducedMotion.matches)) {
        resetScrollStyles()
        return
      }

      const sectionBounds = section.getBoundingClientRect()
      const innerBounds = inner.getBoundingClientRect()
      const rootFontSize = Number.parseFloat(
        window.getComputedStyle(document.documentElement).fontSize
      )
      const stickyTop = HEADER_HEIGHT_REM * rootFontSize
      const scrollDistance = Math.max(
        1,
        section.offsetHeight - inner.offsetHeight
      )
      const scrollProgress = clampProgress(
        (stickyTop - sectionBounds.top) / scrollDistance
      )
      const copyProgress = getSegmentProgress(
        scrollProgress,
        KEYBOARD_MOVE_START,
        COPY_HIDE_END
      )
      const sceneProgress = getSegmentProgress(
        scrollProgress,
        KEYBOARD_MOVE_START,
        KEYBOARD_MOVE_END
      )
      const monitorProgress = getSegmentProgress(
        scrollProgress,
        MONITOR_REVEAL_START,
        MONITOR_REVEAL_END
      )
      const cableProgress = getSegmentProgress(
        scrollProgress,
        USB_CABLE_START,
        USB_CABLE_END
      )
      const sceneCenter =
        innerBounds.left + scene.offsetLeft + scene.offsetWidth / 2
      const targetCenter = innerBounds.left + inner.clientWidth / 2
      const targetTranslateX = targetCenter - sceneCenter
      const targetTranslateY = window.innerHeight * KEYBOARD_LOWER_OFFSET_RATIO
      const keyboardScale = 1 + (KEYBOARD_FINAL_SCALE - 1) * sceneProgress

      presentationProgressRef.current = sceneProgress
      section.style.setProperty(
        '--keyboard-copy-opacity',
        String(1 - copyProgress)
      )
      section.style.setProperty(
        '--keyboard-copy-translate-y',
        `${copyProgress * -32}px`
      )
      section.style.setProperty(
        '--keyboard-translate-x',
        `${targetTranslateX * sceneProgress}px`
      )
      section.style.setProperty(
        '--keyboard-translate-y',
        `${targetTranslateY * sceneProgress}px`
      )
      section.style.setProperty('--keyboard-scale', String(keyboardScale))
      section.style.setProperty('--monitor-opacity', String(monitorProgress))
      section.style.setProperty(
        '--monitor-translate-y',
        `${(1 - monitorProgress) * -26}px`
      )
      section.style.setProperty('--usb-cable-progress', String(cableProgress))
      section.dataset.scrollStage = getScrollStage(scrollProgress)
      section.dataset.monitorVisible = monitorProgress > 0 ? 'true' : 'false'
      section.dataset.signalStage =
        scrollProgress >= SIGNAL_START ? 'glitch' : 'off'
      updateCableGeometry(innerBounds)
    }

    const scheduleScrollUpdate = (): void => {
      if (animationFrame === 0) {
        animationFrame = window.requestAnimationFrame(updateScrollStyles)
      }
    }

    scheduleScrollUpdateRef.current = scheduleScrollUpdate

    const resizeObserver = new ResizeObserver(scheduleScrollUpdate)
    resizeObserver.observe(section)
    resizeObserver.observe(inner)
    resizeObserver.observe(scene)
    window.addEventListener('resize', scheduleScrollUpdate)
    window.addEventListener('scroll', scheduleScrollUpdate, { passive: true })
    desktopLayout.addEventListener('change', scheduleScrollUpdate)
    reducedMotion.addEventListener('change', scheduleScrollUpdate)
    updateScrollStyles()

    return () => {
      if (animationFrame !== 0) {
        window.cancelAnimationFrame(animationFrame)
      }
      resizeObserver.disconnect()
      window.removeEventListener('resize', scheduleScrollUpdate)
      window.removeEventListener('scroll', scheduleScrollUpdate)
      desktopLayout.removeEventListener('change', scheduleScrollUpdate)
      reducedMotion.removeEventListener('change', scheduleScrollUpdate)
      scheduleScrollUpdateRef.current = () => undefined
      resetScrollStyles()
    }
  }, [])

  const handleSlotActivate = useCallback(
    (slotIndex: number): void => {
      if (slots[slotIndex]?.skill) {
        setActiveSlot(slotIndex)
      }
    },
    [slots]
  )

  const changePage = useCallback(
    (direction: -1 | 1): void => {
      setActivePage((currentPage) => {
        const nextPage = currentPage + direction
        return (nextPage + pageCount) % pageCount
      })
      setActiveSlot(0)
    },
    [pageCount]
  )

  const showPreviousPage = useCallback((): void => {
    changePage(-1)
  }, [changePage])

  const showNextPage = useCallback((): void => {
    changePage(1)
  }, [changePage])

  return (
    <section
      aria-labelledby="technologies-title"
      className={styles.section}
      id="technologies"
      ref={sectionRef}
    >
      <div className={styles.inner} data-reveal ref={innerRef}>
        <svg
          aria-hidden="true"
          className={styles.usbCable}
          preserveAspectRatio="none"
          ref={cableSvgRef}
          viewBox="0 0 1 1"
        >
          <path
            className={styles.usbCableCore}
            pathLength="1"
            ref={cableCoreRef}
          />
        </svg>

        {activeSkill ? (
          <div
            aria-atomic="true"
            aria-live="polite"
            className={styles.techDisplay}
            style={{ color: displayAccent }}
          >
            <div className={styles.techMonitor} ref={monitorRef}>
              <svg
                aria-hidden="true"
                className={styles.techMonitorFrame}
                preserveAspectRatio="none"
                viewBox="0 0 640 280"
              >
                <defs>
                  <linearGradient
                    id="monitor-shell"
                    x1="0"
                    x2="0"
                    y1="0"
                    y2="1"
                  >
                    <stop offset="0" stopColor="#33363a" />
                    <stop offset="0.45" stopColor="#1a1c1f" />
                    <stop offset="1" stopColor="#0f1012" />
                  </linearGradient>
                  <linearGradient id="monitor-edge" x1="0" x2="1" y1="0" y2="1">
                    <stop offset="0" stopColor="#686c71" />
                    <stop offset="0.35" stopColor="#272a2e" />
                    <stop offset="1" stopColor="#08090a" />
                  </linearGradient>
                  <radialGradient cx="50%" cy="42%" id="monitor-screen" r="75%">
                    <stop offset="0" stopColor="#17191d" />
                    <stop offset="1" stopColor="#0a0b0d" />
                  </radialGradient>
                </defs>
                <rect
                  fill="url(#monitor-shell)"
                  height="272"
                  rx="34"
                  stroke="url(#monitor-edge)"
                  strokeWidth="8"
                  width="632"
                  x="4"
                  y="4"
                />
                <rect
                  fill="url(#monitor-screen)"
                  height="224"
                  rx="18"
                  stroke="#050607"
                  strokeWidth="5"
                  width="584"
                  x="28"
                  y="28"
                />
                <path
                  d="M52 36H588"
                  opacity="0.3"
                  stroke="#a9adb3"
                  strokeLinecap="round"
                  strokeWidth="2"
                />
              </svg>

              <div className={styles.techMonitorScreen}>
                <TechScreenContent
                  className={styles.techContentPrimary}
                  skill={activeSkill}
                />
                <TechScreenContent
                  ariaHidden
                  className={`${styles.techSignalGhost} ${styles.techSignalGhostWarm}`}
                  skill={activeSkill}
                />
                <TechScreenContent
                  ariaHidden
                  className={`${styles.techSignalGhost} ${styles.techSignalGhostCool}`}
                  skill={activeSkill}
                />
              </div>
            </div>
          </div>
        ) : null}

        <div className={styles.copy}>
          <p className={styles.kicker}>TECHNOLOGIES / 24-KEY MACRO PAD</p>
          <h2 id="technologies-title">Learn more. Understand more.</h2>
          <p className={styles.description}>学的东西 说不定什么时候就用上了</p>

          <div className={styles.controls}>
            {pageCount > 1 ? (
              <div className={styles.pagination}>
                <button
                  aria-label="上一页技术"
                  className={styles.pageButton}
                  onClick={showPreviousPage}
                  type="button"
                >
                  <ChevronLeftIcon aria-hidden="true" />
                </button>
                <span>
                  {activePage + 1} / {pageCount}
                </span>
                <button
                  aria-label="下一页技术"
                  className={styles.pageButton}
                  onClick={showNextPage}
                  type="button"
                >
                  <ChevronRightIcon aria-hidden="true" />
                </button>
              </div>
            ) : null}
          </div>
        </div>

        <div className={styles.scene} ref={sceneRef}>
          <span
            aria-hidden="true"
            className={styles.keyboardConnectorAnchor}
            ref={keyboardConnectorRef}
          />
          <TechnologiesKeyboardCanvas
            activeSlot={activeSlot}
            connectorAnchorRef={keyboardConnectorRef}
            onConnectorPositionChange={handleConnectorPositionChange}
            onSlotActivate={handleSlotActivate}
            presentationProgressRef={presentationProgressRef}
            slots={slots}
          />
        </div>
      </div>
    </section>
  )
}
