-- Migration 007: Convert resource/amount columns to BIGINT UNSIGNED
-- WARNING: Backup your database before running this change.
-- This migration: clamps negatives to 0 then converts columns to BIGINT UNSIGNED.

USE capybara_db;

-- If any negative values exist for resource columns, set them to 0.
-- NOTE: We intentionally DO NOT clamp or convert `ecology_points` or `blessing_charges`:
--  - `ecology_points` can be negative (pollution penalties), so must remain signed.
--  - `blessing_charges` is a small counter; keep as INT to save space and for simplicity.
UPDATE faith_users SET
  watermelon_count = GREATEST(0, watermelon_count),
  presse_melon = GREATEST(0, presse_melon),
  jardin_melonifique = GREATEST(0, jardin_melonifique),
  multiplicateur_agricolyte = GREATEST(0, multiplicateur_agricolyte),
  serre_auto_multipliee = GREATEST(0, serre_auto_multipliee),
  usine_hydro_melonique = GREATEST(0, usine_hydro_melonique),
  complexe_agricolo_energetique = GREATEST(0, complexe_agricolo_energetique),
  megastructure_melonospherique = GREATEST(0, megastructure_melonospherique),
  terraformeur_fruito_spherique = GREATEST(0, terraformeur_fruito_spherique),
  architecte_quantique_melon = GREATEST(0, architecte_quantique_melon),
  matrice_originelle_fruits = GREATEST(0, matrice_originelle_fruits),
  coeur_cosmique_watermelon = GREATEST(0, coeur_cosmique_watermelon);

-- Clamp trade_investments.invested_amount if negatives exist
UPDATE trade_investments SET invested_amount = GREATEST(0, invested_amount);

-- Convert columns in faith_users to BIGINT UNSIGNED
ALTER TABLE faith_users
  MODIFY COLUMN watermelon_count BIGINT UNSIGNED NOT NULL DEFAULT 0,
  MODIFY COLUMN presse_melon BIGINT UNSIGNED NOT NULL DEFAULT 0,
  MODIFY COLUMN jardin_melonifique BIGINT UNSIGNED NOT NULL DEFAULT 0,
  MODIFY COLUMN multiplicateur_agricolyte BIGINT UNSIGNED NOT NULL DEFAULT 0,
  MODIFY COLUMN serre_auto_multipliee BIGINT UNSIGNED NOT NULL DEFAULT 0,
  MODIFY COLUMN usine_hydro_melonique BIGINT UNSIGNED NOT NULL DEFAULT 0,
  MODIFY COLUMN complexe_agricolo_energetique BIGINT UNSIGNED NOT NULL DEFAULT 0,
  MODIFY COLUMN megastructure_melonospherique BIGINT UNSIGNED NOT NULL DEFAULT 0,
  MODIFY COLUMN terraformeur_fruito_spherique BIGINT UNSIGNED NOT NULL DEFAULT 0,
  MODIFY COLUMN architecte_quantique_melon BIGINT UNSIGNED NOT NULL DEFAULT 0,
  MODIFY COLUMN matrice_originelle_fruits BIGINT UNSIGNED NOT NULL DEFAULT 0,
  MODIFY COLUMN coeur_cosmique_watermelon BIGINT UNSIGNED NOT NULL DEFAULT 0;

-- Note: We do not convert `blessing_charges` and `ecology_points` on purpose:
--  - `ecology_points` can hold negative values and therefore must stay signed (INT).
--  - `blessing_charges` is a small non-negative counter; leaving it as `INT` saves space.

-- Convert invested_amount in trade_investments to BIGINT UNSIGNED
ALTER TABLE trade_investments
  MODIFY COLUMN invested_amount BIGINT UNSIGNED NOT NULL DEFAULT 0;

-- Note: Do not change `id` or `faith_level` (faith_level can be negative)
-- If you use indexes or specific code that assumes INT sizes, please review and update accordingly.
