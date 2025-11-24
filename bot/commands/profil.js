const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { PRODUCTION_CHAIN } = require('../../productionChain');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('profil')
        .setDescription('Affiche votre profil complet: foi, watermelons et production'),

    async execute(interaction, { db }) {
        const user = interaction.user;
        try {
            const faithData = await db.getFaith(interaction.guild.id, user.id) || { faith_level: 0, label: db.LEVELS['0'], ecology_points: 0 };
            const resources = await db.getProduction(interaction.guild.id, user.id);
            const totalScore = db.calculateProductionScore(resources);

            // Séparer les ressources par catégorie
            const productionItems = [];
            for (const level of PRODUCTION_CHAIN) {
                const count = resources[level.id] || 0;
                if (count > 0) {
                    productionItems.push(`${level.emoji} **${level.name}**: ${count}`);
                }
            }

            const embed = new EmbedBuilder()
                .setTitle(`📊 Profil de ${user.username}`)
                .addFields(
                    {
                        name: '⭐ Statistiques',
                        value: `**:pray: Foi**: ${faithData.label} (${faithData.faith_level})\n**:seedling: Écologie**: ${faithData.ecology_points} pts\n**📈 Score total**: ${formatNumber(totalScore)} pts`,
                        inline: false
                    },
                    {
                        name: '🏭 Production',
                        value: productionItems.length > 0 ? productionItems.join('\n') : 'Aucune production',
                        inline: false
                    }
                )
                .setColor(0x00D4FF);

            await interaction.reply({ embeds: [embed] });
        } catch (err) {
            console.error('Error while handling /profil command:', err);
            await interaction.reply({ content: 'Impossible de récupérer les données (erreur serveur).', ephemeral: true });
        }
    }
};

function formatNumber(num) {
    return new Intl.NumberFormat('fr-FR').format(num || 0);
}
