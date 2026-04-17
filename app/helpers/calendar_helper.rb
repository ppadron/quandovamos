module CalendarHelper
  def calendar_week_rows_for_month(year, month)
    first = Date.new(year, month, 1)
    last = first.end_of_month
    leading = first.cwday - 1
    cells = ([ nil ] * leading) + (first..last).to_a
    cells << nil while cells.size % 7 != 0
    cells.each_slice(7).map(&:to_a)
  end

  def calendar_day_cells_for_month(year, month)
    calendar_week_rows_for_month(year, month).flatten
  end

  def months_covering_event_slots(event)
    slots = event.event_slots
    return [] if slots.empty?

    dates = slots.map { |s| s.starts_at.in_time_zone.to_date }.uniq.sort
    first_month = Date.new(dates.first.year, dates.first.month, 1)
    last_month = Date.new(dates.last.year, dates.last.month, 1)
    months = []
    cur = first_month
    while cur <= last_month
      months << cur
      cur = cur.next_month
    end
    months
  end

  def event_slots_indexed_by_local_date(event)
    event.event_slots.index_by { |s| s.starts_at.in_time_zone.to_date }
  end

  def event_slots_grouped_by_week_monday_local(event)
    event.event_slots.sort_by(&:starts_at).group_by do |s|
      s.starts_at.in_time_zone.to_date.beginning_of_week(:monday)
    end
  end

  def timed_grid_hours
    (0..23).to_a
  end

  # Hour rows for one week of the guest timed grid (only start times are stored per slot).
  def timed_grid_hours_for_week_slots(week_slots)
    return timed_grid_hours if week_slots.blank?

    hours = week_slots.map { |s| s.starts_at.in_time_zone.hour }
    (hours.min..hours.max).to_a
  end

  def calendar_weekday_abbrs
    I18n.t("calendar.weekdays_abbr")
  end
end
