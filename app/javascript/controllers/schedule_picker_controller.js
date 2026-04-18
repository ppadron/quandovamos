import { Controller } from "@hotwired/stimulus"
import { DateTime } from "luxon"

// Horário de Brasília na interface; valores enviados em ISO UTC.
const ZONE = "America/Sao_Paulo"
const WEEKDAY_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"]
const TIMED_ROW_HEIGHT_PX = 48

export default class extends Controller {
  static targets = [
    "allDaySection",
    "timedSection",
    "timedDurationSection",
    "durationRange",
    "durationInput",
    "touchOverlayToggle",
    "hiddenInputs",
    "monthTitle",
    "monthGrid",
    "weekTitle",
    "weekGrid",
    "selectionCount"
  ]

  static values = {
    maxSlots: { type: Number, default: 20 },
    initialSelected: { type: Array, default: [] },
    startHour: { type: Number, default: 0 },
    endHour: { type: Number, default: 23 },
    selectionTemplate: { type: String, default: "%{count} de %{max} selecionados" },
    hourColumnLabel: { type: String, default: "Hora" }
  }

  connect() {
    this.form = this.element.closest("form")
    this.timedAddOverlayHideTimeouts = new Map()
    this.slotStyleAssignments = new Map()
    this.selected = new Set(
      (this.initialSelectedValue || []).map((s) => this.normalizeIso(s)).filter(Boolean)
    )

    this.monthCursor = DateTime.now().setZone(ZONE).startOf("month")
    this.weekStart = this.mondayOfWeekContaining(DateTime.now().setZone(ZONE))

    if (this.selected.size > 0) {
      const firstIso = this.selected.values().next().value
      const first = DateTime.fromISO(firstIso, { zone: "utc" })
      if (first.isValid) {
        const local = first.setZone(ZONE)
        this.monthCursor = local.startOf("month")
        this.weekStart = this.mondayOfWeekContaining(local)
      }
    }

    this.timedDayCount = this.visibleTimedDayCount()
    this.alwaysShowAddButtons = this.prefersTouchAddButtons()
    this.handleResize = this.handleResize.bind(this)
    window.addEventListener("resize", this.handleResize)

    if (this.hasTouchOverlayToggleTarget) {
      this.touchOverlayToggleTarget.checked = this.alwaysShowAddButtons
    }

    this.renderMonth()
    this.renderWeek()
    this.syncModeFromForm()
    this.syncDurationControls()
    this.refreshHiddenInputs()
    this.updateSelectionCount()
  }

  disconnect() {
    window.removeEventListener("resize", this.handleResize)
    this.timedAddOverlayHideTimeouts?.forEach((timeoutId) => window.clearTimeout(timeoutId))
  }

  normalizeIso(s) {
    if (!s) return null
    const d = DateTime.fromISO(String(s).trim(), { zone: "utc" })
    return d.isValid ? d.toUTC().toISO() : null
  }

  mondayOfWeekContaining(dt) {
    const d = dt.startOf("day")
    const wd = d.weekday
    const back = wd === 7 ? 6 : wd - 1
    return d.minus({ days: back })
  }

  nowInZone() {
    return DateTime.now().setZone(ZONE)
  }

  prefersTouchAddButtons() {
    if (typeof window === "undefined") return false
    const coarsePointer = window.matchMedia?.("(pointer: coarse)")?.matches
    return Boolean(coarsePointer || navigator.maxTouchPoints > 0 || "ontouchstart" in window)
  }

  visibleTimedDayCount() {
    if (typeof window === "undefined") return 7
    const width = window.innerWidth
    if (width < 768) return 1
    if (width < 1024) return 3
    return 7
  }

  handleResize() {
    const nextDayCount = this.visibleTimedDayCount()
    if (nextDayCount === this.timedDayCount) return

    if (nextDayCount === 7) {
      this.weekStart = this.mondayOfWeekContaining(this.weekStart)
    }

    this.timedDayCount = nextDayCount
    this.renderWeek()
  }

  highlightTimedRow(event) {
    const rowIndex =
      event.currentTarget.dataset.rowHoverIndex ||
      event.currentTarget.dataset.rowIndex ||
      event.currentTarget.dataset.triggerRowIndex
    if (rowIndex == null || !this.hasWeekGridTarget) return

    this.setTimedRowHighlight(rowIndex, true)
  }

