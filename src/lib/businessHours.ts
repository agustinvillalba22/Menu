import type { PublicBusinessHours } from './types'

/**
 * Formatting helpers for the public menu's local-info block (Fase 1d — P6).
 *
 * The backend exposes ``is_open_now`` (computed server-side in the
 * restaurant's tz) so the front-end never has to guess the open/closed state.
 * What the front-end *does* need to render is the textual schedule summary
 * underneath the pill — and how to pick "today's" hours (the row matching the
 * restaurant's *current* weekday, not the viewer's), which is why
 * ``todayWeekday`` here is server-derived (passed in by `PublicMenuPage`
 * computed from ``restaurant.is_open_now`` ... actually no, weekday selection
 * needs a tz we don't have client-side).
 *
 * Decision: the public summary renders ALL hours the owner set, grouped by
 * consecutive weekdays sharing the same open/close window (so "Lun-Vie
 * 09-18" reads as one line, not five). The user scanning the header gets the
 * whole schedule in one glance. "Today" highlight is intentionally omitted
 * — without the restaurant's tz in the browser, the highlight would be wrong
 * for any customer in a different tz than the owner, and showing a wrong
 * "today" is worse than showing no "today".
 */

const WEEKDAY_ABBR = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

/**
 * Drop the seconds part of "HH:MM:SS" so the schedule reads naturally.
 * Returns the input untouched if it doesn't match the expected shape.
 */
export function formatTimeOfDay(value: string): string {
  // The backend ships the time as `HH:MM:SS` (Pydantic's default for
  // `datetime.time`). Trimming to `HH:MM` keeps remote-menu readers from
  // parsing ":00" as odd — and is a no-op if the backend ever drops seconds.
  const m = /^(\d{2}:\d{2})/.exec(value)
  return m ? m[1] : value
}

interface _GroupedHours {
  days: number[] // weekday ints in this contiguous run
  open_time: string
  close_time: string
}

/**
 * Group consecutive weekdays sharing the same open/close window so a "Lun-Vie
 * 09-18" owner sees one chip, not five. Wraps at week-end (Sun 6 → Mon 0) so
 * a 7-day same-window restaurant condenses to "Lun-Dom".
 */
function _group_hours(rows: PublicBusinessHours[]): _GroupedHours[] {
  if (rows.length === 0) return []
  const sorted = [...rows].sort((a, b) => a.weekday - b.weekday)
  const groups: _GroupedHours[] = []
  for (const row of sorted) {
    const last = groups[groups.length - 1]
    if (
      last
      // Same window AND weekday directly follows the previous one (allowing
      // the wrap-around 6 → 0 only when this is the run that includes Mon 0).
      && last.open_time === row.open_time
      && last.close_time === row.close_time
      && (last.days[last.days.length - 1] + 1) % 7 === row.weekday
      // Don't merge across the week-wrap unless it's a 7-day span: otherwise
      // a 5-day Mon-Fri run followed by a lone Sunday would wrongly absorb
      // Monday again.
      && last.days.length + 1 <= 7
    ) {
      last.days.push(row.weekday)
    } else {
      groups.push({
        days: [row.weekday],
        open_time: row.open_time,
        close_time: row.close_time,
      })
    }
  }
  return groups
}

function _label_days(days: number[]): string {
  if (days.length === 1) return WEEKDAY_ABBR[days[0]] ?? String(days[0])
  // Two consecutive days → "Lun-Mar"; longer runs → "Lun-Vie".
  const first = WEEKDAY_ABBR[days[0]] ?? String(days[0])
  const last = WEEKDAY_ABBR[days[days.length - 1]] ?? String(days[days.length - 1])
  return `${first}-${last}`
}

/**
 * Build the one-line textual schedule for the public header, e.g.
 * "Lun-Vie 09:00-18:00, Sáb 11:00-23:30". Empty string when there are no
 * rows — the caller should hide the schedule line entirely in that case.
 */
export function formatSchedule(rows: PublicBusinessHours[]): string {
  return _group_hours(rows)
    .map(
      (g) =>
        `${_label_days(g.days)} ${formatTimeOfDay(g.open_time)}-${formatTimeOfDay(g.close_time)}`,
    )
    .join(', ')
}