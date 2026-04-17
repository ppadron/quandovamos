class CreateGuests < ActiveRecord::Migration[8.0]
  def change
    create_table :guests do |t|
      t.references :event, null: false, foreign_key: true
      t.string :name, null: false
      t.string :update_token

      t.timestamps
    end
    add_index :guests, :update_token, unique: true
  end
end