  clearTimedRow(event) {
    const rowIndex =
      event.currentTarget.dataset.rowHoverIndex ||
      event.currentTarget.dataset.rowIndex ||
      event.currentTarget.dataset.triggerRowIndex
    if (rowIndex == null || !this.hasWeekGridTarget) return

    this.setTimedRowHighlight(rowIndex, false)
  }

  setTimedRowHighlight(rowIndex, highlighted) {
    if (rowIndex == null || !this.hasWeekGridTarget) return

    this.weekGridTarget
      .querySelectorAll(`[data-row-index="${rowIndex}"]`)
      .forEach((element) => element.classList.toggle("timed-slot-row-highlight", highlighted))
  }

  setTimedAddOverlayActive(iso, active) {
    this.timedAddOverlayForIso(iso)?.classList.toggle("timed-slot-add-overlay-active", active)
  }

  timedCellDateTime(dayIndex, rowIndex) {
    const rawStart = Number(this.startHourValue)
    const startH = Number.isFinite(rawStart) ? Math.max(0, Math.min(23, rawStart)) : 0
    return this.weekStart.plus({ days: dayIndex }).set({
      hour: startH + rowIndex,
      minute: 0,
      second: 0,
      millisecond: 0
    })
  }

  hoverTimedBlock(event) {
    const block = event.currentTarget
    const startRowIndex = parseInt(block.dataset.blockStartRowIndex, 10)
    const rowSpan = parseInt(block.dataset.blockRowSpan, 10)
    const dayIndex = parseInt(block.dataset.blockDayIndex, 10)
    if (!Number.isFinite(startRowIndex) || !Number.isFinite(rowSpan) || rowSpan < 1 || !Number.isFinite(dayIndex)) return

    const rect = block.getBoundingClientRect()
    const offsetY = Math.max(0, Math.min(event.clientY - rect.top, Math.max(rect.height - 1, 0)))
    const hoveredRowOffset = Math.min(rowSpan - 1, Math.floor(offsetY / TIMED_ROW_HEIGHT_PX))
    const nextRowIndex = startRowIndex + hoveredRowOffset
    const previousRowIndex = block.dataset.activeHoverRowIndex
    const previousCellIso = block.dataset.activeHoverCellIso
    const nextCell = this.timedCellDateTime(dayIndex, nextRowIndex)
    const nextCellIso = this.normalizeIso(nextCell.toUTC().toISO()) || nextCell.toUTC().toISO()

    if (previousRowIndex != null && previousRowIndex !== String(nextRowIndex)) {
      this.setTimedRowHighlight(previousRowIndex, false)
    }
    if (previousCellIso && previousCellIso !== nextCellIso) {
      this.setTimedAddOverlayActive(previousCellIso, false)
    }

    this.setTimedRowHighlight(nextRowIndex, true)
    block.dataset.activeHoverRowIndex = String(nextRowIndex)

    const blockHighlight = block.querySelector(".timed-slot-block-row-highlight")
    if (blockHighlight) {
      const highlightTop = (hoveredRowOffset * TIMED_ROW_HEIGHT_PX) - 2
      const clampedHighlightTop = Math.max(-2, highlightTop)
      const remainingHeight = rect.height - Math.max(clampedHighlightTop, 0)
      const targetHighlightHeight = hoveredRowOffset === 0 ? TIMED_ROW_HEIGHT_PX : TIMED_ROW_HEIGHT_PX + 4
      blockHighlight.style.top = `${clampedHighlightTop}px`
      blockHighlight.style.height = `${Math.min(targetHighlightHeight, remainingHeight)}px`
      blockHighlight.classList.add("timed-slot-block-row-highlight-active")
    }

    if (!this.selected.has(nextCellIso) && !this.isPastTimedStart(nextCell)) {
      this.setTimedAddOverlayActive(nextCellIso, true)
    }
    block.dataset.activeHoverCellIso = nextCellIso
  }

  leaveTimedBlock(event) {
    const block = event.currentTarget
    const previousRowIndex = block.dataset.activeHoverRowIndex
    const previousCellIso = block.dataset.activeHoverCellIso
    if (previousRowIndex != null) {
      this.setTimedRowHighlight(previousRowIndex, false)
      delete block.dataset.activeHoverRowIndex
    }
    if (previousCellIso) {
      this.setTimedAddOverlayActive(previousCellIso, false)
      delete block.dataset.activeHoverCellIso
    }

    block.querySelector(".timed-slot-block-row-highlight")?.classList.remove("timed-slot-block-row-highlight-active")
  }

