const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { PRODUCTION_CHAIN } = require('../../productionChain');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('profil')
        .setDescription('Affiche votre profil complet: foi, watermelons et production')
        .addUserOption(opt => opt.setName('user').setDescription('Utilisateur à afficher').setRequired(false)),

    async execute(interaction, context) {
        const { db, settings } = context;
        const user = interaction.options.getUser('user') || interaction.user;
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

            // --- Calcul de la production fournie par les capy (par trigger) ---
            const keys = await db.getLootKeys(interaction.guild.id, user.id) || [];
            const defs = settings.lootbox && settings.lootbox.capybaras || [];
            const triggerTotals = {}; // { auto: X, message: Y, ... }

            for (const k of keys) {
                const def = defs.find(d => d.id === k.capy_id);
                if (!def) continue;
                const count = k.count || 0;
                if (count <= 0) continue;
                const dupBonus = typeof def.duplicate_bonus_pct === 'number' ? def.duplicate_bonus_pct : 0.05;
                const multiplier = 1 + dupBonus * (count - 1);
                const perTrigger = Math.floor((def.autofarm || 0) * count * multiplier);
                const trigger = (def.triggers && def.triggers[0]) ? def.triggers[0] : 'auto';
                triggerTotals[trigger] = (triggerTotals[trigger] || 0) + perTrigger;
            }

            const triggerOrder = ['auto','message','farm','join','voice','slot'];
            const triggerLabels = { auto: 'Auto (horaire)', message: 'Message', farm: 'Farm', join: 'Join', voice: 'Voice', slot: 'Slot' };
            const capyLines = [];
            let capyTotal = 0;
            for (const t of triggerOrder) {
                const v = triggerTotals[t] || 0;
                capyTotal += v;
                capyLines.push(`${triggerLabels[t] || t}: **${v}**`);
            }
            const capyProductionText = capyLines.join(' • ');

            const prestigeLine = `**🏅 Prestige**: ${resources.prestige_count || 0}` + (resources.last_reset_at ? ` (dernier reset: ${new Date(resources.last_reset_at).toLocaleString('fr-FR')})` : '');

            const embed = new EmbedBuilder()
                .setTitle(`📊 Profil de ${user.username}`)
                .addFields(
                    {
                        name: '⭐ Statistiques',
                        value: `**:pray: Foi**: ${faithData.label} (${faithData.faith_level})\n**:seedling: Écologie**: ${faithData.ecology_points} pts\n**📈 Score total**: ${formatNumber(totalScore)} pts\n${prestigeLine}`,
                        inline: false
                    },
                    {
                        name: '🏭 Production',
                        value: productionItems.length > 0 ? productionItems.join('\n') : 'Aucune production',
                        inline: false
                    },
                    {
                        name: '🐾 Production des capy',
                        value: capyTotal > 0 ? `${capyProductionText}\n**Total / activation**: ${formatNumber(capyTotal)}` : 'Aucune production provenant de capy',
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
