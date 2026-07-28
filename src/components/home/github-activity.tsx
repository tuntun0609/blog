'use client'

import { useTheme } from 'next-themes'
import { useCallback, useEffect, useRef, useState } from 'react'
import { type Activity, ActivityCalendar } from 'react-activity-calendar'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import styles from './github-activity.module.css'

import 'react-activity-calendar/tooltips.css'

const ACTIVITY_API_URL =
  'https://github-contributions-api.jogruber.de/v4/tuntun0609'
const ACTIVITY_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u
const ISO_DATE_LENGTH = 10
const MILLISECONDS_PER_MINUTE = 60_000
const VISIBLE_YEAR_COUNT = 2
const CURRENT_YEAR = new Date().getFullYear()
const YEAR_OPTIONS = Array.from(
  { length: VISIBLE_YEAR_COUNT },
  (_, index) => CURRENT_YEAR - index
)

const CALENDAR_THEME = {
  dark: ['#161b22', '#0e4429', '#006d32', '#26a641', '#39d353'],
  light: ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'],
}

const CALENDAR_LABELS = {
  legend: {
    less: '少',
    more: '多',
  },
  months: [
    '1月',
    '2月',
    '3月',
    '4月',
    '5月',
    '6月',
    '7月',
    '8月',
    '9月',
    '10月',
    '11月',
    '12月',
  ],
  weekdays: ['日', '一', '二', '三', '四', '五', '六'],
}

const activityDateFormatter = new Intl.DateTimeFormat('zh-CN', {
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
  year: 'numeric',
})

const contributionNumberFormatter = new Intl.NumberFormat('zh-CN')

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const parseActivities = (value: unknown): Activity[] => {
  if (!(isRecord(value) && Array.isArray(value.contributions))) {
    throw new Error('GitHub contribution response is missing activity data')
  }

  return value.contributions.map((contribution) => {
    if (!isRecord(contribution)) {
      throw new Error('GitHub contribution response contains an invalid entry')
    }

    const { count, date, level } = contribution
    const hasValidCount =
      typeof count === 'number' && Number.isInteger(count) && count >= 0
    const hasValidDate =
      typeof date === 'string' && ACTIVITY_DATE_PATTERN.test(date)
    const hasValidLevel =
      typeof level === 'number' &&
      Number.isInteger(level) &&
      level >= 0 &&
      level <= 4

    if (!(hasValidCount && hasValidDate && hasValidLevel)) {
      throw new Error('GitHub contribution response contains an invalid entry')
    }

    return { count, date, level }
  })
}

const requestActivities = async (
  year: number | 'last',
  signal: AbortSignal
): Promise<Activity[]> => {
  const response = await fetch(`${ACTIVITY_API_URL}?y=${year}`, { signal })

  if (!response.ok) {
    throw new Error(`GitHub contribution request failed: ${response.status}`)
  }

  const responseData: unknown = await response.json()
  return parseActivities(responseData)
}

const getCurrentActivityDate = (): string => {
  const currentDate = new Date()
  const localDate = new Date(
    currentDate.getTime() -
      currentDate.getTimezoneOffset() * MILLISECONDS_PER_MINUTE
  )

  return localDate.toISOString().slice(0, ISO_DATE_LENGTH)
}

const mergeCurrentDayActivity = (
  lastYearActivities: Activity[],
  currentYearActivities: Activity[]
): Activity[] => {
  const currentDate = getCurrentActivityDate()
  const currentDayActivity = currentYearActivities.find(
    (activity) => activity.date === currentDate
  )

  if (!currentDayActivity) {
    return lastYearActivities
  }

  return [
    ...lastYearActivities.filter((activity) => activity.date !== currentDate),
    currentDayActivity,
  ]
}

const formatActivityTooltip = (activity: Activity): string => {
  const date = new Date(`${activity.date}T00:00:00Z`)
  return `${activityDateFormatter.format(date)} · ${activity.count} 次贡献`
}

