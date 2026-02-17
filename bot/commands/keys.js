const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const { getProducers } = require('../../productionChain');

// Estimate total watermelon production produced in one `applyProduction` cycle
function estimateProductionPerCycle(resources) {
  const copy = Object.assign({}, resources);
  const producers = getProducers().reverse();
  const ALPHA = 0.65;
  const MIN_PRODUCTION_PER_PRODUCER = 1;
  const blessingMultiplier = parseFloat(copy.blessing_multiplier || 1) || 1;

  for (const level of producers) {
    const producerCount = copy[level.id] || 0;
    if (producerCount <= 0) continue;
    const base = (level.produces && level.produces.amount) ? level.produces.amount * Math.pow(producerCount, ALPHA) : 0;
    const baseProduction = Math.max(MIN_PRODUCTION_PER_PRODUCER, base);
    const finalProduction = Math.round(baseProduction * blessingMultiplier);
    copy[level.produces.resource] = (copy[level.produces.resource] || 0) + finalProduction;
  }

  const initial = resources.watermelon_count || 0;
  const after = copy.watermelon_count || 0;
  return Math.max(0, after - initial);
}

// Compute key price using production-per-cycle (linear scaling)
function computeKeyPrice(settings, productionPerCycle) {
  const cfg = (settings && settings.lootbox) || {};
  const basePrice = Number(cfg.purchase_base_price || 10);
  // Use the same config field but divisor tuned for per-cycle numbers
  const divisor = Number(cfg.purchase_scale_divisor || 100) || 100;
  const maxMul = Number(cfg.purchase_max_multiplier || 5);
  const multiplier = Math.min(maxMul, 1 + (productionPerCycle / Math.max(1, divisor)));
  const pricePerKey = Math.max(1, Math.round(basePrice * multiplier));
  return { pricePerKey, multiplier };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('keys')
    .setDescription('Acheter 1 clé de lootbox'),

  async execute(interaction, context) {
    const { db, settings } = context;
    const guildId = interaction.guild.id;
    const discordId = interaction.user.id;

    await interaction.deferReply();
    try {
      const resources = await db.getProduction(guildId, discordId);
      const productionPerCycle = estimateProductionPerCycle(resources);
      const { pricePerKey } = computeKeyPrice(settings, productionPerCycle);
      const available = resources.watermelon_count || 0;

      if (available < pricePerKey) {
        return interaction.editReply({ content: `❌ Tu n\'as pas assez de 🍉 — coût : **${pricePerKey} 🍉**, tu as **${available} 🍉**.` });
      }

      await db.addWatermelon(guildId, discordId, -pricePerKey, true);
      await db.grantLootVoucher(guildId, discordId, 1);

      const newResources = await db.getProduction(guildId, discordId);
      const voucherCount = await db.getLootVouchers(guildId, discordId);

      const embed = new EmbedBuilder()
        .setTitle('🎁 Achat — Clé de lootbox')
        .setDescription(`Tu as acheté **1** clé pour **${pricePerKey} 🍉**.`)
        .addFields(
          { name: '🔑 Clés', value: `${voucherCount}`, inline: true },
          { name: '💸 Coût', value: `${pricePerKey} 🍉`, inline: true },
          { name: '💰 Restant', value: `${newResources.watermelon_count || 0} 🍉`, inline: true }
        )
        .setColor(0xFFD700);

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error('Error in /keys buy:', err);
      try { await interaction.editReply({ content: 'Erreur lors de l\'achat de la clé.' }); } catch (_) {}
    }
  }
};