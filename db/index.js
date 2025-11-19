require('dotenv').config();

const fs = require('fs');

// Try to use mysql2/promise for modern auth and async/await; fall back to legacy `mysql` if not present.
let mysql2;
let mysqlLegacy;
let pool;
let usingMysql2 = false;

try {
  mysql2 = require('mysql2/promise');
  usingMysql2 = true;
} catch (err) {
  try {
    mysqlLegacy = require('mysql');
    usingMysql2 = false;
  } catch (err2) {
    console.error('No mysql2 or mysql module installed. Please install one of them.');
    process.exit(1);
  }
}

const poolConfig = {
  connectionLimit: 10,
  host: process.env.DB_HOST || 'db',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || process.env.DB_ROOT_PASS || '',
  database: process.env.DB_NAME || 'capybara_db',
};

if (usingMysql2) {
  pool = mysql2.createPool(poolConfig);
} else {
  pool = mysqlLegacy.createPool(poolConfig);
}

// Faith level labels are read from `settings.json` (root). The default labels
// have been moved to `settings.example.json` so configuration is centralised.
// Keep a minimal fallback for `0` to avoid breaking callers if the settings file
// doesn't define the mapping yet.
// When running in strict mode we require `faith.levels` to be fully defined in
// the `settings.json` file (root or the path indicated by SETTINGS_FILE). This
// ensures administrators can't accidentally leave the mapping incomplete.
let LEVELS = {};

// Allow overriding level labels via settings.json (path from env is respected)
try {
  // Default settings file is the project root (user requested root-level settings.json)
  const settingsPath = process.env.SETTINGS_FILE || './settings.json';
  if (!fs.existsSync(settingsPath)) {
    console.error(`Missing settings file at ${settingsPath}. Please create it from settings.example.json.`);
    process.exit(1);
  }
  const s = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  if (!s || !s.faith || !s.faith.levels) {
    console.error('settings.json must include `faith.levels` mapping with keys -5..20. See settings.example.json.');
    process.exit(1);
  }
  // Validate that all faith levels -5..20 are present
  const missing = [];
  for (let i = -5; i <= 20; i++) {
    if (!(i.toString() in s.faith.levels)) missing.push(i);
  }
  if (missing.length > 0) {
    console.error(`settings.json is missing faith.levels for the following keys: ${missing.join(', ')}.`);
    process.exit(1);
  }
  // Use labels defined in settings.json (authoritative)
  LEVELS = { ...s.faith.levels };
} catch (err) {
  // ignore
}

async function query(sql, params = []) {
  if (usingMysql2) {
    const [results] = await pool.execute(sql, params);
    return results;
  }

  return new Promise((resolve, reject) => {
    pool.query(sql, params, (err, results) => {
      if (err) return reject(err);
      resolve(results);
    });
  });
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
    updated_at: row.updated_at
  };
}

async function getWatermelon(guildId, discordId) {
  const res = await query('SELECT watermelon_count FROM faith_users WHERE guild_id = ? AND discord_id = ?', [guildId, discordId]);
  if (res.length === 0) return { watermelon_count: 0 };
  return { watermelon_count: res[0].watermelon_count };
}

async function addWatermelon(guildId, discordId, delta) {
  await ensureUser(guildId, discordId);
  delta = parseInt(delta, 10) || 0;
  // clamp delta magnitude so we don't allow huge swings
  const clamped = Math.max(-15, Math.min(15, delta));
  // Update and ensure non-negative total
  await query('UPDATE faith_users SET watermelon_count = GREATEST(0, watermelon_count + ?) WHERE guild_id = ? AND discord_id = ?', [clamped, guildId, discordId]);
  return getWatermelon(guildId, discordId);
}

async function getWatermelonLeaderboard(guildId, limit = 10) {
  // MySQL doesn't support prepared statement params for LIMIT, so we sanitize and inject directly
  const safeLimit = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));
  const res = await query(`SELECT discord_id, watermelon_count FROM faith_users WHERE guild_id = ? ORDER BY watermelon_count DESC LIMIT ${safeLimit}`, [guildId]);
  return res;
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

module.exports = {
  query,
  ensureUser,
  getFaith,
  setFaith,
  addFaith,
  getWatermelon,
  addWatermelon,
  getWatermelonLeaderboard,
  LEVELS,
};
