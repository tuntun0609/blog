'use client'

import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import dynamic from 'next/dynamic'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { TECHNOLOGIES_PER_PAGE, technologySkills } from './technologies-config'
import { unlockKeyboardAudio } from './technologies-keyboard-audio'
import type {
  KeyboardCableOrigin,
  TechnologySlot,
} from './technologies-keyboard-model'
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
const USB_CABLE_FALLBACK_ORIGIN: KeyboardCableOrigin = {
  xRatio: 0.5,
  yRatio: 0.33,
}
const USB_CABLE_EXIT_LIFT_PX = 30
const USB_CABLE_MAX_SIDE_REACH_PX = 192
const USB_CABLE_MINIMUM_VISIBLE_PROGRESS = 0.002
const USB_CABLE_PLUG_HIDE_DEPTH_PX = 24
const USB_CABLE_SIDE_REACH_RATIO = 0.18
const USB_CABLE_FADE_DISTANCE_PX = 24
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

export function TechnologiesKeyboard() {
  const sectionRef = useRef<HTMLElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<HTMLDivElement>(null)
  const techDisplayRef = useRef<HTMLDivElement>(null)
  const usbCableRef = useRef<SVGSVGElement>(null)
  const usbCablePlugRef = useRef<SVGGElement>(null)
  const usbCableOriginRef = useRef<KeyboardCableOrigin>(
    USB_CABLE_FALLBACK_ORIGIN
  )
  const scheduleCableGeometryUpdateRef = useRef<() => void>(() => undefined)
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
  const handleCableOriginChange = useCallback(
    (origin: KeyboardCableOrigin): void => {
      usbCableOriginRef.current = origin
      scheduleCableGeometryUpdateRef.current()
    },
    []
  )
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
    const techDisplay = techDisplayRef.current
    const usbCable = usbCableRef.current
    const usbCablePlug = usbCablePlugRef.current

    if (
      !(section && inner && scene && techDisplay && usbCable && usbCablePlug)
    ) {
      return
    }

    const desktopLayout = window.matchMedia(DESKTOP_LAYOUT_QUERY)
    const reducedMotion = window.matchMedia(REDUCED_MOTION_QUERY)
    let animationFrame = 0

    const updateUsbCableGeometry = (cableProgress: number): void => {
      const cableIsVisible = cableProgress > USB_CABLE_MINIMUM_VISIBLE_PROGRESS

      usbCable.style.visibility = cableIsVisible ? 'visible' : 'hidden'

      const innerBounds = inner.getBoundingClientRect()
      const sceneBounds = scene.getBoundingClientRect()
      const cableOrigin = usbCableOriginRef.current
      const keyboardAnchorX =
        sceneBounds.left -
        innerBounds.left +
        sceneBounds.width * cableOrigin.xRatio
      const keyboardAnchorY =
        sceneBounds.top -
        innerBounds.top +
        sceneBounds.height * cableOrigin.yRatio
      const monitorCenterX = techDisplay.offsetLeft
      const monitorBottomY =
        techDisplay.offsetTop + techDisplay.offsetHeight * 0.5
      const monitorEntryY = monitorBottomY - USB_CABLE_PLUG_HIDE_DEPTH_PX
      const sideReach = Math.min(
        innerBounds.width * USB_CABLE_SIDE_REACH_RATIO,
        USB_CABLE_MAX_SIDE_REACH_PX
      )
      const cablePathData = [
        `M ${keyboardAnchorX} ${keyboardAnchorY}`,
        `C ${keyboardAnchorX} ${keyboardAnchorY - USB_CABLE_EXIT_LIFT_PX}`,
        `${monitorCenterX + sideReach} ${monitorBottomY + USB_CABLE_EXIT_LIFT_PX}`,
        `${monitorCenterX} ${monitorEntryY}`,
      ].join(' ')
      const cablePaths = usbCable.querySelectorAll<SVGPathElement>(
        '[data-usb-cable-path]'
      )

      for (const cablePath of cablePaths) {
        cablePath.setAttribute('d', cablePathData)
      }

      const drawingPath = cablePaths.item(0)

      if (!(drawingPath && cableIsVisible)) {
        usbCable.style.opacity = '0'
        usbCablePlug.style.opacity = '0'
        return
      }

      const cableLength = drawingPath.getTotalLength()
      const revealedCableLength = cableLength * cableProgress
      const cableOpacity = clampProgress(
        revealedCableLength / USB_CABLE_FADE_DISTANCE_PX
      )

      for (const cablePath of cablePaths) {
        cablePath.style.strokeDasharray = `${revealedCableLength} ${cableLength}`
        cablePath.style.strokeDashoffset = '0'
      }

      const plugDistance = Math.max(
        0,
        Math.min(cableLength, cableLength * cableProgress)
      )
      const plugPosition = drawingPath.getPointAtLength(plugDistance)
      const previousPosition = drawingPath.getPointAtLength(
        Math.max(0, plugDistance - 2)
      )
      const plugAngleRadians = Math.atan2(
        plugPosition.y - previousPosition.y,
        plugPosition.x - previousPosition.x
      )

      usbCable.style.opacity = String(cableOpacity)
      usbCablePlug.style.opacity = '1'
      usbCablePlug.style.transform = `translate(${plugPosition.x}px, ${plugPosition.y}px) rotate(${plugAngleRadians}rad)`
    }

    const resetScrollStyles = (): void => {
      presentationProgressRef.current = 0
      section.style.removeProperty('--keyboard-copy-opacity')
      section.style.removeProperty('--keyboard-copy-translate-y')
      section.style.removeProperty('--keyboard-translate-x')
      section.style.removeProperty('--keyboard-translate-y')
      section.style.removeProperty('--keyboard-scale')
      section.style.removeProperty('--usb-cable-progress')
      delete section.dataset.scrollStage
      delete section.dataset.keyboardFacing
      updateUsbCableGeometry(0)
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
      const copyProgress = getSegmentProgress(scrollProgress, 0.08, 0.52)
      const sceneProgress = getSegmentProgress(scrollProgress, 0.08, 0.82)
      const cableProgress = getSegmentProgress(scrollProgress, 0.16, 0.84)
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
      section.style.setProperty('--usb-cable-progress', String(cableProgress))
      section.dataset.scrollStage = copyProgress > 0.96 ? 'keyboard' : 'details'
      section.dataset.keyboardFacing = sceneProgress > 0.96 ? 'true' : 'false'
      updateUsbCableGeometry(cableProgress)
    }

    const scheduleScrollUpdate = (): void => {
      if (animationFrame === 0) {
        animationFrame = window.requestAnimationFrame(updateScrollStyles)
      }
    }

    const resizeObserver = new ResizeObserver(scheduleScrollUpdate)
    scheduleCableGeometryUpdateRef.current = scheduleScrollUpdate
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
      scheduleCableGeometryUpdateRef.current = () => undefined
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
        {activeSkill ? (
          <div
            aria-atomic="true"
            aria-live="polite"
            className={styles.techDisplay}
            ref={techDisplayRef}
            style={{ color: displayAccent }}
          >
            <div className={styles.techMonitor}>
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
                <p className={styles.techMonitorLabel}>
                  TECHNOLOGIES / 24-KEY MACRO PAD
                </p>
                <div className={styles.techProjection} key={activeSkill.id}>
                  <div className={styles.techReadout}>
                    <svg
                      aria-hidden="true"
                      className={styles.techLogo}
                      viewBox="0 0 24 24"
                    >
                      <path d={activeSkill.iconPath} />
                    </svg>
                    <div className={styles.techText}>
                      <p className={styles.techName}>{activeSkill.name}</p>
                      <p className={styles.techDescription}>
                        {activeSkill.description}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <svg aria-hidden="true" className={styles.usbCable} ref={usbCableRef}>
          <defs>
            <linearGradient
              id="keyboard-usb-cable-sheath"
              x1="0"
              x2="0"
              y1="0"
              y2="1"
            >
              <stop offset="0" stopColor="#4c5056" />
              <stop offset="0.48" stopColor="#25282c" />
              <stop offset="1" stopColor="#111316" />
            </linearGradient>
            <linearGradient
              id="keyboard-usb-connector-metal"
              x1="0"
              x2="1"
              y1="0"
              y2="0"
            >
              <stop offset="0" stopColor="#72777d" />
              <stop offset="0.5" stopColor="#d7dadd" />
              <stop offset="1" stopColor="#73787e" />
            </linearGradient>
          </defs>
          <path
            className={`${styles.usbCablePath} ${styles.usbCableShadow}`}
            data-usb-cable-path
          />
          <path
            className={`${styles.usbCablePath} ${styles.usbCableSheath}`}
            data-usb-cable-path
          />
          <path
            className={`${styles.usbCablePath} ${styles.usbCableHighlight}`}
            data-usb-cable-path
          />
          <g className={styles.usbCablePlug} ref={usbCablePlugRef}>
            <rect
              className={styles.usbConnectorBoot}
              height="12"
              rx="6"
              width="22"
              x="0"
              y="-6"
            />
            <rect
              className={styles.usbConnectorMetal}
              height="8"
              rx="2.5"
              width="10"
              x="14"
              y="-4"
            />
            <path className={styles.usbConnectorSeam} d="M 17 -2.25 V 2.25" />
          </g>
        </svg>

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
          <TechnologiesKeyboardCanvas
            activeSlot={activeSlot}
            onCableOriginChange={handleCableOriginChange}
            onSlotActivate={handleSlotActivate}
            presentationProgressRef={presentationProgressRef}
            slots={slots}
          />
        </div>
      </div>
    </section>
  )
}
