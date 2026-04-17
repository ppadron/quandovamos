class CreateEvents < ActiveRecord::Migration[8.0]
  def change
    create_table :events do |t|
      t.string :title, null: false
      t.text :description
      t.boolean :all_day, null: false, default: false
      t.string :invite_token, null: false
      t.string :organizer_token, null: false

      t.timestamps
    end
    add_index :events, :invite_token, unique: true
    add_index :events, :organizer_token, unique: true
  end
end