  timedAddOverlayForIso(iso) {
    if (!iso || !this.hasWeekGridTarget) return null
    return this.weekGridTarget.querySelector(`[data-overlay-iso="${iso}"]`)
  }

  showTimedAddOverlay(event) {
    const iso = this.normalizeIso(event.currentTarget.dataset.iso)
    if (!iso) return

    const timeoutId = this.timedAddOverlayHideTimeouts.get(iso)
    if (timeoutId) {
      window.clearTimeout(timeoutId)
      this.timedAddOverlayHideTimeouts.delete(iso)
    }

    this.highlightTimedRow(event)
    this.timedAddOverlayForIso(iso)?.classList.add("timed-slot-add-overlay-active")
  }

  hideTimedAddOverlay(event) {
    const iso = this.normalizeIso(event.currentTarget.dataset.iso)
    if (!iso) {
      this.clearTimedRow(event)
      return
    }

    const existingTimeout = this.timedAddOverlayHideTimeouts.get(iso)
    if (existingTimeout) window.clearTimeout(existingTimeout)

    const timeoutId = window.setTimeout(() => {
      this.timedAddOverlayForIso(iso)?.classList.remove("timed-slot-add-overlay-active")
      this.timedAddOverlayHideTimeouts.delete(iso)
    }, 120)

    this.timedAddOverlayHideTimeouts.set(iso, timeoutId)
    this.clearTimedRow(event)
  }

  touchOverlayModeChanged(event) {
    this.alwaysShowAddButtons = !!event.currentTarget.checked
    this.renderWeek()
  }

  getDurationHours() {
    const el = this.hasDurationInputTarget
      ? this.durationInputTarget
      : this.form?.querySelector('input[name="event[duration_hours]"]')
    return this.clampDurationValue(el?.value)
  }

  clampDurationValue(value) {
    const n = parseInt(value, 10)
    if (!Number.isFinite(n)) return 1
    return Math.max(1, Math.min(8, n))
  }

  syncDurationControls(value = null) {
    const nextValue = this.clampDurationValue(value ?? this.durationInputTarget?.value)
    if (this.hasDurationRangeTarget) this.durationRangeTarget.value = String(nextValue)
    if (this.hasDurationInputTarget) this.durationInputTarget.value = String(nextValue)
    return nextValue
  }

  isPastAllDayDate(localDateTime) {
    return localDateTime.startOf("day") < this.nowInZone().startOf("day")
  }

  isPastTimedStart(localDateTime) {
    return localDateTime < this.nowInZone()
  }

  /** @param {string} utcIso */
  localHourStartFromUtcIso(utcIso) {
    return DateTime.fromISO(utcIso, { zone: "utc" }).setZone(ZONE).startOf("hour")
  }

  formatStartHourLabel(hour) {
    return String(hour).padStart(2, "0") + ":00"
  }

  formatSlotRangeLabelFromIso(utcIso) {
    const start = this.localHourStartFromUtcIso(utcIso)
    const end = start.plus({ hours: this.getDurationHours() })
    const label = `${start.toFormat("HH:mm")}-${end.toFormat("HH:mm")}`
    return end.day !== start.day ? `${label} (+1d)` : label
  }

