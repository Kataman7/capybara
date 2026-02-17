const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

function computeKeyPrice(settings, score) {
  const cfg = (settings && settings.lootbox) || {};
  const basePrice = Number(cfg.purchase_base_price || 10);
  const divisor = Number(cfg.purchase_scale_divisor || 1000000);
  const maxMul = Number(cfg.purchase_max_multiplier || 5);
  const multiplier = Math.min(maxMul, 1 + (score / Math.max(1, divisor)));
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
      const score = db.calculateProductionScore(resources) || 0;
      const { pricePerKey } = computeKeyPrice(settings, score);
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