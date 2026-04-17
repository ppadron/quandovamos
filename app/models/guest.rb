class Guest < ApplicationRecord
  MAX_NAME_LENGTH = 100

  belongs_to :event
  has_many :guest_availabilities, dependent: :destroy

  validates :name, presence: true, length: { maximum: MAX_NAME_LENGTH }

  before_validation :generate_update_token, on: :create

  def availability_for(slot)
    guest_availabilities.find_by(event_slot: slot)
  end

  def available_for?(slot)
    availability_for(slot)&.available?
  end

  private

  def generate_update_token
    self.update_token ||= loop do
      token = SecureRandom.urlsafe_base64(24)
      break token unless Guest.exists?(update_token: token)
    end
  end
end