  slotLayerPalette(order) {
    const palettes = [
      {
        style: "background-color:#dbeafe;background-image:repeating-linear-gradient(135deg, rgba(37,99,235,0.24) 0 6px, transparent 6px 12px);",
        labelStyle: "color:#172554;"
      },
      {
        style: "background-color:#ede9fe;background-image:repeating-linear-gradient(45deg, rgba(109,40,217,0.24) 0 6px, transparent 6px 12px);",
        labelStyle: "color:#3b0764;"
      },
      {
        style: "background-color:#d1fae5;background-image:repeating-linear-gradient(0deg, rgba(5,150,105,0.22) 0 4px, transparent 4px 9px);",
        labelStyle: "color:#022c22;"
      },
      {
        style: "background-color:#ffedd5;background-image:repeating-linear-gradient(90deg, rgba(234,88,12,0.22) 0 4px, transparent 4px 9px);",
        labelStyle: "color:#7c2d12;"
      },
      {
        style: "background-color:#fce7f3;background-image:radial-gradient(circle at 2px 2px, rgba(190,24,93,0.28) 1.2px, transparent 1.3px);background-size:10px 10px;",
        labelStyle: "color:#831843;"
      },
      {
        style: "background-color:#cffafe;background-image:linear-gradient(45deg, rgba(8,145,178,0.2) 25%, transparent 25%), linear-gradient(-45deg, rgba(8,145,178,0.2) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgba(8,145,178,0.2) 75%), linear-gradient(-45deg, transparent 75%, rgba(8,145,178,0.2) 75%);background-size:12px 12px;background-position:0 0, 0 6px, 6px -6px, -6px 0;",
        labelStyle: "color:#164e63;"
      },
      {
        style: "background-color:#ecfccb;background-image:linear-gradient(135deg, rgba(101,163,13,0.22) 12%, transparent 12%, transparent 50%, rgba(101,163,13,0.22) 50%, rgba(101,163,13,0.22) 62%, transparent 62%, transparent);background-size:14px 14px;",
        labelStyle: "color:#365314;"
      },
      {
        style: "background-color:#e5e7eb;background-image:repeating-linear-gradient(0deg, rgba(75,85,99,0.18) 0 2px, transparent 2px 8px), repeating-linear-gradient(90deg, rgba(75,85,99,0.18) 0 2px, transparent 2px 8px);",
        labelStyle: "color:#111827;"
      }
    ]
    return palettes[Math.min(order, palettes.length - 1)]
  }

  slotTimeRange(utcIso) {
    const start = this.localHourStartFromUtcIso(utcIso)
    return {
      start,
      end: start.plus({ hours: this.getDurationHours() })
    }
  }

  slotsOverlap(aUtcIso, bUtcIso) {
    const a = this.slotTimeRange(aUtcIso)
    const b = this.slotTimeRange(bUtcIso)
    return a.start < b.end && b.start < a.end
  }

  slotsNeedDifferentBackground(aUtcIso, bUtcIso) {
    const a = this.slotTimeRange(aUtcIso)
    const b = this.slotTimeRange(bUtcIso)
    const sequential = a.end.equals(b.start) || b.end.equals(a.start)
    return this.slotsOverlap(aUtcIso, bUtcIso) || sequential
  }

  selectedSlotLanes() {
    const lanesByIso = new Map()
    const laneSlots = Array.from({ length: 8 }, () => [])
    const sortedStarts = Array.from(this.selected).sort((aIso, bIso) => {
      const aStart = this.localHourStartFromUtcIso(aIso).toMillis()
      const bStart = this.localHourStartFromUtcIso(bIso).toMillis()
      return aStart - bStart
    })

    for (const startIso of sortedStarts) {
      let lane = 0
      while (lane < 8) {
        const conflicts = laneSlots[lane].some((existingIso) => this.slotsOverlap(startIso, existingIso))
        if (!conflicts) break
        lane += 1
      }
      lanesByIso.set(startIso, lane)
      if (lane < 8) laneSlots[lane].push(startIso)
    }

    return lanesByIso
  }

  selectedSlotStyles() {
    const sortedStarts = Array.from(this.selected).sort((aIso, bIso) => {
      const aStart = this.localHourStartFromUtcIso(aIso).toMillis()
      const bStart = this.localHourStartFromUtcIso(bIso).toMillis()
      return aStart - bStart
    })

    for (const iso of Array.from(this.slotStyleAssignments.keys())) {
      if (!this.selected.has(iso)) this.slotStyleAssignments.delete(iso)
    }

    const usageCounts = Array(8).fill(0)
    for (const startIso of sortedStarts) {
      const existingStyle = this.slotStyleAssignments.get(startIso)
      if (Number.isInteger(existingStyle) && existingStyle >= 0 && existingStyle < 8) {
        usageCounts[existingStyle] += 1
      }
    }

    for (const startIso of sortedStarts) {
      const existingStyle = this.slotStyleAssignments.get(startIso)
      if (Number.isInteger(existingStyle) && existingStyle >= 0 && existingStyle < 8) continue

      const conflictingStyles = new Set()

      for (const existingIso of sortedStarts) {
        if (existingIso === startIso) continue

        const assignedStyle = this.slotStyleAssignments.get(existingIso)
        if (!Number.isInteger(assignedStyle) || assignedStyle < 0 || assignedStyle >= 8) continue

        if (this.slotsOverlap(startIso, existingIso)) {
          conflictingStyles.add(assignedStyle)
        }
      }

      const availableStyles = Array.from({ length: 8 }, (_, index) => index)
        .filter((index) => !conflictingStyles.has(index))
        .sort((a, b) => usageCounts[a] - usageCounts[b] || a - b)

      const styleIndex = availableStyles[0] ?? 0
      usageCounts[styleIndex] += 1
      this.slotStyleAssignments.set(startIso, styleIndex)
    }

    return new Map(
      sortedStarts.map((startIso) => [startIso, { styleIndex: this.slotStyleAssignments.get(startIso) ?? 0 }])
    )
  }

