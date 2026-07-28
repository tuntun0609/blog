'use client'

import {
  ChevronLeftIcon,
  ChevronRightIcon,
  Volume2Icon,
  VolumeXIcon,
} from 'lucide-react'
import dynamic from 'next/dynamic'
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
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

const createSkillStyle = (keyColor: string, iconColor: string): CSSProperties =>
  ({
    '--skill-color': keyColor,
    '--skill-icon-color': iconColor,
  }) as CSSProperties

interface TechnologyLegendItemProps {
  readonly active: boolean
  readonly onActivate: (slotIndex: number) => void
  readonly onDeactivate: () => void
  readonly skill: TechnologySkill
  readonly slotIndex: number
}

function TechnologyLegendItem({
  active,
  onActivate,
  onDeactivate,
  skill,
  slotIndex,
}: TechnologyLegendItemProps) {
  const activate = useCallback((): void => {
    onActivate(slotIndex)
  }, [onActivate, slotIndex])

  return (
    <li>
      <button
        aria-label={`${skill.name}：${skill.description}`}
        className={styles.legendButton}
        data-active={active}
        onBlur={onDeactivate}
        onFocus={activate}
        onPointerEnter={activate}
        onPointerLeave={onDeactivate}
        style={createSkillStyle(skill.keyColor, skill.iconColor)}
        type="button"
      >
        <span aria-hidden="true" className={styles.legendIcon}>
          <svg viewBox="0 0 24 24">
            <title>{skill.name}</title>
            <path d={skill.iconPath} />
          </svg>
        </span>
        <span className={styles.legendName}>{skill.name}</span>
      </button>
    </li>
  )
}

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

  const handleSkillActivate = useCallback((slotIndex: number): void => {
    setActiveSlot(slotIndex)
  }, [])

  const handleSkillDeactivate = useCallback((): void => {
    setActiveSlot(null)
  }, [])

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
          <h2 id="technologies-title">把日常技术栈，放进一把会回应的键盘。</h2>
          <p className={styles.description}>
            每个技能都是一个独立键位。悬停会压下键帽；首次点击或轻触后，还会听见短促的机械轴体声。
          </p>

          <div className={styles.meta}>
            <span>
              {technologySkills.length} 项已配置 · {TECHNOLOGIES_PER_PAGE}{' '}
              个键位
            </span>
            <span>继续向配置数组添加即可扩展</span>
          </div>

          <ul aria-label="当前页技术栈" className={styles.legend}>
            {visibleSkills.map((skill, slotIndex) => (
              <TechnologyLegendItem
                active={activeSlot === slotIndex}
                key={skill.id}
                onActivate={handleSkillActivate}
                onDeactivate={handleSkillDeactivate}
                skill={skill}
                slotIndex={slotIndex}
              />
            ))}
          </ul>

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
