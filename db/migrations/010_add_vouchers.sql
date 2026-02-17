CREATE TABLE IF NOT EXISTS lootbox_vouchers (
  guild_id VARCHAR(32) NOT NULL,
  discord_id VARCHAR(32) NOT NULL,
  `count` INT NOT NULL DEFAULT 0,
  PRIMARY KEY (guild_id, discord_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
