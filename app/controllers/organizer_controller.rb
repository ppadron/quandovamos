class OrganizerController < ApplicationController
  def show
    @event = Event.find_by!(invite_token: params[:invite_token], organizer_token: params[:organizer_token])
    @guests = @event.guests.includes(guest_availabilities: :event_slot).order(:name)
    @unanimous_slots = @event.unanimous_slots
    @unanimous_slot_id_set = @unanimous_slots.map(&:id).to_set

    @availability_names_by_slot_id = {}
    @guests.each do |guest|
      guest.guest_availabilities.each do |ga|
        next unless ga.available?

        sid = ga.event_slot_id
        (@availability_names_by_slot_id[sid] ||= []) << guest.name
      end
    end
    @availability_names_by_slot_id.transform_values!(&:sort)
  end
end
