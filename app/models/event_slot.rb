class EventSlot < ApplicationRecord
  belongs_to :event
  has_many :guest_availabilities, dependent: :destroy

  validates :starts_at, presence: true

  before_validation :anchor_all_day_time

  private

  def anchor_all_day_time
    return unless event&.all_day? && starts_at.present?

    z = starts_at.in_time_zone
    d = z.to_date
    self.starts_at = Time.zone.local(d.year, d.month, d.day, 12, 0, 0)
  end
end
