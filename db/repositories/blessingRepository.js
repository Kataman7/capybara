const { query } = require('../core');
const { ensureUser } = require('./userRepository');

async function grantBlessing(guildId, discordId, multiplier, charges) {
  await ensureUser(guildId, discordId);
  const safeMultiplier = Math.max(1, Math.min(5, parseFloat(multiplier) || 1));
  const safeCharges = Math.max(0, Math.min(10, parseInt(charges, 10) || 0));
  await query('UPDATE faith_users SET blessing_multiplier = ?, blessing_charges = ? WHERE guild_id = ? AND discord_id = ?', [safeMultiplier, safeCharges, guildId, discordId]);
  return { blessing_multiplier: safeMultiplier, blessing_charges: safeCharges };
}

async function consumeBlessingCharge(guildId, discordId) {
  await ensureUser(guildId, discordId);
  const res = await query('SELECT blessing_multiplier, blessing_charges FROM faith_users WHERE guild_id = ? AND discord_id = ?', [guildId, discordId]);
  if (res.length === 0) return { blessing_multiplier: 1, blessing_charges: 0 };
  const currentMultiplier = res[0].blessing_multiplier || 1;
  let charges = Math.max(0, (res[0].blessing_charges || 0) - 1);
  const multiplier = charges > 0 ? currentMultiplier : 1;
  await query('UPDATE faith_users SET blessing_multiplier = ?, blessing_charges = ? WHERE guild_id = ? AND discord_id = ?', [multiplier, charges, guildId, discordId]);
  return { blessing_multiplier: multiplier, blessing_charges: charges };
}

module.exports = {
    grantBlessing,
    consumeBlessingCharge
};
