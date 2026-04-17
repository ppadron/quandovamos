class EventsController < ApplicationController
  def new
    @event = Event.new(all_day: false, duration_hours: 2)
    @initial_proposed = []
  end

  def create
    event_attrs = params.require(:event).permit(:title, :description, :all_day, :duration_hours)
    timestamps = Array(params.dig(:event, :proposed_slot_timestamps)).compact_blank

    @event = Event.new(event_attrs)
    append_unique_slots_from_timestamps!(@event, timestamps)

    if @event.save
      redirect_to organizer_event_path(@event.invite_token, @event.organizer_token),
        notice: t("flashes.event_created")
    else
      @initial_proposed = @event.event_slots.map { |s| s.starts_at.utc.iso8601 }
      render :new, status: :unprocessable_entity
    end
  end

  private

  def append_unique_slots_from_timestamps!(event, strings)
    seen = {}
    strings.first(Event::MAX_SLOTS).each do |raw|
      t = parse_proposed_timestamp(raw)
      next unless t

      key = t.to_i
      next if seen[key]

      seen[key] = true
      event.event_slots.build(starts_at: t)
    end
  end

  def parse_proposed_timestamp(raw)
    return if raw.blank?

    Time.iso8601(raw.to_s).utc
  rescue ArgumentError
    Time.zone.parse(raw.to_s)&.utc
  end
end
