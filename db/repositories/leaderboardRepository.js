const { query } = require('../core');
const { calculateProductionScore } = require('./resourceRepository');

async function getWatermelonLeaderboard(guildId, limit = 10) {
  // MySQL doesn't support prepared statement params for LIMIT, so we sanitize and inject directly
  const safeLimit = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));
  const res = await query(`SELECT discord_id, watermelon_count FROM faith_users WHERE guild_id = ? ORDER BY watermelon_count DESC LIMIT ${safeLimit}`, [guildId]);
  return res;
}

// Get leaderboard based on total production value
async function getProductionLeaderboard(guildId, limit = 10) {
  const safeLimit = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));
  const allUsers = await query('SELECT * FROM faith_users WHERE guild_id = ?', [guildId]);
  
  // Calculate score for each user
  const scored = allUsers.map(row => {
    const resources = {
      watermelon_count: row.watermelon_count || 0,
      presse_melon: row.presse_melon || 0,
      jardin_melonifique: row.jardin_melonifique || 0,
      multiplicateur_agricolyte: row.multiplicateur_agricolyte || 0,
      serre_auto_multipliee: row.serre_auto_multipliee || 0,
      usine_hydro_melonique: row.usine_hydro_melonique || 0,
      complexe_agricolo_energetique: row.complexe_agricolo_energetique || 0,
      megastructure_melonospherique: row.megastructure_melonospherique || 0,
      terraformeur_fruito_spherique: row.terraformeur_fruito_spherique || 0,
      architecte_quantique_melon: row.architecte_quantique_melon || 0,
      matrice_originelle_fruits: row.matrice_originelle_fruits || 0,
      coeur_cosmique_watermelon: row.coeur_cosmique_watermelon || 0
    };
    
    return {
      discord_id: row.discord_id,
      faith_level: row.faith_level,
      watermelon_count: row.watermelon_count || 0,
      total_score: calculateProductionScore(resources)
    };
  });
  
  // Sort by total score and limit
  scored.sort((a, b) => b.total_score - a.total_score);
  return scored.slice(0, safeLimit);
}

module.exports = {
    getWatermelonLeaderboard,
    getProductionLeaderboard
};
