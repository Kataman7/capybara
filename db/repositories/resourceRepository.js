const { query } = require('../core');
const { ensureUser } = require('./userRepository');
const { PRODUCTION_CHAIN, getProducers } = require('../../productionChain');

async function getWatermelon(guildId, discordId) {
  const res = await query('SELECT watermelon_count FROM faith_users WHERE guild_id = ? AND discord_id = ?', [guildId, discordId]);
  if (res.length === 0) return { watermelon_count: 0 };
  return { watermelon_count: res[0].watermelon_count };
}

async function addWatermelon(guildId, discordId, delta, force = false) {
  await ensureUser(guildId, discordId);
  delta = parseInt(delta, 10) || 0;
  
  let valueToAdd = delta;
  if (!force) {
      // clamp delta magnitude so we don't allow huge swings
      valueToAdd = Math.max(-15, Math.min(15, delta));
  }

  // Update and ensure non-negative total
  await query('UPDATE faith_users SET watermelon_count = GREATEST(0, watermelon_count + ?) WHERE guild_id = ? AND discord_id = ?', [valueToAdd, guildId, discordId]);
  return getWatermelon(guildId, discordId);
}

// Get all production resources for a user
async function getProduction(guildId, discordId) {
  const res = await query('SELECT * FROM faith_users WHERE guild_id = ? AND discord_id = ?', [guildId, discordId]);
  if (res.length === 0) {
    return {
      watermelon_count: 0,
      presse_melon: 0,
      jardin_melonifique: 0,
      multiplicateur_agricolyte: 0,
      serre_auto_multipliee: 0,
      usine_hydro_melonique: 0,
      complexe_agricolo_energetique: 0,
      megastructure_melonospherique: 0,
      terraformeur_fruito_spherique: 0,
      architecte_quantique_melon: 0,
      matrice_originelle_fruits: 0,
      coeur_cosmique_watermelon: 0,
      blessing_multiplier: 1,
      blessing_charges: 0,
      ecology_points: 0,
      prestige_count: 0,
      last_reset_at: null
    };
  }
  const row = res[0];
  return {
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
    coeur_cosmique_watermelon: row.coeur_cosmique_watermelon || 0,
    blessing_multiplier: row.blessing_multiplier || 1,
    blessing_charges: row.blessing_charges || 0,
    ecology_points: row.ecology_points || 0,
    prestige_count: row.prestige_count || 0,
    last_reset_at: row.last_reset_at || null
  };
}

// Update a specific resource
async function updateResource(guildId, discordId, resourceId, newValue) {
  await ensureUser(guildId, discordId);
  const safeValue = Math.max(0, parseInt(newValue, 10) || 0);
  await query(`UPDATE faith_users SET ${resourceId} = ? WHERE guild_id = ? AND discord_id = ?`, [safeValue, guildId, discordId]);
}

// Buy as much as possible of a specific resource
async function buyResource(guildId, discordId, resourceId, costResourceId, costAmount) {
  await ensureUser(guildId, discordId);
  const resources = await getProduction(guildId, discordId);
  const available = resources[costResourceId] || 0;
  const canBuy = Math.floor(available / costAmount);
  
  if (canBuy > 0) {
    const newCostResource = available - (canBuy * costAmount);
    const newTargetResource = (resources[resourceId] || 0) + canBuy;
    
    await query(`UPDATE faith_users SET ${costResourceId} = ?, ${resourceId} = ? WHERE guild_id = ? AND discord_id = ?`, 
      [newCostResource, newTargetResource, guildId, discordId]);
    
    return { bought: canBuy, remaining: newCostResource };
  }
  
  return { bought: 0, remaining: available };
}

