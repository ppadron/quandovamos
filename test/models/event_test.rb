require "test_helper"

class EventTest < ActiveSupport::TestCase
  test "unanimous slots require every guest to be available" do
    event = Event.new(title: "Trip", all_day: true, description: nil)
    slot_a = event.event_slots.build(starts_at: Time.utc(2026, 6, 1, 12, 0, 0))
    slot_b = event.event_slots.build(starts_at: Time.utc(2026, 6, 2, 12, 0, 0))
    event.save!

    alice = event.guests.create!(name: "Alice")
    bob = event.guests.create!(name: "Bob")

    alice.guest_availabilities.create!(event_slot: slot_a, available: true)
    bob.guest_availabilities.create!(event_slot: slot_a, available: true)

    alice.guest_availabilities.create!(event_slot: slot_b, available: true)
    bob.guest_availabilities.create!(event_slot: slot_b, available: false)

    assert_equal [ slot_a.id ], event.reload.unanimous_slot_ids
    assert_equal [ slot_a.id ], event.unanimous_slots.pluck(:id)
  end

  test "no unanimous slots when there are no guests" do
    event = Event.new(title: "Empty", all_day: false, duration_hours: 1)
    event.event_slots.build(starts_at: Time.utc(2026, 7, 1, 10, 0, 0))
    event.save!

    assert_equal [], event.reload.unanimous_slot_ids
  end

  test "must have at least one slot with a time" do
    event = Event.new(title: "No slots", all_day: false, duration_hours: 2)
    assert_not event.valid?
    assert_includes event.errors[:base], I18n.t("errors.event.must_have_slots")
  end

  test "timed events require duration_hours" do
    event = Event.new(title: "No duration", all_day: false)
    event.event_slots.build(starts_at: Time.utc(2026, 7, 1, 10, 0, 0))
    assert_not event.valid?
    assert_includes event.errors[:duration_hours], I18n.t("errors.event.duration_required")
  end

  test "all day events ignore duration_hours" do
    event = Event.new(title: "Camp", all_day: true, duration_hours: 3)
    event.event_slots.build(starts_at: Time.utc(2026, 7, 1, 12, 0, 0))
    assert event.valid?
    event.save!
    assert_nil event.reload.duration_hours
  end

  test "all day events do not allow past dates" do
    travel_to Time.zone.local(2026, 7, 2, 10, 0, 0) do
      event = Event.new(title: "Camp", all_day: true)
      event.event_slots.build(starts_at: Time.utc(2026, 7, 1, 12, 0, 0))

      assert_not event.valid?
      assert_includes event.errors[:base], I18n.t("errors.event.past_slots_not_allowed")
    end
  end

  test "timed events do not allow past times" do
    travel_to Time.zone.local(2026, 7, 2, 10, 15, 0) do
      event = Event.new(title: "Reunião", all_day: false, duration_hours: 2)
      event.event_slots.build(starts_at: Time.zone.local(2026, 7, 2, 10, 0, 0).utc)

      assert_not event.valid?
      assert_includes event.errors[:base], I18n.t("errors.event.past_slots_not_allowed")
    end
  end
end
