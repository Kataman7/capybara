CREATE TABLE IF NOT EXISTS lootbox_keys (
  guild_id VARCHAR(32) NOT NULL,
  discord_id VARCHAR(32) NOT NULL,
  capy_id VARCHAR(64) NOT NULL,
  `count` INT NOT NULL DEFAULT 0,
  PRIMARY KEY (guild_id, discord_id, capy_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
