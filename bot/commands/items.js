const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { PRODUCTION_CHAIN } = require('../../productionChain');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('items')
        .setDescription('Affiche toutes les ressources achetables et leurs coûts'),

    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setTitle('📦 Objets et améliorations disponibles')
            .setDescription('Chaque niveau convertit automatiquement le niveau inférieur après un farm réussi.');

        PRODUCTION_CHAIN.forEach(level => {
            const costText = level.cost
                ? `Coût: ${level.cost.amount} ${getResourceLabel(level.cost.resource)}`
                : 'Ressource de base';
            const productionText = level.produces
                ? `Produit: ${level.produces.amount} ${getResourceLabel(level.produces.resource)} / cycle`
                : 'Produit directement des 🍉';
            embed.addFields({
                name: `${level.emoji} ${level.name}`,
                value: `${costText}\n${productionText}`,
                inline: true
            });
        });

        await interaction.reply({ embeds: [embed] });
    }
};

function getResourceLabel(resourceId) {
    const lvl = PRODUCTION_CHAIN.find(entry => entry.id === resourceId);
    if (!lvl) return resourceId;
    return `${lvl.emoji} ${lvl.name}`;
}
