const { query } = require('../core');
const { ensureUser } = require('./userRepository');

async function grantLootKey(guildId, discordId, capyId, amount = 1) {
  await ensureUser(guildId, discordId);
  await query(`INSERT INTO lootbox_keys (guild_id, discord_id, capy_id, ` + '`count`' + `) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE ` + '`count`' + ` = ` + '`count`' + ` + ?`, [guildId, discordId, capyId, amount, amount]);
}

async function getLootKeys(guildId, discordId) {
  const rows = await query('SELECT capy_id, `count` FROM lootbox_keys WHERE guild_id = ? AND discord_id = ?', [guildId, discordId]);
  return rows || [];
}

async function grantLootVoucher(guildId, discordId, amount = 1) {
  await ensureUser(guildId, discordId);
  await query(`INSERT INTO lootbox_vouchers (guild_id, discord_id, ` + '`count`' + `) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE ` + '`count`' + ` = ` + '`count`' + ` + ?`, [guildId, discordId, amount, amount]);
}

async function getLootVouchers(guildId, discordId) {
  const rows = await query('SELECT `count` FROM lootbox_vouchers WHERE guild_id = ? AND discord_id = ?', [guildId, discordId]);
  if (!rows || rows.length === 0) return 0;
  return rows[0]['count'] || 0;
}

async function consumeLootVoucher(guildId, discordId, amount = 1) {
  // decrement if enough vouchers exist, return true if consumed
  const cur = await getLootVouchers(guildId, discordId);
  if (cur < amount) return false;
  await query('UPDATE lootbox_vouchers SET `count` = `count` - ? WHERE guild_id = ? AND discord_id = ?', [amount, guildId, discordId]);
  return true;
}

async function getAllLootKeys() {
  const rows = await query('SELECT guild_id, discord_id, capy_id, `count` FROM lootbox_keys');
  return rows || [];
}

module.exports = {
  grantLootKey,
  getLootKeys,
  getAllLootKeys,
  grantLootVoucher,
  getLootVouchers,
  consumeLootVoucher
};
