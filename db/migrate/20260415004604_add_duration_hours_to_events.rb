class AddDurationHoursToEvents < ActiveRecord::Migration[8.0]
  def change
    add_column :events, :duration_hours, :integer
  end
end
