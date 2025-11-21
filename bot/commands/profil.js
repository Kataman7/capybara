const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { PRODUCTION_CHAIN } = require('../../productionChain');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('profil')
        .setDescription('Affiche votre profil complet: foi, watermelons et production'),

    async execute(interaction, { db }) {
        const user = interaction.user;
        try {
            const faithData = await db.getFaith(interaction.guild.id, user.id) || { faith_level: 0, label: db.LEVELS['0'] };
            const resources = await db.getProduction(interaction.guild.id, user.id);

            const fields = [
                {
                    name: '⭐ Foi',
                    value: `**${faithData.label}**\nPalier: \`${faithData.faith_level}\``,
                    inline: false
                }
            ];

            for (const level of PRODUCTION_CHAIN) {
                const count = resources[level.id] || 0;
                if (count > 0 || level.id === 'watermelon_count') {
                    fields.push({
                        name: `${level.emoji} ${level.name}`,
                        value: `${count}`,
                        inline: true
                    });
                }
            }

            const embed = new EmbedBuilder()
                .setTitle(`📊 Profil de ${user.username}`)
                .addFields(fields)
                .setColor(0x00D4FF);

            await interaction.reply({ embeds: [embed] });
        } catch (err) {
            console.error('Error while handling /profil command:', err);
            await interaction.reply({ content: 'Impossible de récupérer les données (erreur serveur).', ephemeral: true });
        }
    }
};

function resourcesLabel(resourceId) {
    const level = PRODUCTION_CHAIN.find(l => l.id === resourceId);
    if (!level) return resourceId;
    return `${level.emoji}`;
}
