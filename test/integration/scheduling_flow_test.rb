require "test_helper"

class SchedulingFlowTest < ActionDispatch::IntegrationTest
  setup do
    @event = Event.new(title: "Board game night", all_day: false, description: "Bring snacks", duration_hours: 2)
    @slot = @event.event_slots.build(starts_at: Time.utc(2026, 8, 10, 19, 0, 0))
    @event.save!
  end

  test "organizer page rejects wrong organizer token" do
    get organizer_event_path(@event.invite_token, "wrong-token")
    assert_response :not_found
  end

  test "organizer page loads with correct tokens" do
    get organizer_event_path(@event.invite_token, @event.organizer_token)
    assert_response :success
    assert_includes @response.body, @event.title
  end

  test "guest cannot load another guest edit page" do
    guest = @event.guests.create!(name: "Casey")
    guest.guest_availabilities.create!(event_slot: @slot, available: true)

    get edit_guest_path("not-a-real-token")
    assert_response :not_found
  end

  test "creating event from calendar-style timestamps" do
    assert_difference "Event.count", 1 do
      post events_path, params: {
        event: {
          title: "Lunch poll",
          description: "",
          all_day: "false",
          duration_hours: "2",
          proposed_slot_timestamps: [
            "2026-09-01T12:00:00.000Z",
            "2026-09-02T15:00:00.000Z"
          ]
        }
      }
    end

    assert_response :redirect
    event = Event.order(:id).last
    assert_equal "Lunch poll", event.title
    assert_equal 2, event.duration_hours
    assert_equal 2, event.event_slots.count
    assert_includes event.event_slots.pluck(:starts_at), Time.utc(2026, 9, 1, 12, 0, 0)
    assert_includes event.event_slots.pluck(:starts_at), Time.utc(2026, 9, 2, 15, 0, 0)
  end

  test "creating event rejects past timestamps" do
    travel_to Time.zone.local(2026, 9, 2, 16, 0, 0) do
      assert_no_difference "Event.count" do
        post events_path, params: {
          event: {
            title: "Past poll",
            description: "",
            all_day: "false",
            duration_hours: "2",
            proposed_slot_timestamps: [
              "2026-09-02T15:00:00.000Z"
            ]
          }
        }
      end

      assert_response :unprocessable_entity
      assert_includes @response.body, I18n.t("errors.event.past_slots_not_allowed")
    end
  end

  test "invite flow creates guest and availability" do
    assert_difference -> { @event.guests.count }, +1 do
      post invite_path(@event.invite_token), params: {
        guest: { name: "  Dana  " },
        availability: { @slot.id.to_s => "1" }
      }
    end

    assert_redirected_to edit_guest_path(Guest.last.update_token)
    guest = Guest.last
    assert_equal "Dana", guest.name
    assert guest.reload.available_for?(@slot)
  end
end
