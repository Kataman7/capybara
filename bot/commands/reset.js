const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

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
    .setName('reset')
    .setDescription('Reset (prestige) your production if you reached the threshold'),

  async execute(interaction, context) {
    const { db, settings } = context;
    const guildId = interaction.guild.id;
    const discordId = interaction.user.id;

    // make replies public (not ephemeral)
    await interaction.deferReply();

    try {
      const resources = await db.getProduction(guildId, discordId);
      const currentScore = db.calculateProductionScore(resources);

      // Threshold from settings (fallback to 10M)
      const RESET_THRESHOLD = (settings && settings.game && parseInt(settings.game.reset_threshold, 10)) || 10000000;

      if (currentScore < RESET_THRESHOLD) {
        return interaction.editReply({ content: `Ton score est de ${currentScore.toLocaleString('fr-FR')} pts — il faut au moins ${RESET_THRESHOLD.toLocaleString('fr-FR')} pts pour effectuer un reset.` });
      }

      const embed = new EmbedBuilder()
        .setTitle('Confirmation de reset')
        .setDescription(`Ton score actuel est de **${currentScore.toLocaleString('fr-FR')}** pts.

Le reset remettra à zéro tes productions et pastèques (tu pourras conserver d'autres valeurs si on change la logique). En échange, ton compteur de prestige sera incrémenté. Es-tu sûr·e de vouloir continuer ?`);

      const yesId = `reset_confirm:${guildId}:${discordId}:yes:${Date.now()}`;
      const noId = `reset_confirm:${guildId}:${discordId}:no:${Date.now()}`;
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(yesId).setLabel('Oui — reset').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(noId).setLabel('Non — annuler').setStyle(ButtonStyle.Secondary)
      );

      const msg = await interaction.editReply({ embeds: [embed], components: [row] });

      const collector = msg.createMessageComponentCollector({ time: 2 * 60 * 1000 });

      collector.on('collect', async (ci) => {
        if (ci.user.id !== discordId) {
          return ci.reply({ content: 'Ce bouton n\'est pas pour toi.' , ephemeral: true });
        }

        await ci.deferUpdate();
        const parts = ci.customId.split(':');
        const action = parts[3];

        if (action === 'no') {
          const disabled = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(yesId).setLabel('Oui — reset').setStyle(ButtonStyle.Danger).setDisabled(true),
            new ButtonBuilder().setCustomId(noId).setLabel('Non — annuler').setStyle(ButtonStyle.Secondary).setDisabled(true)
          );
          try {
            await msg.edit({ components: [disabled] });
          } catch (e) {
            // ignore Unknown Message (10008) and continue
            if (!(e && e.code === 10008)) console.error('msg.edit error:', e);
          }
          await interaction.followUp({ content: 'Reset annulé.' });
          collector.stop('cancelled');
          return;
        }

        // Perform the reset via repository method (keeps SQL inside DB layer)
        await db.resetProduction(guildId, discordId);

        // Grant lootbox vouchers on reset (to be opened later)
        try {
          // support configurable random range: reset_grant_min / reset_grant_max (fallback to default_grant_on_reset)
          let grantCount = 1;
          if (settings.lootbox) {
            const cfg = settings.lootbox;
            if (typeof cfg.reset_grant_min === 'number' || typeof cfg.reset_grant_max === 'number') {
              const min = parseInt(cfg.reset_grant_min || 1, 10);
              const max = parseInt(cfg.reset_grant_max || (cfg.default_grant_on_reset || 1), 10);
              const lo = Math.min(min, max);
              const hi = Math.max(min, max);
              grantCount = Math.floor(Math.random() * (hi - lo + 1)) + lo;
            } else {
              grantCount = cfg.default_grant_on_reset ? parseInt(cfg.default_grant_on_reset, 10) : 1;
            }
          }

          if (grantCount > 0) await db.grantLootVoucher(guildId, discordId, grantCount);
          if (grantCount > 0) {
            await interaction.followUp({ content: `Tu as reçu **${grantCount}** clé(s) de lootbox à ouvrir avec "/lootbox".` });
          }
        } catch (err) {
          console.error('Error granting loot vouchers on reset:', err);
        }

        const disabled = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(yesId).setLabel('Oui — reset').setStyle(ButtonStyle.Danger).setDisabled(true),
          new ButtonBuilder().setCustomId(noId).setLabel('Non — annuler').setStyle(ButtonStyle.Secondary).setDisabled(true)
        );

        try {
          await msg.edit({ components: [disabled] });
        } catch (e) {
          if (!(e && e.code === 10008)) console.error('msg.edit error:', e);
        }
        await interaction.followUp({ content: `Reset effectué ✅ — ton compteur de prestige a été incrémenté.` });

        collector.stop('done');
      });

      collector.on('end', async (_collected, reason) => {
        if (reason !== 'done' && reason !== 'cancelled') {
          try {
            try { await msg.edit({ components: [] }); } catch(_) {}
            try { await interaction.followUp({ content: 'Temps écoulé — reset annulé.' }); } catch (_) {}
          } catch (err) {
            // ignore
          }
        }
      });

    } catch (err) {
      console.error('Reset command error:', err);
      try {
        await interaction.editReply({ content: 'Erreur lors du reset (erreur serveur).' });
      } catch (_) {
        await interaction.followUp({ content: 'Erreur lors du reset (erreur serveur).', ephemeral: true });
      }
    }
  }
};
