USE capybara_db;

ALTER TABLE faith_users
  ADD COLUMN presse_melon INT DEFAULT 0 AFTER watermelon_count,
  ADD COLUMN jardin_melonifique INT DEFAULT 0 AFTER presse_melon,
  ADD COLUMN multiplicateur_agricolyte INT DEFAULT 0 AFTER jardin_melonifique,
  ADD COLUMN serre_auto_multipliee INT DEFAULT 0 AFTER multiplicateur_agricolyte,
  ADD COLUMN usine_hydro_melonique INT DEFAULT 0 AFTER serre_auto_multipliee,
  ADD COLUMN complexe_agricolo_energetique INT DEFAULT 0 AFTER usine_hydro_melonique,
  ADD COLUMN megastructure_melonospherique INT DEFAULT 0 AFTER complexe_agricolo_energetique,
  ADD COLUMN terraformeur_fruito_spherique INT DEFAULT 0 AFTER megastructure_melonospherique,
  ADD COLUMN architecte_quantique_melon INT DEFAULT 0 AFTER terraformeur_fruito_spherique,
  ADD COLUMN matrice_originelle_fruits INT DEFAULT 0 AFTER architecte_quantique_melon,
  ADD COLUMN coeur_cosmique_watermelon INT DEFAULT 0 AFTER matrice_originelle_fruits;
