const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reset')
    .setDescription('Reset (prestige) your production if you reached the threshold'),

  async execute(interaction, context) {
    const { db, settings } = context;
    const guildId = interaction.guild.id;
    const discordId = interaction.user.id;

    await interaction.deferReply({ ephemeral: true });

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
          return ci.reply({ content: 'Ce bouton n\'est pas pour toi.', ephemeral: true });
        }

        await ci.deferUpdate();
        const parts = ci.customId.split(':');
        const action = parts[3];

        if (action === 'no') {
          const disabled = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(yesId).setLabel('Oui — reset').setStyle(ButtonStyle.Danger).setDisabled(true),
            new ButtonBuilder().setCustomId(noId).setLabel('Non — annuler').setStyle(ButtonStyle.Secondary).setDisabled(true)
          );
          await msg.edit({ components: [disabled] });
          await interaction.followUp({ content: 'Reset annulé.', ephemeral: true });
          collector.stop('cancelled');
          return;
        }

        // Perform the reset via repository method (keeps SQL inside DB layer)
        await db.resetProduction(guildId, discordId);

        const disabled = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(yesId).setLabel('Oui — reset').setStyle(ButtonStyle.Danger).setDisabled(true),
          new ButtonBuilder().setCustomId(noId).setLabel('Non — annuler').setStyle(ButtonStyle.Secondary).setDisabled(true)
        );

        await msg.edit({ components: [disabled] });
        await interaction.followUp({ content: `Reset effectué ✅ — ton compteur de prestige a été incrémenté.`, ephemeral: true });

        collector.stop('done');
      });

      collector.on('end', (_collected, reason) => {
        if (reason !== 'done' && reason !== 'cancelled') {
          try {
            msg.edit({ components: [] }).catch(() => {});
            interaction.followUp({ content: 'Temps écoulé — reset annulé.', ephemeral: true }).catch(() => {});
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
