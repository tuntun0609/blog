'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { type Activity, ActivityCalendar } from 'react-activity-calendar'
import 'react-activity-calendar/tooltips.css'
import { useTheme } from 'next-themes'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import styles from './github-activity.module.css'

const ACTIVITY_API_URL =
  'https://github-contributions-api.jogruber.de/v4/tuntun0609'
const ACTIVITY_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u
const VISIBLE_YEAR_COUNT = 2
const CURRENT_YEAR = new Date().getFullYear()
const YEAR_OPTIONS = Array.from(
  { length: VISIBLE_YEAR_COUNT },
  (_, index) => CURRENT_YEAR - index
)

const CALENDAR_THEME = {
  dark: ['#20242a', '#1f402c', '#2f6a42', '#4a965f', '#72c08b'],
  light: ['#e8edf2', '#d8ebde', '#acd4b7', '#75b888', '#4e9a68'],
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

    const fetchActivities = async () => {
      setStatus('loading')

      try {
        const apiYear = selectedYear === CURRENT_YEAR ? 'last' : selectedYear
        const response = await fetch(`${ACTIVITY_API_URL}?y=${apiYear}`, {
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error(
            `GitHub contribution request failed: ${response.status}`
          )
        }

        const responseData: unknown = await response.json()
        setActivities(parseActivities(responseData))
        setStatus('ready')
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return
        }

        setStatus('error')
      }
    }

    fetchActivities()

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
        {status === 'loading' ? (
          <p aria-live="polite" className={styles.stateMessage}>
            正在读取 GitHub 活动…
          </p>
        ) : null}

        {status === 'error' ? (
          <p aria-live="polite" className={styles.stateMessage}>
            暂时无法读取 GitHub 活动，请稍后再试。
          </p>
        ) : null}

        {status === 'ready' ? (
          <>
            <section
              aria-label={`${periodLabel} GitHub 贡献日历`}
              className={styles.scrollArea}
              ref={scrollAreaRef}
            >
              <div className={styles.calendarCanvas}>
                <ActivityCalendar
                  blockMargin={4}
                  blockRadius={2}
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
          </>
        ) : null}
      </div>
    </div>
  )
}
