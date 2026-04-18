class GuestsController < ApplicationController
  before_action :set_guest

  def edit
    @event = @guest.event
  end

  def update
    @event = @guest.event

    availability = availability_param_hash

    Guest.transaction do
      @guest.update!(guest_update_params)
      @event.event_slots.each do |slot|
        ga = @guest.guest_availabilities.find_or_initialize_by(event_slot: slot)
        available = if timed_slot_locked?(slot)
          ga.available?
        else
          truthy?(availability[slot.id.to_s])
        end
        ga.update!(available: available)
      end
    end

    redirect_to edit_guest_path(@guest.update_token), notice: t("flashes.guest_updated")
  rescue ActiveRecord::RecordInvalid
    flash.now[:alert] = @guest.errors.full_messages.to_sentence.presence || t("flashes.guest_save_error")
    render :edit, status: :unprocessable_entity
  end

  private

  def set_guest
    @guest = Guest.find_by!(update_token: params[:update_token])
  end

  def guest_update_params
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
