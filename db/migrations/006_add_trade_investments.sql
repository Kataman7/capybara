CREATE TABLE IF NOT EXISTS trade_investments (
    guild_id VARCHAR(255) NOT NULL,
    discord_id VARCHAR(255) NOT NULL,
    invested_amount INT NOT NULL DEFAULT 0,
    entry_price DECIMAL(20, 10) NOT NULL,
    investment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (guild_id, discord_id)
);
