CREATE DATABASE IF NOT EXISTS capybara_db CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
USE capybara_db;

CREATE TABLE IF NOT EXISTS faith_users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  guild_id VARCHAR(32) NOT NULL,
  discord_id VARCHAR(32) NOT NULL,
  faith_level INT DEFAULT 0,
  watermelon_count INT DEFAULT 0,
  presse_melon INT DEFAULT 0,
  jardin_melonifique INT DEFAULT 0,
  multiplicateur_agricolyte INT DEFAULT 0,
  serre_auto_multipliee INT DEFAULT 0,
  usine_hydro_melonique INT DEFAULT 0,
  complexe_agricolo_energetique INT DEFAULT 0,
  megastructure_melonospherique INT DEFAULT 0,
  terraformeur_fruito_spherique INT DEFAULT 0,
  architecte_quantique_melon INT DEFAULT 0,
  matrice_originelle_fruits INT DEFAULT 0,
  coeur_cosmique_watermelon INT DEFAULT 0,
  blessing_multiplier DECIMAL(5,2) NOT NULL DEFAULT 1.00,
  blessing_charges INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_guild_user (guild_id, discord_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
