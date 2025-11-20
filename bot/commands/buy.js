const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { PRODUCTION_CHAIN } = require('../../productionChain');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('buy')
        .setDescription('Achète automatiquement toutes les améliorations possibles'),

    async execute(interaction, { db }) {
        try {
            await interaction.deferReply();

            const resources = await db.getProduction(interaction.guild.id, interaction.user.id) || {};
            const purchases = [];

            for (let i = PRODUCTION_CHAIN.length - 1; i >= 0; i--) {
                const level = PRODUCTION_CHAIN[i];
                if (!level.cost) continue;

                const result = await db.buyResource(
                    interaction.guild.id,
                    interaction.user.id,
                    level.id,
                    level.cost.resource,
                    level.cost.amount
                );

                if (result.bought > 0) {
                    purchases.push(`${level.emoji} **${level.name}** x${result.bought}`);
                }

                resources[level.id] = (resources[level.id] || 0) + result.bought;
                resources[level.cost.resource] = result.remaining;
            }

            if (purchases.length === 0) {
                await interaction.editReply('❌ Aucun achat possible. Tu n\'as pas assez de ressources !');
            } else {
                const embed = new EmbedBuilder()
                    .setTitle('✅ Achats effectués !')
                    .setDescription(purchases.join('\n'))
                    .setColor(0x00FF00);
                await interaction.editReply({ embeds: [embed] });
            }
        } catch (err) {
            console.error('Error while buying:', err);
            try {
                await interaction.editReply({ content: 'Erreur lors de l\'achat (erreur serveur).' });
            } catch (_err) {
                await interaction.followUp({ content: 'Erreur lors de l\'achat (erreur serveur).', ephemeral: true });
            }
        }
    }
};