  visibleTimedSlots(slotLanes, slotStyles, startH, endH, dayCount) {
    const weekStartDay = this.weekStart.startOf("day")
    const duration = this.getDurationHours()
    const visibleSlots = []

    for (const startIso of this.selected) {
      const start = this.localHourStartFromUtcIso(startIso)
      const end = start.plus({ hours: duration })
      const lane = slotLanes.get(startIso) ?? 0
      const styleIndex = slotStyles.get(startIso)?.styleIndex ?? 0
      let segmentStart = start
      let firstSegment = true

      while (segmentStart < end) {
        const dayStart = segmentStart.startOf("day")
        const nextDay = dayStart.plus({ days: 1 })
        const segmentEnd = end < nextDay ? end : nextDay
        const dayIndex = Math.round(dayStart.diff(weekStartDay, "days").days)

        if (dayIndex >= 0 && dayIndex < dayCount) {
          const segmentStartHour = segmentStart.hour
          const segmentEndHour = segmentEnd.equals(nextDay) ? 24 : segmentEnd.hour
          const clippedStartHour = Math.max(segmentStartHour, startH)
          const clippedEndHour = Math.min(segmentEndHour, endH + 1)

          if (clippedEndHour > clippedStartHour) {
            visibleSlots.push({
              startIso,
              dayIndex,
              lane,
              styleIndex,
              top: ((clippedStartHour - startH) * TIMED_ROW_HEIGHT_PX),
              height: ((clippedEndHour - clippedStartHour) * TIMED_ROW_HEIGHT_PX) - 4,
              firstSegment,
              label: this.formatSlotRangeLabelFromIso(startIso)
            })
          }
        }

        segmentStart = segmentEnd
        firstSegment = false
      }
    }

    return visibleSlots
  }

  isCellInSpanOfStart(cellUtcIso, startUtcIso) {
    const duration = this.getDurationHours()
    const start = this.localHourStartFromUtcIso(startUtcIso)
    const cell = this.localHourStartFromUtcIso(cellUtcIso)
    const end = start.plus({ hours: duration })
    return cell >= start && cell < end
  }

  coveringStartIsosForCell(cellUtcIso) {
    const owners = []
    for (const startIso of this.selected) {
      if (this.isCellInSpanOfStart(cellUtcIso, startIso)) owners.push(startIso)
    }
    return owners
  }

  modeChanged() {
    this.selected.clear()
    this.refreshHiddenInputs()
    this.syncModeFromForm()
    this.renderMonth()
    this.renderWeek()
    this.updateSelectionCount()
  }

  durationChanged(event) {
    this.syncDurationControls(event?.currentTarget?.value)
    this.selected.clear()
    this.refreshHiddenInputs()
    this.renderWeek()
    this.updateSelectionCount()
  }

  syncModeFromForm() {
    const r = this.form.querySelector('input[name="event[all_day]"]:checked')
    const allDay = !!(r && (r.value === "true" || r.value === "1"))

    this.allDaySectionTarget.classList.toggle("hidden", !allDay)
    this.timedSectionTarget.classList.toggle("hidden", allDay)

    if (this.hasTimedDurationSectionTarget) {
      this.timedDurationSectionTarget.classList.toggle("hidden", allDay)
    }
  }

  prevMonth() {
    this.monthCursor = this.monthCursor.minus({ months: 1 }).startOf("month")
    this.renderMonth()
  }

  nextMonth() {
    this.monthCursor = this.monthCursor.plus({ months: 1 }).startOf("month")
    this.renderMonth()
  }

  prevWeek() {
    this.weekStart = this.weekStart.minus({ days: this.timedDayCount || 7 })
    this.renderWeek()
  }

