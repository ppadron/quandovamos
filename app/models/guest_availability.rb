class GuestAvailability < ApplicationRecord
  belongs_to :guest
  belongs_to :event_slot

  validates :available, inclusion: { in: [ true, false ] }
  validates :event_slot_id, uniqueness: { scope: :guest_id }
end
