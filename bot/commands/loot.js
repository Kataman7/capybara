const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('loot')
    .setDescription('Affiche tes capy possédés et le nombre de clés de lootbox'),

  async execute(interaction, context) {
    const { db, settings } = context;
    const guildId = interaction.guild.id;
    const discordId = interaction.user.id;

    // make public
    await interaction.deferReply();

    try {
      const keys = await db.getLootKeys(guildId, discordId);
      const voucherCount = await db.getLootVouchers(guildId, discordId);

      const defs = (settings.lootbox && settings.lootbox.capybaras) || [];
      // Only show owned capy (count > 0)
      const ownedList = keys
        .map(k => {
          const def = defs.find(d => d.id === k.capy_id) || { name: k.capy_id };
          return { id: k.capy_id, name: def.name || k.capy_id, count: k.count };
        })
        .filter(x => x.count > 0)
        .sort((a, b) => b.count - a.count);

      const collectionText = ownedList.length ? ownedList.map(x => {
        const def = defs.find(d => d.id === x.id) || {};
        const trigger = (def.triggers && def.triggers[0]) ? def.triggers[0] : 'auto';
        const dupPct = typeof def.duplicate_bonus_pct === 'number' ? Math.round(def.duplicate_bonus_pct * 100) : Math.round((def.duplicate_bonus_pct || 0.05) * 100);
        const autofarm = def.autofarm || 0;
        return `• **${x.count}x** ${x.name} — +${autofarm} autofarm (déclenche: ${trigger}, +${dupPct}% par copie)`;
      }).join('\n') : 'Aucun capy pour le moment';

      const embed = new EmbedBuilder()
        .setTitle('Tes capybaras <:capy:960978642182242357>')
        .setColor(0x00BFFF)
        .addFields(
          { name: ':key: Clés', value: `${voucherCount}`, inline: true },
          { name: '<:capy_peek:960979572273324044> Collection', value: collectionText, inline: false }
        );

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error('Error in /loot command:', err);
      try { await interaction.editReply({ content: 'Erreur lors de la récupération de ton inventaire.' }); } catch (_) {}
    }
  }
};