  nextWeek() {
    this.weekStart = this.weekStart.plus({ days: this.timedDayCount || 7 })
    this.renderWeek()
  }

  renderMonth() {
    const first = this.monthCursor.startOf("month")
    this.monthTitleTarget.textContent = first.setLocale("pt-BR").toFormat("LLLL yyyy")

    const leading = first.weekday === 7 ? 6 : first.weekday - 1
    const daysInMonth = this.monthCursor.daysInMonth

    let html = '<div class="grid grid-cols-7 gap-1 text-center text-xs font-semibold opacity-70 mb-1">'
    WEEKDAY_LABELS.forEach((l) => {
      html += `<div>${l}</div>`
    })
    html += "</div><div class=\"grid grid-cols-7 gap-1\">"

    for (let i = 0; i < leading; i++) {
      html += '<div class="aspect-square"></div>'
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dt = DateTime.fromObject(
        {
          year: this.monthCursor.year,
          month: this.monthCursor.month,
          day,
          hour: 12,
          minute: 0,
          second: 0
        },
        { zone: ZONE }
      )
      const iso = dt.toUTC().toISO()
      const on = this.selected.has(iso)
      const locked = this.isPastAllDayDate(dt) && !on
      const cls = locked
        ? "btn btn-disabled btn-sm aspect-square min-h-0 h-auto py-2 opacity-45"
        : on
          ? "btn btn-primary btn-sm aspect-square min-h-0 h-auto py-2"
          : "btn btn-ghost btn-sm border border-base-300 aspect-square min-h-0 h-auto py-2"
      const disabled = locked ? "disabled" : ""
      html += `<button type="button" class="${cls}" data-action="click->schedule-picker#toggleMonthDay" data-iso="${iso}" ${disabled}>${day}</button>`
    }

    html += "</div>"
    this.monthGridTarget.innerHTML = html
  }

  toggleMonthDay(event) {
    const iso = this.normalizeIso(event.currentTarget.dataset.iso)
    if (!iso) return
    if (this.isPastAllDayDate(DateTime.fromISO(iso, { zone: "utc" }).setZone(ZONE)) && !this.selected.has(iso)) return
    if (this.selected.has(iso)) {
      this.selected.delete(iso)
    } else {
      if (this.selected.size >= this.maxSlotsValue) return
      this.selected.add(iso)
    }
    this.renderMonth()
    this.refreshHiddenInputs()
    this.updateSelectionCount()
  }

