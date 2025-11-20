ALTER TABLE faith_users
    ADD COLUMN blessing_multiplier DECIMAL(5,2) NOT NULL DEFAULT 1.00 AFTER coeur_cosmique_watermelon,
    ADD COLUMN blessing_charges INT NOT NULL DEFAULT 0 AFTER blessing_multiplier;