// Apply production from all producers (called after successful farm)
async function applyProduction(guildId, discordId) {
  await ensureUser(guildId, discordId);
  const resources = await getProduction(guildId, discordId);
  
  // Get blessing multiplier
  const blessingMultiplier = parseFloat(resources.blessing_multiplier) || 1;
  // Apply production in cascade (from highest to lowest)
  // Use concave production to avoid exponential explosion.
  // finalProduction = produces.amount * (producerCount ^ alpha) * blessingMultiplier
  // alpha in (0,1) => diminishing returns. We also add a small floor so single producers still produce.
  const producers = getProducers().reverse();
  const ALPHA = 0.65; // tuning parameter: lower -> stronger diminishing returns
  const MIN_PRODUCTION_PER_PRODUCER = 1; // ensure at least minimal yield per producer when count >=1
  for (const level of producers) {
    const producerCount = resources[level.id] || 0;
    if (producerCount > 0) {
      // Concave growth
      const base = level.produces.amount * Math.pow(producerCount, ALPHA);
      const baseProduction = Math.max(MIN_PRODUCTION_PER_PRODUCER, base);
      const finalProduction = Math.round(baseProduction * blessingMultiplier);
      resources[level.produces.resource] = (resources[level.produces.resource] || 0) + finalProduction;
    }
  }
  
  // Update all resources in one query
  await query(`UPDATE faith_users SET 
    watermelon_count = ?,
    presse_melon = ?,
    jardin_melonifique = ?,
    multiplicateur_agricolyte = ?,
    serre_auto_multipliee = ?,
    usine_hydro_melonique = ?,
    complexe_agricolo_energetique = ?,
    megastructure_melonospherique = ?,
    terraformeur_fruito_spherique = ?,
    architecte_quantique_melon = ?,
    matrice_originelle_fruits = ?,
    coeur_cosmique_watermelon = ?
    WHERE guild_id = ? AND discord_id = ?`, [
    resources.watermelon_count,
    resources.presse_melon,
    resources.jardin_melonifique,
    resources.multiplicateur_agricolyte,
    resources.serre_auto_multipliee,
    resources.usine_hydro_melonique,
    resources.complexe_agricolo_energetique,
    resources.megastructure_melonospherique,
    resources.terraformeur_fruito_spherique,
    resources.architecte_quantique_melon,
    resources.matrice_originelle_fruits,
    resources.coeur_cosmique_watermelon,
    guildId,
    discordId
  ]);
  
  return resources;
}

// Calculate total production score (convert everything to watermelon equivalent)
function calculateProductionScore(resources) {
  // Compute a more robust score with diminishing returns so high-tier counts
  // don't explode the score. We use a log-weighted contribution per level.
  let score = resources.watermelon_count || 0;

  // Tuning: use a softened product-of-costs to produce large but controlled weights.
  // We compute the product of costs up to each level, then take a fractional power (GAMMA)
  // to reduce exponential growth while preserving order-of-magnitude differences.
  // Example: GAMMA=0.45 tends to make a single top-level unit worth several millions.
  const GLOBAL_SCORE_SCALE = 1.0; // adjust globally if needed
  const GAMMA = 0.45; // in (0,1): lower -> more compression

  let runningMultiplier = 1;
  for (let i = 1; i < PRODUCTION_CHAIN.length; i++) {
    const level = PRODUCTION_CHAIN[i];
    // multiply by cost for this level (use amount or 1 if missing)
    const costAmount = (level.cost && level.cost.amount) ? level.cost.amount : 1;
    runningMultiplier *= costAmount;

    const count = resources[level.id] || 0;
    if (!count || count <= 0) continue;

    // soften the multiplier by taking a fractional power
    const softened = Math.pow(runningMultiplier, GAMMA);

    // contribution scales linearly with count but the multiplier is softened
    score += count * softened * GLOBAL_SCORE_SCALE;
  }

  // Round to integer for compatibility with existing code
  return Math.round(score);
}

// Perform a prestige/reset: zero production and watermelon_count, increment prestige_count and set last_reset_at
async function resetProduction(guildId, discordId) {
  await ensureUser(guildId, discordId);
  const sql = `UPDATE faith_users SET
    watermelon_count = 0,
    presse_melon = 0,
    jardin_melonifique = 0,
    multiplicateur_agricolyte = 0,
    serre_auto_multipliee = 0,
    usine_hydro_melonique = 0,
    complexe_agricolo_energetique = 0,
    megastructure_melonospherique = 0,
    terraformeur_fruito_spherique = 0,
    architecte_quantique_melon = 0,
    matrice_originelle_fruits = 0,
    coeur_cosmique_watermelon = 0,
    prestige_count = prestige_count + 1,
    last_reset_at = NOW()
    WHERE guild_id = ? AND discord_id = ?`;

  await query(sql, [guildId, discordId]);

  // Return the updated production row
  return getProduction(guildId, discordId);
}

module.exports = {
    getWatermelon,
    addWatermelon,
    getProduction,
    updateResource,
    buyResource,
    applyProduction,
  calculateProductionScore,
  resetProduction
};
