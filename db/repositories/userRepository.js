const { query } = require('../core');
const fs = require('fs');

// Faith level labels are read from `settings.json` (root).
let LEVELS = {};

// Allow overriding level labels via settings.json (path from env is respected)
try {
  const settingsPath = process.env.SETTINGS_FILE || './settings.json';
  if (fs.existsSync(settingsPath)) {
    const s = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    if (s && s.faith && s.faith.levels) {
      LEVELS = { ...s.faith.levels };
    }
  }
} catch (err) {
  // ignore
}

async function ensureUser(guildId, discordId) {
  const res = await query('SELECT * FROM faith_users WHERE guild_id = ? AND discord_id = ?', [guildId, discordId]);
  if (res.length === 0) {
    await query('INSERT INTO faith_users (guild_id, discord_id, faith_level) VALUES (?, ?, ?)', [guildId, discordId, 0]);
    return { guild_id: guildId, discord_id: discordId, faith_level: 0 };
  }
  return res[0];
}

async function getFaith(guildId, discordId) {
  const res = await query('SELECT * FROM faith_users WHERE guild_id = ? AND discord_id = ?', [guildId, discordId]);
  if (res.length === 0) return null;
  const row = res[0];
  return {
    id: row.id,
    guild_id: row.guild_id,
    discord_id: row.discord_id,
    faith_level: row.faith_level,
    label: LEVELS[row.faith_level],
    watermelon_count: row.watermelon_count || 0,
    blessing_multiplier: row.blessing_multiplier || 1,
    blessing_charges: row.blessing_charges || 0,
    ecology_points: row.ecology_points || 0,
    updated_at: row.updated_at
  };
}

async function setFaith(guildId, discordId, newFaith) {
  // clamp
  if (newFaith > 20) newFaith = 20;
  if (newFaith < -5) newFaith = -5;
  await ensureUser(guildId, discordId);
  await query('UPDATE faith_users SET faith_level = ? WHERE guild_id = ? AND discord_id = ?', [newFaith, guildId, discordId]);
  return getFaith(guildId, discordId);
}

async function addFaith(guildId, discordId, delta) {
  await ensureUser(guildId, discordId);
  const cur = await getFaith(guildId, discordId);
  // Normalize delta so faith changes are limited to -1, 0 or +1 regardless of input.
  const normalizedDelta = Math.max(-1, Math.min(1, delta));
  const newVal = Math.max(-5, Math.min(20, cur.faith_level + normalizedDelta));
  await query('UPDATE faith_users SET faith_level = ? WHERE guild_id = ? AND discord_id = ?', [newVal, guildId, discordId]);
  return getFaith(guildId, discordId);
}

async function addEcologyPoints(guildId, discordId, delta) {
  await ensureUser(guildId, discordId);
  delta = parseInt(delta, 10) || 0;
  // Clamp delta between -10 and +10
  const clamped = Math.max(-10, Math.min(10, delta));
  await query('UPDATE faith_users SET ecology_points = ecology_points + ? WHERE guild_id = ? AND discord_id = ?', [clamped, guildId, discordId]);
  return getFaith(guildId, discordId);
}

module.exports = {
    ensureUser,
    getFaith,
    setFaith,
    addFaith,
    addEcologyPoints,
    LEVELS
};
