ALTER TABLE faith_users
  ADD COLUMN prestige_count INT NOT NULL DEFAULT 0 AFTER ecology_points,
  ADD COLUMN last_reset_at TIMESTAMP NULL AFTER prestige_count;