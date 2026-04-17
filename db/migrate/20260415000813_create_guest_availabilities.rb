class CreateGuestAvailabilities < ActiveRecord::Migration[8.0]
  def change
    create_table :guest_availabilities do |t|
      t.references :guest, null: false, foreign_key: true
      t.references :event_slot, null: false, foreign_key: true
      t.boolean :available, null: false, default: false

      t.timestamps
    end
    add_index :guest_availabilities, %i[guest_id event_slot_id], unique: true
  end
end
