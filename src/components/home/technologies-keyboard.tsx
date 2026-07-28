'use client'

import {
  ChevronLeftIcon,
  ChevronRightIcon,
  Volume2Icon,
  VolumeXIcon,
} from 'lucide-react'
import dynamic from 'next/dynamic'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { TECHNOLOGIES_PER_PAGE, technologySkills } from './technologies-config'
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

export function TechnologiesKeyboard() {
  const [activePage, setActivePage] = useState(0)
  const [activeSlot, setActiveSlot] = useState<number | null>(null)
  const [soundEnabled, setSoundEnabled] = useState(true)
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

  const handleHoveredSlotChange = useCallback(
    (slotIndex: number | null): void => {
      setActiveSlot(slotIndex)
    },
    []
  )

  const changePage = useCallback(
    (direction: -1 | 1): void => {
      setActivePage((currentPage) => {
        const nextPage = currentPage + direction
        return (nextPage + pageCount) % pageCount
      })
      setActiveSlot(null)
    },
    [pageCount]
  )

  const showPreviousPage = useCallback((): void => {
    changePage(-1)
  }, [changePage])

  const showNextPage = useCallback((): void => {
    changePage(1)
  }, [changePage])

  const toggleSound = useCallback((): void => {
    setSoundEnabled((enabled) => {
      const nextValue = !enabled

      if (nextValue) {
        unlockKeyboardAudio()
      }

      return nextValue
    })
  }, [])

  return (
    <section
      aria-labelledby="technologies-title"
      className={styles.section}
      id="technologies"
    >
      <div className={styles.inner} data-reveal>
        <div className={styles.copy}>
          <p className={styles.kicker}>TECHNOLOGIES / 24-KEY MACRO PAD</p>
          <h2 id="technologies-title">Read more. Understand more.</h2>
          <p className={styles.description}>
            每个技能都是一个独立键位。悬停会压下键帽；首次点击或轻触后，还会听见短促的机械轴体声。
          </p>

          <div className={styles.controls}>
            <button
              aria-pressed={soundEnabled}
              className={styles.soundButton}
              onClick={toggleSound}
              type="button"
            >
              {soundEnabled ? (
                <Volume2Icon aria-hidden="true" />
              ) : (
                <VolumeXIcon aria-hidden="true" />
              )}
              键音 {soundEnabled ? '开启' : '关闭'}
            </button>

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

        <div className={styles.scene}>
          <TechnologiesKeyboardCanvas
            activeSlot={activeSlot}
            onHoveredSlotChange={handleHoveredSlotChange}
            slots={slots}
            soundEnabled={soundEnabled}
          />
        </div>
      </div>
    </section>
  )
}
