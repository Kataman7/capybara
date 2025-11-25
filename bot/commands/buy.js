const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { PRODUCTION_CHAIN } = require('../../productionChain');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('buy')
        .setDescription('Achète automatiquement toutes les améliorations possibles'),

    async execute(interaction, { db }) {
        try {
            await interaction.deferReply();

            let totalPurchases = [];
            let keepBuying = true;

            // Boucle pour acheter en cascade jusqu'à ce qu'on ne puisse plus rien acheter
            while (keepBuying) {
                keepBuying = false;
                
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
                        // Chercher si on a déjà acheté ce niveau
                        const existingPurchase = totalPurchases.find(p => p.level === level.id);
                        if (existingPurchase) {
                            existingPurchase.count += result.bought;
                        } else {
                            totalPurchases.push({ level: level.id, emoji: level.emoji, name: level.name, count: result.bought });
                        }
                        keepBuying = true; // On a acheté quelque chose, on refait un tour
                    }
                }
            }

            if (totalPurchases.length === 0) {
                await interaction.editReply('❌ Aucun achat possible. Tu n\'as pas assez de ressources !');
            } else {
                const purchaseLines = totalPurchases.map(p => `${p.emoji} **${p.name}** x${p.count}`);
                const embed = new EmbedBuilder()
                    .setTitle('✅ Achats effectués !')
                    .setDescription(purchaseLines.join('\n'))
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
