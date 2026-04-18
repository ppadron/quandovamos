class InvitesController < ApplicationController
  before_action :set_event

  def show
    @guest = Guest.new
  end

  def create
    @guest = @event.guests.build(invite_guest_params)
    availability = availability_param_hash

    Guest.transaction do
      @guest.save!
      @event.event_slots.each do |slot|
        @guest.guest_availabilities.create!(
          event_slot: slot,
          available: timed_slot_locked?(slot) ? false : truthy?(availability[slot.id.to_s])
        )
      end
    end

    redirect_to edit_guest_path(@guest.update_token),
      notice: t("flashes.invite_saved")
  rescue ActiveRecord::RecordInvalid
    flash.now[:alert] = @guest.errors.full_messages.to_sentence.presence || t("flashes.invite_save_error")
    render :show, status: :unprocessable_entity
  end

  private

  def set_event
    @event = Event.find_by!(invite_token: params[:invite_token])
  end

  def invite_guest_params
    params.require(:guest).permit(:name).tap do |p|
      p[:name] = p[:name].to_s.strip
    end
  end

  def availability_param_hash
    return {} unless params.key?(:availability)

    permitted_keys = @event.event_slots.map { |s| s.id.to_s }
    params.require(:availability).permit(*permitted_keys).to_h
  end

  def truthy?(value)
    ActiveModel::Type::Boolean.new.cast(value)
  end

  def timed_slot_locked?(slot)
    !@event.all_day? && slot.starts_at < Time.current
  end
end
