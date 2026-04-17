class Event < ApplicationRecord
  MAX_SLOTS = 40

  has_many :event_slots, inverse_of: :event, dependent: :destroy
  has_many :guests, dependent: :destroy

  validates :title, presence: true, length: { maximum: 200 }
  validates :invite_token, :organizer_token, presence: true, uniqueness: true
  validates :duration_hours, inclusion: { in: 1..23 }, allow_nil: true
  validate :event_slots_count_within_limit
  validate :must_have_at_least_one_slot
  validate :duration_matches_poll_type
  validate :slots_must_not_be_in_past

  before_validation :generate_tokens, on: :create
  before_validation :clear_duration_when_all_day

  def unanimous_slots
    event_slots.where(id: unanimous_slot_ids).order(:starts_at)
  end

  def unanimous_slot_ids
    return [] if guests.empty?

    event_slots.ids.select do |sid|
      guests.all? { |guest| guest.guest_availabilities.find_by(event_slot_id: sid)&.available? }
    end
  end

  private

  def clear_duration_when_all_day
    self.duration_hours = nil if all_day?
  end

  def duration_matches_poll_type
    return if all_day?

    errors.add(:duration_hours, I18n.t("errors.event.duration_required")) if duration_hours.blank?
  end

  def must_have_at_least_one_slot
    filled = event_slots.reject(&:marked_for_destruction?).count { |s| s.starts_at.present? }
    return if filled.positive?

    errors.add(:base, I18n.t("errors.event.must_have_slots"))
  end

  def slots_must_not_be_in_past
    current_time = Time.current
    current_date = current_time.in_time_zone.to_date

    has_past_slot = event_slots.reject(&:marked_for_destruction?).any? do |slot|
      next false if slot.starts_at.blank?

      if all_day?
        slot.starts_at.in_time_zone.to_date < current_date
      else
        slot.starts_at < current_time
      end
    end

    errors.add(:base, I18n.t("errors.event.past_slots_not_allowed")) if has_past_slot
  end

  def event_slots_count_within_limit
    count = event_slots.reject(&:marked_for_destruction?).size
    return if count <= MAX_SLOTS

    errors.add(:base, I18n.t("errors.event.too_many_slots", max: MAX_SLOTS))
  end

  def generate_tokens
    self.invite_token ||= unique_token(:invite_token)
    self.organizer_token ||= unique_token(:organizer_token)
  end

  def unique_token(column)
    loop do
      token = SecureRandom.urlsafe_base64(24)
      break token unless Event.exists?(column => token)
    end
  end
end
