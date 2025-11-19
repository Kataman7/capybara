USE capybara_db;

ALTER TABLE faith_users
  ADD COLUMN watermelon_count INT DEFAULT 0 AFTER faith_level;