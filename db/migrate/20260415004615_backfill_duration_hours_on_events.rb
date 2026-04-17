class BackfillDurationHoursOnEvents < ActiveRecord::Migration[8.0]
  def up
    execute <<~SQL.squish
      UPDATE events SET duration_hours = 1
      WHERE all_day = 0 AND duration_hours IS NULL
    SQL
  end

  def down
  end
end
