# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[8.0].define(version: 2026_04_15_004615) do
  create_table "event_slots", force: :cascade do |t|
    t.integer "event_id", null: false
    t.datetime "starts_at", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["event_id"], name: "index_event_slots_on_event_id"
    t.index ["starts_at"], name: "index_event_slots_on_starts_at"
  end

  create_table "events", force: :cascade do |t|
    t.string "title", null: false
    t.text "description"
    t.boolean "all_day", default: false, null: false
    t.string "invite_token", null: false
    t.string "organizer_token", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.integer "duration_hours"
    t.index ["invite_token"], name: "index_events_on_invite_token", unique: true
    t.index ["organizer_token"], name: "index_events_on_organizer_token", unique: true
  end

  create_table "guest_availabilities", force: :cascade do |t|
    t.integer "guest_id", null: false
    t.integer "event_slot_id", null: false
    t.boolean "available", default: false, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["event_slot_id"], name: "index_guest_availabilities_on_event_slot_id"
    t.index ["guest_id", "event_slot_id"], name: "index_guest_availabilities_on_guest_id_and_event_slot_id", unique: true
    t.index ["guest_id"], name: "index_guest_availabilities_on_guest_id"
  end

  create_table "guests", force: :cascade do |t|
    t.integer "event_id", null: false
    t.string "name", null: false
    t.string "update_token"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["event_id"], name: "index_guests_on_event_id"
    t.index ["update_token"], name: "index_guests_on_update_token", unique: true
  end

  add_foreign_key "event_slots", "events"
  add_foreign_key "guest_availabilities", "event_slots"
  add_foreign_key "guest_availabilities", "guests"
  add_foreign_key "guests", "events"
end