export function GithubActivity() {
  const { resolvedTheme } = useTheme()
  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR)
  const [activities, setActivities] = useState<Activity[]>([])
  const [status, setStatus] = useState<'error' | 'loading' | 'ready'>('loading')
  const scrollAreaRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const controller = new AbortController()

    const loadActivities = async () => {
      setStatus('loading')

      try {
        const apiYear = selectedYear === CURRENT_YEAR ? 'last' : selectedYear
        const nextActivities =
          selectedYear === CURRENT_YEAR
            ? mergeCurrentDayActivity(
                ...(await Promise.all([
                  requestActivities(apiYear, controller.signal),
                  requestActivities(selectedYear, controller.signal),
                ]))
              )
            : await requestActivities(apiYear, controller.signal)

        setActivities(nextActivities)
        setStatus('ready')
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return
        }

        setStatus('error')
      }
    }

    loadActivities()

    return () => controller.abort()
  }, [selectedYear])

  useEffect(() => {
    if (status !== 'ready') {
      return
    }

    const frameId = window.requestAnimationFrame(() => {
      const scrollArea = scrollAreaRef.current
      if (scrollArea) {
        scrollArea.scrollLeft = scrollArea.scrollWidth
      }
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [activities, status])

  const handleYearChange = useCallback((values: string[]) => {
    const [nextYearValue] = values
    if (!nextYearValue) {
      return
    }

    const nextYear = Number(nextYearValue)
    if (YEAR_OPTIONS.includes(nextYear)) {
      setSelectedYear(nextYear)
    }
  }, [])

  const contributionCount = activities.reduce(
    (total, activity) => total + activity.count,
    0
  )
  const periodLabel =
    selectedYear === CURRENT_YEAR ? '最近一年' : `${selectedYear} 年`
  const hasActivityData = activities.length > 0

  return (
    <div className={styles.activity} data-delay="1" data-reveal>
      <div className={styles.toolbar}>
        <div>
          <p className={styles.label}>CONTRIBUTION GRAPH</p>
          <h3>GitHub Activity</h3>
        </div>

        <ToggleGroup
          aria-label="选择 GitHub 活动年份"
          className={styles.yearToggle}
          onValueChange={handleYearChange}
          size="sm"
          value={[String(selectedYear)]}
          variant="outline"
        >
          {YEAR_OPTIONS.map((year) => (
            <ToggleGroupItem
              aria-label={`查看 ${year} 年 GitHub 活动`}
              key={year}
              value={String(year)}
            >
              {year}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <div className={styles.panel}>
        <p
          aria-hidden={status !== 'loading'}
          aria-live="polite"
          className={`${styles.stateMessage} ${styles.panelState}`}
          data-active={status === 'loading'}
        >
          正在读取 GitHub 活动…
        </p>

        <p
          aria-hidden={status !== 'error'}
          aria-live="polite"
          className={`${styles.stateMessage} ${styles.panelState}`}
          data-active={status === 'error'}
        >
          暂时无法读取 GitHub 活动，请稍后再试。
        </p>

        {hasActivityData ? (
          <div
            aria-hidden={status !== 'ready'}
            className={styles.panelState}
            data-active={status === 'ready'}
          >
            <section
              aria-label={`${periodLabel} GitHub 贡献日历`}
              className={styles.scrollArea}
              ref={scrollAreaRef}
            >
              <div className={styles.calendarCanvas}>
                <ActivityCalendar
                  blockMargin={4}
                  blockRadius={3}
                  blockSize={12}
                  className={styles.calendar}
                  colorScheme={resolvedTheme === 'dark' ? 'dark' : 'light'}
                  data={activities}
                  fontSize={11}
                  labels={CALENDAR_LABELS}
                  showColorLegend={false}
                  showTotalCount={false}
                  showWeekdayLabels={['mon', 'wed', 'fri']}
                  theme={CALENDAR_THEME}
                  tooltips={{
                    activity: {
                      offset: { mainAxis: 9 },
                      text: formatActivityTooltip,
                      withArrow: true,
                    },
                  }}
                />
              </div>
            </section>

            <p className={styles.summary}>
              <strong>
                {contributionNumberFormatter.format(contributionCount)}
              </strong>{' '}
              次贡献 · {periodLabel}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  )
}
