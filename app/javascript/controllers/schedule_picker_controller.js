import { Controller } from "@hotwired/stimulus"
import { DateTime } from "luxon"

// Horário de Brasília na interface; valores enviados em ISO UTC.
const ZONE = "America/Sao_Paulo"
const WEEKDAY_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"]

export default class extends Controller {
  static targets = [
    "allDaySection",
    "timedSection",
    "timedDurationSection",
    "hiddenInputs",
    "monthTitle",
    "monthGrid",
    "weekTitle",
    "weekGrid",
    "selectionCount"
  ]

  static values = {
    maxSlots: { type: Number, default: 40 },
    initialSelected: { type: Array, default: [] },
    startHour: { type: Number, default: 0 },
    endHour: { type: Number, default: 23 },
    selectionTemplate: { type: String, default: "%{count} de %{max} selecionados" },
    hourColumnLabel: { type: String, default: "Hora" }
  }

  connect() {
    this.form = this.element.closest("form")
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

    this.renderMonth()
    this.renderWeek()
    this.syncModeFromForm()
    this.refreshHiddenInputs()
    this.updateSelectionCount()
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

  getDurationHours() {
    const el = this.form?.querySelector('select[name="event[duration_hours]"]')
    const n = parseInt(el?.value, 10)
    if (!Number.isFinite(n) || n < 1 || n > 23) return 1
    return n
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

  isCellInSpanOfStart(cellUtcIso, startUtcIso) {
    const duration = this.getDurationHours()
    const start = this.localHourStartFromUtcIso(startUtcIso)
    const cell = this.localHourStartFromUtcIso(cellUtcIso)
    const end = start.plus({ hours: duration })
    return cell >= start && cell < end
  }

  /** @returns {string | null} stored start ISO if this cell belongs to some selected span */
  findOwningStartIsoForCell(cellUtcIso) {
    for (const startIso of this.selected) {
      if (this.isCellInSpanOfStart(cellUtcIso, startIso)) return startIso
    }
    return null
  }

  wouldOverlapProposedStart(newStartUtcIso) {
    const duration = this.getDurationHours()
    const newStart = this.localHourStartFromUtcIso(newStartUtcIso)
    const newEnd = newStart.plus({ hours: duration })
    for (const ex of this.selected) {
      const exStart = this.localHourStartFromUtcIso(ex)
      const exEnd = exStart.plus({ hours: duration })
      if (newStart < exEnd && exStart < newEnd) return true
    }
    return false
  }

  modeChanged() {
    this.selected.clear()
    this.refreshHiddenInputs()
    this.syncModeFromForm()
    this.renderMonth()
    this.renderWeek()
    this.updateSelectionCount()
  }

  durationChanged() {
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
    this.weekStart = this.weekStart.minus({ days: 7 })
    this.renderWeek()
  }

  nextWeek() {
    this.weekStart = this.weekStart.plus({ days: 7 })
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
    const end = this.weekStart.plus({ days: 6 })
    const a = this.weekStart.setLocale("pt-BR").toFormat("dd/MM/yyyy")
    const b = end.setLocale("pt-BR").toFormat("dd/MM/yyyy")
    this.weekTitleTarget.textContent = `${a} – ${b}`

    const hourLabel = this.hourColumnLabelValue
    let html =
      '<div class="overflow-x-auto"><table class="table table-xs sm:table-sm table-bordered w-full min-w-[640px]"><thead><tr><th class="w-16 bg-base-200">' +
      hourLabel +
      "</th>"

    for (let c = 0; c < 7; c++) {
      const day = this.weekStart.plus({ days: c })
      const dd = day.toFormat("dd/MM")
      const mon = day.setLocale("pt-BR").toFormat("LLL")
      html += `<th class="text-center bg-base-200"><div class="font-semibold">${WEEKDAY_LABELS[c]}</div><div class="text-xs font-normal opacity-80">${mon} ${dd}</div></th>`
    }
    html += "</tr></thead><tbody>"

    const rawStart = Number(this.startHourValue)
    const rawEnd = Number(this.endHourValue)
    const startH = Number.isFinite(rawStart) ? Math.max(0, Math.min(23, rawStart)) : 0
    const endH = Number.isFinite(rawEnd) ? Math.max(startH, Math.min(23, rawEnd)) : 23

    for (let hour = startH; hour <= endH; hour++) {
      html += `<tr><td class="bg-base-200 font-mono text-xs whitespace-nowrap">${String(hour).padStart(2, "0")}:00</td>`
      for (let col = 0; col < 7; col++) {
        const cell = this.weekStart.plus({ days: col }).set({ hour, minute: 0, second: 0, millisecond: 0 })
        const iso = this.normalizeIso(cell.toUTC().toISO()) || cell.toUTC().toISO()
        const owningStart = this.findOwningStartIsoForCell(iso)
        const inSpan = !!owningStart
        const locked = this.isPastTimedStart(cell) && !inSpan
        const isStart =
          inSpan &&
          this.localHourStartFromUtcIso(owningStart).equals(this.localHourStartFromUtcIso(iso))

        let cls = "bg-base-100 hover:bg-base-200"
        if (locked) {
          cls = "bg-base-200/70 text-base-content/35"
        } else if (inSpan) {
          cls = isStart
            ? "bg-primary text-primary-content font-semibold"
            : "bg-primary/85 text-primary-content"
        }
        const mark = isStart ? "✓" : ""
        const disabled = locked ? "disabled" : ""
        html += `<td class="p-0"><button type="button" class="w-full h-10 min-h-10 ${cls} border border-base-300 text-xs" data-action="click->schedule-picker#toggleWeekCell" data-iso="${iso}" ${disabled}>${mark}</button></td>`
      }
      html += "</tr>"
    }
    html += "</tbody></table></div>"
    this.weekGridTarget.innerHTML = html
  }

  toggleWeekCell(event) {
    const iso = this.normalizeIso(event.currentTarget.dataset.iso)
    if (!iso) return
    if (this.isPastTimedStart(this.localHourStartFromUtcIso(iso)) && !this.findOwningStartIsoForCell(iso)) return

    const owning = this.findOwningStartIsoForCell(iso)
    if (owning) {
      this.selected.delete(owning)
    } else {
      if (this.selected.size >= this.maxSlotsValue) return
      if (this.wouldOverlapProposedStart(iso)) return
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
