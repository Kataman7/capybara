const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

function pickCapyFromSettings(settings) {
  const cfg = settings.lootbox && Array.isArray(settings.lootbox.capybaras) ? settings.lootbox.capybaras : [];
  if (!cfg.length) return null;
  const total = cfg.reduce((s, c) => s + (c.weight || 1), 0);
  let r = Math.random() * total;
  for (const c of cfg) {
    r -= (c.weight || 1);
    if (r <= 0) return c.id;
  }
  return cfg[cfg.length - 1].id;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('lootbox')
    .setDescription('Ouvre une lootbox en consommant une clé'),

  async execute(interaction, context) {
    const { db, settings } = context;
    const guildId = interaction.guild.id;
    const discordId = interaction.user.id;

    await interaction.deferReply();
    try {
      const vouchers = await db.getLootVouchers(guildId, discordId);
      if (!vouchers || vouchers <= 0) {
        return interaction.editReply({ content: 'Tu n\'as pas de clés de lootbox à ouvrir.' });
      }

      // consume one voucher
      const consumed = await db.consumeLootVoucher(guildId, discordId, 1);
      if (!consumed) return interaction.editReply({ content: 'Impossible de consommer la clé (peut-être concurrent).' });

      // pick capy and grant ownership
      const capyId = pickCapyFromSettings(settings);
      if (!capyId) return interaction.editReply({ content: 'Aucune capy définie sur ce serveur.' });

      // simple opening animation using embeds
      const defs = settings.lootbox && settings.lootbox.capybaras || [];
      const def = defs.find(d => d.id === capyId) || { name: capyId };

      const anim = new EmbedBuilder()
        .setTitle('🎁 Ouverture de la Lootbox...')
        .setDescription('🔒 Clé insérée \n🔄 Ouverture...')
        .setColor(0xFFD700);

      const msg = await interaction.editReply({ embeds: [anim] });

      await new Promise(r => setTimeout(r, 900));
      anim.setDescription('✨ La boîte s\'ouvre...');
      await interaction.editReply({ embeds: [anim] });

      await new Promise(r => setTimeout(r, 900));
      // Use single backslash to escape backticks inside template literal
      anim.setTitle('🎉 Tu as obtenu une capy !').setDescription(`**${def.name}** \n\`${capyId}\``).setColor(0x00FF99);
      await interaction.editReply({ embeds: [anim] });

      // determine grant amount: small chance for rare/legendary multi-grant
      const roll = Math.random();
      let grantAmount = 1;
      let rarity = 'common';
      // 1% legendary (x10), next 9% rare (x3), otherwise common (x1)
      if (roll < 0.01) { grantAmount = 10; rarity = 'legendary'; }
      else if (roll < 0.10) { grantAmount = 3; rarity = 'rare'; }

      // grant the capy ownership (may increase existing count)
      await db.grantLootKey(guildId, discordId, capyId, grantAmount);

      // final message with a small flavor
      await new Promise(r => setTimeout(r, 400));
      const plural = grantAmount > 1 ? `**${grantAmount}x** ` : '';
      const rarityText = rarity === 'legendary' ? ' 🌟🔱 **LÉGENDAIRE**' : (rarity === 'rare' ? ' ✨ **RARE**' : '');
      await interaction.followUp({ content: `Tu as ouvert une clé et obtenu ${plural}**${def.name}** (${capyId})${rarityText} !` });
    } catch (err) {
      console.error('Error opening lootbox:', err);
      try { await interaction.editReply({ content: 'Erreur lors de l\'ouverture de la lootbox.' }); } catch (_) {}
    }
  }
};
