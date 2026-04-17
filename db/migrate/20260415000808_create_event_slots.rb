class CreateEventSlots < ActiveRecord::Migration[8.0]
  def change
    create_table :event_slots do |t|
      t.references :event, null: false, foreign_key: true
      t.datetime :starts_at, null: false

      t.timestamps
    end
    add_index :event_slots, :starts_at
  end
end