  renderWeek() {
    const dayCount = this.timedDayCount || this.visibleTimedDayCount()
    const end = this.weekStart.plus({ days: dayCount - 1 })
    const a = this.weekStart.setLocale("pt-BR").toFormat("dd/MM/yyyy")
    const b = end.setLocale("pt-BR").toFormat("dd/MM/yyyy")
    this.weekTitleTarget.textContent = `${a} – ${b}`
    const slotLanes = this.selectedSlotLanes()
    const slotStyles = this.selectedSlotStyles()

    const hourLabel = this.hourColumnLabelValue
    const rawStart = Number(this.startHourValue)
    const rawEnd = Number(this.endHourValue)
    const startH = Number.isFinite(rawStart) ? Math.max(0, Math.min(23, rawStart)) : 0
    const endH = Number.isFinite(rawEnd) ? Math.max(startH, Math.min(23, rawEnd)) : 23
    const rowCount = (endH - startH) + 1
    const contentHeight = rowCount * TIMED_ROW_HEIGHT_PX
    const visibleSlots = this.visibleTimedSlots(slotLanes, slotStyles, startH, endH, dayCount)
    const calendarMinWidth = dayCount === 1 ? "220px" : dayCount === 3 ? "420px" : "640px"
    const gridTemplate = `4rem repeat(${dayCount}, minmax(0, 1fr))`
    let html = `<div class="calendar-scroll"><div style="min-width:${calendarMinWidth};">`
    html += `<div class="sticky top-0 z-[100] grid border-b border-base-300/70 bg-base-200 shadow-sm" style="grid-template-columns:${gridTemplate};">`
    html += `<div class="calendar-sticky-head calendar-sticky-corner flex items-center px-3 py-2 text-xs font-semibold uppercase tracking-wide text-base-content/70">${hourLabel}</div>`

    for (let c = 0; c < dayCount; c++) {
      const day = this.weekStart.plus({ days: c })
      const weekdayIndex = day.weekday === 7 ? 6 : day.weekday - 1
      const dd = day.toFormat("dd/MM")
      const mon = day.setLocale("pt-BR").toFormat("LLL")
      html += `<div class="calendar-sticky-head border-l border-base-300/60 px-2 py-2 text-center"><div class="font-semibold">${WEEKDAY_LABELS[weekdayIndex]}</div><div class="text-xs font-normal opacity-80">${mon} ${dd}</div></div>`
    }

    html += "</div>"
    html += `<div class="grid" style="grid-template-columns:${gridTemplate};">`
    html += `<div class="relative bg-base-200/55 border-r border-base-300/70" style="height:${contentHeight}px;">`
    html += `<div class="absolute inset-0 grid" style="grid-template-rows:repeat(${rowCount}, ${TIMED_ROW_HEIGHT_PX}px);">`
    for (let hour = startH; hour <= endH; hour++) {
      const rowIndex = hour - startH
      const zebraCls = rowIndex % 2 === 0 ? "bg-base-100/80" : "bg-base-300/70"
      html += `<div class="border-b border-base-300/60 transition-colors ${zebraCls}" data-row-index="${rowIndex}"></div>`
    }
    html += "</div>"
    html += '<div class="relative z-10">'
    for (let hour = startH; hour <= endH; hour++) {
      const rowIndex = hour - startH
      html += `<div class="flex items-center justify-center border-b border-base-300/60 px-2 font-mono text-xs text-base-content/80 transition-colors" data-row-index="${rowIndex}" style="height:${TIMED_ROW_HEIGHT_PX}px;">${this.formatStartHourLabel(hour)}</div>`
    }
    html += "</div></div>"

    for (let col = 0; col < dayCount; col++) {
      html += `<div class="relative border-l border-base-300/60 bg-base-100" style="height:${contentHeight}px;">`
      html += `<div class="absolute inset-0 grid" style="grid-template-rows:repeat(${rowCount}, ${TIMED_ROW_HEIGHT_PX}px);">`
      for (let hour = startH; hour <= endH; hour++) {
        const rowIndex = hour - startH
        const zebraCls = rowIndex % 2 === 0 ? "bg-base-100" : "bg-base-300/45"
        html += `<div class="border-b border-base-300/60 transition-colors ${zebraCls}" data-row-index="${rowIndex}"></div>`
      }
      html += "</div>"
      html += `<div class="absolute inset-0 grid" style="grid-template-rows:repeat(${rowCount}, ${TIMED_ROW_HEIGHT_PX}px);">`

      for (let hour = startH; hour <= endH; hour++) {
        const cell = this.weekStart.plus({ days: col }).set({ hour, minute: 0, second: 0, millisecond: 0 })
        const iso = this.normalizeIso(cell.toUTC().toISO()) || cell.toUTC().toISO()
        const coveringStarts = this.coveringStartIsosForCell(iso)
        const isStart = this.selected.has(iso)
        const locked = this.isPastTimedStart(cell) && !isStart
        const rowIndex = hour - startH
        const titleParts = coveringStarts.map((startIso) => {
          const styleIndex = slotStyles.get(startIso)?.styleIndex ?? 0
          return `${styleIndex + 1}a textura: ${this.formatSlotRangeLabelFromIso(startIso)}`
        })
        const titleAttr = titleParts.length > 0 ? ` title="${titleParts.join(" | ")}"` : ""
        const disabled = locked ? "disabled" : ""
        const buttonCls = locked
          ? "bg-red-500/10 text-base-content/35 cursor-not-allowed"
          : "bg-transparent hover:bg-primary/5"
        const actionAttr = locked
          ? ""
          : ' data-action="mouseenter->schedule-picker#showTimedAddOverlay mouseleave->schedule-picker#hideTimedAddOverlay click->schedule-picker#toggleWeekCell"'
        html += `<button type="button" class="w-full border-b border-base-300/60 text-left transition-colors ${buttonCls}" data-row-index="${rowIndex}" data-iso="${iso}" ${disabled}${titleAttr}${actionAttr}></button>`
      }

      html += "</div>"
      html += '<div class="pointer-events-none absolute inset-0">'

      for (let hour = startH; hour <= endH; hour++) {
        const cell = this.weekStart.plus({ days: col }).set({ hour, minute: 0, second: 0, millisecond: 0 })
        const iso = this.normalizeIso(cell.toUTC().toISO()) || cell.toUTC().toISO()
        const isStart = this.selected.has(iso)
        const locked = this.isPastTimedStart(cell) && !isStart
        const rowIndex = hour - startH

        const top = (hour - startH) * TIMED_ROW_HEIGHT_PX

        if (locked) {
          html += `<div class="timed-slot-blocked-overlay z-20" data-action="mouseenter->schedule-picker#highlightTimedRow mouseleave->schedule-picker#clearTimedRow" data-row-index="${rowIndex}" title="Horario passado indisponivel" style="top:${top}px;height:${TIMED_ROW_HEIGHT_PX}px;"><span class="timed-slot-blocked-overlay-label">×</span></div>`
        } else if (!isStart) {
          const overlayVisibilityClass = this.alwaysShowAddButtons ? " timed-slot-add-overlay-visible" : ""
          html += `<button type="button" class="timed-slot-add-overlay z-20${overlayVisibilityClass}" data-action="mouseenter->schedule-picker#showTimedAddOverlay mouseleave->schedule-picker#hideTimedAddOverlay click->schedule-picker#toggleWeekCell" data-overlay-iso="${iso}" data-row-index="${rowIndex}" data-iso="${iso}" title="Adicionar ${this.formatSlotRangeLabelFromIso(iso)}" style="top:${top}px;height:${TIMED_ROW_HEIGHT_PX}px;"><span class="timed-slot-add-overlay-label">+</span></button>`
        }
      }

      visibleSlots
        .filter((slot) => slot.dayIndex === col)
        .sort((a, b) => a.lane - b.lane)
        .forEach((slot) => {
          const palette = this.slotLayerPalette(slot.styleIndex)
          const leftOffset = 4 + (slot.lane * 12)
          const rowIndex = Math.max(0, Math.round((slot.top - 2) / TIMED_ROW_HEIGHT_PX))
          const rowSpan = Math.max(1, Math.round(slot.height / TIMED_ROW_HEIGHT_PX))
          const blockHighlightHtml = '<div class="timed-slot-block-row-highlight" aria-hidden="true"></div>'
          const labelHtml = slot.firstSegment
            ? `<div class="timed-slot-block-label" style="${palette.labelStyle}">${slot.label}</div>`
            : ""
          html += `<button type="button" class="timed-slot-block absolute z-10 flex flex-col items-start justify-start overflow-hidden rounded-lg border-2 shadow-sm text-left" data-action="mouseenter->schedule-picker#hoverTimedBlock mousemove->schedule-picker#hoverTimedBlock mouseleave->schedule-picker#leaveTimedBlock click->schedule-picker#toggleWeekCell" data-block-day-index="${slot.dayIndex}" data-block-start-row-index="${rowIndex}" data-block-row-span="${rowSpan}" data-iso="${slot.startIso}" title="${slot.label}" style="top:${slot.top}px;left:${leftOffset}px;right:4px;height:${slot.height}px;border-color:#ffffff;${palette.style}">${blockHighlightHtml}${labelHtml}</button>`
        })

      html += "</div></div>"
    }

    html += "</div></div></div>"
    this.weekGridTarget.innerHTML = html
  }

  toggleWeekCell(event) {
    const iso = this.normalizeIso(event.currentTarget.dataset.iso)
    if (!iso) return
    if (this.isPastTimedStart(this.localHourStartFromUtcIso(iso)) && !this.selected.has(iso)) return

    if (this.selected.has(iso)) {
      this.selected.delete(iso)
    } else {
      if (this.selected.size >= this.maxSlotsValue) return
      this.selected.add(iso)
    }
    this.renderWeek()
    this.refreshHiddenInputs()
    this.updateSelectionCount()
  }

  refreshHiddenInputs() {
    this.hiddenInputsTarget.innerHTML = ""
    for (const iso of this.selected) {
      const input = document.createElement("input")
      input.type = "hidden"
      input.name = "event[proposed_slot_timestamps][]"
      input.value = iso
      this.hiddenInputsTarget.appendChild(input)
    }
  }

  updateSelectionCount() {
    if (!this.hasSelectionCountTarget) return
    const tpl = this.selectionTemplateValue || "%{count} de %{max} selecionados"
    this.selectionCountTarget.textContent = tpl
      .replace("%{count}", String(this.selected.size))
      .replace("%{max}", String(this.maxSlotsValue))
  }
}
