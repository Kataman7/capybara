const { query } = require('../core');
const { ensureUser } = require('./userRepository');

async function createInvestment(guildId, discordId, amount, price) {
  await ensureUser(guildId, discordId);
  await query(
    'INSERT INTO trade_investments (guild_id, discord_id, invested_amount, entry_price) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE invested_amount = ?, entry_price = ?, investment_date = CURRENT_TIMESTAMP',
    [guildId, discordId, amount, price, amount, price]
  );
  return getInvestment(guildId, discordId);
}

async function getInvestment(guildId, discordId) {
  const res = await query('SELECT * FROM trade_investments WHERE guild_id = ? AND discord_id = ?', [guildId, discordId]);
  if (res.length === 0) return null;
  return res[0];
}

async function removeInvestment(guildId, discordId) {
  await query('DELETE FROM trade_investments WHERE guild_id = ? AND discord_id = ?', [guildId, discordId]);
}

module.exports = {
    createInvestment,
    getInvestment,
    removeInvestment
};
