module ApplicationHelper
  def slot_label(event, slot)
    t = slot.starts_at.in_time_zone
    if event.all_day?
      t.strftime("%d/%m/%Y")
    elsif event.duration_hours.present?
      t_end = t + event.duration_hours.hours
      if t.to_date == t_end.to_date
        "#{t.strftime("%d/%m/%Y %H:%M")}–#{t_end.strftime("%H:%M")}"
      else
        "#{t.strftime("%d/%m/%Y %H:%M")}–#{t_end.strftime("%d/%m/%Y %H:%M")}"
      end
    else
      t.strftime("%d/%m/%Y %H:%M")
    end
  end

  def yes_no(value)
    value ? t("common.yes") : t("common.no")
  end

  def format_br_datetime(utc_time)
    utc_time.in_time_zone.strftime("%d/%m/%Y %H:%M")
  end
end
